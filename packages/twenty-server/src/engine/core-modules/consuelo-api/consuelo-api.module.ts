import { Module } from '@nestjs/common';

import { TokenModule } from 'src/engine/core-modules/auth/token/token.module';
import { PermissionsModule } from 'src/engine/metadata-modules/permissions/permissions.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { CallsController } from 'src/engine/core-modules/consuelo-api/controllers/calls.controller';
import { RefreshContactAttemptHazardViewCronCommand } from 'src/engine/core-modules/consuelo-api/crons/commands/refresh-contact-attempt-hazard-view.cron.command';
import { RefreshContactAttemptHazardViewCronJob } from 'src/engine/core-modules/consuelo-api/crons/jobs/refresh-contact-attempt-hazard-view.cron.job';
import { CallTimingModelService } from 'src/engine/core-modules/consuelo-api/services/call-timing-model.service';
import { CadenceStoreService } from 'src/engine/core-modules/consuelo-api/services/cadence-store.service';
import { CallTimingStore } from 'src/engine/core-modules/consuelo-api/services/call-timing-store';
import { LegacyCallsController } from 'src/engine/core-modules/consuelo-api/controllers/legacy-calls.controller';
import { ParallelController } from 'src/engine/core-modules/consuelo-api/controllers/parallel.controller';
import { QueuesController } from 'src/engine/core-modules/consuelo-api/controllers/queues.controller';
import { VoiceController } from 'src/engine/core-modules/consuelo-api/controllers/voice.controller';
import { CsvMappingController } from 'src/engine/core-modules/consuelo-api/controllers/csv-mapping.controller';
import { OsInstallController } from 'src/engine/core-modules/consuelo-api/controllers/os-install.controller';
import { TwilioSignatureGuard } from 'src/engine/core-modules/consuelo-api/guards/twilio-signature.guard';
import { DialerCallPermissionGuard } from 'src/engine/core-modules/consuelo-api/guards/dialer-call-permission.guard';
import { DialerCallStartResolver } from 'src/engine/core-modules/consuelo-api/resolvers/dialer-call-start.resolver';
import { CallsService } from 'src/engine/core-modules/consuelo-api/services/calls.service';
import { DialerCallStartService } from 'src/engine/core-modules/consuelo-api/services/dialer-call-start.service';
import { LegacyDialerService } from 'src/engine/core-modules/consuelo-api/services/legacy-dialer.service';
import { ParallelService } from 'src/engine/core-modules/consuelo-api/services/parallel.service';
import { ParallelBetaSamplerService } from 'src/engine/core-modules/consuelo-api/services/parallel-beta-sampler.service';
import { ParallelPosteriorStore } from 'src/engine/core-modules/consuelo-api/services/parallel-posterior.store';
import { ParallelStrategyResolverService } from 'src/engine/core-modules/consuelo-api/services/parallel-strategy-resolver.service';
import { QueuesService } from 'src/engine/core-modules/consuelo-api/services/queues.service';
import { StoppingModelStoreService } from 'src/engine/core-modules/consuelo-api/services/stopping-model-store.service';
import { VoiceService } from 'src/engine/core-modules/consuelo-api/services/voice.service';
import { WhittleIndexStoreService } from 'src/engine/core-modules/consuelo-api/services/whittle-index-store.service';
import { VoiceStateService } from 'src/engine/core-modules/consuelo-api/services/voice-state.service';
import { CsvMappingService } from 'src/engine/core-modules/consuelo-api/services/csv-mapping.service';

@Module({
  imports: [TokenModule, PermissionsModule, WorkspaceCacheStorageModule],
  controllers: [
    QueuesController,
    CallsController,
    LegacyCallsController,
    ParallelController,
    VoiceController,
    CsvMappingController,
    OsInstallController,
  ],
  providers: [
    QueuesService,
    CallsService,
    DialerCallStartService,
    DialerCallStartResolver,
    LegacyDialerService,
    ParallelService,
    ParallelPosteriorStore,
    ParallelBetaSamplerService,
    ParallelStrategyResolverService,
    StoppingModelStoreService,
    CallTimingStore,
    CallTimingModelService,
    CadenceStoreService,
    WhittleIndexStoreService,
    RefreshContactAttemptHazardViewCronJob,
    RefreshContactAttemptHazardViewCronCommand,
    TwilioSignatureGuard,
    DialerCallPermissionGuard,
    VoiceService,
    VoiceStateService,
    CsvMappingService,
  ],
})
export class ConsueloApiModule {}
