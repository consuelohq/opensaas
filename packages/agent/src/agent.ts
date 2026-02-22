import type { AgentConfig, AgentContext, AgentMessage } from './types.js';
import type { ToolRegistry } from './tools/types.js';

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
export const buildToolSet = async (registry: ToolRegistry) => {
  const { tool } = await import('ai');
  // HACK: AI SDK ToolSet type is complex — build dynamically and let streamText infer
  const toolSet: Record<string, unknown> = {};

  for (const [name, def] of registry.tools) {
    toolSet[name] = tool({
      description: def.description,
      parameters: def.parameters,
      execute: def.execute,
    });
  }

  return toolSet;
};

// construct system prompt from context layers
export const buildSystemPrompt = (
  context: AgentContext,
  basePrompt: string,
): string => {
  const parts = [basePrompt];

  parts.push(`\nUser ID: ${context.userId}\nWorkspace: ${context.workspaceId}`);

  if (context.activeCall) {
    const call = context.activeCall;
    parts.push(
      `\nActive call: ${call.direction} with ${sanitizeField(call.contactName)} (ID: ${call.contactId})`,
    );
  }

  if (context.recentActivity.length > 0) {
    const activities = context.recentActivity
      .slice(0, 10)
      .map((activity) => `- [${activity.type}] ${sanitizeField(activity.summary)}`)
      .join('\n');
    parts.push(`\nRecent activity:\n${activities}`);
  }

  if (context.connectedIntegrations.length > 0) {
    parts.push(
      `\nConnected integrations: ${context.connectedIntegrations.join(', ')}`,
    );
  }

  if (context.memories.length > 0) {
    const memories = context.memories
      .slice(0, 5)
      .map((memory) => `- ${sanitizeField(memory.content)}`)
      .join('\n');
    parts.push(`\nMemories:\n${memories}`);
  }

  return parts.join('\n');
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

  constructor(options: AgentOptions) {
    this.config = options.config;
    this.context = options.context;
    this.tools = options.tools;
  }

  async chat(options: ChatOptions) {
    try {
      const ai = await import('ai');
      const model = await resolveModel(this.config);

      const systemPrompt = buildSystemPrompt(
        this.context,
        this.config.systemPrompt,
      );

      const toolSet = this.tools ? await buildToolSet(this.tools) : undefined;

      // HACK: model type mismatch between LanguageModelV2 (provider) and LanguageModel (streamText)
      // due to moduleResolution:"node" in tsconfig.base.json — safe at runtime
      return ai.streamText({
        model: model as unknown as Parameters<typeof ai.streamText>[0]['model'],
        system: systemPrompt,
        messages: options.messages,
        tools: toolSet as Parameters<typeof ai.streamText>[0]['tools'],
        maxSteps: this.config.maxSteps ?? 5,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
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
