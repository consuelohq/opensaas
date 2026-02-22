import type {
  ChatRequest,
  StreamChunk,
  ConversationStore,
  ConversationState,
  AgentConfig,
  AgentMessage,
} from './types.js';
import type { ContextLoader } from './context/index.js';
import type { ToolRegistry } from './tools/types.js';

export type ChatHandlerOptions = {
  config: AgentConfig;
  store: ConversationStore;
  contextLoader: ContextLoader;
  tools?: ToolRegistry;
};

export type ChatResult = {
  conversationId: string;
  stream: ReadableStream<string>;
};

const sseEncode = (chunk: StreamChunk): string =>
  `data: ${JSON.stringify(chunk)}\n\n`;

export async function handleChat(
  request: ChatRequest,
  userId: string,
  workspaceId: string,
  options: ChatHandlerOptions,
): Promise<ChatResult> {
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

  const stream = new ReadableStream<string>({
    async start(controller) {
      try {
        const result = await agent.chat({
          messages: conv.messages,
          onStepFinish: (step) => {
            // emit tool chunks for each step
            const calls = step.toolCalls as Array<{
              toolName: string;
              args: Record<string, unknown>;
            }>;
            if (calls) {
              for (const call of calls) {
                controller.enqueue(
                  sseEncode({
                    type: 'tool_start',
                    tool: call.toolName,
                    input: call.args,
                  }),
                );
              }
            }
          },
        });

        // stream text chunks
        for await (const textPart of result.textStream) {
          controller.enqueue(sseEncode({ type: 'text', content: textPart }));
        }

        // persist assistant response
        const finalText = await result.text;
        conv.messages.push({ role: 'assistant', content: finalText });
        conv.updatedAt = new Date();

        // persist token usage
        const usage = await result.usage;
        if (usage) {
          conv.tokenUsage.push({
            input: usage.promptTokens,
            cached: 0,
            output: usage.completionTokens,
            provider: config.provider,
          });
        }

        await store.save(conv);

        controller.enqueue(sseEncode({ type: 'done' }));
        controller.close();
      } catch (err: unknown) {
        controller.enqueue(
          sseEncode({
            type: 'text',
            content: `error: ${err instanceof Error ? err.message : 'unknown error'}`,
          }),
        );
        controller.enqueue(sseEncode({ type: 'done' }));
        controller.close();
      }
    },
  });

  return { conversationId, stream };
}
