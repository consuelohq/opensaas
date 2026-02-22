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

import { RestApiExceptionFilter } from 'src/engine/api/rest/rest-api-exception.filter';
import { AutomationService } from 'src/engine/core-modules/agent/services/automation.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

type CreateAutomationBody = {
  name: string;
  description?: string;
  enabled?: boolean;
  skillId: string;
  triggerConfig: Record<string, unknown>;
  inputOverrides?: Record<string, unknown>;
  notifyOn?: string;
  maxRunsPerDay?: number | null;
};

type UpdateAutomationBody = Partial<CreateAutomationBody>;

@Controller('v1/agent/automations')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
@UseFilters(RestApiExceptionFilter)
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  // literal routes before param routes

  @Get()
  async listAutomations(
    @AuthUser() user: UserEntity,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ) {
    try {
      return await this.automationService.findByUser(user.id, workspace.id);
    } catch (err: unknown) {
      throw new HttpException(
        { error: { code: 'LIST_FAILED', message: err instanceof Error ? err.message : 'unknown error' } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  async createAutomation(
    @Body() body: CreateAutomationBody,
    @AuthUser() user: UserEntity,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ) {
    try {
      return await this.automationService.create({
        ...body,
        description: body.description ?? null,
        enabled: body.enabled ?? true,
        inputOverrides: body.inputOverrides ?? {},
        notifyOn: body.notifyOn ?? 'failure',
        maxRunsPerDay: body.maxRunsPerDay ?? null,
        userId: user.id,
        workspaceId: workspace.id,
      });
    } catch (err: unknown) {
      throw new HttpException(
        { error: { code: 'CREATE_FAILED', message: err instanceof Error ? err.message : 'unknown error' } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // param routes

  @Get(':id')
  async getAutomation(@Param('id') id: string) {
    try {
      const automation = await this.automationService.findById(id);

      if (!automation) {
        throw new HttpException(
          { error: { code: 'NOT_FOUND', message: `Automation ${id} not found` } },
          HttpStatus.NOT_FOUND,
        );
      }

      return automation;
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        { error: { code: 'GET_FAILED', message: err instanceof Error ? err.message : 'unknown error' } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id')
  async updateAutomation(
    @Param('id') id: string,
    @Body() body: UpdateAutomationBody,
  ) {
    try {
      return await this.automationService.update(id, body);
    } catch (err: unknown) {
      throw new HttpException(
        { error: { code: 'UPDATE_FAILED', message: err instanceof Error ? err.message : 'unknown error' } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async deleteAutomation(@Param('id') id: string) {
    try {
      await this.automationService.delete(id);

      return { success: true };
    } catch (err: unknown) {
      throw new HttpException(
        { error: { code: 'DELETE_FAILED', message: err instanceof Error ? err.message : 'unknown error' } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/toggle')
  async toggleAutomation(@Param('id') id: string) {
    try {
      const automation = await this.automationService.findById(id);

      if (!automation) {
        throw new HttpException(
          { error: { code: 'NOT_FOUND', message: `Automation ${id} not found` } },
          HttpStatus.NOT_FOUND,
        );
      }

      return await this.automationService.update(id, {
        enabled: !automation.enabled,
      });
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        { error: { code: 'TOGGLE_FAILED', message: err instanceof Error ? err.message : 'unknown error' } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/run')
  async manualRun(@Param('id') _id: string) {
    // STUB: DEV-964 — manual run not yet implemented
    throw new HttpException(
      {
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Manual run not yet implemented — waiting on DEV-964',
        },
      },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
