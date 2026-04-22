// agent service — thin wrapper around pi session
// old runtime (buildSystemPrompt, resolveModel, PROVIDERS, ai.streamText) removed in DEV-1260
// DEV-1263: chat() now returns AsyncIterable<PiStreamEvent> for streaming

import { Logger } from '@consuelo/logger';
import type { AgentConfig, AgentContext, AgentMessage } from './types.js';
import type {
  AfterTurnEvent,
  AfterTurnExtension,
} from './pi-extensions/after-turn.types.js';
import type { ContextInjection } from './pi-extensions/context-injection.js';
import type { PipelineIntelligence } from './pi-extensions/pipeline-intelligence.js';
import type { CoachingDetector } from './pi-extensions/coaching-extension.js';
import type { CoachingLifecycle } from './pi-extensions/coaching-lifecycle.js';
import type { TranscriptContextExtension } from './pi-extensions/transcript-extension.js';

const logger = new Logger('agent');

export type BeforeTurnExtension =
  | ContextInjection
  | PipelineIntelligence
  | CoachingDetector
  | TranscriptContextExtension
  | CoachingLifecycle;

// pi stream event types — emitted during session.prompt() streaming
export type PiTextDelta = { type: 'text_delta'; text: string };
export type PiToolCallStart = {
  type: 'tool_call_start';
  toolCallId: string;
  toolName: string;
  args?: Record<string, unknown>;
};
export type PiToolCallResult = {
  type: 'tool_call_result';
  toolCallId: string;
  result: unknown;
};
export type PiUsage = {
  type: 'usage';
  inputTokens: number;
  outputTokens: number;
};
export type PiDone = { type: 'done' };

export type PiStreamEvent =
  | PiTextDelta
  | PiToolCallStart
  | PiToolCallResult
  | PiUsage
  | PiDone;

export type PiSession = {
  prompt: (
    message: string,
    options?: { signal?: AbortSignal; model?: string },
  ) => AsyncIterable<PiStreamEvent>;
};

// kept for backward compat — aggregated result from consuming a full stream
export type PiSessionResult = {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
    error?: string;
  }>;
};

// model cycling — fast model for coaching (low latency), general model for everything else
export type ModelCyclingConfig = {
  coachingModel: string;
  generalModel: string;
};

export const DEFAULT_MODEL_CYCLING: ModelCyclingConfig = {
  coachingModel: 'openai/gpt-oss-120b',
  generalModel: 'openai/gpt-oss-120b',
};

export type AgentOptions = {
  config: AgentConfig;
  context: AgentContext;
  session: PiSession;
  beforeTurnExtensions?: BeforeTurnExtension[];
  afterTurnExtensions?: AfterTurnExtension[];
  modelCycling?: ModelCyclingConfig;
};

export type ChatOptions = {
  messages: AgentMessage[];
  conversationId: string;
  abortSignal?: AbortSignal;
  isCoaching?: boolean;
  model?: string;
  onStepFinish?: (step: { toolCalls: unknown[]; usage: unknown }) => void;
};

export class AgentService {
  private config: AgentConfig;
  private context: AgentContext;
  private session: PiSession;
  private beforeTurnExtensions: BeforeTurnExtension[];
  private afterTurnExtensions: AfterTurnExtension[];
  private modelCycling?: ModelCyclingConfig;

  private renderMessageContent(message: AgentMessage): string {
    if (typeof message.content === 'string') {
      return message.content;
    }

    if (!Array.isArray(message.content)) {
      return '';
    }

    return message.content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (!part || typeof part !== 'object') {
          return '';
        }

        const typedPart = part as { type?: unknown; text?: unknown };
        if (typedPart.type === 'text' && typeof typedPart.text === 'string') {
          return typedPart.text;
        }

        return '';
      })
      .filter((part) => part.length > 0)
      .join('\n');
  }

  private renderPrompt(messages: AgentMessage[]): string {
    return messages
      .map((message) => {
        const content = this.renderMessageContent(message).trim();
        if (content.length === 0) {
          return '';
        }

        return `${message.role.toUpperCase()}:\n${content}`;
      })
      .filter((content) => content.length > 0)
      .join('\n\n');
  }

  constructor(options: AgentOptions) {
    this.config = options.config;
    this.context = options.context;
    this.session = options.session;
    this.beforeTurnExtensions = options.beforeTurnExtensions ?? [];
    this.afterTurnExtensions = options.afterTurnExtensions ?? [];
    this.modelCycling = options.modelCycling;
  }

  // stream pi events — runs before-turn extensions, yields events, fires after-turn extensions on done
  async *chat(options: ChatOptions): AsyncGenerator<PiStreamEvent> {
    // run before-turn extensions (context injection, pipeline intelligence)
    let transformedMessages = options.messages;
    for (const ext of this.beforeTurnExtensions) {
      // HACK(DEV-1315): before-turn extensions use pi-agent-core's AgentMessage type
      // which differs from ai SDK's CoreMessage — safe at runtime, both are message arrays
      transformedMessages = (await ext.transformContext(
        transformedMessages as Parameters<typeof ext.transformContext>[0],
        options.abortSignal,
      )) as typeof transformedMessages;
    }

    // extract user message (last user message in the array)
    const lastUserMsg = [...transformedMessages]
      .reverse()
      .find((message) => message.role === 'user');
    const userText = lastUserMsg ? this.renderMessageContent(lastUserMsg) : '';
    const promptText = this.renderPrompt(transformedMessages);

    // delegate to pi session — yields stream events
    const model = this.resolveModel(options);
    const stream = this.session.prompt(promptText, {
      signal: options.abortSignal,
      model,
    });

    // accumulate for after-turn extensions
    let fullText = '';
    const toolCalls: Array<{
      name: string;
      args: Record<string, unknown>;
      result?: unknown;
      error?: string;
      toolCallId: string;
    }> = [];
    let usage: { inputTokens: number; outputTokens: number } | undefined;

    for await (const event of stream) {
      yield event;

      switch (event.type) {
        case 'text_delta':
          fullText += event.text;
          break;
        case 'tool_call_start':
          toolCalls.push({
            name: event.toolName,
            args: event.args ?? {},
            toolCallId: event.toolCallId,
          });
          break;
        case 'tool_call_result': {
          const tc = toolCalls.find((t) => t.toolCallId === event.toolCallId);
          if (tc) tc.result = event.result;
          break;
        }
        case 'usage':
          usage = {
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
          };
          break;
      }
    }

    // fire after-turn extensions (preference inference, turn grading)
    const afterTurnEvent: AfterTurnEvent = {
      messages: transformedMessages,
      userMessage: userText,
      assistantMessage: fullText,
      toolCalls,
      injectedMemoryIds: [],
      usage,
      metadata: {
        userId: this.context.userId,
        workspaceId: this.context.workspaceId,
        conversationId: options.conversationId,
      },
    };

    for (const ext of this.afterTurnExtensions) {
      ext.afterTurn(afterTurnEvent).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'unknown error';
        logger.error(`after-turn extension failed: ${message}`, {
          err,
          extension: ext.name,
          userId: this.context.userId,
        });
      });
    }
  }

  getConfig(): AgentConfig {
    return this.config;
  }

  getContext(): AgentContext {
    return this.context;
  }

  // resolve model for this turn — explicit > cycling > config default
  private resolveModel(options: ChatOptions): string | undefined {
    if (options.model) return options.model;
    if (!this.modelCycling) return undefined;

    const isCoaching = options.isCoaching ?? !!this.context.activeCall;
    return isCoaching
      ? this.modelCycling.coachingModel
      : this.modelCycling.generalModel;
  }
}
