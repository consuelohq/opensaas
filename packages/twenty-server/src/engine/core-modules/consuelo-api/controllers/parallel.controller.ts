import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { TwilioSignatureGuard } from 'src/engine/core-modules/consuelo-api/guards/twilio-signature.guard';
import { ParallelService } from 'src/engine/core-modules/consuelo-api/services/parallel.service';

type AuthRequest = Request & {
  workspace?: { id: string };
  user?: { id: string };
};

@Controller('api/v1/calls/parallel')
export class ParallelController {
  constructor(private readonly parallelService: ParallelService) {}

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Post()
  async initiateParallelDial(
    @Req() request: AuthRequest,
    @Body() body: Record<string, unknown>,
  ) {
    const workspaceId = request.workspace?.id;
    const userId = request.user?.id;

    if (!workspaceId || !userId) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.parallelService.initiateParallelDial({
      body,
      userId,
      workspaceId,
    });
  }

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Get('validate')
  async validateParallelDial(
    @Req() request: AuthRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    const workspaceId = request.workspace?.id;

    if (!workspaceId) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.parallelService.validateParallelDial({ query, workspaceId });
  }

  @UseGuards(PublicEndpointGuard, TwilioSignatureGuard, NoPermissionGuard)
  @Post('status-callback')
  @HttpCode(200)
  async statusCallback(@Body() body: Record<string, string | undefined>) {
    return this.parallelService.statusCallback(body);
  }

  @UseGuards(PublicEndpointGuard, TwilioSignatureGuard, NoPermissionGuard)
  @Post('customer-twiml')
  async customerTwiml(
    @Body() body: Record<string, string | undefined>,
    @Res() response: Response,
  ) {
    const twiml = await this.parallelService.customerTwiml(body);

    response.type('text/xml').status(200).send(twiml);
  }

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Get(':groupId')
  async groupStatus(
    @Req() request: AuthRequest,
    @Param('groupId') groupId: string,
  ) {
    const workspaceId = request.workspace?.id;

    if (!workspaceId) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.parallelService.getGroupStatus({ groupId, workspaceId });
  }

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Post(':groupId/terminate')
  @HttpCode(200)
  async terminateGroup(
    @Req() request: AuthRequest,
    @Param('groupId') groupId: string,
  ) {
    const workspaceId = request.workspace?.id;
    const userId = request.user?.id;

    if (!workspaceId || !userId) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.parallelService.terminateGroup({ groupId, userId, workspaceId });
  }
}
