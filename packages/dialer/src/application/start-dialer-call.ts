import { Effect } from 'effect';

import { DialerRequestError } from '../errors/dialer-errors.js';
import { DialerIdGenerator } from '../ports/id-generator.js';
import {
  DialerCallRepository,
  DialerCallRuntime,
  DialerTargetRepository,
  type CallableTarget,
  type DialerCallStartCapacity,
  type DialerCallStartResult,
  type StartDialerCallInput,
} from '../ports/dialer-call-start.js';

export type StartDialerCallCommand = {
  workspaceId: string;
  userId: string;
  sessionId?: string;
  input: StartDialerCallInput;
};

const requestError = (
  code: string,
  message: string,
  details?: unknown,
): DialerRequestError =>
  new DialerRequestError({
    code,
    message,
    details,
    retryable: false,
  });

const validateInput = (input: StartDialerCallInput): void => {
  if (input.source === 'direct' && input.selectionStrategy !== 'single') {
    throw requestError(
      'INVALID_SELECTION_STRATEGY',
      'Direct call starts must use single selection strategy',
    );
  }
  if (input.source === 'queue' && input.selectionStrategy !== 'predictive') {
    throw requestError(
      'INVALID_SELECTION_STRATEGY',
      'Queue call starts must use predictive selection strategy',
    );
  }
  if (input.requestedFanout < 1) {
    throw requestError(
      'INVALID_REQUESTED_FANOUT',
      'requestedFanout must be at least 1',
    );
  }
  if (input.source === 'direct' && !input.contactId && !input.targetPhone) {
    throw requestError(
      'MISSING_DIRECT_TARGET',
      'Direct call starts require contactId or targetPhone',
    );
  }
  if (
    input.source === 'queue' &&
    !input.queueId &&
    (!input.contactIds || input.contactIds.length === 0) &&
    (!input.targetPhones || input.targetPhones.length === 0)
  ) {
    throw requestError(
      'MISSING_QUEUE_TARGETS',
      'Queue call starts require queueId, contactIds, or targetPhones',
    );
  }
};

const buildTargetPhoneFallbacks = (
  contactIds: string[] | null | undefined,
  targetPhones: string[] | null | undefined,
): ReadonlyMap<string, string> => {
  const fallbacks = new Map<string, string>();
  if (!contactIds || !targetPhones) return fallbacks;

  for (const [index, contactId] of contactIds.entries()) {
    const targetPhone = targetPhones[index];
    if (contactId && targetPhone) fallbacks.set(contactId, targetPhone);
  }
  return fallbacks;
};

const dedupeTargetsByPhone = (targets: CallableTarget[]): CallableTarget[] => {
  const seen = new Set<string>();
  return targets.filter((target) => {
    if (seen.has(target.phone)) return false;
    seen.add(target.phone);
    return true;
  });
};

export const computeDialerCallCapacity = (input: {
  requestedFanout: number;
  callableTargetCount: number;
  availableCallerIdCount: number;
}): DialerCallStartCapacity => {
  const actualFanout = Math.min(
    input.requestedFanout,
    input.callableTargetCount,
    input.availableCallerIdCount,
  );
  const reducedCapacityReasons: string[] = [];
  const blockedReasons: string[] = [];

  if (input.callableTargetCount < input.requestedFanout) {
    reducedCapacityReasons.push('callable-target-capacity');
  }
  if (input.availableCallerIdCount < input.requestedFanout) {
    reducedCapacityReasons.push('caller-id-capacity');
  }
  if (input.callableTargetCount === 0) {
    blockedReasons.push('no-callable-targets');
  }
  if (input.availableCallerIdCount === 0) {
    blockedReasons.push('no-available-caller-ids');
  }

  return {
    ...input,
    reducedCapacityReasons,
    blockedReasons,
    actualFanout,
  };
};

export const startDialerCall = (command: StartDialerCallCommand) =>
  Effect.gen(function* () {
    yield* Effect.try({
      try: () => validateInput(command.input),
      catch: (cause) =>
        cause instanceof DialerRequestError
          ? cause
          : requestError('INVALID_REQUEST', String(cause)),
    });

    const targetsRepository = yield* DialerTargetRepository;
    const callsRepository = yield* DialerCallRepository;
    const runtime = yield* DialerCallRuntime;
    const ids = yield* DialerIdGenerator;
    const callMode = command.input.callMode ?? 'live';
    const enforceScenarioAllowlist =
      command.input.callMode === 'live' ||
      command.input.callMode === 'twilio-test';
    const requestedFanout = Math.max(1, command.input.requestedFanout);
    const sessionId = command.sessionId ?? (yield* ids.generateDialerSessionId);
    const context = {
      workspaceId: command.workspaceId,
      userId: command.userId,
    };

    const inputQueueId =
      command.input.source === 'queue'
        ? yield* targetsRepository.resolveInputQueueId({
            ...context,
            input: command.input,
          })
        : null;
    const targets =
      command.input.source === 'direct'
        ? yield* targetsRepository.resolveDirectTargets({
            ...context,
            input: command.input,
          })
        : yield* targetsRepository.resolveQueueTargets({
            ...context,
            queueId: inputQueueId ?? '',
            requestedFanout,
            fallbackPhonesByContactId: buildTargetPhoneFallbacks(
              command.input.contactIds,
              command.input.targetPhones,
            ),
          });
    const uniqueTargets = dedupeTargetsByPhone(targets);

    if (enforceScenarioAllowlist) {
      yield* runtime.assertSafeTargetsAllowed({
        ...context,
        targets: uniqueTargets,
      });
    }

    const callerIds = yield* runtime.resolveCallerIds({
      ...context,
      callerIdNumber: command.input.callerIdNumber,
      callMode,
      enforceScenarioAllowlist,
      targetCount: uniqueTargets.length,
    });
    const capacity = computeDialerCallCapacity({
      requestedFanout,
      callableTargetCount: uniqueTargets.length,
      availableCallerIdCount: callerIds.length,
    });
    if (capacity.actualFanout === 0) {
      return yield* Effect.fail(
        requestError(
          'NO_CALLABLE_TARGETS',
          'No callable targets or caller IDs are available',
          capacity,
        ),
      );
    }

    const selectedTargets = uniqueTargets.slice(0, capacity.actualFanout);
    const selectedCallerIds = callerIds.slice(0, capacity.actualFanout);
    const queueId =
      command.input.source === 'direct'
        ? yield* targetsRepository.createDirectQueue({
            ...context,
            contactIds: selectedTargets.map((target) => target.contactId),
          })
        : (inputQueueId ?? '');

    if (callMode === 'mock') {
      const calls = yield* callsRepository.createMockCalls({
        ...context,
        sessionId,
        queueId,
        targets: selectedTargets,
        callerIds: selectedCallerIds,
      });
      const result: DialerCallStartResult = {
        sessionId,
        twilioGroupId: null,
        queueId,
        selectionStrategy: command.input.selectionStrategy,
        requestedFanout,
        actualFanout: capacity.actualFanout,
        status: 'mocked',
        capacity,
        calls,
      };
      return result;
    }

    const providerResult = yield* runtime.initiateProviderCalls({
      ...context,
      sessionId,
      queueId,
      targets: selectedTargets,
      callerIds: selectedCallerIds,
      callMode,
    });
    const result: DialerCallStartResult = {
      sessionId,
      twilioGroupId: providerResult.twilioGroupId,
      queueId,
      selectionStrategy: command.input.selectionStrategy,
      requestedFanout,
      actualFanout: capacity.actualFanout,
      status: 'dialing',
      capacity,
      calls: providerResult.calls,
    };
    return result;
  }).pipe(
    Effect.withSpan('dialer.start_dialer_call'),
    Effect.annotateLogs({ workspaceId: command.workspaceId }),
  );
