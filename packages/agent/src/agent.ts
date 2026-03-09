// agent service — thin wrapper around pi session
// old runtime (buildSystemPrompt, resolveModel, PROVIDERS, ai.streamText) removed in DEV-1260
// pi-agent-core now handles: model routing, tool execution, streaming

import type { AgentConfig, AgentContext, AgentMessage } from './types.js';
import type { AfterTurnEvent, AfterTurnExtension } from './pi-extensions/after-turn.types.js';
import type { ContextInjection } from './pi-extensions/context-injection.js';
import type { PipelineIntelligence } from './pi-extensions/pipeline-intelligence.js';
import type { CoachingDetector } from './pi-extensions/coaching-extension.js';
import type { CoachingLifecycle } from './pi-extensions/coaching-lifecycle.js';

export type BeforeTurnExtension = ContextInjection | PipelineIntelligence | CoachingDetector | CoachingLifecycle;

export type PiSession = {
  prompt: (message: string, options?: { signal?: AbortSignal; model?: string }) => Promise<PiSessionResult>;
};

export type PiSessionResult = {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result?: unknown; error?: string }>;
};

// model cycling — fast model for coaching (low latency), general model for everything else
// ko: "let people choose their own provider... just make sure its documented where i can change them"
// change these defaults before launch — see DEV-1262
export type ModelCyclingConfig = {
  coachingModel: string;
  generalModel: string;
};

export const DEFAULT_MODEL_CYCLING: ModelCyclingConfig = {
  coachingModel: 'groq/gpt-oss-120b',
  generalModel: 'groq/gpt-oss-120b',
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
  private executor?: InstanceType<typeof import('./executor/index.js').AgentExecutor>;

  constructor(options: AgentOptions) {
    this.config = options.config;
    this.context = options.context;
    this.session = options.session;
    this.beforeTurnExtensions = options.beforeTurnExtensions ?? [];
    this.afterTurnExtensions = options.afterTurnExtensions ?? [];
    this.modelCycling = options.modelCycling;
  }

  private async getExecutor() {
    try {
      if (!this.executor) {
        const { AgentExecutor } = await import('./executor/index.js');
        this.executor = new AgentExecutor({ timeout: 30_000, memoryLimit: 128 });
      }
      return this.executor;
    } catch (err: unknown) {
      this.executor = undefined;
      throw err;
    }
  }

  async chat(options: ChatOptions) {
    try {
      // run before-turn extensions (context injection, pipeline intelligence)
      let transformedMessages = options.messages;
      for (const ext of this.beforeTurnExtensions) {
        // HACK: before-turn extensions use pi-agent-core's AgentMessage type
        // which differs from ai SDK's CoreMessage — safe at runtime, both are message arrays
        transformedMessages = await ext.transformContext(
          transformedMessages as Parameters<typeof ext.transformContext>[0],
          options.abortSignal,
        ) as typeof transformedMessages;
      }

      // extract user message (last user message in the array)
      const lastUserMsg = [...transformedMessages].reverse().find((m) => m.role === 'user');
      const userText = lastUserMsg && 'content' in lastUserMsg && typeof lastUserMsg.content === 'string'
        ? lastUserMsg.content
        : '';

      // delegate to pi session
      const model = this.resolveModel(options);
      const result = await this.session.prompt(userText, { signal: options.abortSignal, model });

      // run after-turn extensions (preference inference, turn grading)
      const afterTurnEvent: AfterTurnEvent = {
        messages: transformedMessages,
        userMessage: userText,
        assistantMessage: result.text,
        toolCalls: (result.toolCalls ?? []).map((tc) => ({
          name: tc.name,
          args: tc.args,
          result: tc.result,
          error: tc.error,
        })),
        injectedMemoryIds: [],
        usage: result.usage,
        metadata: {
          userId: this.context.userId,
          workspaceId: this.context.workspaceId,
          conversationId: options.conversationId,
        },
      };

      // fire-and-forget after-turn extensions
      for (const ext of this.afterTurnExtensions) {
        ext.afterTurn(afterTurnEvent).catch(() => {
          // best-effort — don't block response on extension failures
        });
      }

      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(`agent chat failed: ${message}`, { cause: err });
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
