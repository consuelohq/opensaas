import { Injectable } from '@nestjs/common';

import { ParallelStrategyResolver } from '@consuelo/dialer';

import { ParallelBetaSamplerService } from 'src/engine/core-modules/consuelo-api/services/parallel-beta-sampler.service';
import { ParallelPosteriorStore } from 'src/engine/core-modules/consuelo-api/services/parallel-posterior.store';

@Injectable()
export class ParallelStrategyResolverService extends ParallelStrategyResolver {
  constructor(
    posteriorStore: ParallelPosteriorStore,
    betaSampler: ParallelBetaSamplerService,
  ) {
    super(posteriorStore, betaSampler);
  }
}
