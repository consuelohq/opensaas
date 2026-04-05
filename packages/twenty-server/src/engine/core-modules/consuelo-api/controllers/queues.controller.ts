import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";

import { Request, Response } from "express";

import { WorkspaceAuthGuard } from "src/engine/guards/workspace-auth.guard";

import { QueuesService } from "../services/queues.service";

type AuthRequest = Request & {
  workspace?: { id: string };
  user?: { id: string };
};

@Controller("api/v1")
@UseGuards(WorkspaceAuthGuard)
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  @Post("queues")
  async createQueue(
    @Req() request: AuthRequest,
    @Body() body: Record<string, unknown>,
  ) {
    const workspaceId = request.workspace?.id;
    const userId = request.user?.id;

    if (!workspaceId || !userId) {
      throw new UnauthorizedException("Authentication required");
    }

    const queue = await this.queuesService.createQueue({
      workspaceId,
      userId,
      name: String(body.name ?? ""),
      sourceType: body.sourceType ? String(body.sourceType) : undefined,
      sourceId: body.sourceId ? String(body.sourceId) : undefined,
      category: body.category ? String(body.category) : undefined,
      settings: (body.settings as Record<string, unknown> | undefined) ?? {},
      contactIds: Array.isArray(body.contactIds)
        ? body.contactIds.map((contactId) => String(contactId))
        : [],
    });

    return queue;
  }

  @Get("queues")
  async listQueues(@Req() request: AuthRequest) {
    const workspaceId = request.workspace?.id;
    if (!workspaceId) {
      throw new UnauthorizedException("Authentication required");
    }

    return this.queuesService.listQueues(workspaceId);
  }

  @Get("queues/:id")
  async getQueue(@Req() request: AuthRequest, @Param("id") id: string) {
    const workspaceId = request.workspace?.id;
    if (!workspaceId) {
      throw new UnauthorizedException("Authentication required");
    }

    const queue = await this.queuesService.getQueue(workspaceId, id);
    if (!queue) {
      throw new NotFoundException("Queue not found");
    }

    return queue;
  }

  @Post("queues/:id/start")
  async startQueue(@Req() request: AuthRequest, @Param("id") id: string) {
    const workspaceId = request.workspace?.id;
    if (!workspaceId) {
      throw new UnauthorizedException("Authentication required");
    }

    const result = await this.queuesService.startQueue(workspaceId, id);
    if (!result) {
      throw new NotFoundException("Queue not found");
    }

    return result;
  }

  @Post("queues/:id/pause")
  async pauseQueue(@Req() request: AuthRequest, @Param("id") id: string) {
    const workspaceId = request.workspace?.id;
    if (!workspaceId) {
      throw new UnauthorizedException("Authentication required");
    }

    const queue = await this.queuesService.updateQueueStatus(
      workspaceId,
      id,
      "paused",
    );
    if (!queue) {
      throw new NotFoundException("Queue not found");
    }

    return queue;
  }

  @Post("queues/:id/skip")
  async skipQueueItem(@Req() request: AuthRequest, @Param("id") id: string) {
    const workspaceId = request.workspace?.id;
    if (!workspaceId) {
      throw new UnauthorizedException("Authentication required");
    }

    return this.queuesService.skipCurrentItem({
      queueId: id,
      workspaceId,
    });
  }

  @Post("queues/:id/next")
  async nextQueueItem(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: { outcome?: string },
  ) {
    const workspaceId = request.workspace?.id;
    if (!workspaceId) {
      throw new UnauthorizedException("Authentication required");
    }

    return this.queuesService.completeCurrentAndAdvance({
      queueId: id,
      workspaceId,
      outcome: body.outcome,
    });
  }

  @Post("queues/:id/restart")
  @HttpCode(200)
  async restartQueue(@Req() request: AuthRequest, @Param("id") id: string) {
    const workspaceId = request.workspace?.id;
    if (!workspaceId) {
      throw new UnauthorizedException("Authentication required");
    }

    const result = await this.queuesService.restartQueue(workspaceId, id);
    if (!result) {
      throw new NotFoundException("Queue not found");
    }

    return { success: true };
  }

  @Post("queues/:id/assign")
  async assignQueue(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: { userId: string },
  ) {
    const workspaceId = request.workspace?.id;
    if (!workspaceId) {
      throw new UnauthorizedException("Authentication required");
    }

    const queue = await this.queuesService.assignQueue(
      workspaceId,
      id,
      body.userId,
    );
    if (!queue) {
      throw new NotFoundException("Queue not found");
    }

    return queue;
  }

  @Get("queues/:id/analytics")
  async getQueueAnalytics(
    @Req() request: AuthRequest,
    @Param("id") id: string,
  ) {
    const workspaceId = request.workspace?.id;
    if (!workspaceId) {
      throw new UnauthorizedException("Authentication required");
    }

    const analytics = await this.queuesService.queueAnalytics(workspaceId, id);
    if (!analytics) {
      throw new NotFoundException("Queue not found");
    }

    return analytics;
  }

  @Get("queues/:id/export")
  async exportQueueCsv(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const workspaceId = request.workspace?.id;
    if (!workspaceId) {
      throw new UnauthorizedException("Authentication required");
    }

    const csv = await this.queuesService.exportQueueCsv(workspaceId, id);
    if (!csv) {
      throw new NotFoundException("Queue not found");
    }

    response.setHeader("Content-Type", "text/csv");
    response.send(csv);
  }

  @Get("contacts/:id/dialer")
  async getContactDialerInfo(
    @Req() request: AuthRequest,
    @Param("id") id: string,
  ) {
    const workspaceId = request.workspace?.id;
    if (!workspaceId) {
      throw new UnauthorizedException("Authentication required");
    }

    const info = await this.queuesService.getContactDialerInfo(workspaceId, id);
    if (!info) {
      throw new NotFoundException("Contact not found");
    }

    return info;
  }
}
