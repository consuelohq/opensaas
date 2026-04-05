import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

import { TwilioSignatureGuard } from '../guards/twilio-signature.guard';
import { ParallelService } from '../services/parallel.service';

@Controller('api/v1/calls/parallel')
export class ParallelController {
  constructor(private readonly parallelService: ParallelService) {}

  @UseGuards(WorkspaceAuthGuard)
  @Post()
  async initiateParallelDial(@Body() body: Record<string, unknown>) {
    return this.parallelService.initiateParallelDial() ?? body;
  }

  @UseGuards(WorkspaceAuthGuard)
  @Get('validate')
  async validateParallelDial() {
    return this.parallelService.validateParallelDial();
  }

  @UseGuards(TwilioSignatureGuard)
  @Post('status-callback')
  async statusCallback() {
    return this.parallelService.statusCallback();
  }

  @UseGuards(TwilioSignatureGuard)
  @Post('customer-twiml')
  async customerTwiml() {
    return this.parallelService.customerTwiml();
  }

  @UseGuards(WorkspaceAuthGuard)
  @Get(':groupId')
  async groupStatus(@Param('groupId') groupId: string) {
    return this.parallelService.getGroupStatus() ?? { groupId };
  }

  @UseGuards(WorkspaceAuthGuard)
  @Post(':groupId/terminate')
  async terminateGroup(
    @Param('groupId') groupId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.parallelService.terminateGroup() ?? { groupId, ...body };
  }
}
