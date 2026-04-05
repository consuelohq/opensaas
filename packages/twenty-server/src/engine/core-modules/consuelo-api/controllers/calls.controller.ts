import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";

import { Request } from "express";

import { WorkspaceAuthGuard } from "src/engine/guards/workspace-auth.guard";

import { TwilioSignatureGuard } from "../guards/twilio-signature.guard";
import { CallsService } from "../services/calls.service";

type AuthRequest = Request & {
  workspace?: { id: string };
};

const MAX_LIMIT = 1000;

function clampPagination(
  limitParam?: string,
  offsetParam?: string,
): { limit: number; offset: number } {
  let limit = 50;
  let offset = 0;

  if (limitParam !== undefined) {
    const parsed = Number(limitParam);
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0) {
      limit = Math.min(parsed, MAX_LIMIT);
    }
  }

  if (offsetParam !== undefined) {
    const parsed = Number(offsetParam);
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0) {
      offset = parsed;
    }
  }

  return { limit, offset };
}

@Controller("api/v1")
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @UseGuards(WorkspaceAuthGuard)
  @Post("calls")
  async initiateCall(@Body() body: Record<string, unknown>) {
    return this.callsService.initiateCall() ?? body;
  }

  @UseGuards(TwilioSignatureGuard)
  @Post("calls/callback")
  async callbackCall(@Body() body: Record<string, unknown>) {
    return this.callsService.callbackCall() ?? body;
  }

  @UseGuards(TwilioSignatureGuard)
  @Post("calls/callback/twiml")
  async callbackTwiml() {
    return this.callsService.callbackTwiml();
  }

  @UseGuards(WorkspaceAuthGuard)
  @Post("calls/initiate-phone")
  async initiatePhone() {
    return this.callsService.initiatePhoneCall();
  }

  @UseGuards(WorkspaceAuthGuard)
  @Get("calls/history")
  async callHistory(
    @Req() request: AuthRequest,
    @Query("limit") limitParam?: string,
    @Query("offset") offsetParam?: string,
  ) {
    const workspaceId = request.workspace?.id;
    if (!workspaceId) {
      throw new UnauthorizedException("Authentication required");
    }

    const { limit, offset } = clampPagination(limitParam, offsetParam);

    return this.callsService.getCallHistory(workspaceId, limit, offset);
  }

  @UseGuards(WorkspaceAuthGuard)
  @Get("recordings/:sid/stream")
  async streamRecording(@Param("sid") sid: string) {
    return this.callsService.streamRecording() ?? sid;
  }

  @UseGuards(WorkspaceAuthGuard)
  @Get("calls/:id")
  async getCall(@Req() request: AuthRequest, @Param("id") id: string) {
    const workspaceId = request.workspace?.id;
    if (!workspaceId) {
      throw new UnauthorizedException("Authentication required");
    }

    const call = await this.callsService.getCall(workspaceId, id);

    if (!call) {
      throw new NotFoundException("Call not found");
    }

    return call;
  }

  @UseGuards(WorkspaceAuthGuard)
  @Post("calls/:id/hangup")
  async hangupCall(@Param("id") id: string) {
    return this.callsService.hangupCall() ?? { id };
  }

  @UseGuards(WorkspaceAuthGuard)
  @Post("calls/:id/analysis")
  async analysis(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const workspaceId = request.workspace?.id;
    if (!workspaceId) {
      throw new UnauthorizedException("Authentication required");
    }

    const updated = await this.callsService.persistAnalysis(
      workspaceId,
      id,
      body,
    );
    if (!updated) {
      throw new NotFoundException("Call not found");
    }

    return updated;
  }

  @UseGuards(WorkspaceAuthGuard)
  @Get("calls/:id/transcript")
  async transcript(@Req() request: AuthRequest, @Param("id") id: string) {
    const workspaceId = request.workspace?.id;
    if (!workspaceId) {
      throw new UnauthorizedException("Authentication required");
    }

    const transcript = await this.callsService.getTranscript(workspaceId, id);
    if (!transcript) {
      throw new NotFoundException("Call not found");
    }

    return transcript;
  }
}
