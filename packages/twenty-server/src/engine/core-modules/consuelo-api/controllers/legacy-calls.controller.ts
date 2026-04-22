import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { CallsService } from 'src/engine/core-modules/consuelo-api/services/calls.service';
import { VoiceService } from 'src/engine/core-modules/consuelo-api/services/voice.service';

type AuthRequest = Request & {
  workspace?: { id: string };
};

@Controller('v1')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
export class LegacyCallsController {
  constructor(
    private readonly callsService: CallsService,
    private readonly voiceService: VoiceService,
  ) {}

  @Get('calls/status/:callSid')
  async getCallStatus(@Param('callSid') callSid: string) {
    const status = await this.voiceService.getCallStatusForPolling(callSid);

    if (!status) {
      throw new NotFoundException('No conference for this call');
    }

    return status;
  }

  @Post('calls/:id/disposition')
  async setDisposition(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body() body: { outcome?: string; notes?: string },
  ) {
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
  }
}
