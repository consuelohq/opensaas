import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  BadRequestException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { Request, Response } from 'express';

import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { TwilioSignatureGuard } from 'src/engine/core-modules/consuelo-api/guards/twilio-signature.guard';
import { VoiceService } from 'src/engine/core-modules/consuelo-api/services/voice.service';

type AuthRequest = Request & {
  workspace?: { id: string };
  user?: { id: string };
};

@Controller('v1')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Get('phone-numbers')
  async getPhoneNumbers(@Req() request: AuthRequest) {
    const workspaceId = request.workspace?.id;

    if (!workspaceId) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.voiceService.getPhoneNumbers(workspaceId);
  }

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Get('voice/token')
  async getVoiceToken(@Req() request: AuthRequest) {
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.voiceService.getVoiceToken(userId);
  }

  @UseGuards(PublicEndpointGuard, TwilioSignatureGuard, NoPermissionGuard)
  @Post('voice/twiml')
  async getVoiceTwiml(
    @Body() body: Record<string, string | undefined>,
    @Res() response: Response,
  ) {
    const twiml = await this.voiceService.buildTwimlResponse(body);

    response.type('text/xml').status(200).send(twiml);
  }

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Get('voice/active-call')
  async getActiveCall(@Req() request: Request) {
    const conferenceName = request.query.conferenceName;

    if (typeof conferenceName !== 'string' || conferenceName.length === 0) {
      throw new BadRequestException('conferenceName is required');
    }

    return this.voiceService.getActiveCall(conferenceName);
  }

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Get('voice/status')
  async getVoiceStatus(@Req() request: AuthRequest) {
    const workspaceId = request.workspace?.id;

    if (!workspaceId) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.voiceService.getVoiceStatus(workspaceId);
  }

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Get('voice/conference-by-call/:callSid')
  async getConferenceByCallSid(@Param('callSid') callSid: string) {
    return this.voiceService.getConferenceByCallSid(callSid);
  }

  @UseGuards(PublicEndpointGuard, TwilioSignatureGuard, NoPermissionGuard)
  @Post('webhooks/status')
  async handleStatusWebhook(@Body() body: Record<string, string | undefined>) {
    return this.voiceService.handleStatusWebhook(body);
  }
}
