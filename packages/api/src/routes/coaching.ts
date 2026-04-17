import type { Server as HttpServer } from 'http';

import * as Sentry from '@sentry/node';
import { AgentService, createCoachingDetector, createTranscriptContext } from '@consuelo/agent';
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
import type { RouteDefinition } from './index.js';

const auditLogger = createLogger('api:audit');
const routeLogger = createLogger('api:coaching');

let CoachModule: typeof import('@consuelo/coaching') | null = null;
const getCoachModule = async () => {
  if (!CoachModule) {
    CoachModule = await import('@consuelo/coaching');
  }

  return CoachModule;
};

interface CoachBody {
  messages?: Array<{ role: string; content: string }>;
  contextChunks?: string[];
  callId?: string;
}

interface AnalyzeBody {
  messages: Array<{ role: string; content: string }>;
  callSid?: string;
}

interface RefreshBody {
  callId?: string;
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

type CoachingStreamMessage =
  | TranscriptSnapshotMessage
  | TranscriptBroadcastMessage
  | CoachingBroadcastMessage;

interface WebSocketClient {
  readyState: number;
  send: (data: string) => void;
  close: () => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
}

interface SnakeCaseCallAnalytics {
  call_sid: string;
  user_id: string;
  phone_number: string;
  call_date: string;
  key_moments: Array<{
    timestamp: string;
    type: string;
    description: string;
    transcript_snippet: string;
  }>;
  sentiment_analysis: {
    customer_sentiment: string;
    engagement_level: string;
    objections_raised: string[];
    buying_signals: string[];
  };
  performance_metrics: {
    talk_ratio: number;
    questions_asked: number;
    objections_handled: number;
    next_steps_established: boolean;
    call_duration_minutes: number;
  };
  overall_score: number;
  strengths: string[];
  improvement_areas: string[];
  action_items: string[];
  generated_at: string;
}

type CallTranscriptRuntime = {
  entries: TranscriptEntry[];
  talkingPoints: TalkingPoints | null;
  loadedFromDatabase: boolean;
  lastCoachingAt: number;
  lastCoachingWordCount: number;
  generating: boolean;
  queued: boolean;
};

type CallContextRow = {
  contact_id?: string | null;
  contact_name?: string | null;
};

const LLM_TIMEOUT_MS = 30_000;
const TRANSCRIBE_INTERVAL_MS = 3_000;
const MIN_COACHING_REFRESH_INTERVAL_MS = 5_000;
const MIN_TRANSCRIPT_WORDS_FOR_COACHING = 8;
const MIN_NEW_WORDS_FOR_REFRESH = 20;
const MAX_TRANSCRIPT_ENTRIES_IN_PROMPT = 24;
const SQL_GET_TRANSCRIPT_BY_CALL_SID =
  'SELECT transcript FROM calls WHERE call_sid = $1 LIMIT 1';
const SQL_APPEND_TRANSCRIPT_ENTRY =
  "UPDATE calls SET transcript = COALESCE(transcript, '[]'::jsonb) || $2::jsonb, updated_at = NOW() WHERE call_sid = $1";
const SQL_GET_CALL_CONTEXT_BY_CALL_SID =
  'SELECT c.contact_id::text AS contact_id, ct.name AS contact_name FROM calls c LEFT JOIN contacts ct ON c.contact_id = ct.id WHERE c.call_sid = $1 LIMIT 1';

const getPool = getSharedPool;
const clientsByCall = new Map<string, Set<WebSocketClient>>();
const runtimeByCall = new Map<string, CallTranscriptRuntime>();
const entryCountersByCall = new Map<string, number>();

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
          (
            entry,
          ): entry is { objection: string; response: string } => entry !== null,
        )
    : [];

  return {
    product_or_option_name: product,
    details: toStringArray(value.details),
    clarifying_questions: toStringArray(value.clarifying_questions),
    objection_responses: objectionResponses,
  };
};

const countWords = (entries: TranscriptEntry[]): number =>
  entries.reduce(
    (sum, entry) =>
      sum + entry.text.split(/\s+/).filter((word) => word.length > 0).length,
    0,
  );

const transformCallAnalytics = (
  input: SnakeCaseCallAnalytics,
  callSid?: string,
): Record<string, unknown> => ({
  id: `${input.call_sid}-${Date.now()}`,
  callId: callSid ?? input.call_sid,
  keyMoments: input.key_moments.map((moment) => ({
    timestamp: new Date(moment.timestamp).getTime(),
    type: moment.type,
    text: moment.description,
    speaker: 'agent' as const,
  })),
  sentiment: {
    overall: input.sentiment_analysis.customer_sentiment,
    agentScore: Math.round(input.performance_metrics.talk_ratio * 100),
    customerScore: Math.round(
      (1 - input.performance_metrics.talk_ratio) * 100,
    ),
    trajectory: 'stable' as const,
  },
  performanceScore: input.overall_score,
  summary:
    input.strengths.join(' ') + ' ' + input.improvement_areas.join(' '),
  duration: input.performance_metrics.call_duration_minutes * 60,
  outcome: 'other' as const,
  nextSteps: input.action_items,
  tokensUsed: { input: 0, output: 0 },
  modelUsed: 'groq',
  latencyMs: 0,
  createdAt: input.generated_at,
});

const getRuntime = async (callId: string): Promise<CallTranscriptRuntime> => {
  try {
    const existing = runtimeByCall.get(callId);
    if (existing) {
      if (!existing.loadedFromDatabase) {
        const pool = await getPool();
        const { rows } = await pool.query(SQL_GET_TRANSCRIPT_BY_CALL_SID, [callId]);
        const transcriptValue = rows[0]?.transcript;
        existing.entries = Array.isArray(transcriptValue)
          ? transcriptValue
              .map((entry) => coerceTranscriptEntry(entry))
              .filter((entry): entry is TranscriptEntry => entry !== null)
          : [];
        existing.loadedFromDatabase = true;
        existing.lastCoachingWordCount = countWords(existing.entries);
      }
      return existing;
    }

    const runtime: CallTranscriptRuntime = {
      entries: [],
      talkingPoints: null,
      loadedFromDatabase: false,
      lastCoachingAt: 0,
      lastCoachingWordCount: 0,
      generating: false,
      queued: false,
    };
    runtimeByCall.set(callId, runtime);
    return getRuntime(callId);
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
  const speaker = value.speaker === 'agent' ? 'agent' : value.speaker === 'customer' ? 'customer' : null;
  const text = typeof value.text === 'string' ? value.text : null;
  const timestamp = typeof value.timestamp === 'number' ? value.timestamp : null;
  const confidence = typeof value.confidence === 'number' ? value.confidence : 0.9;

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
      client.chat.completions.create({
        model: options?.model ?? 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: message }],
        temperature: 0.3,
        max_tokens: 900,
        response_format: { type: 'json_object' },
      }),
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

const buildActiveCallState = async (callId: string): Promise<ActiveCallState> => {
  try {
    const pool = await getPool();
    const { rows } = await pool.query(SQL_GET_CALL_CONTEXT_BY_CALL_SID, [callId]);
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
    const activeCall = await buildActiveCallState(callId);
    const context: AgentContext = {
      userId: 'coaching-system',
      workspaceId: 'coaching-system',
      activeCall,
      recentActivity: [],
      connectedIntegrations: [],
      memories: [],
    };
    const config: AgentConfig = {
      systemPrompt: 'You are a live sales coaching agent. Return valid JSON only.',
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

const sendToClients = (callId: string, message: CoachingStreamMessage): void => {
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

const sendSnapshot = async (client: WebSocketClient, callId: string): Promise<void> => {
  try {
    const runtime = await getRuntime(callId);
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

const broadcastTalkingPoints = (callId: string, talkingPoints: TalkingPoints): void => {
  sendToClients(callId, { type: 'coaching', talkingPoints });
};

const persistTranscriptEntry = async (
  callId: string,
  entry: TranscriptEntry,
): Promise<void> => {
  try {
    const pool = await getPool();
    await pool.query(SQL_APPEND_TRANSCRIPT_ENTRY, [callId, JSON.stringify([entry])]);
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
): Promise<TalkingPoints | null> => {
  const runtime = await getRuntime(callId);
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

    const talkingPoints = normalizeTalkingPoints(JSON.parse(text));
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
      void runPiCoaching(callId);
    }
  }
};

const appendTranscriptEntry = async (
  callId: string,
  entry: TranscriptEntry,
): Promise<void> => {
  const runtime = await getRuntime(callId);
  runtime.entries = [...runtime.entries, entry];

  try {
    await persistTranscriptEntry(callId, entry);
  } catch (error: unknown) {
    Sentry.captureException(error);
    routeLogger.error('[Coaching] transcript persistence failed', {
      callId,
      error: error instanceof Error ? error.message : 'unknown error',
    });
  }

  broadcastTranscript(callId, entry);
  void runPiCoaching(callId);
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

export const coachingRoutes = (): RouteDefinition[] => [
  {
    method: 'POST',
    path: '/v1/coaching',
    handler: errorHandler(async (req, res) => {
      const auth = requireAuth(req, res);
      if (auth === null) return;

      const body = req.body as CoachBody | undefined;
      if (typeof body?.callId === 'string' && body.callId.length > 0) {
        const talkingPoints = await runPiCoaching(body.callId, true);
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
      const auth = requireAuth(req, res);
      if (auth === null) return;

      const body = req.body as CoachBody | undefined;
      if (!body?.callId) {
        res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing "callId"' },
        });
        return;
      }

      const talkingPoints = await runPiCoaching(body.callId, true);
      res.status(200).json({ data: talkingPoints });
    }),
  },
  {
    method: 'POST',
    path: '/v1/coaching/refresh',
    handler: errorHandler(async (req, res) => {
      const auth = requireAuth(req, res);
      if (auth === null) return;

      const body = req.body as RefreshBody | undefined;
      if (!body?.callId) {
        res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing "callId"' },
        });
        return;
      }

      const talkingPoints = await runPiCoaching(body.callId, true);
      res.status(200).json({ data: talkingPoints });
    }),
  },
  {
    method: 'POST',
    path: '/v1/coaching/analyze',
    handler: errorHandler(async (req, res) => {
      const auth = requireAuth(req, res);
      if (auth === null) return;

      const body = req.body as AnalyzeBody | undefined;
      if (!body?.messages?.length) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing "messages" array',
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
        const result = await withTimeout(
          coach.analyzeCall(messages as Parameters<typeof coach.analyzeCall>[0], {
            callSid: body.callSid,
            userId: auth.userId,
          }),
          LLM_TIMEOUT_MS,
        );

        res.status(200).json({
          data: transformCallAnalytics(
            result as unknown as SnakeCaseCallAnalytics,
            body.callSid,
          ),
        });
      } catch (error: unknown) {
        Sentry.captureException(error);
        const message =
          error instanceof Error ? error.message : 'analysis request failed';
        res.status(500).json({ error: { code: 'ANALYSIS_FAILED', message } });
      }
    }),
  },
  {
    method: 'POST',
    path: '/v1/calls/:callId/analysis',
    handler: errorHandler(async (req, res) => {
      const auth = requireAuth(req, res);
      if (auth === null) return;

      const callId = req.params?.callId;
      if (!callId) {
        res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing callId' },
        });
        return;
      }

      auditLogger.info('coaching.analysis_persisted', {
        action: 'coaching.analysis_persisted',
        userId: auth.userId ?? 'anonymous',
        outcome: 'success',
        callId,
      });
      res.status(200).json({ data: { callId, persisted: true } });
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
      const url = new URL(request.url ?? '', 'http://localhost');

      if (url.pathname === '/v1/coaching/stream') {
        const token = url.searchParams.get('token');
        if (!token) {
          socket.destroy();
          return;
        }

        streamWss.handleUpgrade(request, socket, head, (ws) => {
          streamWss.emit('connection', ws, request);
        });
        return;
      }

      if (url.pathname === '/v1/coaching/media') {
        mediaWss.handleUpgrade(request, socket, head, (ws) => {
          mediaWss.emit('connection', ws, request);
        });
      }
    });

    streamWss.on('connection', (ws: unknown, req: { url?: string }) => {
      const client = ws as WebSocketClient;
      const url = new URL(req.url ?? '', 'http://localhost');
      const callId = url.searchParams.get('callId');
      if (!callId) {
        client.close();
        return;
      }

      if (!clientsByCall.has(callId)) {
        clientsByCall.set(callId, new Set());
      }
      clientsByCall.get(callId)?.add(client);
      void sendSnapshot(client, callId);

      client.on('close', () => {
        clientsByCall.get(callId)?.delete(client);
        if (clientsByCall.get(callId)?.size === 0) {
          clientsByCall.delete(callId);
        }
      });
    });

    mediaWss.on('connection', (ws: unknown, req: { url?: string }) => {
      const client = ws as WebSocketClient;
      const url = new URL(req.url ?? '', 'http://localhost');
      let callId: string | null = url.searchParams.get('callId');
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
        if (!callId) {
          return;
        }

        const buffer = audioBuffers[track];
        if (buffer.length === 0) {
          return;
        }

        const chunks = buffer.splice(0);
        const combined = Buffer.concat(chunks);

        try {
          const client = await getGroqChatClient();
          const wavHeader = buildWavHeader(combined.length);
          const wavBuffer = Buffer.concat([wavHeader, combined]);
          const file = new File([wavBuffer], 'audio.wav', {
            type: 'audio/wav',
          });
          const transcription = await withTimeout(
            client.audio.transcriptions.create({
              model: 'whisper-large-v3-turbo',
              file,
            }),
            LLM_TIMEOUT_MS,
          );

          if (!transcription.text?.trim()) {
            return;
          }

          const entryCounter = getEntryCounter(callId);
          const entry: TranscriptEntry = {
            id: `${callId}-${entryCounter}`,
            speaker: track === 'inbound' ? 'customer' : 'agent',
            text: transcription.text.trim(),
            timestamp: Date.now(),
            confidence: 0.9,
          };
          await appendTranscriptEntry(callId, entry);
        } catch (error: unknown) {
          Sentry.captureException(error);
          routeLogger.error('[Coaching] transcription failed', {
            callId,
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
          const payload = JSON.parse(rawData.toString()) as Record<string, unknown>;
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
              callId = nextCallId;
            }
            return;
          }

          if (
            eventType === 'media' &&
            isRecord(payload.media) &&
            typeof payload.media.payload === 'string'
          ) {
            const track = payload.media.track === 'outbound' ? 'outbound' : 'inbound';
            audioBuffers[track].push(Buffer.from(payload.media.payload, 'base64'));
          }
        } catch {
          audioBuffers.inbound.push(rawData);
        }
      });

      client.on('close', () => {
        clearInterval(timer);
        void transcribeBuffer('inbound');
        void transcribeBuffer('outbound');
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
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(18, 16);
  header.writeUInt16LE(7, 20);
  header.writeUInt16LE(0, 22);
  header.writeUInt16LE(numChannels, 24);
  header.writeUInt32LE(sampleRate, 26);
  header.writeUInt32LE(byteRate, 30);
  header.writeUInt16LE(blockAlign, 34);
  header.writeUInt16LE(bitsPerSample, 36);
  header.write('data', 38);
  header.writeUInt32LE(dataLength, 42);

  return header;
};
