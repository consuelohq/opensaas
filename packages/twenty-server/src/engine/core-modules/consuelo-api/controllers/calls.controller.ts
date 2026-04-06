import {
  BadRequestException,
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
} from '@nestjs/common';

import { Request } from 'express';

import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { TwilioSignatureGuard } from 'src/engine/core-modules/consuelo-api/guards/twilio-signature.guard';
import { CallsService } from 'src/engine/core-modules/consuelo-api/services/calls.service';

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

@Controller('api/v1')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Post('calls')
  async initiateCall(@Body() body: Record<string, unknown>) {
    return this.callsService.initiateCall() ?? body;
  }

  @UseGuards(PublicEndpointGuard, TwilioSignatureGuard, NoPermissionGuard)
  @Post('calls/callback')
  async callbackCall(@Body() body: Record<string, unknown>) {
    return this.callsService.callbackCall() ?? body;
  }

  @UseGuards(PublicEndpointGuard, TwilioSignatureGuard, NoPermissionGuard)
  @Post('calls/callback/twiml')
  async callbackTwiml() {
    return this.callsService.callbackTwiml();
  }

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Post('calls/initiate-phone')
  async initiatePhone(
    @Req() request: AuthRequest,
    @Body() body: Record<string, unknown>,
  ) {
    try {
      const workspaceId = request.workspace?.id;

      if (!workspaceId) {
        throw new UnauthorizedException('Authentication required');
      }

      return this.callsService.initiatePhoneCall(workspaceId, body);
    } finally {
      // noop
    }
  }

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Get('calls/history')
  async callHistory(
    @Req() request: AuthRequest,
    @Query('limit') limitParam?: string,
    @Query('offset') offsetParam?: string,
  ) {
    try {
      const workspaceId = request.workspace?.id;

      if (!workspaceId) {
        throw new UnauthorizedException('Authentication required');
      }

      const { limit, offset } = clampPagination(limitParam, offsetParam);

      return this.callsService.getCallHistory(workspaceId, limit, offset);
    } finally {
      // noop
    }
  }

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Get('recordings/:sid/stream')
  async streamRecording(@Param('sid') sid: string) {
    try {
      return this.callsService.streamRecording() ?? sid;
    } finally {
      // noop
    }
  }

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Get('calls/:id')
  async getCall(@Req() request: AuthRequest, @Param('id') id: string) {
    try {
      const workspaceId = request.workspace?.id;

      if (!workspaceId) {
        throw new UnauthorizedException('Authentication required');
      }

      const call = await this.callsService.getCall(workspaceId, id);

      if (!call) {
        throw new NotFoundException('Call not found');
      }

      return call;
    } finally {
      // noop
    }
  }

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Post('calls/:id/hangup')
  async hangupCall(@Param('id') id: string) {
    try {
      return this.callsService.hangupCall() ?? { id };
    } finally {
      // noop
    }
  }

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Post('calls/:id/disposition')
  async setDisposition(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body() body: { outcome?: string; notes?: string },
  ) {
    try {
      const workspaceId = request.workspace?.id;

      if (!workspaceId) {
        throw new UnauthorizedException('Authentication required');
      }

      if (!body.outcome && !body.notes) {
        throw new BadRequestException('Provide outcome and/or notes');
      }

      const updated = await this.callsService.setDisposition(
        workspaceId,
        id,
        body.outcome ?? null,
        body.notes,
      );

      if (!updated) {
        throw new NotFoundException('Call not found');
      }

      return updated;
    } finally {
      // noop
    }
  }

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Post('calls/:id/analysis')
  async analysis(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    try {
      const workspaceId = request.workspace?.id;

      if (!workspaceId) {
        throw new UnauthorizedException('Authentication required');
      }

      const updated = await this.callsService.persistAnalysis(
        workspaceId,
        id,
        body,
      );

      if (!updated) {
        throw new NotFoundException('Call not found');
      }

      return updated;
    } finally {
      // noop
    }
  }

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Get('calls/:id/transcript')
  async transcript(@Req() request: AuthRequest, @Param('id') id: string) {
    try {
      const workspaceId = request.workspace?.id;

      if (!workspaceId) {
        throw new UnauthorizedException('Authentication required');
      }

      const transcript = await this.callsService.getTranscript(workspaceId, id);

      if (!transcript) {
        throw new NotFoundException('Call not found');
      }

      return transcript;
    } finally {
      // noop
    }
  }
}
