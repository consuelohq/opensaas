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
import { InjectRepository } from '@nestjs/typeorm';

import { type Repository } from 'typeorm';

import { RestApiExceptionFilter } from 'src/engine/api/rest/rest-api-exception.filter';
import { AgentSkillEntity } from 'src/engine/core-modules/agent/entities/agent-skill.entity';
import { AgentSkillFolderEntity } from 'src/engine/core-modules/agent/entities/agent-skill-folder.entity';
import type {
  SkillCategory,
  SkillOutputFormat,
  SkillTriggerType,
  SkillIntegrationRequirement,
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
  constructor(
    @InjectRepository(AgentSkillEntity)
    private readonly skillRepository: Repository<AgentSkillEntity>,
    @InjectRepository(AgentSkillFolderEntity)
    private readonly folderRepository: Repository<AgentSkillFolderEntity>,
  ) {}

  // literal routes before param routes

  @Get('folders')
  async listFolders(@AuthWorkspace() workspace: WorkspaceEntity) {
    const folders = await this.folderRepository.find({
      where: { workspaceId: workspace.id },
      order: { name: 'ASC' },
    });

    return { folders };
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
  async listSkills(
    @Query() query: ListSkillsQuery,
    @AuthUser() _user: UserEntity,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(query.limit ?? '20', 10) || 20),
    );

    const qb = this.skillRepository
      .createQueryBuilder('skill')
      .where('skill.workspaceId = :workspaceId', {
        workspaceId: workspace.id,
      })
      .andWhere('skill.deletedAt IS NULL');

    if (query.category) {
      qb.andWhere('skill.category = :category', {
        category: query.category,
      });
    }

    if (query.type) {
      qb.andWhere('skill.type = :type', { type: query.type });
    }

    if (query.folderId) {
      qb.andWhere('skill.folderId = :folderId', {
        folderId: query.folderId,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(skill.name ILIKE :search OR skill.description ILIKE :search)',
        {
          search: `%${query.search}%`,
        },
      );
    }

    const [skills, total] = await qb
      .orderBy('skill.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      skills,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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
