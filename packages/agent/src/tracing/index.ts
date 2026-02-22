import type { ExecutionStore, CreateExecutionInput } from '../types.js';

export type { ExecutionStore, CreateExecutionInput };

export type LangfuseConfig = {
  publicKey: string;
  secretKey: string;
  baseUrl?: string;
};

// wraps langfuse SDK for agent trace lifecycle
// langfuse is a peer dep — fully lazy imported, no compile-time dependency
export class TracingService {
  private config: LangfuseConfig | null;
  private executionStore?: ExecutionStore;
  // HACK: langfuse client stored as unknown — peer dep types not available at compile time
  private client: unknown = null;

  constructor(options: { langfuse?: LangfuseConfig; executionStore?: ExecutionStore }) {
    this.config = options.langfuse ?? null;
    this.executionStore = options.executionStore;
  }

  async startTrace(options: { userId: string; conversationId: string; skillId?: string }): Promise<unknown> {
    if (!this.config) return null;
    try {
      const client = await this.getClient();
      if (!client) return null;
      // HACK: langfuse types not available — cast to call trace()
      return (client as { trace: (opts: Record<string, unknown>) => unknown }).trace({
        name: 'agent-chat',
        userId: options.userId,
        metadata: { skillId: options.skillId, conversationId: options.conversationId },
      });
    } catch (_err: unknown) {
      // Sentry.captureException — tracing failure is non-fatal
      return null;
    }
  }

  async logStep(options: {
    trace: unknown;
    conversationId: string;
    model: string;
    step: {
      toolCalls?: Array<{ toolName: string; args: Record<string, unknown> }>;
      toolResults?: Array<{ result: unknown }>;
      usage?: { promptTokens: number; completionTokens: number };
      durationMs?: number;
    };
  }): Promise<void> {
    const { trace, conversationId, model, step } = options;

    if (trace && this.config) {
      try {
        // HACK: langfuse trace type not available at compile time
        (trace as { generation: (opts: Record<string, unknown>) => void }).generation({
          name: step.toolCalls?.[0]?.toolName ?? 'llm-response',
          model,
          usage: step.usage ? { input: step.usage.promptTokens, output: step.usage.completionTokens } : undefined,
        });
      } catch (_err: unknown) {
        // Sentry.captureException — non-fatal
      }
    }

    if (this.executionStore) {
      try {
        const input: CreateExecutionInput = {
          conversationId,
          type: step.toolCalls?.length ? 'tool_call' : 'llm_response',
          status: 'completed',
          toolName: step.toolCalls?.[0]?.toolName,
          input: step.toolCalls?.[0]?.args,
          output: step.toolResults?.[0]?.result as Record<string, unknown> | undefined,
          durationMs: step.durationMs,
        };
        await this.executionStore.create(input);
      } catch (_err: unknown) {
        // Sentry.captureException — non-fatal
      }
    }
  }

  async flush(): Promise<void> {
    if (!this.client || !this.config) return;
    try {
      // HACK: langfuse client type not available at compile time
      await (this.client as { flushAsync: () => Promise<void> }).flushAsync();
    } catch (_err: unknown) {
      // Sentry.captureException — non-fatal
    }
  }

  private async getClient(): Promise<unknown> {
    if (this.client) return this.client;
    if (!this.config) return null;
    try {
      const { Langfuse } = await import('langfuse');
      this.client = new Langfuse({
        publicKey: this.config.publicKey,
        secretKey: this.config.secretKey,
        baseUrl: this.config.baseUrl,
      });
      return this.client;
    } catch (_err: unknown) {
      // Sentry.captureException — langfuse not installed or config invalid
      this.client = null;
      return null;
    }
  }
}
