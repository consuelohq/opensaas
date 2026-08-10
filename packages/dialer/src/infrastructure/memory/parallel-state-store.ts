import { Effect, Exit, Layer } from 'effect';

import { hydrateParallelGroup } from '../../domain/parallel-group.js';
import { DialerStateError, errorMessage } from '../../errors/dialer-errors.js';
import {
  ParallelStateStore,
  type ParallelStateStoreService,
} from '../../ports/parallel-state-store.js';
import type {
  ParallelCall,
  ParallelGroup,
  ParallelStore,
} from '../../types.js';

const stateFailure = (operation: string, cause: unknown): DialerStateError =>
  new DialerStateError({
    operation,
    message: errorMessage(cause),
    retryable: true,
    cause,
  });

const tryStore = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => stateFailure(operation, cause),
  });

export const createParallelStateStoreLayer = (
  store: ParallelStore,
): Layer.Layer<ParallelStateStoreService> => {
  const service: ParallelStateStoreService = {
    setGroup: (group, ttlSeconds) =>
      tryStore('set-group', () =>
        store.setGroup(group.groupId, JSON.stringify(group), ttlSeconds),
      ),
    getGroup: (groupId) =>
      tryStore('get-group', async () => {
        try {
          const raw = await store.getGroup(groupId);
          return raw
            ? hydrateParallelGroup(JSON.parse(raw) as ParallelGroup)
            : null;
        } catch (cause: unknown) {
          throw new Error(
            `Failed to read parallel group: ${errorMessage(cause)}`,
          );
        }
      }),
    registerCall: (groupId, call, ttlSeconds) =>
      tryStore('register-call', () =>
        store.registerCall(groupId, call, ttlSeconds),
      ),
    getGroupIdForCall: (callSid) =>
      tryStore('get-call-mapping', () => store.getCallMapping(callSid)),
    claimWinner: (groupId, callSid, ttlSeconds) =>
      tryStore('claim-winner', () =>
        store.setWinnerIfAbsent(groupId, callSid, ttlSeconds),
      ),
    getWinner: (groupId) =>
      tryStore('get-winner', () => store.getWinner(groupId)),
    claimTelemetryEmission: (groupId, emittedAt, ttlSeconds) =>
      tryStore('claim-telemetry', () =>
        store.claimTelemetryEmission(groupId, emittedAt, ttlSeconds),
      ),
    withGroupLock: <A, E>(groupId: string, operation: Effect.Effect<A, E>) =>
      Effect.async<A, E | DialerStateError>((resume) => {
        let resumed = false;
        const finish = (
          effect: Effect.Effect<A, E | DialerStateError>,
        ): void => {
          if (resumed) return;
          resumed = true;
          resume(effect);
        };

        store
          .withGroupLock(groupId, async () => {
            try {
              const exit = await Effect.runPromiseExit(operation);
              Exit.match(exit, {
                onFailure: (cause) => finish(Effect.failCause(cause)),
                onSuccess: (value) => finish(Effect.succeed(value)),
              });
            } catch (cause: unknown) {
              finish(Effect.fail(stateFailure('run-locked-operation', cause)));
            }
          })
          .catch((cause: unknown) => {
            finish(Effect.fail(stateFailure('with-group-lock', cause)));
          });
      }),
    deleteGroup: (groupId) =>
      tryStore('delete-group', () => store.deleteGroup(groupId)),
  };

  return Layer.succeed(ParallelStateStore, service);
};

export class InMemoryParallelStore implements ParallelStore {
  private groups = new Map<string, { data: string; expiresAt: number }>();
  private callMappings = new Map<
    string,
    { groupId: string; expiresAt: number }
  >();
  private winners = new Map<string, { callSid: string; expiresAt: number }>();
  private groupLocks = new Map<string, Promise<void>>();

  async setGroup(
    groupId: string,
    data: string,
    ttlSeconds: number,
  ): Promise<void> {
    this.groups.set(groupId, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async getGroup(groupId: string): Promise<string | null> {
    const entry = this.groups.get(groupId);
    if (!entry || entry.expiresAt < Date.now()) {
      this.groups.delete(groupId);
      return null;
    }
    return entry.data;
  }

  async registerCall(
    groupId: string,
    call: ParallelCall,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.withGroupLock(groupId, async () => {
        try {
          const raw = await this.getGroup(groupId);
          if (!raw) {
            throw new Error('Parallel group not found while registering call');
          }

          const group = hydrateParallelGroup(JSON.parse(raw) as ParallelGroup);
          if (
            !group.calls.some((candidate) => candidate.callSid === call.callSid)
          ) {
            group.calls.push(call);
          }
          await this.setGroup(groupId, JSON.stringify(group), ttlSeconds);
          await this.setCallMapping(call.callSid, groupId, ttlSeconds);
        } catch (cause: unknown) {
          throw new Error(
            `Failed to register parallel call: ${errorMessage(cause)}`,
          );
        }
      });
    } catch (cause: unknown) {
      throw new Error(
        `Parallel call registration failed: ${errorMessage(cause)}`,
      );
    }
  }

  async setCallMapping(
    callSid: string,
    groupId: string,
    ttlSeconds: number,
  ): Promise<void> {
    this.callMappings.set(callSid, {
      groupId,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async getCallMapping(callSid: string): Promise<string | null> {
    const entry = this.callMappings.get(callSid);
    if (!entry || entry.expiresAt < Date.now()) {
      this.callMappings.delete(callSid);
      return null;
    }
    return entry.groupId;
  }

  async setWinnerIfAbsent(
    groupId: string,
    callSid: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const existing = this.winners.get(groupId);
    if (existing && existing.expiresAt >= Date.now()) return false;
    this.winners.set(groupId, {
      callSid,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
  }

  async getWinner(groupId: string): Promise<string | null> {
    const entry = this.winners.get(groupId);
    if (!entry || entry.expiresAt < Date.now()) {
      this.winners.delete(groupId);
      return null;
    }
    return entry.callSid;
  }

  async claimTelemetryEmission(
    groupId: string,
    emittedAt: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    try {
      return await this.withGroupLock(groupId, async () => {
        try {
          const raw = await this.getGroup(groupId);
          if (!raw) return false;
          const group = hydrateParallelGroup(JSON.parse(raw) as ParallelGroup);
          if (group.telemetryEmittedAt) return false;
          group.telemetryEmittedAt = emittedAt;
          await this.setGroup(groupId, JSON.stringify(group), ttlSeconds);
          return true;
        } catch (cause: unknown) {
          throw new Error(
            `Failed to claim telemetry emission: ${errorMessage(cause)}`,
          );
        }
      });
    } catch (cause: unknown) {
      throw new Error(`Telemetry claim failed: ${errorMessage(cause)}`);
    }
  }

  async withGroupLock<A>(
    groupId: string,
    operation: () => Promise<A>,
  ): Promise<A> {
    const previous = this.groupLocks.get(groupId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    this.groupLocks.set(groupId, tail);

    await previous;
    try {
      return await operation();
    } catch (cause: unknown) {
      throw new Error(
        `Parallel group operation failed: ${errorMessage(cause)}`,
      );
    } finally {
      release();
      if (this.groupLocks.get(groupId) === tail) {
        this.groupLocks.delete(groupId);
      }
    }
  }

  async deleteGroup(groupId: string): Promise<void> {
    this.groups.delete(groupId);
    this.winners.delete(groupId);
    for (const [callSid, mapping] of this.callMappings.entries()) {
      if (mapping.groupId === groupId) this.callMappings.delete(callSid);
    }
  }
}
