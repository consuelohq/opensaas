import { createHash } from 'node:crypto';
import type { IncomingMessage, Server as HttpServer } from 'http';

import * as Sentry from '@sentry/node';
import {
  AgentService,
  createCoachingDetector,
  createTranscriptContext,
} from '@consuelo/agent';
import type {
  ActiveCallState,
  AgentConfig,
  AgentContext,
  AgentMessage,
  PiSession,
  PiStreamEvent,
} from '@consuelo/agent';
import { createLogger } from '@consuelo/logger';
import type OpenAI from 'openai';

import { errorHandler } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getSharedPool } from '../shared/db.js';
import { trackLLMUsage } from '../services/posthog.js';
import type { AuthContext } from '../types.js';
import type { RouteDefinition } from './index.js';

const routeLogger = createLogger('api:coaching');

let CoachModule: typeof import('@consuelo/coaching') | null = null;
const getCoachModule = async () => {
  try {
    if (!CoachModule) {
      CoachModule = await import('@consuelo/coaching');
    }

    return CoachModule;
  } catch (error: unknown) {
    Sentry.captureException(error);
    throw error;
  }
};

interface CoachBody {
  messages?: Array<{ role: string; content: string }>;
  contextChunks?: string[];
  callId?: string;
}

interface RefreshBody {
  callId?: string;
}

interface AccessTokenPayload {
  sub: string;
  type: string;
  userId: string;
  workspaceId: string;
  workspaceMemberId?: string;
  userWorkspaceId: string;
}

interface TranscriptEntry {
  id: string;
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: number;
  confidence: number;
}

interface TalkingPoints {
  product_or_option_name: string | null;
  details: string[];
  clarifying_questions: string[];
  objection_responses: Array<{ objection: string; response: string }>;
}

interface TranscriptSnapshotMessage {
  type: 'snapshot';
  entries: TranscriptEntry[];
  talkingPoints: TalkingPoints | null;
}

interface TranscriptBroadcastMessage {
  type: 'transcript';
  entry: TranscriptEntry;
}

interface CoachingBroadcastMessage {
  type: 'coaching';
  talkingPoints: TalkingPoints;
}

interface CoachingErrorBroadcastMessage {
  type: 'coaching_error';
  message: string;
  rawText?: string;
}

type CoachingStreamMessage =
  | TranscriptSnapshotMessage
  | TranscriptBroadcastMessage
  | CoachingBroadcastMessage
  | CoachingErrorBroadcastMessage;

interface WebSocketClient {
  readyState: number;
  send: (data: string) => void;
  close: () => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
}

type CallTranscriptRuntime = {
  entries: TranscriptEntry[];
  talkingPoints: TalkingPoints | null;
  loadedFromDatabase: boolean;
  lastCoachingAt: number;
  lastCoachingWordCount: number;
  generating: boolean;
  queued: boolean;
  workspaceId: string | null;
};

type CallContextRow = {
  contact_id?: string | null;
  contact_name?: string | null;
};

type RuntimeTranscriptRow = {
  transcript?: unknown;
  workspace_id?: string | null;
};

const LLM_TIMEOUT_MS = 30_000;
const TRANSCRIBE_INTERVAL_MS = 3_000;
const MIN_COACHING_REFRESH_INTERVAL_MS = 5_000;
const MIN_TRANSCRIPT_WORDS_FOR_COACHING = 8;
const MIN_NEW_WORDS_FOR_REFRESH = 20;
const MAX_TRANSCRIPT_ENTRIES_IN_PROMPT = 24;
const SQL_GET_TRANSCRIPT_BY_CALL_SID =
  'SELECT transcript, workspace_id::text AS workspace_id FROM calls WHERE call_sid = $1 AND workspace_id = $2 LIMIT 1';
const SQL_GET_WORKSPACE_ID_BY_CALL_SID =
  'SELECT workspace_id::text AS workspace_id FROM calls WHERE call_sid = $1 LIMIT 1';
const SQL_VALIDATE_CALL_IN_WORKSPACE =
  'SELECT 1 FROM calls WHERE call_sid = $1 AND workspace_id = $2 LIMIT 1';
const SQL_APPEND_TRANSCRIPT_ENTRY =
  "UPDATE calls SET transcript = COALESCE(transcript, '[]'::jsonb) || $3::jsonb, updated_at = NOW() WHERE call_sid = $1 AND workspace_id = $2";
const SQL_GET_CALL_CONTEXT_BY_CALL_SID =
  'SELECT c.contact_id::text AS contact_id, ct.name AS contact_name FROM calls c LEFT JOIN contacts ct ON c.contact_id = ct.id WHERE c.call_sid = $1 AND c.workspace_id = $2 LIMIT 1';

const getPool = getSharedPool;
const clientsByCall = new Map<string, Set<WebSocketClient>>();
const runtimeByCall = new Map<string, CallTranscriptRuntime>();
const runtimeLoadersByCall = new Map<string, Promise<CallTranscriptRuntime>>();
const entryCountersByCall = new Map<string, number>();
const mediaConnectionsByCall = new Map<string, number>();

const cleanupCallState = (callId: string): void => {
  runtimeByCall.delete(callId);
  runtimeLoadersByCall.delete(callId);
  entryCountersByCall.delete(callId);
};

const incrementMediaConnectionCount = (callId: string): void => {
  mediaConnectionsByCall.set(
    callId,
    (mediaConnectionsByCall.get(callId) ?? 0) + 1,
  );
};

const decrementMediaConnectionCount = (callId: string): void => {
  const nextCount = (mediaConnectionsByCall.get(callId) ?? 0) - 1;
  if (nextCount > 0) {
    mediaConnectionsByCall.set(callId, nextCount);
    return;
  }

  mediaConnectionsByCall.delete(callId);
  if ((clientsByCall.get(callId)?.size ?? 0) === 0) {
    cleanupCallState(callId);
  }
};

const withTimeout = <TResult>(
  promise: Promise<TResult>,
  timeoutMs: number,
): Promise<TResult> =>
  Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];

const normalizeTalkingPoints = (value: unknown): TalkingPoints => {
  const base: TalkingPoints = {
    product_or_option_name: null,
    details: [],
    clarifying_questions: [],
    objection_responses: [],
  };

  if (!isRecord(value)) {
    return base;
  }

  const product =
    typeof value.product_or_option_name === 'string'
      ? value.product_or_option_name
      : null;

  const objectionResponses = Array.isArray(value.objection_responses)
    ? value.objection_responses
        .map((entry) => {
          if (!isRecord(entry)) {
            return null;
          }

          const objection =
            typeof entry.objection === 'string' ? entry.objection : null;
          const response =
            typeof entry.response === 'string' ? entry.response : null;

          if (!objection || !response) {
            return null;
          }

          return { objection, response };
        })
        .filter(
          (entry): entry is { objection: string; response: string } =>
            entry !== null,
        )
    : [];

  return {
    product_or_option_name: product,
    details: toStringArray(value.details),
    clarifying_questions: toStringArray(value.clarifying_questions),
    objection_responses: objectionResponses,
  };
};

const deriveSecret = (
  appSecret: string,
  workspaceId: string,
  tokenType: string,
): string =>
  createHash('sha256')
    .update(`${appSecret}${workspaceId}${tokenType}`)
    .digest('hex');

const getHeaderValue = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? '') : (value ?? '');

const buildUpgradeUrl = (request: IncomingMessage): string => {
  const protocol =
    getHeaderValue(request.headers['x-forwarded-proto']) || 'https';
  const host = getHeaderValue(request.headers.host);

  return `${protocol}://${host}${request.url ?? ''}`;
};

const validateStreamToken = async (
  token: string | null,
): Promise<AuthContext | null> => {
  const appSecret = process.env.APP_SECRET;
  if (!token || !appSecret) {
    return null;
  }

  try {
    const jwtModule = await import('jsonwebtoken');
    const jwtDecode =
      jwtModule.decode ??
      (jwtModule as unknown as { default: typeof import('jsonwebtoken') })
        .default.decode;
    const jwtVerify =
      jwtModule.verify ??
      (jwtModule as unknown as { default: typeof import('jsonwebtoken') })
        .default.verify;

    const decoded = jwtDecode(token) as AccessTokenPayload | null;
    if (!decoded || decoded.type !== 'ACCESS' || !decoded.workspaceId) {
      return null;
    }

    const secret = deriveSecret(appSecret, decoded.workspaceId, decoded.type);
    jwtVerify(token, secret, { algorithms: ['HS256'] });

    return {
      userId: decoded.userId,
      workspaceId: decoded.workspaceId,
      workspaceMemberId: decoded.workspaceMemberId,
      userWorkspaceId: decoded.userWorkspaceId,
    };
  } catch (error: unknown) {
    routeLogger.error('[Coaching] websocket token validation failed', {
      error: error instanceof Error ? error.message : 'unknown error',
    });
    return null;
  }
};

const validateMediaUpgradeRequest = async (
  request: IncomingMessage,
): Promise<boolean> => {
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
  const signature = getHeaderValue(request.headers['x-twilio-signature']);
  const upgradeUrl = buildUpgradeUrl(request);
  const callId = new URL(upgradeUrl).searchParams.get('callId');
  if (!authToken || !signature || !callId) {
    return false;
  }

  try {
    const twilio = await import('twilio');
    return twilio.default.validateRequest(authToken, signature, upgradeUrl, {});
  } catch (error: unknown) {
    routeLogger.error(
      '[Coaching] media websocket signature validation failed',
      {
        error: error instanceof Error ? error.message : 'unknown error',
      },
    );
    return false;
  }
};

const createRuntime = (): CallTranscriptRuntime => ({
  entries: [],
  talkingPoints: null,
  loadedFromDatabase: false,
  lastCoachingAt: 0,
  lastCoachingWordCount: 0,
  generating: false,
  queued: false,
  workspaceId: null,
});

const getOrCreateRuntime = (callId: string): CallTranscriptRuntime => {
  const existing = runtimeByCall.get(callId);
  if (existing) {
    return existing;
  }

  const runtime = createRuntime();
  runtimeByCall.set(callId, runtime);
  return runtime;
};

const resolveWorkspaceIdForCall = async (
  callId: string,
): Promise<string | null> => {
  try {
    const pool = await getPool();
    const { rows } = await pool.query(SQL_GET_WORKSPACE_ID_BY_CALL_SID, [
      callId,
    ]);

    return typeof rows[0]?.workspace_id === 'string'
      ? rows[0].workspace_id
      : null;
  } catch (error: unknown) {
    Sentry.captureException(error);
    throw error;
  }
};

const callBelongsToWorkspace = async (
  callId: string,
  workspaceId: string,
): Promise<boolean> => {
  try {
    const pool = await getPool();
    const { rows } = await pool.query(SQL_VALIDATE_CALL_IN_WORKSPACE, [
      callId,
      workspaceId,
    ]);

    return rows.length > 0;
  } catch (error: unknown) {
    Sentry.captureException(error);
    throw error;
  }
};

const countWords = (entries: TranscriptEntry[]): number =>
  entries.reduce(
    (sum, entry) =>
      sum + entry.text.split(/\s+/).filter((word) => word.length > 0).length,
    0,
  );

const getRuntime = async (
  callId: string,
  workspaceId?: string,
): Promise<CallTranscriptRuntime> => {
  try {
    const runtime = getOrCreateRuntime(callId);
    if (workspaceId) {
      if (runtime.workspaceId && runtime.workspaceId !== workspaceId) {
        throw new Error(`workspace mismatch for call ${callId}`);
      }
      runtime.workspaceId = workspaceId;
    }

    if (runtime.loadedFromDatabase) {
      return runtime;
    }

    const existingLoader = runtimeLoadersByCall.get(callId);
    if (existingLoader) {
      return await existingLoader;
    }

    const loader = (async (): Promise<CallTranscriptRuntime> => {
      try {
        const resolvedWorkspaceId =
          runtime.workspaceId ?? (await resolveWorkspaceIdForCall(callId));

        if (!resolvedWorkspaceId) {
          runtime.loadedFromDatabase = true;
          runtime.lastCoachingWordCount = countWords(runtime.entries);
          routeLogger.warn('[Coaching] workspace not found for call runtime', {
            callId,
          });
          return runtime;
        }

        const pool = await getPool();
        const { rows } = await pool.query(SQL_GET_TRANSCRIPT_BY_CALL_SID, [
          callId,
          resolvedWorkspaceId,
        ]);
        const row = rows[0] as RuntimeTranscriptRow | undefined;
        const transcriptValue = row?.transcript;

        runtime.entries = Array.isArray(transcriptValue)
          ? transcriptValue
              .map((entry) => coerceTranscriptEntry(entry))
              .filter((entry): entry is TranscriptEntry => entry !== null)
          : [];
        runtime.workspaceId = resolvedWorkspaceId;
        runtime.loadedFromDatabase = true;
        runtime.lastCoachingWordCount = countWords(runtime.entries);

        return runtime;
      } catch (error: unknown) {
        Sentry.captureException(error);
        throw error;
      }
    })().finally(() => {
      runtimeLoadersByCall.delete(callId);
    });

    runtimeLoadersByCall.set(callId, loader);
    return await loader;
  } catch (error: unknown) {
    Sentry.captureException(error);
    throw error;
  }
};

const coerceTranscriptEntry = (value: unknown): TranscriptEntry | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === 'string' ? value.id : null;
  const speaker =
    value.speaker === 'agent'
      ? 'agent'
      : value.speaker === 'customer'
        ? 'customer'
        : null;
  const text = typeof value.text === 'string' ? value.text : null;
  const timestamp =
    typeof value.timestamp === 'number' ? value.timestamp : null;
  const confidence =
    typeof value.confidence === 'number' ? value.confidence : 0.9;

  if (!id || !speaker || !text || timestamp === null) {
    return null;
  }

  return { id, speaker, text, timestamp, confidence };
};

const getGroqChatClient = async (): Promise<OpenAI> => {
  try {
    const { default: OpenAIClient } = await import('openai');
    return new OpenAIClient({
      apiKey: process.env.GROQ_API_KEY ?? '',
      baseURL: 'https://api.groq.com/openai/v1',
    });
  } catch (error: unknown) {
    Sentry.captureException(error);
    throw error;
  }
};

const createCoachingPiSession = (): PiSession => ({
  async *prompt(
    message: string,
    options?: { signal?: AbortSignal; model?: string },
  ): AsyncIterable<PiStreamEvent> {
    const client = await getGroqChatClient();
    const response = await withTimeout(
      client.chat.completions.create(
        {
          model: options?.model ?? 'openai/gpt-oss-120b',
          messages: [{ role: 'user', content: message }],
          temperature: 0.3,
          max_tokens: 900,
          response_format: { type: 'json_object' },
        },
        { signal: options?.signal },
      ),
      LLM_TIMEOUT_MS,
    );

    const content = response.choices[0]?.message?.content ?? '';
    if (content.length > 0) {
      yield { type: 'text_delta', text: content };
    }

    if (response.usage) {
      yield {
        type: 'usage',
        inputTokens: response.usage.prompt_tokens ?? 0,
        outputTokens: response.usage.completion_tokens ?? 0,
      };
    }

    yield { type: 'done' };
  },
});

const buildActiveCallState = async (
  callId: string,
  workspaceId: string | null,
): Promise<ActiveCallState> => {
  try {
    if (!workspaceId) {
      return {
        callSid: callId,
        contactId: '',
        contactName: 'unknown contact',
        direction: 'outbound',
        startedAt: new Date(),
        recentNotes: [],
        durationSeconds: 0,
      };
    }

    const pool = await getPool();
    const { rows } = await pool.query(SQL_GET_CALL_CONTEXT_BY_CALL_SID, [
      callId,
      workspaceId,
    ]);
    const row = (rows[0] ?? {}) as CallContextRow;

    return {
      callSid: callId,
      contactId: row.contact_id ?? '',
      contactName: row.contact_name ?? 'unknown contact',
      direction: 'outbound',
      startedAt: new Date(),
      recentNotes: [],
      durationSeconds: 0,
    };
  } catch (error: unknown) {
    Sentry.captureException(error);
    throw error;
  }
};

const buildCoachingAgent = async (
  callId: string,
  runtime: CallTranscriptRuntime,
): Promise<AgentService> => {
  try {
    const activeCall = await buildActiveCallState(callId, runtime.workspaceId);
    const context: AgentContext = {
      userId: 'coaching-system',
      workspaceId: runtime.workspaceId ?? 'coaching-system',
      activeCall,
      recentActivity: [],
      connectedIntegrations: [],
      memories: [],
    };
    const config: AgentConfig = {
      systemPrompt:
        'You are a live sales coaching agent. Return valid JSON only.',
      model: 'openai/gpt-oss-120b',
      provider: 'groq',
      maxTokens: 900,
      temperature: 0.3,
    };

    return new AgentService({
      config,
      context,
      session: createCoachingPiSession(),
      beforeTurnExtensions: [
        createTranscriptContext(() => ({
          callSid: callId,
          entries: runtime.entries.slice(-MAX_TRANSCRIPT_ENTRIES_IN_PROMPT),
        })),
        createCoachingDetector(() => activeCall),
      ],
    });
  } catch (error: unknown) {
    Sentry.captureException(error);
    throw error;
  }
};

const sendToClients = (
  callId: string,
  message: CoachingStreamMessage,
): void => {
  const clients = clientsByCall.get(callId);
  if (!clients) {
    return;
  }

  const payload = JSON.stringify(message);
  for (const client of clients) {
    try {
      if (client.readyState === 1) {
        client.send(payload);
      }
    } catch (error: unknown) {
      Sentry.captureException(error);
    }
  }
};

const sendSnapshot = async (
  client: WebSocketClient,
  callId: string,
  workspaceId: string,
): Promise<void> => {
  try {
    const runtime = await getRuntime(callId, workspaceId);
    client.send(
      JSON.stringify({
        type: 'snapshot',
        entries: runtime.entries,
        talkingPoints: runtime.talkingPoints,
      } satisfies TranscriptSnapshotMessage),
    );
  } catch (error: unknown) {
    Sentry.captureException(error);
    throw error;
  }
};

export const broadcastTranscript = (
  callId: string,
  entry: TranscriptEntry,
): void => {
  sendToClients(callId, { type: 'transcript', entry });
};

const broadcastTalkingPoints = (
  callId: string,
  talkingPoints: TalkingPoints,
): void => {
  sendToClients(callId, { type: 'coaching', talkingPoints });
};

const broadcastCoachingError = (
  callId: string,
  message: string,
  rawText?: string,
): void => {
  sendToClients(callId, { type: 'coaching_error', message, rawText });
};

const persistTranscriptEntry = async (
  callId: string,
  workspaceId: string,
  entry: TranscriptEntry,
): Promise<boolean> => {
  try {
    const pool = await getPool();
    const result = await pool.query(SQL_APPEND_TRANSCRIPT_ENTRY, [
      callId,
      workspaceId,
      JSON.stringify([entry]),
    ]);

    if (result.rowCount === 0) {
      routeLogger.warn('[Coaching] transcript append affected 0 rows', {
        callId,
        workspaceId,
        entryId: entry.id,
      });
      Sentry.captureMessage('[Coaching] transcript append affected 0 rows', {
        level: 'warning',
        extra: { callId, workspaceId, entryId: entry.id },
      });
      return false;
    }

    return true;
  } catch (error: unknown) {
    Sentry.captureException(error);
    throw error;
  }
};

const shouldRefreshCoaching = (
  runtime: CallTranscriptRuntime,
  force: boolean,
): boolean => {
  if (force) {
    return runtime.entries.length > 0;
  }

  const totalWords = countWords(runtime.entries);
  if (totalWords < MIN_TRANSCRIPT_WORDS_FOR_COACHING) {
    return false;
  }

  if (runtime.talkingPoints === null) {
    return true;
  }

  const enoughTimeElapsed =
    Date.now() - runtime.lastCoachingAt >= MIN_COACHING_REFRESH_INTERVAL_MS;
  const enoughNewWords =
    totalWords - runtime.lastCoachingWordCount >= MIN_NEW_WORDS_FOR_REFRESH;

  return enoughTimeElapsed && enoughNewWords;
};

const runPiCoaching = async (
  callId: string,
  force = false,
  workspaceId?: string,
): Promise<TalkingPoints | null> => {
  const runtime = await getRuntime(callId, workspaceId);
  if (!shouldRefreshCoaching(runtime, force)) {
    return runtime.talkingPoints;
  }

  if (runtime.generating) {
    runtime.queued = true;
    return runtime.talkingPoints;
  }

  runtime.generating = true;
  let usage: { inputTokens: number; outputTokens: number } | null = null;
  const startedAt = Date.now();

  try {
    const agent = await buildCoachingAgent(callId, runtime);
    let text = '';

    for await (const event of agent.chat({
      messages: [
        {
          role: 'user' as const,
          content: 'generate the next live coaching update for the active call',
        },
      ],
      conversationId: `live-coaching-${callId}`,
      isCoaching: true,
      model: 'openai/gpt-oss-120b',
    })) {
      if (event.type === 'text_delta') {
        text += event.text;
      }

      if (event.type === 'usage') {
        usage = {
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
        };
      }
    }

    let talkingPoints: TalkingPoints;
    try {
      talkingPoints = normalizeTalkingPoints(JSON.parse(text));
    } catch (error: unknown) {
      const rawTextSnippet = text.slice(0, 500);
      runtime.lastCoachingAt = Date.now();
      runtime.lastCoachingWordCount = countWords(runtime.entries);
      routeLogger.error('[Coaching] invalid coaching payload', {
        callId,
        error: error instanceof Error ? error.message : 'unknown error',
        rawTextSnippet,
      });
      broadcastCoachingError(
        callId,
        'Invalid coaching payload',
        rawTextSnippet,
      );
      if (runtime.talkingPoints === null) {
        runtime.talkingPoints = normalizeTalkingPoints(null);
      }
      return runtime.talkingPoints;
    }

    runtime.talkingPoints = talkingPoints;
    runtime.lastCoachingAt = Date.now();
    runtime.lastCoachingWordCount = countWords(runtime.entries);
    broadcastTalkingPoints(callId, talkingPoints);

    void trackLLMUsage({
      userId: 'coaching-system',
      model: 'openai/gpt-oss-120b',
      provider: 'groq',
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      latencyMs: Date.now() - startedAt,
      endpoint: '/v1/coaching/refresh',
    });

    return talkingPoints;
  } catch (error: unknown) {
    Sentry.captureException(error);
    routeLogger.error('[Coaching] pi coaching refresh failed', {
      callId,
      error: error instanceof Error ? error.message : 'unknown error',
    });
    return runtime.talkingPoints;
  } finally {
    runtime.generating = false;
    if (runtime.queued) {
      runtime.queued = false;
      void runPiCoaching(callId, false, workspaceId);
    }
  }
};

const appendTranscriptEntry = async (
  callId: string,
  entry: TranscriptEntry,
  workspaceId?: string,
): Promise<void> => {
  const runtime = await getRuntime(callId, workspaceId);
  runtime.entries = [...runtime.entries, entry];

  if (!runtime.workspaceId) {
    routeLogger.warn(
      '[Coaching] skipped transcript persistence without workspace',
      {
        callId,
      },
    );
    broadcastTranscript(callId, entry);
    void runPiCoaching(callId, false, workspaceId);
    return;
  }

  try {
    const persisted = await persistTranscriptEntry(
      callId,
      runtime.workspaceId,
      entry,
    );
    if (!persisted) {
      runtime.entries = runtime.entries.filter(
        (existingEntry) => existingEntry.id !== entry.id,
      );
      return;
    }
  } catch (error: unknown) {
    Sentry.captureException(error);
    runtime.entries = runtime.entries.filter(
      (existingEntry) => existingEntry.id !== entry.id,
    );
    routeLogger.error('[Coaching] transcript persistence failed', {
      callId,
      error: error instanceof Error ? error.message : 'unknown error',
    });
    return;
  }

  broadcastTranscript(callId, entry);
  void runPiCoaching(callId, false, workspaceId);
};

const getLegacyCoach = async () => {
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not configured');
    }

    const coachingModule = await getCoachModule();
    return new coachingModule.Coach({ apiKey: process.env.GROQ_API_KEY });
  } catch (error: unknown) {
    Sentry.captureException(error);
    throw error;
  }
};

const handleCoachingRefreshRequest = async (
  req: { body?: unknown; auth?: AuthContext },
  res: {
    status: (code: number) => { json: (data: unknown) => void };
  },
): Promise<void> => {
  try {
    const auth = requireAuth(
      req as Parameters<typeof requireAuth>[0],
      res as Parameters<typeof requireAuth>[1],
    );
    if (auth === null) {
      return;
    }

    const body = req.body as RefreshBody | CoachBody | undefined;
    if (!body?.callId) {
      res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Missing "callId"' },
      });
      return;
    }

    if (!(await callBelongsToWorkspace(body.callId, auth.workspaceId))) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Call not found' },
      });
      return;
    }

    const talkingPoints = await runPiCoaching(
      body.callId,
      true,
      auth.workspaceId,
    );
    res.status(200).json({ data: talkingPoints });
  } catch (error: unknown) {
    Sentry.captureException(error);
    throw error;
  }
};

export const coachingRoutes = (): RouteDefinition[] => [
  {
    method: 'POST',
    path: '/v1/coaching',
    handler: errorHandler(async (req, res) => {
      const auth = requireAuth(req, res);
      if (auth === null) return;

      const body = req.body as CoachBody | undefined;
      if (typeof body?.callId === 'string' && body.callId.length > 0) {
        if (!(await callBelongsToWorkspace(body.callId, auth.workspaceId))) {
          res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'Call not found' },
          });
          return;
        }

        const talkingPoints = await runPiCoaching(
          body.callId,
          true,
          auth.workspaceId,
        );
        res.status(200).json({ data: talkingPoints });
        return;
      }

      if (!body?.messages?.length) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing "messages" array or "callId"',
          },
        });
        return;
      }

      try {
        const coach = await getLegacyCoach();
        const messages = body.messages.map((message) => ({
          role: message.role === 'customer' ? 'customer' : 'sales_rep',
          content: message.content,
        }));
        const startedAt = Date.now();
        const result = await withTimeout(
          coach.coach(messages as Parameters<typeof coach.coach>[0], {
            contextChunks: body.contextChunks,
          }),
          LLM_TIMEOUT_MS,
        );

        void trackLLMUsage({
          userId: auth.userId,
          model: 'openai/gpt-oss-120b',
          provider: 'groq',
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - startedAt,
          endpoint: '/v1/coaching',
        });

        res.status(200).json({ data: normalizeTalkingPoints(result) });
      } catch (error: unknown) {
        Sentry.captureException(error);
        const message =
          error instanceof Error ? error.message : 'coaching request failed';
        res.status(500).json({ error: { code: 'COACHING_FAILED', message } });
      }
    }),
  },
  {
    method: 'POST',
    path: '/v1/coaching/realtime',
    handler: errorHandler(async (req, res) => {
      // deprecated: keep this route for backward compatibility while delegating
      // to the shared refresh handler used by /v1/coaching/refresh.
      await handleCoachingRefreshRequest(req, res);
    }),
  },
  {
    method: 'POST',
    path: '/v1/coaching/refresh',
    handler: errorHandler(async (req, res) => {
      await handleCoachingRefreshRequest(req, res);
    }),
  },
];

export const setupCoachingWebSocket = async (
  server: HttpServer,
): Promise<void> => {
  try {
    const { WebSocketServer } = await import('ws');
    const streamWss = new WebSocketServer({ noServer: true });
    const mediaWss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      void (async () => {
        const url = new URL(request.url ?? '', 'http://localhost');

        try {
          if (url.pathname === '/v1/coaching/stream') {
            const auth = await validateStreamToken(
              url.searchParams.get('token'),
            );
            const callId = url.searchParams.get('callId');
            if (
              !auth ||
              !callId ||
              !(await callBelongsToWorkspace(callId, auth.workspaceId))
            ) {
              socket.destroy();
              return;
            }

            (request as IncomingMessage & { auth?: AuthContext }).auth = auth;
            streamWss.handleUpgrade(request, socket, head, (ws) => {
              streamWss.emit('connection', ws, request);
            });
            return;
          }

          if (url.pathname === '/v1/coaching/media') {
            const isValidMediaUpgrade =
              await validateMediaUpgradeRequest(request);
            if (!isValidMediaUpgrade) {
              socket.destroy();
              return;
            }

            mediaWss.handleUpgrade(request, socket, head, (ws) => {
              mediaWss.emit('connection', ws, request);
            });
          }
        } catch (error: unknown) {
          routeLogger.error('[Coaching] websocket upgrade rejected', {
            path: url.pathname,
            error: error instanceof Error ? error.message : 'unknown error',
          });
          socket.destroy();
        }
      })();
    });

    streamWss.on(
      'connection',
      (
        ws: unknown,
        req: IncomingMessage & { url?: string; auth?: AuthContext },
      ) => {
        const client = ws as WebSocketClient;
        const url = new URL(req.url ?? '', 'http://localhost');
        const callId = url.searchParams.get('callId');
        const auth = req.auth;
        if (!callId || !auth) {
          client.close();
          return;
        }

        if (!clientsByCall.has(callId)) {
          clientsByCall.set(callId, new Set());
        }
        clientsByCall.get(callId)?.add(client);
        void sendSnapshot(client, callId, auth.workspaceId);

        client.on('close', () => {
          clientsByCall.get(callId)?.delete(client);
          if (clientsByCall.get(callId)?.size === 0) {
            clientsByCall.delete(callId);
            if ((mediaConnectionsByCall.get(callId) ?? 0) === 0) {
              cleanupCallState(callId);
            }
          }
        });
      },
    );

    mediaWss.on('connection', (ws: unknown, req: { url?: string }) => {
      const client = ws as WebSocketClient;
      const url = new URL(req.url ?? '', 'http://localhost');
      let callId: string | null = url.searchParams.get('callId');
      let registeredMediaCallId: string | null = callId;
      if (registeredMediaCallId) {
        incrementMediaConnectionCount(registeredMediaCallId);
      }
      const transcriptionAbortController = new AbortController();
      const audioBuffers: Record<'inbound' | 'outbound', Buffer[]> = {
        inbound: [],
        outbound: [],
      };

      const getEntryCounter = (nextCallId: string): number => {
        const current = entryCountersByCall.get(nextCallId) ?? 0;
        const next = current + 1;
        entryCountersByCall.set(nextCallId, next);
        return next;
      };

      const transcribeBuffer = async (track: 'inbound' | 'outbound') => {
        if (!callId || transcriptionAbortController.signal.aborted) {
          return;
        }

        const buffer = audioBuffers[track];
        if (buffer.length === 0) {
          return;
        }

        const currentCallId = callId;
        const runtime = await getRuntime(currentCallId);
        if (
          !runtime.workspaceId ||
          transcriptionAbortController.signal.aborted
        ) {
          return;
        }

        const chunks = buffer.splice(0);
        const combined = Buffer.concat(chunks);

        try {
          const groqClient = await getGroqChatClient();
          const wavHeader = buildWavHeader(combined.length);
          const wavBuffer = Buffer.concat([wavHeader, combined]);
          const file = new File([wavBuffer], 'audio.wav', {
            type: 'audio/wav',
          });
          const transcription = await withTimeout(
            groqClient.audio.transcriptions.create(
              {
                model: 'whisper-large-v3-turbo',
                file,
              },
              { signal: transcriptionAbortController.signal },
            ),
            LLM_TIMEOUT_MS,
          );

          if (
            transcriptionAbortController.signal.aborted ||
            !transcription.text?.trim()
          ) {
            return;
          }

          const entryCounter = getEntryCounter(currentCallId);
          const entry: TranscriptEntry = {
            id: `${currentCallId}-${entryCounter}`,
            speaker: track === 'inbound' ? 'customer' : 'agent',
            text: transcription.text.trim(),
            timestamp: Date.now(),
            confidence: 0.9,
          };
          await appendTranscriptEntry(
            currentCallId,
            entry,
            runtime.workspaceId,
          );
        } catch (error: unknown) {
          if (
            transcriptionAbortController.signal.aborted ||
            (error instanceof Error && error.name === 'AbortError')
          ) {
            return;
          }

          Sentry.captureException(error);
          routeLogger.error('[Coaching] transcription failed', {
            callId: currentCallId,
            track,
            error: error instanceof Error ? error.message : 'unknown error',
          });
        }
      };

      const timer = setInterval(() => {
        void transcribeBuffer('inbound');
        void transcribeBuffer('outbound');
      }, TRANSCRIBE_INTERVAL_MS);

      client.on('message', (...args: unknown[]) => {
        const [rawData] = args;
        if (!Buffer.isBuffer(rawData)) {
          return;
        }

        try {
          const payload = JSON.parse(rawData.toString()) as Record<
            string,
            unknown
          >;
          const eventType = payload.event;

          if (eventType === 'start' && isRecord(payload.start)) {
            const startPayload = payload.start as Record<string, unknown>;
            const customParameters = isRecord(startPayload.customParameters)
              ? startPayload.customParameters
              : null;
            const nextCallId =
              typeof customParameters?.callId === 'string'
                ? customParameters.callId
                : typeof startPayload.callSid === 'string'
                  ? startPayload.callSid
                  : null;
            if (nextCallId) {
              if (callId !== null && callId !== nextCallId) {
                routeLogger.error('[Coaching] start frame callId mismatch', {
                  urlCallId: callId,
                  startCallId: nextCallId,
                });
                client.close();
                return;
              }

              callId = nextCallId;
              if (registeredMediaCallId === null) {
                registeredMediaCallId = nextCallId;
                incrementMediaConnectionCount(registeredMediaCallId);
              }
            }
            return;
          }

          if (
            eventType === 'media' &&
            isRecord(payload.media) &&
            typeof payload.media.payload === 'string'
          ) {
            const track = payload.media.track;
            if (track !== 'inbound' && track !== 'outbound') {
              routeLogger.error(
                '[Coaching] dropped media frame with invalid track',
                {
                  callId,
                  track,
                },
              );
              return;
            }

            audioBuffers[track].push(
              Buffer.from(payload.media.payload, 'base64'),
            );
          }
        } catch (err: unknown) {
          routeLogger.error('[Coaching] dropped malformed media frame', {
            callId,
            error: err instanceof Error ? err.message : 'unknown error',
            rawDataLength: rawData.length,
            rawDataType: typeof rawData,
            rawDataSnippet: rawData.toString('utf8', 0, 120),
          });
        }
      });

      client.on('close', () => {
        clearInterval(timer);
        void Promise.allSettled([
          transcribeBuffer('inbound'),
          transcribeBuffer('outbound'),
        ]).finally(() => {
          transcriptionAbortController.abort();
          if (registeredMediaCallId) {
            decrementMediaConnectionCount(registeredMediaCallId);
            registeredMediaCallId = null;
          }
        });
      });
    });

    routeLogger.info('[Coaching] websocket servers initialized', {
      action: 'coaching.websocket_initialized',
    });
  } catch (error: unknown) {
    Sentry.captureException(error);
    throw error;
  }
};

const buildWavHeader = (dataLength: number): Buffer => {
  const header = Buffer.alloc(46);
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 8;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  header.write('RIFF', 0);
  header.writeUInt32LE(38 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(18, 16);
  header.writeUInt16LE(7, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.writeUInt16LE(0, 36);
  header.write('data', 38);
  header.writeUInt32LE(dataLength, 42);

  return header;
};
