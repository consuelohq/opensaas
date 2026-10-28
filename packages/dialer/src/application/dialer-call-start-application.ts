import { Effect, Layer } from 'effect';

import { liveDialerIdGeneratorLayer } from '../infrastructure/memory/runtime.js';
import {
  DialerCallRepository,
  DialerCallRuntime,
  DialerTargetRepository,
  type DialerCallRepositoryService,
  type DialerCallRuntimeService,
  type DialerTargetRepositoryService,
} from '../ports/dialer-call-start.js';
import {
  startDialerCall,
  type StartDialerCallCommand,
} from './start-dialer-call.js';

export type DialerCallStartPorts = {
  targets: DialerTargetRepositoryService;
  calls: DialerCallRepositoryService;
  runtime: DialerCallRuntimeService;
};

export const createDialerCallStartApplication = (
  ports: DialerCallStartPorts,
) => {
  const layer = Layer.mergeAll(
    Layer.succeed(DialerTargetRepository, ports.targets),
    Layer.succeed(DialerCallRepository, ports.calls),
    Layer.succeed(DialerCallRuntime, ports.runtime),
    liveDialerIdGeneratorLayer,
  );

  return {
    start: (command: StartDialerCallCommand) =>
      startDialerCall(command).pipe(Effect.provide(layer)),
  };
};
