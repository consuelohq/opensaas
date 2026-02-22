import type {
  ChatRequest,
  ConversationStore,
  ConversationState,
  AgentConfig,
  AgentMessage,
} from './types.js';
import type { ContextLoader } from './context/index.js';
import type { ToolRegistry } from './tools/types.js';
import type { TracingService } from './tracing/index.js';

export type ChatHandlerOptions = {
  config: AgentConfig;
  store: ConversationStore;
  contextLoader: ContextLoader;
  tools?: ToolRegistry;
  tracing?: TracingService;
};

export type ChatResult = {
  conversationId: string;
  response: Response;
};

export const handleChat = async (
  request: ChatRequest,
  userId: string,
  workspaceId: string,
  options: ChatHandlerOptions,
): Promise<ChatResult> => {
  const { config, store, contextLoader, tools } = options;

  // load or create conversation
  let conversation: ConversationState | null = null;
  if (request.conversationId) {
    conversation = await store.load(request.conversationId);
  }
  if (!conversation) {
    conversation = await store.create(userId, workspaceId);
  }

  // append user message
  const userMessage: AgentMessage = { role: 'user', content: request.message };
  conversation.messages.push(userMessage);
  if (request.skillId) conversation.activeSkillId = request.skillId;

  // load context + build agent
  const context = await contextLoader.load(userId, workspaceId);
  const { AgentService } = await import('./agent.js');
  const agent = new AgentService({ config, context, tools });

  const conversationId = conversation.id;
  const conv = conversation;
  const trace = options.tracing
    ? await options.tracing.startTrace({ userId, conversationId: conv.id, skillId: request.skillId })
    : null;

  const ai = await import('ai');

  // AI SDK UI message stream — text, tool calls, tool results all handled by protocol
  const stream = ai.createUIMessageStream({
    execute: async ({ writer }) => {
      try {
        const result = await agent.chat({
          messages: conv.messages,
          onStepFinish: (step) => {
            if (options.tracing) {
              options.tracing.logStep({
                trace,
                conversationId: conv.id,
                model: config.model,
                step: step as Parameters<TracingService['logStep']>[0]['step'],
              }).catch(() => {});
            }
          },
        });

        // merge streamText output into UI message stream
        writer.merge(result.toUIMessageStream());

        // persist after stream completes
        const finalText = await result.text;
        conv.messages.push({ role: 'assistant', content: finalText });
        conv.updatedAt = new Date();

        const usage = await result.usage;
        if (usage) {
          conv.tokenUsage.push({
            input: usage.inputTokens ?? 0,
            cached: 0,
            output: usage.outputTokens ?? 0,
            provider: config.provider,
          });
        }

        await store.save(conv);
        if (options.tracing) await options.tracing.flush();
      } catch (err: unknown) {
        conv.updatedAt = new Date();
        await store.save(conv).catch(() => {});
        throw err;
      }
    },
    onError: () => 'Something went wrong. Please try again.',
  });

  const response = ai.createUIMessageStreamResponse({ stream });

  return { conversationId, response };
};
