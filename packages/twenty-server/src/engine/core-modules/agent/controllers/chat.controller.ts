import {
  Body,
  Controller,
  Post,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import {
  convertToModelMessages,
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
  streamText,
} from 'ai';
import { type Response } from 'express';

import { RestApiExceptionFilter } from 'src/engine/api/rest/rest-api-exception.filter';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';

type ChatBody = {
  messages: Array<{
    role: string;
    parts?: Array<{ type: string; text?: string }>;
    content?: string;
  }>;
  conversationId?: string;
  skillId?: string;
};

@Controller('v1/agent/chat')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
@UseFilters(RestApiExceptionFilter)
export class ChatController {
  constructor(private readonly aiModelRegistry: AiModelRegistryService) {}

  @Post()
  async chat(
    @Body() body: ChatBody,
    @AuthUser() user: UserEntity,
    @Res() response: Response,
  ) {
    const models = this.aiModelRegistry.getAvailableModels();

    if (models.length === 0) {
      response.status(503).json({
        error: {
          code: 'NO_AI_MODELS',
          message:
            'No AI models configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GROQ_API_KEY.',
        },
      });

      return;
    }

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        try {
          const result = streamText({
            model: models[0].model,
            system: `You are Consuelo, an AI sales assistant. You help sales reps with coaching, call prep, CRM data, and pipeline management. Be concise and actionable. The current user is ${user.firstName ?? 'a team member'}.`,
            messages: convertToModelMessages(body.messages),
          });

          writer.merge(result.toUIMessageStream());
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
