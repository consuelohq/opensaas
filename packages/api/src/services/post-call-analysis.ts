import * as Sentry from '@sentry/node';
import {
  AgentService,
  createCoachingLifecycle,
  createCoachingSchemas,
  createTranscriptContext,
  type AgentConfig,
  type AgentContext,
  type PiSession,
  type PiStreamEvent,
} from '@consuelo/agent';
import { createLogger } from '@consuelo/logger';

import { getSharedPool } from '../shared/db.js';
import {
  persistPostCallAnalysisWithDisposition,
  type CallDisposition,
} from './post-call-disposition.js';
const logger = createLogger('api:post-call-analysis');

const POST_CALL_MODEL = 'openai/gpt-oss-120b';
const POST_CALL_MAX_TOKENS = 1200;
const POST_CALL_TEMPERATURE = 0.2;
const POST_CALL_TIMEOUT_MS = 30_000;
const MAX_TRANSCRIPT_ENTRIES_IN_PROMPT = 48;

const SQL_GET_CALL_ANALYSIS_CONTEXT =
  'SELECT c.id::text AS id, c.call_sid, c.workspace_id::text AS workspace_id, c.transcript, c.analysis, c.outcome, c.start_time, c.end_time, ct.name AS contact_name FROM calls c LEFT JOIN contacts ct ON c.contact_id = ct.id WHERE (c.id::text = $1 OR c.call_sid = $1) AND c.workspace_id = $2 LIMIT 1';
const analysisRunsByCall = new Map<
  string,
  Promise<GeneratedPostCallAnalysis>
>();

type GeneratedPostCallAnalysis = {
  analysis: PersistedCallAnalytics;
  source: 'generated' | 'persisted';
  committedDisposition: CallDisposition | null;
  requiresManualDisposition: boolean;
};

type ValidatedPostCallAnalysisResult = {
  analytics: {
    key_moments: Array<{
      timestamp: string;
      type: 'objection' | 'commitment' | 'question' | 'insight';
      description: string;
      impact: 'positive' | 'negative' | 'neutral';
    }>;
    sentiment: {
      overall: 'positive' | 'negative' | 'neutral' | 'mixed';
      customer: string;
      agent: string;
      trend: 'improving' | 'declining' | 'stable';
    };
    performance: {
      talk_ratio: number;
      response_time_avg: number;
      objection_handling_score: number;
    };
  };
  summary: string;
  outcome:
    | 'interested'
    | 'not_interested'
    | 'callback_scheduled'
    | 'voicemail'
    | 'no_answer'
    | 'wrong_number'
    | 'other';
  next_steps: string[];
};

type PersistedTranscriptEntry = {
  id: string;
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: number;
  confidence: number;
};

type PersistedCallAnalytics = {
  id: string;
  callId: string;
  keyMoments: Array<{
    timestamp: number;
    type: 'objection' | 'interest' | 'question' | 'commitment' | 'concern';
    text: string;
    speaker: 'agent' | 'customer';
  }>;
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative';
    agentScore: number;
    customerScore: number;
    trajectory: 'improving' | 'stable' | 'declining';
  };
  performanceScore: number;
  summary: string;
  duration: number;
  outcome:
    | 'interested'
    | 'not_interested'
    | 'callback_scheduled'
    | 'voicemail'
    | 'no_answer'
    | 'wrong_number'
    | 'other';
  nextSteps: string[];
  tokensUsed: { input: number; output: number };
  modelUsed: string;
  latencyMs: number;
  createdAt: string;
};

type CallAnalysisContextRow = {
  id?: string | null;
  call_sid?: string | null;
  workspace_id?: string | null;
  transcript?: unknown;
  analysis?: unknown;
  outcome?: string | null;
  start_time?: string | Date | null;
  end_time?: string | Date | null;
  contact_name?: string | null;
};

type GroqChatClient = {
  chat: {
    completions: {
      create: (
        request: {
          model: string;
          messages: Array<{ role: 'user'; content: string }>;
          temperature: number;
          max_tokens: number;
          response_format: { type: 'json_object' };
        },
        options?: { signal?: AbortSignal },
      ) => Promise<{
        choices?: Array<{ message?: { content?: string | null } }>;
        usage?: {
          prompt_tokens?: number | null;
          completion_tokens?: number | null;
        };
      }>;
    };
  };
};

const getPool = getSharedPool;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const withTimeout = async <TResult>(
  promise: Promise<TResult>,
  timeoutMs: number,
): Promise<TResult> =>
  await Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);

const coerceTranscriptEntry = (
  value: unknown,
): PersistedTranscriptEntry | null => {
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

const clampPercentage = (value: number): number => {
  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized)));
};

const parseTimestamp = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDateValue = (
  value: string | Date | null | undefined,
): number | null => {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value !== 'string') {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const deriveDurationSeconds = (row: CallAnalysisContextRow): number => {
  const startedAt = parseDateValue(row.start_time);
  const endedAt = parseDateValue(row.end_time);

  if (startedAt === null || endedAt === null || endedAt < startedAt) {
    return 0;
  }

  return Math.round((endedAt - startedAt) / 1000);
};

const normalizeMomentType = (
  value: string,
  impact: 'positive' | 'negative' | 'neutral',
): 'objection' | 'interest' | 'question' | 'commitment' | 'concern' => {
  if (value === 'objection') {
    return 'objection';
  }

  if (value === 'question') {
    return 'question';
  }

  if (value === 'commitment') {
    return 'commitment';
  }

  if (impact === 'negative') {
    return 'concern';
  }

  return 'interest';
};

const normalizeOutcome = (value: string): PersistedCallAnalytics['outcome'] => {
  switch (value) {
    case 'interested':
    case 'not_interested':
    case 'callback_scheduled':
    case 'voicemail':
    case 'no_answer':
    case 'wrong_number':
      return value;
    case 'connected':
      return 'interested';
    case 'follow-up':
    case 'follow_up':
      return 'callback_scheduled';
    case 'not-interested':
      return 'not_interested';
    case 'busy':
      return 'other';
    default:
      return 'other';
  }
};

const normalizeSentiment = (
  value: string,
): PersistedCallAnalytics['sentiment']['overall'] => {
  if (value === 'positive' || value === 'negative' || value === 'neutral') {
    return value;
  }

  return 'neutral';
};

const isPersistedCallAnalytics = (
  value: unknown,
): value is PersistedCallAnalytics => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.callId === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.performanceScore === 'number' &&
    typeof value.duration === 'number' &&
    typeof value.modelUsed === 'string' &&
    typeof value.createdAt === 'string' &&
    Array.isArray(value.keyMoments) &&
    Array.isArray(value.nextSteps) &&
    isRecord(value.sentiment) &&
    isRecord(value.tokensUsed)
  );
};

const getGroqChatClient = async (): Promise<GroqChatClient> => {
  try {
    const openAiModule = await import('openai');
    const OpenAIClient = openAiModule.default;

    return new OpenAIClient({
      apiKey: process.env.GROQ_API_KEY ?? '',
      baseURL: 'https://api.groq.com/openai/v1',
    }) as unknown as GroqChatClient;
  } catch (error: unknown) {
    Sentry.captureException(error);
    throw error;
  }
};

const createPostCallPiSession = (): PiSession => ({
  async *prompt(
    message: string,
    options?: { signal?: AbortSignal; model?: string },
  ): AsyncIterable<PiStreamEvent> {
    const client = await getGroqChatClient();
    const response = await withTimeout(
      client.chat.completions.create(
        {
          model: options?.model ?? POST_CALL_MODEL,
          messages: [{ role: 'user', content: message }],
          temperature: POST_CALL_TEMPERATURE,
          max_tokens: POST_CALL_MAX_TOKENS,
          response_format: { type: 'json_object' },
        },
        { signal: options?.signal },
      ),
      POST_CALL_TIMEOUT_MS,
    );

    const content = response.choices?.[0]?.message?.content ?? '';
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

const loadCallAnalysisContext = async (
  callId: string,
  workspaceId: string,
): Promise<CallAnalysisContextRow | null> => {
  try {
    const pool = await getPool();
    const { rows } = await pool.query(SQL_GET_CALL_ANALYSIS_CONTEXT, [
      callId,
      workspaceId,
    ]);

    return (rows[0] ?? null) as CallAnalysisContextRow | null;
  } catch (error: unknown) {
    Sentry.captureException(error);
    throw error;
  }
};

const persistCallAnalysis = async (
  callId: string,
  workspaceId: string,
  analysis: PersistedCallAnalytics,
): Promise<{
  committedDisposition: CallDisposition | null;
  requiresManualDisposition: boolean;
}> => {
  try {
    const pool = await getPool();

    return await persistPostCallAnalysisWithDisposition(pool, {
      callId,
      workspaceId,
      analysis,
    });
  } catch (error: unknown) {
    Sentry.captureException(error);
    throw error;
  }
};

const buildPostCallAgent = async (
  callId: string,
  workspaceId: string,
  contactName: string,
  outcome: string,
  durationSeconds: number,
  transcriptEntries: PersistedTranscriptEntry[],
): Promise<AgentService> => {
  try {
    const context: AgentContext = {
      userId: 'post-call-analysis-system',
      workspaceId,
      recentActivity: [],
      connectedIntegrations: [],
      memories: [],
    };
    const config: AgentConfig = {
      systemPrompt:
        'You are a post-call analysis agent. Return valid JSON only.',
      model: POST_CALL_MODEL,
      provider: 'groq',
      maxTokens: POST_CALL_MAX_TOKENS,
      temperature: POST_CALL_TEMPERATURE,
    };

    return new AgentService({
      config,
      context,
      session: createPostCallPiSession(),
      beforeTurnExtensions: [
        createTranscriptContext(() => ({
          callSid: callId,
          entries: transcriptEntries.slice(-MAX_TRANSCRIPT_ENTRIES_IN_PROMPT),
        })),
        createCoachingLifecycle(async () => ({
          contactName,
          duration: durationSeconds,
          outcome,
          hasTranscript: transcriptEntries.length > 0,
          analyzed: false,
        })),
      ],
    });
  } catch (error: unknown) {
    Sentry.captureException(error);
    throw error;
  }
};

const parsePostCallAnalysisResult = async (
  payload: string,
): Promise<ValidatedPostCallAnalysisResult> => {
  try {
    const parsed = JSON.parse(payload) as unknown;
    const { PostCallAnalysisResultSchema } = await createCoachingSchemas();

    return PostCallAnalysisResultSchema.parse(
      parsed,
    ) as unknown as ValidatedPostCallAnalysisResult;
  } catch (error: unknown) {
    Sentry.captureException(error);
    throw error;
  }
};

const toPersistedCallAnalytics = (
  callId: string,
  durationSeconds: number,
  result: ValidatedPostCallAnalysisResult,
  usage: { input: number; output: number },
  latencyMs: number,
): PersistedCallAnalytics => {
  const createdAt = new Date().toISOString();
  const agentScore = clampPercentage(result.analytics.performance.talk_ratio);

  return {
    id: `${callId}-${createdAt}`,
    callId,
    keyMoments: result.analytics.key_moments.map((moment) => ({
      timestamp: parseTimestamp(moment.timestamp),
      type: normalizeMomentType(moment.type, moment.impact),
      text: moment.description,
      speaker: 'customer',
    })),
    sentiment: {
      overall: normalizeSentiment(result.analytics.sentiment.overall),
      agentScore,
      customerScore: Math.max(0, 100 - agentScore),
      trajectory: result.analytics.sentiment.trend,
    },
    performanceScore: clampPercentage(
      result.analytics.performance.objection_handling_score,
    ),
    summary: result.summary,
    duration: durationSeconds,
    outcome: normalizeOutcome(result.outcome),
    nextSteps: result.next_steps,
    tokensUsed: usage,
    modelUsed: POST_CALL_MODEL,
    latencyMs,
    createdAt,
  };
};

const generateFreshCallAnalysis = async (
  row: CallAnalysisContextRow,
  callId: string,
  workspaceId: string,
): Promise<PersistedCallAnalytics> => {
  const transcriptEntries = Array.isArray(row.transcript)
    ? row.transcript
        .map((entry) => coerceTranscriptEntry(entry))
        .filter((entry): entry is PersistedTranscriptEntry => entry !== null)
    : [];

  if (transcriptEntries.length === 0) {
    throw new Error('No transcript available for analysis');
  }

  const normalizedCallId =
    typeof row.call_sid === 'string' && row.call_sid.length > 0
      ? row.call_sid
      : callId;
  const durationSeconds = deriveDurationSeconds(row);
  const startedAt = Date.now();
  const agent = await buildPostCallAgent(
    normalizedCallId,
    workspaceId,
    row.contact_name ?? 'unknown contact',
    row.outcome ?? 'other',
    durationSeconds,
    transcriptEntries,
  );
  let payload = '';
  let usage = { input: 0, output: 0 };

  for await (const event of agent.chat({
    messages: [
      {
        role: 'user' as const,
        content:
          'run the post-call analysis for the recently ended call and return only valid json.',
      },
    ],
    conversationId: `post-call-analysis-${normalizedCallId}`,
    model: POST_CALL_MODEL,
  })) {
    if (event.type === 'text_delta') {
      payload += event.text;
    }

    if (event.type === 'usage') {
      usage = {
        input: event.inputTokens,
        output: event.outputTokens,
      };
    }
  }

  const result = await parsePostCallAnalysisResult(payload);

  return toPersistedCallAnalytics(
    normalizedCallId,
    durationSeconds,
    result,
    usage,
    Date.now() - startedAt,
  );
};

export const generatePostCallAnalysis = async (
  callId: string,
  workspaceId: string,
  options?: { force?: boolean },
): Promise<GeneratedPostCallAnalysis> => {
  const runKey = `${workspaceId}:${callId}:${options?.force === true ? 'force' : 'default'}`;
  const existingRun = analysisRunsByCall.get(runKey);

  if (existingRun) {
    return await existingRun;
  }

  const run = (async (): Promise<GeneratedPostCallAnalysis> => {
    const row = await loadCallAnalysisContext(callId, workspaceId);

    if (!row) {
      throw new Error('Call not found');
    }

    if (!options?.force && isPersistedCallAnalytics(row.analysis)) {
      const committedDisposition =
        typeof row.outcome === 'string'
          ? (row.outcome as CallDisposition)
          : null;

      return {
        analysis: row.analysis,
        source: 'persisted',
        committedDisposition,
        requiresManualDisposition: committedDisposition === null,
      };
    }

    const analysis = await generateFreshCallAnalysis(row, callId, workspaceId);
    const dispositionResult = await persistCallAnalysis(
      callId,
      workspaceId,
      analysis,
    );
    logger.info('post_call_analysis.generated', {
      action: 'post_call_analysis.generated',
      callId,
      workspaceId,
      source: options?.force === true ? 'forced' : 'automatic',
      committedDisposition: dispositionResult.committedDisposition,
      requiresManualDisposition: dispositionResult.requiresManualDisposition,
    });

    return {
      analysis,
      source: 'generated',
      ...dispositionResult,
    };
  })();

  analysisRunsByCall.set(runKey, run);

  try {
    return await run;
  } catch (error: unknown) {
    Sentry.captureException(error);
    throw error;
  } finally {
    analysisRunsByCall.delete(runKey);
  }
};
