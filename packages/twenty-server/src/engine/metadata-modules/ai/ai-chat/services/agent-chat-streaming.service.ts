import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { type Response } from 'express';
import { type ExtendedUIMessage } from 'twenty-shared/ai';
import { type Repository } from 'typeorm';

import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AgentMessageRole } from 'src/engine/metadata-modules/ai/ai-agent-execution/entities/agent-message.entity';
import {
  AgentException,
  AgentExceptionCode,
} from 'src/engine/metadata-modules/ai/ai-agent/agent.exception';
import { type BrowsingContextType } from 'src/engine/metadata-modules/ai/ai-agent/types/browsingContext.type';
import { AgentChatThreadEntity } from 'src/engine/metadata-modules/ai/ai-chat/entities/agent-chat-thread.entity';
import { PiAgentService } from 'src/engine/metadata-modules/pi-agent/pi-agent.service';

import { AgentChatService } from './agent-chat.service';
import { ChatExecutionService } from './chat-execution.service';

export type StreamAgentChatOptions = {
  threadId: string;
  userWorkspaceId: string;
  workspace: WorkspaceEntity;
  response: Response;
  messages: ExtendedUIMessage[];
  browsingContext: BrowsingContextType | null;
};

@Injectable()
export class AgentChatStreamingService {
  constructor(
    @InjectRepository(AgentChatThreadEntity)
    private readonly threadRepository: Repository<AgentChatThreadEntity>,
    private readonly agentChatService: AgentChatService,
    private readonly chatExecutionService: ChatExecutionService,
    private readonly piAgentService: PiAgentService,
  ) {}

  async streamAgentChat({
    threadId,
    userWorkspaceId,
    workspace,
    messages,
    browsingContext,
    response,
  }: StreamAgentChatOptions) {
    const thread = await this.threadRepository.findOne({
      where: {
        id: threadId,
        userWorkspaceId,
      },
    });

    if (!thread) {
      throw new AgentException(
        'Thread not found',
        AgentExceptionCode.AGENT_EXECUTION_FAILED,
      );
    }

    // save user message (fire-and-forget for faster time-to-first-letter)
    const lastUserText =
      messages[messages.length - 1]?.parts.find((part) => part.type === 'text')
        ?.text ?? '';

    const userMessagePromise = this.agentChatService.addMessage({
      threadId: thread.id,
      uiMessage: {
        role: AgentMessageRole.USER,
        parts: [{ type: 'text', text: lastUserText }],
      },
    });

    userMessagePromise.catch(() => {});

    try {
      // stream via piagent — returns pi-format SSE ReadableStream
      const { stream } = await this.piAgentService.streamChat(
        {
          workspace,
          userWorkspaceId,
          messages,
          browsingContext,
        },
        threadId,
      );

      // set SSE headers
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');

      // pipe the SSE stream to the response, collecting text for persistence
      const reader = stream.getReader();
      let fullText = '';
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          // write raw SSE bytes to response
          response.write(value);

          // parse SSE events to collect assistant text for DB persistence
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;

            try {
              const event = JSON.parse(line.slice(6)) as {
                type: string;
                content?: string;
              };

              if (event.type === 'text' && event.content) {
                fullText += event.content;
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // persist assistant message
      if (fullText.length > 0) {
        const userMessage = await userMessagePromise;

        await this.agentChatService.addMessage({
          threadId: thread.id,
          uiMessage: {
            role: AgentMessageRole.ASSISTANT,
            parts: [{ type: 'text', text: fullText }],
          } as ExtendedUIMessage,
          turnId: userMessage.turnId,
        });
      }

      response.end();
    } catch (error) {
      response.end();
      throw error;
    }
  }
}
