import { randomUUID } from 'node:crypto';

import { Effect, Layer } from 'effect';

import { DialerClock, type DialerClockService } from '../../ports/clock.js';
import {
  DialerIdGenerator,
  type DialerIdGeneratorService,
} from '../../ports/id-generator.js';

const clockService: DialerClockService = {
  now: Effect.sync(() => new Date()),
  sleep: (milliseconds) => Effect.sleep(milliseconds),
};

const idGeneratorService: DialerIdGeneratorService = {
  generateParallelGroupId: Effect.sync(
    () => `pg_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
  ),
  generateDialerSessionId: Effect.sync(
    () => `session_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
  ),
};

export const liveDialerClockLayer = Layer.succeed(DialerClock, clockService);
export const liveDialerIdGeneratorLayer = Layer.succeed(
  DialerIdGenerator,
  idGeneratorService,
);
