import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Put,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { RestApiExceptionFilter } from 'src/engine/api/rest/rest-api-exception.filter';
import { AgentMemoryService } from 'src/engine/core-modules/agent/services/memory.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

type UpdateMemoryBody = {
  value?: string;
  confidence?: number;
  type?: 'preference' | 'fact' | 'pattern';
};

type ListMemoriesQuery = {
  type?: 'preference' | 'fact' | 'pattern';
  limit?: string;
  offset?: string;
};

@Controller('v1/agent/memory')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
@UseFilters(RestApiExceptionFilter)
export class AgentMemoryController {
  constructor(private readonly memoryService: AgentMemoryService) {}

  @Get()
  async listMemories(
    @AuthUser() user: UserEntity,
    @Query() query: ListMemoriesQuery,
  ) {
    try {
      const memories = await this.memoryService.list(user.id, {
        type: query.type,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });

      return { memories };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'failed to list memories';

      throw new HttpException(
        { error: { code: 'MEMORY_LIST_FAILED', message } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  async updateMemory(
    @Param('id') id: string,
    @AuthUser() user: UserEntity,
    @Body() body: UpdateMemoryBody,
  ) {
    try {
      const memory = await this.memoryService.update(id, user.id, body);

      return { memory };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'failed to update memory';

      throw new HttpException(
        { error: { code: 'MEMORY_UPDATE_FAILED', message } },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Delete(':id')
  async deleteMemory(@Param('id') id: string, @AuthUser() user: UserEntity) {
    try {
      await this.memoryService.delete(id, user.id);

      return { success: true };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'failed to delete memory';

      throw new HttpException(
        { error: { code: 'MEMORY_DELETE_FAILED', message } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
