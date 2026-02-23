import {
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { RestApiExceptionFilter } from 'src/engine/api/rest/rest-api-exception.filter';
import { ConversationService } from 'src/engine/core-modules/agent/services/conversation.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

type ListConversationsQuery = {
  limit?: string;
  offset?: string;
};

@Controller('v1/agent/conversations')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
@UseFilters(RestApiExceptionFilter)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get()
  async list(
    @AuthUser() user: UserEntity,
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Query() query: ListConversationsQuery,
  ) {
    try {
      const conversations = await this.conversationService.list(
        user.id,
        workspace.id,
        {
          limit: query.limit ? parseInt(query.limit, 10) : undefined,
          offset: query.offset ? parseInt(query.offset, 10) : undefined,
        },
      );

      return { conversations };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'failed to list conversations';

      throw new HttpException(
        { error: { code: 'CONVERSATION_LIST_FAILED', message } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async findById(@Param('id') id: string, @AuthUser() user: UserEntity) {
    try {
      const conversation = await this.conversationService.findById(id, user.id);

      if (!conversation) {
        throw new HttpException(
          { error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
          HttpStatus.NOT_FOUND,
        );
      }

      return { conversation };
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }

      const message =
        err instanceof Error ? err.message : 'failed to get conversation';

      throw new HttpException(
        { error: { code: 'CONVERSATION_GET_FAILED', message } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id/title')
  async updateTitle(@Param('id') id: string, @AuthUser() user: UserEntity) {
    try {
      // title auto-generation will be handled by the chat flow
      await this.conversationService.updateTitle(id, user.id, 'Updated');

      return { success: true };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'failed to update title';

      throw new HttpException(
        { error: { code: 'CONVERSATION_UPDATE_FAILED', message } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/pin')
  async togglePin(@Param('id') id: string, @AuthUser() user: UserEntity) {
    try {
      const pinned = await this.conversationService.togglePin(id, user.id);

      return { pinned };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'failed to toggle pin';

      throw new HttpException(
        { error: { code: 'CONVERSATION_PIN_FAILED', message } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @AuthUser() user: UserEntity) {
    try {
      await this.conversationService.delete(id, user.id);

      return { success: true };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'failed to delete conversation';

      throw new HttpException(
        { error: { code: 'CONVERSATION_DELETE_FAILED', message } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
