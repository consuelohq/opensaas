import { Module } from '@nestjs/common';

import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { CallsController } from 'src/engine/core-modules/consuelo-api/controllers/calls.controller';
import { LegacyCallsController } from 'src/engine/core-modules/consuelo-api/controllers/legacy-calls.controller';
import { ParallelController } from 'src/engine/core-modules/consuelo-api/controllers/parallel.controller';
import { QueuesController } from 'src/engine/core-modules/consuelo-api/controllers/queues.controller';
import { VoiceController } from 'src/engine/core-modules/consuelo-api/controllers/voice.controller';
import { CsvMappingController } from 'src/engine/core-modules/consuelo-api/controllers/csv-mapping.controller';
import { TwilioSignatureGuard } from 'src/engine/core-modules/consuelo-api/guards/twilio-signature.guard';
import { CallsService } from 'src/engine/core-modules/consuelo-api/services/calls.service';
import { LegacyDialerService } from 'src/engine/core-modules/consuelo-api/services/legacy-dialer.service';
import { ParallelService } from 'src/engine/core-modules/consuelo-api/services/parallel.service';
import { QueuesService } from 'src/engine/core-modules/consuelo-api/services/queues.service';
import { VoiceService } from 'src/engine/core-modules/consuelo-api/services/voice.service';
import { VoiceStateService } from 'src/engine/core-modules/consuelo-api/services/voice-state.service';
import { CsvMappingService } from 'src/engine/core-modules/consuelo-api/services/csv-mapping.service';

@Module({
  imports: [TokenModule, WorkspaceCacheStorageModule],
  controllers: [
    QueuesController,
    CallsController,
    LegacyCallsController,
    ParallelController,
    VoiceController,
    CsvMappingController,
  ],
  providers: [
    QueuesService,
    CallsService,
    LegacyDialerService,
    ParallelService,
    TwilioSignatureGuard,
    VoiceService,
    VoiceStateService,
    CsvMappingService,
  ],
})
export class ConsueloApiModule {}
