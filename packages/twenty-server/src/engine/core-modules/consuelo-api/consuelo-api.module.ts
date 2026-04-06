import { Module } from '@nestjs/common';

import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

import { CallsController } from 'src/engine/core-modules/consuelo-api/controllers/calls.controller';
import { ParallelController } from 'src/engine/core-modules/consuelo-api/controllers/parallel.controller';
import { QueuesController } from 'src/engine/core-modules/consuelo-api/controllers/queues.controller';
import { TwilioSignatureGuard } from 'src/engine/core-modules/consuelo-api/guards/twilio-signature.guard';
import { CallsService } from 'src/engine/core-modules/consuelo-api/services/calls.service';
import { ParallelService } from 'src/engine/core-modules/consuelo-api/services/parallel.service';
import { QueuesService } from 'src/engine/core-modules/consuelo-api/services/queues.service';

@Module({
  imports: [TokenModule, WorkspaceCacheStorageModule],
  controllers: [QueuesController, CallsController, ParallelController],
  providers: [
    QueuesService,
    CallsService,
    ParallelService,
    TwilioSignatureGuard,
  ],
})
export class ConsueloApiModule {}
