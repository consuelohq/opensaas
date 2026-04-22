import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { Request, Response } from 'express';

import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { QueuesService } from 'src/engine/core-modules/consuelo-api/services/queues.service';

type AuthRequest = Request & {
  workspace?: { id: string };
  user?: { id: string };
};

@Controller('api/v1')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  @Post('queues')
  async createQueue(
    @Req() request: AuthRequest,
    @Body() body: Record<string, unknown>,
  ) {
    try {
      const workspaceId = request.workspace?.id;
      const userId = request.user?.id;

      if (!workspaceId || !userId) {
        throw new UnauthorizedException('Authentication required');
      }

      const name = String(body.name ?? '').trim();
      const contactIds = Array.isArray(body.contactIds)
        ? body.contactIds.map((contactId) => String(contactId))
        : [];

      if (name.length === 0 || contactIds.length === 0) {
        throw new BadRequestException('name and contactIds[] required');
      }

      const queue = await this.queuesService.createQueue({
        workspaceId,
        userId,
        name,
        sourceType: body.sourceType ? String(body.sourceType) : 'manual',
        sourceId: body.sourceId ? String(body.sourceId) : undefined,
        category: body.category ? String(body.category) : 'all',
        settings: (body.settings as Record<string, unknown> | undefined) ?? {},
        contactIds,
      });

      return queue;
    } finally {
      // noop
    }
  }

  @Get('queues')
  async listQueues(
    @Req() request: AuthRequest,
    @Query('sourceType') sourceType?: string,
    @Query('sourceId') sourceId?: string,
  ) {
    try {
      const workspaceId = request.workspace?.id;

      if (!workspaceId) {
        throw new UnauthorizedException('Authentication required');
      }

      return this.queuesService.listQueues(workspaceId, {
        sourceType,
        sourceId,
      });
    } finally {
      // noop
    }
  }

  @Get('queues/:id')
  async getQueue(@Req() request: AuthRequest, @Param('id') id: string) {
    try {
      const workspaceId = request.workspace?.id;

      if (!workspaceId) {
        throw new UnauthorizedException('Authentication required');
      }

      const queue = await this.queuesService.getQueue(workspaceId, id);

      if (!queue) {
        throw new NotFoundException('Queue not found');
      }

      return queue;
    } finally {
      // noop
    }
  }

  @Post('queues/:id/start')
  async startQueue(@Req() request: AuthRequest, @Param('id') id: string) {
    try {
      const workspaceId = request.workspace?.id;

      if (!workspaceId) {
        throw new UnauthorizedException('Authentication required');
      }

      const result = await this.queuesService.startQueue(workspaceId, id);

      if (!result) {
        throw new NotFoundException('Queue not found');
      }

      return result;
    } finally {
      // noop
    }
  }

  @Post('queues/:id/pause')
  async pauseQueue(@Req() request: AuthRequest, @Param('id') id: string) {
    try {
      const workspaceId = request.workspace?.id;

      if (!workspaceId) {
        throw new UnauthorizedException('Authentication required');
      }

      const queue = await this.queuesService.updateQueueStatus(
        workspaceId,
        id,
        'paused',
      );

      if (!queue) {
        throw new NotFoundException('Queue not found');
      }

      return queue;
    } finally {
      // noop
    }
  }

  @Post('queues/:id/resume')
  async resumeQueue(@Req() request: AuthRequest, @Param('id') id: string) {
    return this.startQueue(request, id);
  }

  @Post('queues/:id/skip')
  async skipQueueItem(@Req() request: AuthRequest, @Param('id') id: string) {
    try {
      const workspaceId = request.workspace?.id;

      if (!workspaceId) {
        throw new UnauthorizedException('Authentication required');
      }

      return this.queuesService.skipCurrentItem({
        queueId: id,
        workspaceId,
      });
    } finally {
      // noop
    }
  }

  @Post('queues/:id/next')
  async nextQueueItem(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body()
    body: {
      outcome?: string;
      isHighPriority?: boolean;
      localTimezone?: string;
    },
  ) {
    try {
      const workspaceId = request.workspace?.id;

      if (!workspaceId) {
        throw new UnauthorizedException('Authentication required');
      }

      return this.queuesService.completeCurrentAndAdvance({
        queueId: id,
        workspaceId,
        outcome: body.outcome,
        isHighPriority: body.isHighPriority,
        localTimezone: body.localTimezone,
      });
    } finally {
      // noop
    }
  }

  @Post('queues/:id/restart')
  @HttpCode(200)
  async restartQueue(@Req() request: AuthRequest, @Param('id') id: string) {
    try {
      const workspaceId = request.workspace?.id;

      if (!workspaceId) {
        throw new UnauthorizedException('Authentication required');
      }

      const result = await this.queuesService.restartQueue(workspaceId, id);

      if (!result) {
        throw new NotFoundException('Queue not found');
      }

      return { success: true };
    } finally {
      // noop
    }
  }

  @Post('queues/:id/assign')
  async assignQueue(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    try {
      const workspaceId = request.workspace?.id;

      if (!workspaceId) {
        throw new UnauthorizedException('Authentication required');
      }

      const queue = await this.queuesService.assignQueue(
        workspaceId,
        id,
        body.userId,
      );

      if (!queue) {
        throw new NotFoundException('Queue not found');
      }

      return queue;
    } finally {
      // noop
    }
  }

  @Get('queues/:id/analytics')
  async getQueueAnalytics(
    @Req() request: AuthRequest,
    @Param('id') id: string,
  ) {
    try {
      const workspaceId = request.workspace?.id;

      if (!workspaceId) {
        throw new UnauthorizedException('Authentication required');
      }

      const analytics = await this.queuesService.queueAnalytics(
        workspaceId,
        id,
      );

      if (!analytics) {
        throw new NotFoundException('Queue not found');
      }

      return analytics;
    } finally {
      // noop
    }
  }

  @Get('queues/:id/export')
  async exportQueueCsv(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    try {
      const workspaceId = request.workspace?.id;

      if (!workspaceId) {
        throw new UnauthorizedException('Authentication required');
      }

      const csv = await this.queuesService.exportQueueCsv(workspaceId, id);

      if (!csv) {
        throw new NotFoundException('Queue not found');
      }

      response.setHeader('Content-Type', 'text/csv');
      response.send(csv);
    } finally {
      // noop
    }
  }

  @Get('contacts/:id/dialer')
  async getContactDialerInfo(
    @Req() request: AuthRequest,
    @Param('id') id: string,
  ) {
    try {
      const workspaceId = request.workspace?.id;

      if (!workspaceId) {
        throw new UnauthorizedException('Authentication required');
      }

      const info = await this.queuesService.getContactDialerInfo(
        workspaceId,
        id,
      );

      if (!info) {
        throw new NotFoundException('Contact not found');
      }

      return info;
    } finally {
      // noop
    }
  }
}
