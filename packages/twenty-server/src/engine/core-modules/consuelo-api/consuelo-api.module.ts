import { Module } from '@nestjs/common';

import { CallsController } from './controllers/calls.controller';
import { ParallelController } from './controllers/parallel.controller';
import { QueuesController } from './controllers/queues.controller';
import { TwilioSignatureGuard } from './guards/twilio-signature.guard';
import { CallsService } from './services/calls.service';
import { ParallelService } from './services/parallel.service';
import { QueuesService } from './services/queues.service';

@Module({
  controllers: [QueuesController, CallsController, ParallelController],
  providers: [
    QueuesService,
    CallsService,
    ParallelService,
    TwilioSignatureGuard,
  ],
})
export class ConsueloApiModule {}
