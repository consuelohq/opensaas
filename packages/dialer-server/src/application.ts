import { randomUUID } from 'node:crypto';

import {
  generateParallelAgentTwiml,
  generateParallelCustomerTwiml,
  getParallelGroupStatus,
  markParallelAgentReady,
  ParallelCompatibilityRuntime,
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

import type {
  DialerServerApplication,
  DialerServerDependencies,
} from './contracts';

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

type CallOperationsApplication = NonNullable<
  DialerServerDependencies['callOperations']
>;

export const createCallHistoryDialerApplication = (
  application: DialerServerApplication,
  callOperations: CallOperationsApplication,
  onPersistenceFailure: (operation: string, error: unknown) => void = () => {},
): DialerServerApplication => {
  const preserveCallFlow = <TValue>(
    operation: string,
    effect: Effect.Effect<TValue, unknown>,
    fallback: TValue,
  ) =>
    effect.pipe(
      Effect.catchAll((error) =>
        Effect.sync(() => {
          onPersistenceFailure(operation, error);
          return fallback;
        }),
      ),
    );

  return {
    ...application,
    startCallSession: (command) => {
      const sessionId = command.sessionId ?? `session_${randomUUID()}`;
      const startedAt = new Date().toISOString();
      const baseSession = {
        id: sessionId,
        workspaceId: command.workspaceId,
        userId: command.userId,
        installationId: command.installationId,
        locationId: command.locationId,
        representativeName: command.representativeName,
        source: command.input.source,
        selectionStrategy: command.input.selectionStrategy,
        requestedFanout: command.input.requestedFanout,
        actualFanout: 0,
        queueId: command.input.queueId ?? undefined,
        contactId: command.input.contactId ?? undefined,
        contactName: command.input.contactName,
        opportunityId: command.input.opportunityId,
        pipelineId: command.input.pipelineId,
        stageId: command.input.stageId,
        opportunitySnapshot: command.input.opportunitySnapshot,
        startedAt,
        calls: [],
      };

      return Effect.gen(function* () {
        yield* callOperations.createOrUpdateCallSession({
          ...baseSession,
          status: 'starting',
        });
        const result = yield* application
          .startCallSession({ ...command, sessionId })
          .pipe(
            Effect.tapError(() =>
              preserveCallFlow(
                'persist-failed-call-session',
                callOperations.createOrUpdateCallSession({
                  ...baseSession,
                  status: 'failed',
                }),
                undefined,
              ),
            ),
          );
        yield* preserveCallFlow(
          'persist-call-session',
          callOperations.createOrUpdateCallSession({
            id: result.sessionId,
            workspaceId: command.workspaceId,
            userId: command.userId,
            installationId: command.installationId,
            locationId: command.locationId,
            representativeName: command.representativeName,
            source: command.input.source,
            selectionStrategy: result.selectionStrategy,
            requestedFanout: result.requestedFanout,
            actualFanout: result.actualFanout,
            queueId: result.queueId,
            contactId: result.calls[0]?.contactId,
            contactName: command.input.contactName,
            opportunityId: command.input.opportunityId,
            pipelineId: command.input.pipelineId,
            stageId: command.input.stageId,
            opportunitySnapshot: command.input.opportunitySnapshot,
            status: result.status,
            startedAt,
            calls: result.calls.map((call) => ({
              providerCallId: call.callSid,
              contactId: call.contactId,
              position: call.position,
              callerIdentity: call.callerId,
              status: call.status,
            })),
          }),
          undefined,
        );
        return result;
      });
    },
    processTwilioStatus: (input) =>
      application.processTwilioStatus(input).pipe(
        Effect.flatMap((result) =>
          preserveCallFlow(
            'persist-call-transition',
            callOperations.recordCallLegTransition({
              providerCallId: input.callSid,
              status: input.callStatus,
              ...(input.answeredBy ? { amdResult: input.answeredBy } : {}),
              ...(input.callDuration &&
              Number.isFinite(Number(input.callDuration))
                ? { durationSeconds: Number(input.callDuration) }
                : {}),
            }),
            undefined,
          ).pipe(Effect.as(result)),
        ),
      ),
    generateTwilioCustomerTwiml: (input) =>
      application.generateTwilioCustomerTwiml(input).pipe(
        Effect.flatMap((twiml) =>
          Effect.gen(function* () {
            const context = application.resolveTwilioCallContext
              ? yield* preserveCallFlow(
                  'resolve-transcription-call-context',
                  application.resolveTwilioCallContext({
                    callSid: input.callSid,
                  }),
                  null,
                )
              : null;
            return yield* preserveCallFlow(
              'attach-transcription-stream',
              callOperations.attachTranscriptionStream({
                providerCallId: input.callSid,
                twiml,
                ...(context?.workspaceId
                  ? { workspaceId: context.workspaceId }
                  : {}),
                ...(context?.dialerSessionId
                  ? { sessionId: context.dialerSessionId }
                  : {}),
              }),
              twiml,
            );
          }),
        ),
      ),
  };
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
  generateTwilioAgentTwiml: (input) =>
    generateParallelAgentTwiml(input).pipe(
      Effect.provide(layers.parallelLayer),
    ),
  markAgentReady: ({ sessionId, workspaceId }) =>
    markParallelAgentReady({ groupId: sessionId, workspaceId }).pipe(
      Effect.provide(layers.parallelLayer),
    ),
  resolveTwilioCallContext: ({ callSid }) =>
    Effect.gen(function* () {
      const runtime = yield* ParallelCompatibilityRuntime;
      const groupId = yield* runtime.getGroupIdForCall(callSid);
      if (!groupId) return null;
      const group = yield* runtime.getGroup(groupId);
      return group
        ? {
            workspaceId: group.workspaceId,
            dialerSessionId: group.dialerSessionId ?? null,
          }
        : null;
    }).pipe(Effect.provide(layers.parallelLayer)),
});

export const createParallelOnlyApplication = (
  parallelLayer: Layer.Layer<ParallelRuntime>,
): Pick<
  DialerServerApplication,
  | 'processTwilioStatus'
  | 'generateTwilioCustomerTwiml'
  | 'generateTwilioAgentTwiml'
  | 'markAgentReady'
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
  generateTwilioAgentTwiml: (input) =>
    generateParallelAgentTwiml(input).pipe(Effect.provide(parallelLayer)),
  markAgentReady: ({ sessionId, workspaceId }) =>
    markParallelAgentReady({ groupId: sessionId, workspaceId }).pipe(
      Effect.provide(parallelLayer),
    ),
});

export const createLegacyParallelStart =
  (parallelLayer: Layer.Layer<ParallelRuntime>) =>
  (command: Parameters<typeof initiateParallelDial>[0]) =>
    initiateParallelDial(command).pipe(Effect.provide(parallelLayer));
