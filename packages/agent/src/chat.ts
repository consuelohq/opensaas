// chat endpoint handler — HTTP layer for agent conversations
// DEV-1263: migrated to pi's stream format — direct SSE, no Vercel AI SDK

import * as Sentry from '@sentry/node';
import { Logger } from '@consuelo/logger';
import type { ChatRequest, AgentConfig } from './types.js';
import type { ContextLoader } from './context/index.js';
import type { TracingService } from './tracing/index.js';
import type { PiStreamEvent, BeforeTurnExtension } from './agent.js';
import type { AfterTurnExtension } from './pi-extensions/after-turn.types.js';
import type {
  SessionManager,
  AgentSessionData,
} from './pi-extensions/database-session-manager.js';

const logger = new Logger('agent:chat');

// pi session — injected by the NestJS service layer
import type { PiSession } from './agent.js';

// SSE event types sent to the frontend
export type SseTextEvent = { type: 'text'; content: string };
export type SseToolCallEvent = {
  type: 'tool_call';
  id: string;
  name: string;
  args?: Record<string, unknown>;
};
export type SseToolResultEvent = {
  type: 'tool_result';
  id: string;
  result: unknown;
};
export type SseUsageEvent = {
  type: 'usage';
  inputTokens: number;
  outputTokens: number;
};
export type SseSessionEvent = { type: 'session'; sessionId: string };
export type SseDoneEvent = { type: 'done' };
export type SseErrorEvent = { type: 'error'; message: string };

export type SseEvent =
  | SseTextEvent
  | SseToolCallEvent
  | SseToolResultEvent
  | SseUsageEvent
  | SseSessionEvent
  | SseDoneEvent
  | SseErrorEvent;

export type ChatHandlerOptions = {
  config: AgentConfig;
  contextLoader: ContextLoader;
  session: PiSession;
  sessionManager: SessionManager;
  beforeTurnExtensions?: BeforeTurnExtension[];
  afterTurnExtensions?: AfterTurnExtension[];
  tracing?: TracingService;
};

export type ChatResult = {
  sessionId: string;
  stream: ReadableStream<Uint8Array>;
};

const encoder = new TextEncoder();

const sseEncode = (event: SseEvent): Uint8Array =>
  encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

// map pi stream events to our SSE format
const mapEvent = (event: PiStreamEvent): SseEvent | null => {
  switch (event.type) {
    case 'text_delta':
      return { type: 'text', content: event.text };
    case 'tool_call_start':
      return {
        type: 'tool_call',
        id: event.toolCallId,
        name: event.toolName,
        args: event.args,
      };
    case 'tool_call_result':
      return {
        type: 'tool_result',
        id: event.toolCallId,
        result: event.result,
      };
    case 'usage':
      return {
        type: 'usage',
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
      };
    case 'done':
      return { type: 'done' };
    default:
      return null;
  }
};

export const handleChat = async (
  request: ChatRequest,
  userId: string,
  workspaceId: string,
  options: ChatHandlerOptions,
): Promise<ChatResult> => {
  const { config, contextLoader, session, sessionManager } = options;

  // lazy session creation — load existing or create new
  let sessionData: AgentSessionData | null = null;
  if (request.conversationId) {
    sessionData = await sessionManager.load(request.conversationId);
  }
  if (!sessionData) {
    sessionData = {
      id: crypto.randomUUID(),
      workspaceId,
      userId,
      messages: [],
      systemPrompt: config.systemPrompt,
      modelId: config.model,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await sessionManager.save(sessionData);
  }

  const sessionId = sessionData.id;

  // load context + build agent
  const context = await contextLoader.load(userId, workspaceId);
  const { AgentService } = await import('./agent.js');
  const agent = new AgentService({
    config,
    context,
    session,
    beforeTurnExtensions: options.beforeTurnExtensions,
    afterTurnExtensions: options.afterTurnExtensions,
  });

  // build SSE stream
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // send session ID first so frontend can reuse it
        controller.enqueue(sseEncode({ type: 'session', sessionId }));

        // pi manages conversation history — only pass the new user message
        const userMessage = { role: 'user' as const, content: request.message };

        // stream pi events, mapping to SSE format
        const piStream = agent.chat({
          messages: [userMessage],
          conversationId: sessionId,
          isCoaching: !!context.activeCall,
        });

        for await (const event of piStream) {
          const mapped = mapEvent(event);
          if (mapped) controller.enqueue(sseEncode(mapped));
        }

        // update session timestamp (pi manages message history)
        sessionData.updatedAt = new Date().toISOString();
        await sessionManager.save(sessionData);

        if (options.tracing) await options.tracing.flush();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'streaming failed';
        logger.error(
          { err, userId, workspaceId, sessionId },
          `chat stream error: ${message}`,
        );
        Sentry.captureException(err, {
          tags: { component: 'chat-handler' },
          user: { id: userId },
        });
        controller.enqueue(sseEncode({ type: 'error', message }));
        controller.enqueue(sseEncode({ type: 'done' }));
      } finally {
        controller.close();
      }
    },
  });

  return { sessionId, stream };
};
