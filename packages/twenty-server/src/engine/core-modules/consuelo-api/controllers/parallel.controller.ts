import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { TwilioSignatureGuard } from 'src/engine/core-modules/consuelo-api/guards/twilio-signature.guard';
import { ParallelService } from 'src/engine/core-modules/consuelo-api/services/parallel.service';

@Controller('api/v1/calls/parallel')
export class ParallelController {
  constructor(private readonly parallelService: ParallelService) {}

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Post()
  async initiateParallelDial(@Body() body: Record<string, unknown>) {
    return this.parallelService.initiateParallelDial() ?? body;
  }

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Get('validate')
  async validateParallelDial() {
    return this.parallelService.validateParallelDial();
  }

  @UseGuards(PublicEndpointGuard, TwilioSignatureGuard, NoPermissionGuard)
  @Post('status-callback')
  async statusCallback() {
    return this.parallelService.statusCallback();
  }

  @UseGuards(PublicEndpointGuard, TwilioSignatureGuard, NoPermissionGuard)
  @Post('customer-twiml')
  async customerTwiml() {
    return this.parallelService.customerTwiml();
  }

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Get(':groupId')
  async groupStatus(@Param('groupId') groupId: string) {
    return this.parallelService.getGroupStatus() ?? { groupId };
  }

  @UseGuards(JwtAuthGuard, WorkspaceAuthGuard, NoPermissionGuard)
  @Post(':groupId/terminate')
  async terminateGroup(
    @Param('groupId') groupId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.parallelService.terminateGroup() ?? { groupId, ...body };
  }
}
