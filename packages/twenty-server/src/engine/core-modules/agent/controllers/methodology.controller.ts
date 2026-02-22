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
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { IsNull, Equal, Repository } from 'typeorm';

import { RestApiExceptionFilter } from 'src/engine/api/rest/rest-api-exception.filter';
import { AgentMethodologyEntity } from 'src/engine/core-modules/agent/entities/agent-methodology.entity';
import { AgentWorkspaceConfigEntity } from 'src/engine/core-modules/agent/entities/agent-workspace-config.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

type CreateMethodologyBody = {
  name: string;
  description: string;
  systemPrompt: string;
  qualificationCriteria: Record<string, unknown>[];
  scoringWeights?: Record<string, number> | null;
};

type UpdateMethodologyBody = Partial<CreateMethodologyBody>;

type UpdateConfigBody = {
  activeMethodologyId?: string;
  config?: Record<string, unknown>;
};

@Controller('v1/agent')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
@UseFilters(RestApiExceptionFilter)
export class AgentMethodologyController {
  constructor(
    @InjectRepository(AgentMethodologyEntity, 'core')
    private readonly methodologyRepo: Repository<AgentMethodologyEntity>,
    @InjectRepository(AgentWorkspaceConfigEntity, 'core')
    private readonly configRepo: Repository<AgentWorkspaceConfigEntity>,
  ) {}

  // --- methodology routes (literal before param) ---

  @Get('methodologies')
  async listMethodologies(@AuthWorkspace() workspace: WorkspaceEntity) {
    try {
      const methodologies = await this.methodologyRepo.find({
        where: [
          { workspaceId: IsNull() },
          { workspaceId: Equal(workspace.id) },
        ],
        order: { type: 'ASC', name: 'ASC' },
      });

      return { methodologies };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'failed to list methodologies';

      throw new HttpException(
        { error: { code: 'METHODOLOGY_LIST_FAILED', message } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('methodologies')
  async createMethodology(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: UserEntity,
    @Body() body: CreateMethodologyBody,
  ) {
    try {
      if (!body.name || !body.systemPrompt) {
        throw new HttpException(
          { error: { code: 'INVALID_REQUEST', message: 'name and systemPrompt are required' } },
          HttpStatus.BAD_REQUEST,
        );
      }

      const entity = this.methodologyRepo.create({
        name: body.name,
        type: 'custom',
        description: body.description ?? '',
        systemPrompt: body.systemPrompt,
        qualificationCriteria: body.qualificationCriteria ?? [],
        scoringWeights: body.scoringWeights ?? null,
        workspaceId: workspace.id,
        createdBy: user.id,
      });

      const saved = await this.methodologyRepo.save(entity);

      return { methodology: saved };
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;

      const message =
        err instanceof Error ? err.message : 'failed to create methodology';

      throw new HttpException(
        { error: { code: 'METHODOLOGY_CREATE_FAILED', message } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('methodologies/:id')
  async getMethodology(
    @Param('id') id: string,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ) {
    try {
      const methodology = await this.methodologyRepo.findOne({
        where: [
          { id, workspaceId: IsNull() },
          { id, workspaceId: Equal(workspace.id) },
        ],
      });

      if (!methodology) {
        throw new HttpException(
          { error: { code: 'NOT_FOUND', message: 'methodology not found' } },
          HttpStatus.NOT_FOUND,
        );
      }

      return { methodology };
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;

      const message =
        err instanceof Error ? err.message : 'failed to get methodology';

      throw new HttpException(
        { error: { code: 'METHODOLOGY_GET_FAILED', message } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('methodologies/:id')
  async updateMethodology(
    @Param('id') id: string,
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Body() body: UpdateMethodologyBody,
  ) {
    try {
      const methodology = await this.methodologyRepo.findOne({
        where: { id, workspaceId: Equal(workspace.id) },
      });

      if (!methodology) {
        throw new HttpException(
          { error: { code: 'NOT_FOUND', message: 'custom methodology not found' } },
          HttpStatus.NOT_FOUND,
        );
      }

      if (methodology.type === 'built-in') {
        throw new HttpException(
          { error: { code: 'FORBIDDEN', message: 'cannot modify built-in methodologies' } },
          HttpStatus.FORBIDDEN,
        );
      }

      if (body.name !== undefined) methodology.name = body.name;
      if (body.description !== undefined) methodology.description = body.description;
      if (body.systemPrompt !== undefined) methodology.systemPrompt = body.systemPrompt;
      if (body.qualificationCriteria !== undefined) methodology.qualificationCriteria = body.qualificationCriteria;
      if (body.scoringWeights !== undefined) methodology.scoringWeights = body.scoringWeights ?? null;

      const saved = await this.methodologyRepo.save(methodology);

      return { methodology: saved };
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;

      const message =
        err instanceof Error ? err.message : 'failed to update methodology';

      throw new HttpException(
        { error: { code: 'METHODOLOGY_UPDATE_FAILED', message } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('methodologies/:id')
  async deleteMethodology(
    @Param('id') id: string,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ) {
    try {
      const methodology = await this.methodologyRepo.findOne({
        where: { id, workspaceId: Equal(workspace.id) },
      });

      if (!methodology) {
        throw new HttpException(
          { error: { code: 'NOT_FOUND', message: 'custom methodology not found' } },
          HttpStatus.NOT_FOUND,
        );
      }

      if (methodology.type === 'built-in') {
        throw new HttpException(
          { error: { code: 'FORBIDDEN', message: 'cannot delete built-in methodologies' } },
          HttpStatus.FORBIDDEN,
        );
      }

      await this.methodologyRepo.remove(methodology);

      return { success: true };
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;

      const message =
        err instanceof Error ? err.message : 'failed to delete methodology';

      throw new HttpException(
        { error: { code: 'METHODOLOGY_DELETE_FAILED', message } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // --- config routes ---

  @Get('config')
  async getConfig(@AuthWorkspace() workspace: WorkspaceEntity) {
    try {
      const config = await this.configRepo.findOne({
        where: { workspaceId: Equal(workspace.id) },
        relations: ['activeMethodology'],
      });

      return { config: config ?? null };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'failed to get config';

      throw new HttpException(
        { error: { code: 'CONFIG_GET_FAILED', message } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('config')
  async updateConfig(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Body() body: UpdateConfigBody,
  ) {
    try {
      if (body.activeMethodologyId) {
        const methodology = await this.methodologyRepo.findOne({
          where: [
            { id: body.activeMethodologyId, workspaceId: IsNull() },
            { id: body.activeMethodologyId, workspaceId: Equal(workspace.id) },
          ],
        });

        if (!methodology) {
          throw new HttpException(
            { error: { code: 'NOT_FOUND', message: 'methodology not found' } },
            HttpStatus.NOT_FOUND,
          );
        }
      }

      let config = await this.configRepo.findOne({
        where: { workspaceId: Equal(workspace.id) },
      });

      if (config) {
        if (body.activeMethodologyId !== undefined) {
          config.activeMethodologyId = body.activeMethodologyId;
        }
        if (body.config !== undefined) config.config = body.config;
      } else {
        config = this.configRepo.create({
          workspaceId: workspace.id,
          activeMethodologyId: body.activeMethodologyId ?? '',
          config: body.config ?? null,
        });
      }

      const saved = await this.configRepo.save(config);
      const full = await this.configRepo.findOne({
        where: { id: saved.id },
        relations: ['activeMethodology'],
      });

      return { config: full };
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;

      const message =
        err instanceof Error ? err.message : 'failed to update config';

      throw new HttpException(
        { error: { code: 'CONFIG_UPDATE_FAILED', message } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
