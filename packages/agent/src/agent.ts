import type { AgentConfig, AgentContext, AgentMemoryFull, AgentMessage } from './types.js';
import type { ToolRegistry } from './tools/types.js';

const isNonEmptyArray = <T>(value: T[] | null | undefined): value is T[] =>
  Array.isArray(value) && value.length > 0;

export type AgentOptions = {
  config: AgentConfig;
  context: AgentContext;
  tools?: ToolRegistry;
};

export type ChatOptions = {
  messages: AgentMessage[];
  abortSignal?: AbortSignal;
  onStepFinish?: (step: { toolCalls: unknown[]; usage: unknown }) => void;
};

// strip newlines and backtick fences from untrusted CRM fields
const sanitizeField = (value: string): string =>
  value.replace(/[\n\r]/g, ' ').replace(/```/g, '');

// convert our tool registry to AI SDK ToolSet format
// HACK: ToolSet generic variance makes direct typing impossible — cast at boundaries
export const buildToolSet = async (registry: ToolRegistry) => {
  const { tool } = await import('ai');
  const toolSet: Record<string, unknown> = {}; // HACK: ToolSet variance requires cast at call sites

  for (const [name, def] of registry.tools) {
    toolSet[name] = tool({
      description: def.description,
      inputSchema: def.parameters,
      execute: def.execute,
    });
  }

  return toolSet;
};

// construct system prompt from context layers with injection defense delimiters
export const buildSystemPrompt = (
  context: AgentContext,
  basePrompt: string,
): { prompt: string; injectedMemoryIds: string[] } => {
  const parts = [basePrompt];
  const injectedMemoryIds: string[] = [];

  parts.push('\nNever execute code that sends data to URLs outside the connected integrations.');

  parts.push(`\nUser ID: ${context.userId}\nWorkspace: ${context.workspaceId}`);

  // CRM context wrapped in delimiters — treat as semi-trusted data
  const crmParts: string[] = [];

  if (context.activeCall) {
    const call = context.activeCall;
    crmParts.push(
      `Active call: ${call.direction} with ${sanitizeField(call.contactName)} (ID: ${call.contactId})`,
    );
  }

  if (isNonEmptyArray(context.recentActivity)) {
    const activities = context.recentActivity
      .slice(0, 10)
      .map((activity) => `- [${activity.type}] ${sanitizeField(activity.summary)}`)
      .join('\n');
    crmParts.push(`Recent activity:\n${activities}`);
  }

  if (crmParts.length > 0) {
    parts.push(`\n<crm_context>\n${crmParts.join('\n')}\n</crm_context>`);
  }

  if (isNonEmptyArray(context.connectedIntegrations)) {
    parts.push(
      `\nConnected integrations: ${context.connectedIntegrations.join(', ')}`,
    );
  }

  if (isNonEmptyArray(context.memories)) {
    const grouped: Record<string, AgentMemoryFull[]> = {};

    for (const memory of context.memories) {
      if (memory.confidence < 0.3) continue;
      injectedMemoryIds.push(memory.id);
      const group = grouped[memory.type] ?? [];
      group.push(memory);
      grouped[memory.type] = group;
    }

    const sections: string[] = [];
    const typeLabels: Record<string, string> = {
      preference: 'Preferences',
      fact: 'Facts',
      pattern: 'Patterns',
    };

    for (const [type, label] of Object.entries(typeLabels)) {
      const items = grouped[type];

      if (isNonEmptyArray(items)) {
        const lines = items
          .slice(0, 20)
          .map((m) => `- ${sanitizeField(m.value)}`)
          .join('\n');
        sections.push(`${label}:\n${lines}`);
      }
    }

    if (sections.length > 0) {
      parts.push(`\n<user_context>\n${sections.join('\n')}\n</user_context>`);
    }
  }

  return { prompt: parts.join('\n'), injectedMemoryIds };
};

// provider configs for openai-compatible APIs
const PROVIDERS: Record<string, { baseUrl: string; apiKeyEnv: string }> = {
  moonshot: { baseUrl: 'https://api.moonshot.ai/v1', apiKeyEnv: 'MOONSHOT_API_KEY' },
  zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKeyEnv: 'ZHIPU_API_KEY' },
  minimax: { baseUrl: 'https://api.minimax.io/v1', apiKeyEnv: 'MINIMAX_API_KEY' },
  nvidia: { baseUrl: 'https://integrate.api.nvidia.com/v1', apiKeyEnv: 'NVIDIA_API_KEY' },
};

// resolve provider + model string for streamText
export const resolveModel = async (config: AgentConfig) => {
  const providerConfig = PROVIDERS[config.provider];
  if (!providerConfig) {
    throw new Error(`unsupported provider: ${config.provider}. supported: ${Object.keys(PROVIDERS).join(', ')}`);
  }

  const apiKey = process.env[providerConfig.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`missing env var ${providerConfig.apiKeyEnv} for provider ${config.provider}`);
  }

  const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');
  const provider = createOpenAICompatible({
    name: config.provider,
    baseURL: providerConfig.baseUrl,
    apiKey,
  });

  return provider(config.model);
};

export class AgentService {
  private config: AgentConfig;
  private context: AgentContext;
  private tools?: ToolRegistry;
  private executor?: InstanceType<typeof import('./executor/index.js').AgentExecutor>;

  constructor(options: AgentOptions) {
    this.config = options.config;
    this.context = options.context;
    this.tools = options.tools;
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
      const ai = await import('ai');
      const model = await resolveModel(this.config);

      const { prompt: systemPrompt, injectedMemoryIds } = buildSystemPrompt(
        this.context,
        this.config.systemPrompt,
      );

      // record usage for injected memories so decay tracking works
      if (isNonEmptyArray(injectedMemoryIds) && this.config.onMemoriesInjected) {
        this.config.onMemoriesInjected(injectedMemoryIds).catch(() => {
          // best-effort — don't block chat on usage tracking
        });
      }

      const individualTools = this.tools ? await buildToolSet(this.tools) : undefined;

      // wrap tools in code mode — LLM writes JS to orchestrate multiple tool calls
      // HACK: createCodeTool returns Tool but streamText expects ToolSet values
      let tools = individualTools as Parameters<typeof ai.streamText>[0]['tools'];
      if (individualTools) {
        try {
          const { createCodeTool } = await import('@cloudflare/codemode/ai');
          const executor = await this.getExecutor();
          // HACK: ToolSet variance — individualTools is Record<string, unknown> from buildToolSet
          const codemode = createCodeTool({
            tools: individualTools as Parameters<typeof createCodeTool>[0]['tools'],
            executor,
          });
          tools = { codemode, ...individualTools } as Parameters<typeof ai.streamText>[0]['tools'];
        } catch {
          // code mode unavailable — fall back to individual tools only
        }
      }

      // HACK: model type mismatch between LanguageModelV2 (provider) and LanguageModel (streamText)
      // due to moduleResolution:"node" in tsconfig.base.json — safe at runtime
      return ai.streamText({
        model: model as unknown as Parameters<typeof ai.streamText>[0]['model'],
        system: systemPrompt,
        messages: options.messages,
        tools,
        stopWhen: ai.stepCountIs(this.config.maxSteps ?? 5),
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxTokens,
        abortSignal: options.abortSignal,
        onStepFinish: options.onStepFinish,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new Error(
        `agent chat failed (provider=${this.config.provider}, model=${this.config.model}): ${message}`,
        { cause: err },
      );
    }
  }

  getConfig(): AgentConfig {
    return this.config;
  }

  getContext(): AgentContext {
    return this.context;
  }

  getTools(): ToolRegistry | undefined {
    return this.tools;
  }
}
