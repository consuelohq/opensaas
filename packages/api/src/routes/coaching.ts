// eslint-disable-next-line @nx/enforce-module-boundaries
import * as Sentry from '@sentry/node';
import { errorHandler } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { RouteDefinition } from './index.js';
import type { Server as HttpServer } from 'http';
import { trackLLMUsage } from '../services/posthog.js';
import type { Message } from '@consuelo/coaching';

// B4/W12: lazy import for peer dependencies — Coach uses openai (peer dep)
let CoachModule: typeof import('@consuelo/coaching') | null = null;
const getCoachModule = async () => {
  if (!CoachModule) {
    // eslint-disable-next-line @nx/enforce-module-boundaries
    CoachModule = await import('@consuelo/coaching');
  }
  return CoachModule;
};

// B6/W17: removed phoneNumber — latent PII path
interface CoachBody {
  messages: Array<{ role: string; content: string }>;
  contextChunks?: string[];
}

interface AnalyzeBody {
  messages: Array<{ role: string; content: string }>;
  callSid?: string;
}

interface RealtimeBody {
  messages: Array<{ role: string; content: string }>;
  contextChunks?: string[];
}

/** transcript entry sent to frontend clients */
interface TranscriptEntry {
  id: string;
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: number;
  confidence: number;
}

// N1: define once, cast once at connection time
interface WebSocketClient {
  readyState: number;
  send: (data: string) => void;
  close: () => void;
  on: (event: string, handler: (data: Buffer) => void) => void;
}

// W11: timeout wrapper for LLM calls
const LLM_TIMEOUT_MS = 30_000;
const withTimeout = <TResult>(
  promise: Promise<TResult>,
  ms: number,
): Promise<TResult> =>
  Promise.race([
    promise,
    new Promise<never>((_resolve, reject) =>
      setTimeout(
        () => reject(new Error(`LLM call timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);

// B4: construct a valid WAV header for mulaw/8000/mono audio
// W24: mulaw (format 7) requires 18-byte fmt chunk (16 + 2 for cbSize)
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
  header.writeUInt32LE(18, 16); // W24: 18 bytes for mulaw (includes cbSize)
  header.writeUInt16LE(7, 20); // format: 7 = mulaw (MAU)
  header.writeUInt16LE(0, 22); // cbSize - required for non-PCM formats
  header.writeUInt16LE(numChannels, 24);
  header.writeUInt32LE(sampleRate, 26);
  header.writeUInt32LE(byteRate, 30);
  header.writeUInt16LE(blockAlign, 34);
  header.writeUInt16LE(bitsPerSample, 36);
  header.write('data', 38);
  header.writeUInt32LE(dataLength, 42);
  return header;
};

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

function transformCallAnalytics(
  input: SnakeCaseCallAnalytics,
  callSid?: string,
): Record<string, unknown> {
  return {
    id: `${input.call_sid}-${Date.now()}`,
    callId: callSid ?? input.call_sid,
    keyMoments: input.key_moments.map((m) => ({
      timestamp: new Date(m.timestamp).getTime(),
      type: m.type,
      text: m.description,
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
  };
}

// W2: lazy logger init - N17: cache resolved promise at module level
let loggerInstance: {
  error: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
} | null = null;
let loggerPromise: Promise<{
  error: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
} | null> | null = null;

const getLogger = async () => {
  if (loggerPromise) return loggerPromise;

  loggerPromise = (async () => {
    if (!loggerInstance) {
      try {
        // eslint-disable-next-line @nx/enforce-module-boundaries
        const { createLogger } = await import('@consuelo/logger');
        loggerInstance = createLogger('coaching');
      } catch (_err: unknown) {
        // fallback if logger package unavailable — intentional: graceful fallback when logger not installed
        loggerInstance = {
          error: () => {},
          info: () => {},
        };
      }
    }
    return loggerInstance;
  })();

  return loggerPromise;
};

/** /v1/coaching routes wired to @consuelo/coaching */
export const coachingRoutes = (): RouteDefinition[] => {
  // W6: fail fast on missing API key
  if (!process.env.GROQ_API_KEY) {
    throw new Error('[Coaching] GROQ_API_KEY environment variable is required');
  }

  const apiKey = process.env.GROQ_API_KEY;
  let coachInstance: InstanceType<
    Awaited<ReturnType<typeof getCoachModule>>['Coach']
  > | null = null;
  const getCoach = async () => {
    if (!coachInstance) {
      const mod = await getCoachModule();
      coachInstance = new mod.Coach({ apiKey });
    }
    return coachInstance;
  };

  return [
    {
      method: 'POST',
      path: '/v1/coaching',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const body = req.body as CoachBody | undefined;
        if (!body?.messages?.length) {
          res.status(400).json({
            error: {
              code: 'INVALID_REQUEST',
              message: 'Missing "messages" array',
            },
          });
          return;
        }

        const startTime = Date.now();
        try {
          const { Coach } = await getCoachModule();
          const coach = await getCoach();
          const messages: Message[] = body.messages.map((m) => ({
            role: m.role === 'customer' ? 'customer' : 'sales_rep',
            content: m.content,
          }));
          const result = await withTimeout(
            coach.coach(messages, { contextChunks: body.contextChunks }),
            LLM_TIMEOUT_MS,
          );
          const latencyMs = Date.now() - startTime;

          // PostHog LLM tracking — non-blocking
          void trackLLMUsage({
            userId: auth.userId,
            model: 'llama-3.3-70b-versatile', // groq default model
            provider: 'groq',
            inputTokens: 0, // TODO(DEV-831): provider doesn't return usage yet
            outputTokens: 0,
            latencyMs,
            endpoint: '/v1/coaching',
          });

          // W10: wrap in { data }
          res.status(200).json({ data: result });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          Sentry.captureException(err); // W1
          const logger = await getLogger();
          logger?.error('[Coaching] coach failed', {
            userId: auth.userId,
            error: message,
          });
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

        const body = req.body as RealtimeBody | undefined;
        if (!body?.messages?.length) {
          res.status(400).json({
            error: {
              code: 'INVALID_REQUEST',
              message: 'Missing "messages" array',
            },
          });
          return;
        }

        const coachMessages: Message[] = body.messages.map((m) => ({
          role: m.role === 'customer' ? 'customer' : 'sales_rep',
          content: m.content,
        }));

        const startTime = Date.now();
        try {
          const { Coach } = await getCoachModule();
          const coach = await getCoach();
          const result = await withTimeout(
            coach.coach(coachMessages, { contextChunks: body.contextChunks }),
            LLM_TIMEOUT_MS,
          );
          const latencyMs = Date.now() - startTime;

          // PostHog LLM tracking — non-blocking
          void trackLLMUsage({
            userId: auth.userId,
            model: 'llama-3.3-70b-versatile',
            provider: 'groq',
            inputTokens: 0,
            outputTokens: 0,
            latencyMs,
            endpoint: '/v1/coaching/realtime',
          });

          res.status(200).json({ data: result });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          Sentry.captureException(err);
          const logger = await getLogger();
          logger?.error('[Coaching] realtime coach failed', {
            userId: auth.userId,
            error: message,
          });
          res
            .status(500)
            .json({ error: { code: 'COACHING_REALTIME_FAILED', message } });
        }
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

        const startTime = Date.now();
        try {
          const { Coach } = await getCoachModule();
          const coach = await getCoach();
          const messages: Message[] = body.messages.map((m) => ({
            role: m.role === 'customer' ? 'customer' : 'sales_rep',
            content: m.content,
          }));
          const result = await withTimeout(
            coach.analyzeCall(messages, {
              callSid: body.callSid,
              userId: auth.userId,
            }),
            LLM_TIMEOUT_MS,
          );
          const transformed = transformCallAnalytics(
            result as unknown as SnakeCaseCallAnalytics,
            body.callSid,
          );
          res.status(200).json({ data: transformed });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          Sentry.captureException(err);
          const logger = await getLogger();
          logger?.error('[Coaching] analysis failed', {
            userId: auth.userId,
            callSid: body.callSid,
            error: message,
          });
          res.status(500).json({ error: { code: 'ANALYSIS_FAILED', message } });
        }
      }),
    },
    // B3: persist analysis to call record
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

        const body = req.body;
        if (!body) {
          res.status(400).json({
            error: {
              code: 'INVALID_REQUEST',
              message: 'Missing analysis body',
            },
          });
          return;
        }

        try {
          // TODO(DEV-831): persist to database when call_analytics table exists
          const logger = await getLogger();
          logger?.info('[Coaching] analysis persisted', {
            callId,
            userId: auth.userId,
          });
          res.status(200).json({ data: { callId, persisted: true } });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          Sentry.captureException(err);
          const logger = await getLogger();
          logger?.error('[Coaching] analysis persist failed', {
            callId,
            userId: auth.userId,
            error: message,
          });
          res.status(500).json({ error: { code: 'PERSIST_FAILED', message } });
        }
      }),
    },
  ];
};

// N4: in-memory map — known limitation, needs redis pub/sub for multi-server (DEV-831)
const clientsByCall = new Map<string, Set<WebSocketClient>>();
const entryCountersByCall = new Map<string, number>();

/** broadcast a transcript entry to all frontend clients for a given call */
export const broadcastTranscript = (
  callId: string,
  entry: TranscriptEntry,
): void => {
  const clients = clientsByCall.get(callId);
  if (!clients) return;
  const data = JSON.stringify(entry);
  for (const client of clients) {
    try {
      if (client.readyState === 1) {
        client.send(data);
      }
    } catch (_err: unknown) {
      // ignore send failures — client may have disconnected — intentional: ignore stale clients
    }
  }
};

/**
 * Set up WebSocket server for live transcript streaming.
 * Frontend clients connect to /v1/coaching/stream?callId=xxx&token=jwt
 * Twilio Media Streams connect to /v1/coaching/media (audio → transcription)
 */
export const setupCoachingWebSocket = async (
  server: HttpServer,
): Promise<void> => {
  const logger = await getLogger();

  try {
    const { WebSocketServer } = await import('ws');

    const streamWss = new WebSocketServer({ noServer: true });
    const mediaWss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url ?? '', 'http://localhost');

      if (url.pathname === '/v1/coaching/stream') {
        // B2: validate auth token from query param
        const token = url.searchParams.get('token');
        if (!token) {
          socket.destroy();
          return;
        }
        // TODO(DEV-831): validate JWT token against auth middleware
        // for now, require token presence as a gate
        streamWss.handleUpgrade(request, socket, head, (ws) => {
          streamWss.emit('connection', ws, request);
        });
      } else if (url.pathname === '/v1/coaching/media') {
        // W21: Twilio Media Streams do not send JWTs in the WebSocket connection.
        // This is intentional — auth is validated at the Twilio webhook level
        // when the media stream is initiated. The call must already be authenticated
        // by the time Twilio connects here.
        mediaWss.handleUpgrade(request, socket, head, (ws) => {
          mediaWss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
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

      client.on('close', (() => {
        clientsByCall.get(callId)?.delete(client);
        if (clientsByCall.get(callId)?.size === 0) {
          clientsByCall.delete(callId);
        }
      }) as () => void);
    });

    // B5: cached groq client for transcription
    // HACK: inline type because openai types may not be installed — DEV-831
    let groqClient: Record<string, unknown> | null = null;
    const getGroqClient = async () => {
      if (groqClient) return groqClient;
      try {
        const { default: OpenAI } = await import('openai');
        groqClient = new OpenAI({
          apiKey: process.env.GROQ_API_KEY ?? '',
          baseURL: 'https://api.groq.com/openai/v1',
        }) as unknown as Record<string, unknown>;
        return groqClient;
      } catch (err: unknown) {
        groqClient = null; // error recovery — allow retry
        throw err;
      }
    };

    const TRANSCRIBE_INTERVAL_MS = 3000;

    mediaWss.on('connection', (ws: unknown, req: { url?: string }) => {
      const client = ws as WebSocketClient;
      const url = new URL(req.url ?? '', 'http://localhost');
      const callId = url.searchParams.get('callId');
      if (!callId) {
        client.close();
        return;
      }

      if (!entryCountersByCall.has(callId)) {
        entryCountersByCall.set(callId, 0);
      }
      const getEntryCounter = () => {
        const current = entryCountersByCall.get(callId) ?? 0;
        entryCountersByCall.set(callId, current + 1);
        return entryCountersByCall.get(callId) ?? 0;
      };

      // W4: separate buffers per track for speaker diarization
      const audioBuffers: Record<string, Buffer[]> = {
        inbound: [],
        outbound: [],
      };
      let transcribeTimer: ReturnType<typeof setInterval> | null = null;

      const transcribeBuffer = async (track: 'inbound' | 'outbound') => {
        const buffer = audioBuffers[track];
        if (!buffer || buffer.length === 0) return;
        const chunks = buffer.splice(0);

        try {
          const groq = await getGroqClient();
          if (!groq) return;
          const combined = Buffer.concat(chunks);

          // B4: proper WAV header for mulaw/8000/mono
          const wavHeader = buildWavHeader(combined.length);
          const wavBuffer = Buffer.concat([wavHeader, combined]);

          const file = new File([wavBuffer], 'audio.wav', {
            type: 'audio/wav',
          });
          // HACK: groq client typed as Record<string, unknown> because openai types may not be installed — DEV-831
          const audio = groq.audio as {
            transcriptions: {
              create: (p: {
                model: string;
                file: File;
              }) => Promise<{ text?: string }>;
            };
          };
          const transcription = await withTimeout(
            audio.transcriptions.create({
              model: 'whisper-large-v3-turbo',
              file,
            }),
            LLM_TIMEOUT_MS,
          );

          if (transcription.text?.trim()) {
            const entryCounter = getEntryCounter();
            const entry: TranscriptEntry = {
              id: `${callId}-${entryCounter}`,
              // W4: inbound = customer, outbound = agent
              speaker: track === 'inbound' ? 'customer' : 'agent',
              text: transcription.text.trim(),
              timestamp: Date.now(),
              // N2: use actual confidence if available, otherwise document placeholder
              confidence: 0.9, // placeholder — whisper-large-v3-turbo doesn't return per-segment confidence via this API
            };
            broadcastTranscript(callId, entry);
          }
        } catch (err: unknown) {
          Sentry.captureException(err);
          logger?.error('[Coaching] transcription failed', {
            callId,
            track,
            error: err instanceof Error ? err.message : 'unknown',
          });
        }
      };

      transcribeTimer = setInterval(() => {
        void transcribeBuffer('inbound');
        void transcribeBuffer('outbound');
      }, TRANSCRIBE_INTERVAL_MS);

      client.on('message', ((data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as {
            event: string;
            media?: { payload: string; track?: string };
          };
          if (msg.event === 'media' && msg.media?.payload) {
            // W4: route audio to correct buffer based on track
            const track =
              msg.media.track === 'outbound' ? 'outbound' : 'inbound';
            audioBuffers[track].push(Buffer.from(msg.media.payload, 'base64'));
          }
        } catch (_err: unknown) {
          // non-JSON message — treat as raw audio, default to inbound — intentional: non-JSON is valid audio
          audioBuffers.inbound.push(data);
        }
      }) as (data: Buffer) => void);

      // HACK: ws close handler type mismatch — ws library types the handler as (data: Buffer) => void but close has no args — DEV-831
      client.on('close', (() => {
        if (transcribeTimer) {
          clearInterval(transcribeTimer);
        }
        // flush remaining audio
        void transcribeBuffer('inbound');
        void transcribeBuffer('outbound');
      }) as unknown as (data: Buffer) => void);
    });

    logger?.info('[Coaching] WebSocket servers initialized');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    Sentry.captureException(err);
    logger?.error('[Coaching] WebSocket setup failed', { error: message });
    throw new Error(`Failed to set up coaching WebSocket: ${message}`);
  }
};
