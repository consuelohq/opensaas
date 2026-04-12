import { Injectable } from '@nestjs/common';

import { CallTimingModel } from '@consuelo/dialer';

import { CallTimingStore } from 'src/engine/core-modules/consuelo-api/services/call-timing-store';

@Injectable()
export class CallTimingModelService extends CallTimingModel {
  constructor(timingModelStore: CallTimingStore) {
    super(timingModelStore);
  }
}
