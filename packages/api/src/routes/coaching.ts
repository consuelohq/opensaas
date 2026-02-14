import { Coach, type Message } from '@consuelo/coaching';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';
import type { Server as HttpServer } from 'http';

interface CoachBody {
  messages: Message[];
  contextChunks?: string[];
}

interface AnalyzeBody {
  messages: Message[];
  callSid?: string;
  phoneNumber?: string;
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

/** /v1/coaching routes wired to @consuelo/coaching */
export const coachingRoutes = (): RouteDefinition[] => {
  const coach = new Coach({ apiKey: process.env.GROQ_API_KEY ?? '' });

  return [
    {
      method: 'POST',
      path: '/v1/coaching',
      handler: errorHandler(async (req, res) => {
        const body = req.body as CoachBody | undefined;
        if (!body?.messages?.length) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing "messages" array' } });
          return;
        }

        try {
          const result = await coach.coach(body.messages, { contextChunks: body.contextChunks });
          res.status(200).json(result);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          res.status(500).json({ error: { code: 'COACHING_FAILED', message } });
        }
      }),
    },
    {
      method: 'POST',
      path: '/v1/coaching/realtime',
      handler: errorHandler(async (req, res) => {
        const body = req.body as RealtimeBody | undefined;
        if (!body?.messages?.length) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing "messages" array' } });
          return;
        }

        // map transcript roles to coaching message roles
        const coachMessages: Message[] = body.messages.map((m) => ({
          role: m.role === 'customer' ? 'customer' : 'sales_rep',
          content: m.content,
        }));

        try {
          const result = await coach.coach(coachMessages, { contextChunks: body.contextChunks });
          res.status(200).json(result);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          res.status(500).json({ error: { code: 'COACHING_REALTIME_FAILED', message } });
        }
      }),
    },
    {
      method: 'POST',
      path: '/v1/coaching/analyze',
      handler: errorHandler(async (req, res) => {
        const body = req.body as AnalyzeBody | undefined;
        if (!body?.messages?.length) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing "messages" array' } });
          return;
        }

        try {
          const result = await coach.analyzeCall(body.messages, {
            callSid: body.callSid,
            userId: req.auth?.userId,
            phoneNumber: body.phoneNumber,
          });
          res.status(200).json(result);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          res.status(500).json({ error: { code: 'ANALYSIS_FAILED', message } });
        }
      }),
    },
  ];
};
const clientsByCall = new Map<string, Set<unknown>>();

/** broadcast a transcript entry to all frontend clients for a given call */
export const broadcastTranscript = (callId: string, entry: TranscriptEntry): void => {
  const clients = clientsByCall.get(callId);
  if (!clients) return;
  const data = JSON.stringify(entry);
  for (const client of clients) {
    try {
      // ws.readyState 1 = OPEN
      const ws = client as { readyState: number; send: (data: string) => void };
      if (ws.readyState === 1) {
        ws.send(data);
      }
    } catch {
      // ignore send failures
    }
  }
};

/**
 * Set up WebSocket server for live transcript streaming.
 * Frontend clients connect to /v1/coaching/stream?callId=xxx
 * Twilio Media Streams connect to /v1/coaching/media (audio → transcription)
 *
 * Must be called after the HTTP server is created.
 * ws is a peerDependency — lazy imported per coding standards.
 */
export const setupCoachingWebSocket = async (server: HttpServer): Promise<void> => {
  try {
    const { WebSocketServer } = await import('ws');

    // frontend transcript stream
    const streamWss = new WebSocketServer({ noServer: true });

    // twilio media streams (audio ingestion)
    const mediaWss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url ?? '', 'http://localhost');

      if (url.pathname === '/v1/coaching/stream') {
        streamWss.handleUpgrade(request, socket, head, (ws) => {
          streamWss.emit('connection', ws, request);
        });
      } else if (url.pathname === '/v1/coaching/media') {
        mediaWss.handleUpgrade(request, socket, head, (ws) => {
          mediaWss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    // handle frontend client connections
    streamWss.on('connection', (ws: unknown, req: { url?: string }) => {
      const url = new URL(req.url ?? '', 'http://localhost');
      const callId = url.searchParams.get('callId');
      if (!callId) {
        (ws as { close: () => void }).close();
        return;
      }

      if (!clientsByCall.has(callId)) {
        clientsByCall.set(callId, new Set());
      }
      clientsByCall.get(callId)?.add(ws);

      (ws as { on: (event: string, handler: () => void) => void }).on('close', () => {
        clientsByCall.get(callId)?.delete(ws);
        if (clientsByCall.get(callId)?.size === 0) {
          clientsByCall.delete(callId);
        }
      });
    });

    // handle twilio media streams — audio transcription pipeline
    const TRANSCRIBE_INTERVAL_MS = 3000;

    mediaWss.on('connection', (ws: unknown, req: { url?: string }) => {
      const url = new URL(req.url ?? '', 'http://localhost');
      const callId = url.searchParams.get('callId');
      if (!callId) {
        (ws as { close: () => void }).close();
        return;
      }

      // buffer audio chunks for periodic transcription
      let audioBuffer: Buffer[] = [];
      let transcribeTimer: ReturnType<typeof setInterval> | null = null;
      let entryCounter = 0;

      const transcribeBuffer = async () => {
        if (audioBuffer.length === 0) return;
        const chunks = audioBuffer;
        audioBuffer = [];

        try {
          const combined = Buffer.concat(chunks);
          const { default: OpenAI } = await import('openai');
          const groq = new OpenAI({
            apiKey: process.env.GROQ_API_KEY ?? '',
            baseURL: 'https://api.groq.com/openai/v1',
          });

          const file = new File([combined], 'audio.wav', { type: 'audio/wav' });
          const transcription = await groq.audio.transcriptions.create({
            model: 'whisper-large-v3',
            file,
          });

          if (transcription.text?.trim()) {
            entryCounter += 1;
            const entry: TranscriptEntry = {
              id: `${callId}-${entryCounter}`,
              speaker: 'customer',
              text: transcription.text.trim(),
              timestamp: Date.now(),
              confidence: 0.9,
            };
            broadcastTranscript(callId, entry);
          }
        } catch {
          // graceful degradation — skip this chunk
        }
      };

      transcribeTimer = setInterval(() => {
        void transcribeBuffer();
      }, TRANSCRIBE_INTERVAL_MS);

      const typedWs = ws as {
        on: (event: string, handler: (data: Buffer) => void) => void;
      };

      typedWs.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as {
            event: string;
            media?: { payload: string; track?: string };
          };
          if (msg.event === 'media' && msg.media?.payload) {
            audioBuffer.push(Buffer.from(msg.media.payload, 'base64'));
          }
        } catch {
          audioBuffer.push(data);
        }
      });

      typedWs.on('close' as string, (() => {
        if (transcribeTimer) {
          clearInterval(transcribeTimer);
        }
        void transcribeBuffer();
      }) as unknown as (data: Buffer) => void);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(`Failed to set up coaching WebSocket: ${message}`);
  }
};
