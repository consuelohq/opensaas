// chat endpoint handler — HTTP layer for agent conversations
// updated in DEV-1260 to use pi session instead of old ai.streamText() flow

import type {
  ChatRequest,
  ConversationStore,
  ConversationState,
  AgentConfig,
  AgentMessage,
} from './types.js';
import type { ContextLoader } from './context/index.js';
import type { TracingService } from './tracing/index.js';
import type { PiSession } from './agent.js';
import type { BeforeTurnExtension } from './agent.js';
import type { AfterTurnExtension } from './pi-extensions/after-turn.types.js';

export type ChatHandlerOptions = {
  config: AgentConfig;
  store: ConversationStore;
  contextLoader: ContextLoader;
  session: PiSession;
  beforeTurnExtensions?: BeforeTurnExtension[];
  afterTurnExtensions?: AfterTurnExtension[];
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
  const { config, store, contextLoader, session } = options;

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
  const agent = new AgentService({
    config,
    context,
    session,
    beforeTurnExtensions: options.beforeTurnExtensions,
    afterTurnExtensions: options.afterTurnExtensions,
  });

  const conversationId = conversation.id;
  const conv = conversation;
  const trace = options.tracing
    ? await options.tracing.startTrace({ userId, conversationId: conv.id, skillId: request.skillId })
    : null;

  const ai = await import('ai');

  // AI SDK UI message stream — pi session result piped through protocol
  const stream = ai.createUIMessageStream({
    execute: async ({ writer }) => {
      try {
        const result = await agent.chat({
          messages: conv.messages,
          conversationId: conv.id,
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

        // write assistant text to UI stream as a text-delta event
        // pi session returns complete text, not a stream — emit as single delta
        const msgId = `msg-${Date.now()}`;
        writer.write({ type: 'text-delta', delta: result.text, id: msgId });

        // persist after completion
        conv.messages.push({ role: 'assistant', content: result.text });
        conv.updatedAt = new Date();

        if (result.usage) {
          conv.tokenUsage.push({
            input: result.usage.inputTokens,
            cached: 0,
            output: result.usage.outputTokens,
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
