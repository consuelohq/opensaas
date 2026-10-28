import { Effect, Layer } from 'effect';

import {
  getCallSession,
  getCallSessionForWorkspace,
} from '../application/get-call-session.js';
import { processProviderCallback } from '../application/process-provider-callback.js';
import { retryPendingCleanup } from '../application/retry-pending-cleanup.js';
import { startParallelSession } from '../application/start-parallel-session.js';
import {
  terminateCallSession,
  terminateCallSessionForWorkspace,
} from '../application/terminate-call-session.js';
import { isTerminalCallStatus } from '../domain/parallel-call.js';
import { computeParallelTelemetry } from '../domain/telemetry.js';
import {
  createParallelStateStoreLayer,
  InMemoryParallelStore,
} from '../infrastructure/memory/parallel-state-store.js';
import {
  liveDialerClockLayer,
  liveDialerIdGeneratorLayer,
} from '../infrastructure/memory/runtime.js';
import { createTwilioCallProviderLayer } from '../infrastructure/twilio/call-provider.js';
import type { CallProviderService } from '../ports/call-provider.js';
import { DialerClock } from '../ports/clock.js';
import type { DialerClockService } from '../ports/clock.js';
import type { DialerIdGeneratorService } from '../ports/id-generator.js';
import { ParallelStateStore } from '../ports/parallel-state-store.js';
import type { ParallelStateStoreService } from '../ports/parallel-state-store.js';
import { ACTIVE_CALL_TTL_SECONDS } from './caller-id.js';
import type { CallerIdLockService } from './caller-id.js';
import type {
  ParallelDialOptions,
  ParallelDialResult,
  ParallelGroup,
  ParallelStore,
  ParallelTelemetry,
  TwilioCredentials,
} from '../types.js';

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response />';

type ParallelRuntimeServices =
  | CallProviderService
  | ParallelStateStoreService
  | DialerClockService
  | DialerIdGeneratorService;

type ParallelRuntimeLayer = Layer.Layer<ParallelRuntimeServices, never, never>;

export class ParallelDialerService {
  private readonly runtimeLayer: ParallelRuntimeLayer;
  private callerIdLock?: CallerIdLockService;

  constructor(
    credentials: TwilioCredentials | undefined,
    store: ParallelStore,
  ) {
    this.runtimeLayer = Layer.mergeAll(
      createTwilioCallProviderLayer(credentials),
      createParallelStateStoreLayer(store),
      liveDialerClockLayer,
      liveDialerIdGeneratorLayer,
    );
  }

  private run<A, E>(
    program: Effect.Effect<A, E, ParallelRuntimeServices>,
  ): Promise<A> {
    return Effect.runPromise(program.pipe(Effect.provide(this.runtimeLayer)));
  }

  withCallerIdLock(service: CallerIdLockService): this {
    this.callerIdLock = service;
    return this;
  }

  private releaseTerminalCallerIdLocks(
    group: ParallelGroup | null,
  ): Promise<void> {
    const callerIdLock = this.callerIdLock;
    if (
      !callerIdLock ||
      !group ||
      !['completed', 'failed'].includes(group.status)
    ) {
      return Promise.resolve();
    }
    const numbers = Array.from(
      new Set(group.calls.map((call) => call.fromNumber).filter(Boolean)),
    );
    return Promise.all(
      numbers.map((number) => callerIdLock.releaseLockByNumber(number)),
    ).then(() => undefined);
  }

  private getStoredGroup(groupId: string): Promise<ParallelGroup | null> {
    return this.run(
      Effect.gen(function* () {
        const state = yield* ParallelStateStore;
        return yield* state.getGroup(groupId);
      }),
    );
  }

  initiateGroup(options: ParallelDialOptions): Promise<ParallelDialResult> {
    return this.run(startParallelSession(options));
  }

  handleStatusCallback(
    callSid: string,
    callStatus: string,
    answeredBy?: string,
  ): Promise<void> {
    return this.run(
      processProviderCallback({ callSid, callStatus, answeredBy }),
    );
  }

  getGroup(groupId: string): Promise<ParallelGroup | null> {
    return this.run(getCallSession(groupId)).then((group) =>
      this.releaseTerminalCallerIdLocks(group).then(() => group),
    );
  }

  getGroupForWorkspace(
    groupId: string,
    workspaceId: string,
  ): Promise<ParallelGroup | null> {
    return this.run(getCallSessionForWorkspace(groupId, workspaceId)).then(
      (group) => this.releaseTerminalCallerIdLocks(group).then(() => group),
    );
  }

  terminateGroup(groupId: string): Promise<void> {
    return this.run(terminateCallSession(groupId))
      .then(() => this.getStoredGroup(groupId))
      .then((group) => this.releaseTerminalCallerIdLocks(group));
  }

  terminateGroupForWorkspace(
    groupId: string,
    workspaceId: string,
  ): Promise<boolean> {
    return this.run(
      terminateCallSessionForWorkspace(groupId, workspaceId),
    ).then((terminated) =>
      terminated
        ? this.getStoredGroup(groupId)
            .then((group) => this.releaseTerminalCallerIdLocks(group))
            .then(() => true)
        : false,
    );
  }

  retryPendingCleanup(groupId: string): Promise<{
    retried: number;
    remaining: number;
  }> {
    return this.run(retryPendingCleanup(groupId)).then((result) => ({
      retried: result.retried,
      remaining: result.remaining,
    }));
  }

  generateCustomerTwiml(callSid: string): Promise<string | null> {
    return this.run(
      Effect.gen(function* () {
        const state = yield* ParallelStateStore;
        const groupId = yield* state.getGroupIdForCall(callSid);
        if (!groupId) return null;
        const group = yield* state.getGroup(groupId);
        if (!group) return null;
        const call = group.calls.find(
          (candidate) => candidate.callSid === callSid,
        );
        if (!call || isTerminalCallStatus(call.status)) return EMPTY_TWIML;
        const muted = group.winnerSid === callSid ? 'false' : 'true';
        return [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<Response>',
          '<Dial>',
          `<Conference beep="false" muted="${muted}" startConferenceOnEnter="false" endConferenceOnExit="false" waitUrl="" participantLabel="customer-${callSid}">${group.conferenceName}</Conference>`,
          '</Dial>',
          '</Response>',
        ].join('');
      }),
    );
  }

  async getGroupIdForCall(callSid: string): Promise<string | null> {
    try {
      return await this.run(
        Effect.gen(function* () {
          const state = yield* ParallelStateStore;
          return yield* state.getGroupIdForCall(callSid);
        }),
      );
    } catch {
      return null;
    }
  }

  getReleasableNumbers(group: ParallelGroup): string[] {
    return group.calls
      .filter((call) => call.callSid !== group.winnerSid)
      .map((call) => call.fromNumber);
  }

  validateRequirements(
    numberCount: number,
    fanout = 3,
  ): {
    valid: boolean;
    required: number;
    current: number;
    message?: string;
  } {
    const required = fanout;
    if (numberCount >= required) {
      return { valid: true, required, current: numberCount };
    }
    return {
      valid: false,
      required,
      current: numberCount,
      message: `Need at least ${required} phone numbers`,
    };
  }

  computeTelemetry(group: ParallelGroup): ParallelTelemetry {
    return computeParallelTelemetry(group);
  }

  markTelemetryEmitted(groupId: string): Promise<void> {
    return this.run(
      Effect.gen(function* () {
        const state = yield* ParallelStateStore;
        const clock = yield* DialerClock;
        yield* state.claimTelemetryEmission(
          groupId,
          (yield* clock.now).toISOString(),
          ACTIVE_CALL_TTL_SECONDS,
        );
      }),
    );
  }

  markTelemetryEmittedIfAbsent(groupId: string): Promise<boolean> {
    return this.run(
      Effect.gen(function* () {
        const state = yield* ParallelStateStore;
        const clock = yield* DialerClock;
        return yield* state.claimTelemetryEmission(
          groupId,
          (yield* clock.now).toISOString(),
          ACTIVE_CALL_TTL_SECONDS,
        );
      }),
    );
  }
}

export { InMemoryParallelStore };
