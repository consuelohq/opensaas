import { Module } from '@nestjs/common';

import { PiAgentService } from './pi-agent.service';

@Module({
  providers: [PiAgentService],
  exports: [PiAgentService],
})
export class PiAgentModule {}
