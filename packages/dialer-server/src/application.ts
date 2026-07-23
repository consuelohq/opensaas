import {
  generateParallelCustomerTwiml,
  getParallelGroupStatus,
  initiateParallelDial,
  processParallelCallback,
  startDialerCall,
  terminateParallelGroup,
  type DialerCallRepositoryService,
  type DialerCallRuntimeService,
  type DialerIdGeneratorService,
  type DialerTargetRepositoryService,
  type ParallelCompatibilityRuntimeService,
} from '@consuelo/dialer';
import { Effect, type Layer } from 'effect';

import type { DialerServerApplication } from './contracts';

type StartRuntime =
  | DialerCallRepositoryService
  | DialerCallRuntimeService
  | DialerIdGeneratorService
  | DialerTargetRepositoryService;

type ParallelRuntime = ParallelCompatibilityRuntimeService;

export type DialerApplicationLayers = {
  startLayer: Layer.Layer<StartRuntime>;
  parallelLayer: Layer.Layer<ParallelRuntime>;
};

export const createEffectDialerApplication = (
  layers: DialerApplicationLayers,
): DialerServerApplication => ({
  startCallSession: (command) =>
    startDialerCall(command).pipe(Effect.provide(layers.startLayer)),
  getCallSession: ({ sessionId, workspaceId }) =>
    getParallelGroupStatus({ groupId: sessionId, workspaceId }).pipe(
      Effect.provide(layers.parallelLayer),
    ),
  terminateCallSession: ({ sessionId, workspaceId, userId }) =>
    terminateParallelGroup({ groupId: sessionId, workspaceId, userId }).pipe(
      Effect.provide(layers.parallelLayer),
    ),
  processTwilioStatus: (input) =>
    processParallelCallback(input).pipe(Effect.provide(layers.parallelLayer)),
  generateTwilioCustomerTwiml: (input) =>
    generateParallelCustomerTwiml(input).pipe(
      Effect.provide(layers.parallelLayer),
    ),
});

export const createParallelOnlyApplication = (
  parallelLayer: Layer.Layer<ParallelRuntime>,
): Pick<
  DialerServerApplication,
  | 'processTwilioStatus'
  | 'generateTwilioCustomerTwiml'
  | 'getCallSession'
  | 'terminateCallSession'
> => ({
  getCallSession: ({ sessionId, workspaceId }) =>
    getParallelGroupStatus({ groupId: sessionId, workspaceId }).pipe(
      Effect.provide(parallelLayer),
    ),
  terminateCallSession: ({ sessionId, workspaceId, userId }) =>
    terminateParallelGroup({ groupId: sessionId, workspaceId, userId }).pipe(
      Effect.provide(parallelLayer),
    ),
  processTwilioStatus: (input) =>
    processParallelCallback(input).pipe(Effect.provide(parallelLayer)),
  generateTwilioCustomerTwiml: (input) =>
    generateParallelCustomerTwiml(input).pipe(Effect.provide(parallelLayer)),
});

export const createLegacyParallelStart =
  (parallelLayer: Layer.Layer<ParallelRuntime>) =>
  (command: Parameters<typeof initiateParallelDial>[0]) =>
    initiateParallelDial(command).pipe(Effect.provide(parallelLayer));
