import {
  Body,
  Controller,
  Post,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { createUIMessageStream, pipeUIMessageStreamToResponse } from 'ai';
import { type Response } from 'express';
import { type ExtendedUIMessage } from 'twenty-shared/ai';

import { RestApiExceptionFilter } from 'src/engine/api/rest/rest-api-exception.filter';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUserWorkspaceId } from 'src/engine/decorators/auth/auth-user-workspace-id.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { type BrowsingContextType } from 'src/engine/metadata-modules/ai/ai-agent/types/browsingContext.type';
import { ChatExecutionService } from 'src/engine/metadata-modules/ai/ai-chat/services/chat-execution.service';

type ChatBody = {
  messages: ExtendedUIMessage[];
  conversationId?: string;
  skillId?: string;
  browsingContext?: BrowsingContextType | null;
};

@Controller('v1/agent/chat')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
@UseFilters(RestApiExceptionFilter)
export class ChatController {
  constructor(private readonly chatExecutionService: ChatExecutionService) {}

  @Post()
  async chat(
    @Body() body: ChatBody,
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUserWorkspaceId() userWorkspaceId: string,
    @Res() response: Response,
  ) {
    const stream = createUIMessageStream<ExtendedUIMessage>({
      execute: async ({ writer }) => {
        try {
          const { stream: chatStream } =
            await this.chatExecutionService.streamChat({
              workspace,
              userWorkspaceId,
              messages: body.messages,
              browsingContext: body.browsingContext ?? null,
            });

          writer.merge(
            chatStream.toUIMessageStream({
              onError: (error) => {
                return error instanceof Error ? error.message : String(error);
              },
              sendStart: false,
            }),
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'unknown error';

          writer.write({
            type: 'error',
            errorText: message,
          });
        }
      },
      onError: () => 'Something went wrong. Please try again.',
    });

    pipeUIMessageStreamToResponse({ stream, response });
  }
}
