import {
  Body,
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
import type {
  Skill,
  SkillCategory,
  SkillFolder,
  SkillIntegrationRequirement,
  SkillOutputFormat,
  SkillTriggerType,
} from 'src/engine/core-modules/agent/types';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

type CreateSkillBody = {
  name: string;
  description?: string;
  icon?: string;
  category: SkillCategory;
  tools: string[];
  systemPrompt: string;
  sandboxTemplate?: string;
  triggers?: SkillTriggerType[];
  inputSchema?: Record<string, unknown>;
  outputFormat?: SkillOutputFormat;
  integrations?: SkillIntegrationRequirement[];
  folderId?: string;
  isPublic?: boolean;
};

type UpdateSkillBody = Partial<Omit<CreateSkillBody, 'type'>>;

type CreateFolderBody = {
  name: string;
  icon?: string;
  parentFolderId?: string;
};

type ListSkillsQuery = {
  category?: SkillCategory;
  type?: 'pre-built' | 'custom';
  folderId?: string;
  search?: string;
  page?: string;
  limit?: string;
};

type PaginatedSkills = {
  skills: Skill[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

// STUB: DEV-948 — all methods throw 501 until storage layer is wired
const notImplemented = (route: string): never => {
  throw new HttpException(
    {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: `${route} not yet implemented — waiting on DEV-948 (storage)`,
      },
    },
    HttpStatus.NOT_IMPLEMENTED,
  );
};

@Controller('v1/agent/skills')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
@UseFilters(RestApiExceptionFilter)
export class SkillController {
  // literal routes before param routes

  @Get('folders')
  listFolders(
    @AuthWorkspace() _workspace: WorkspaceEntity,
  ): never {
    return notImplemented('GET /v1/agent/skills/folders');
  }

  @Post('folders')
  createFolder(
    @Body() _body: CreateFolderBody,
    @AuthUser() _user: UserEntity,
    @AuthWorkspace() _workspace: WorkspaceEntity,
  ): never {
    return notImplemented('POST /v1/agent/skills/folders');
  }

  @Get()
  listSkills(
    @Query() _query: ListSkillsQuery,
    @AuthUser() _user: UserEntity,
    @AuthWorkspace() _workspace: WorkspaceEntity,
  ): never {
    return notImplemented('GET /v1/agent/skills');
  }

  @Post()
  createSkill(
    @Body() _body: CreateSkillBody,
    @AuthUser() _user: UserEntity,
    @AuthWorkspace() _workspace: WorkspaceEntity,
  ): never {
    return notImplemented('POST /v1/agent/skills');
  }

  @Get(':id')
  getSkill(
    @Param('id') _id: string,
    @AuthUser() _user: UserEntity,
    @AuthWorkspace() _workspace: WorkspaceEntity,
  ): never {
    return notImplemented('GET /v1/agent/skills/:id');
  }

  @Patch(':id')
  updateSkill(
    @Param('id') _id: string,
    @Body() _body: UpdateSkillBody,
    @AuthUser() _user: UserEntity,
    @AuthWorkspace() _workspace: WorkspaceEntity,
  ): never {
    return notImplemented('PATCH /v1/agent/skills/:id');
  }

  @Delete(':id')
  deleteSkill(
    @Param('id') _id: string,
    @AuthUser() _user: UserEntity,
    @AuthWorkspace() _workspace: WorkspaceEntity,
  ): never {
    return notImplemented('DELETE /v1/agent/skills/:id');
  }

  @Post(':id/duplicate')
  duplicateSkill(
    @Param('id') _id: string,
    @AuthUser() _user: UserEntity,
    @AuthWorkspace() _workspace: WorkspaceEntity,
  ): never {
    return notImplemented('POST /v1/agent/skills/:id/duplicate');
  }
}
