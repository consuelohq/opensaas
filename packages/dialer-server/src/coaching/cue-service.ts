import { randomUUID } from 'node:crypto';
import {
  admitCapability,
  type ConversationScope,
  type ParticipantBinding,
  type AssistancePolicy,
  type TranscriptEvent,
  type TranscriptCursor,
} from '@consuelo/conversation';
import type { DialerIdentity } from '../contracts';
import {
  createScriptSession,
  type ScriptSession,
  type MercuryCueView,
  type ClosedSetSelector,
} from './script-engine';
import { ScriptConflictError } from './scripts';
import {
  PlaybookAccessError,
  type PlaybookStore,
  type Publication,
} from './playbook-store';
export type CallAdmission = {
  scope: ConversationScope;
  participants: readonly ParticipantBinding[];
  policy: AssistancePolicy;
  active: boolean;
  audioOffsetMs: number | null;
  audioOffsetsByLeg?: Readonly<Record<string, number>>;
  audioOffsetsByStream?: Readonly<Record<string, number>>;
};
export type TranscriptSource = {
  read(input: {
    admission: CallAdmission;
    afterCursor: number;
    cursor: TranscriptCursor;
    projectionId: string;
    signal: AbortSignal;
  }): Promise<
    readonly {
      sourceCursor: number;
      events: readonly TranscriptEvent[];
      acknowledge?: () => Promise<void>;
    }[]
  >;
  release?: (projectionId: string) => void;
};
export type CueService = {
  open(
    identity: DialerIdentity,
    input: { scopeKey: string; scriptId: string; version?: number },
    signal?: AbortSignal,
  ): Promise<{
    view: MercuryCueView;
    publishedVersion: string;
    projectionToken: string;
  }>;
  read(
    identity: DialerIdentity,
    scopeKey: string,
    afterRevision?: number,
  ): Promise<{
    view: MercuryCueView | null;
    publishedVersion: string;
    projectionToken: string;
  }>;
  control(
    identity: DialerIdentity,
    scopeKey: string,
    action: 'pin' | 'auto' | 'next' | 'previous' | 'off',
    projectionToken: string,
  ): Promise<{
    view: MercuryCueView | null;
    projectionToken: string;
    publishedVersion: string;
  }>;
  dispose(): void;
};
export function createCueService(options: {
  store: PlaybookStore;
  resolve(identity: DialerIdentity, scopeKey: string): Promise<CallAdmission>;
  source?: TranscriptSource;
  selector?: ClosedSetSelector;
  nowMs?: () => number;
  maxSessions?: number;
}): CueService {
  const nowMs = options.nowMs ?? Date.now,
    owner = randomUUID(),
    maximum = options.maxSessions ?? 200;
  type Entry = {
    publication: Publication;
    session: ScriptSession;
    sourceCursor: number;
    abort: AbortController;
    poll: Promise<void> | null;
    lastAccess: number;
    workerGeneration: number;
    scope: ConversationScope;
    projectionId: string;
    projectionToken: string;
    bindingKey: string;
  };
  const entries = new Map<string, Entry>(),
    openJobs = new Map<string, Promise<void>>(),
    epochs = new Map<string, number>();
  let pendingOpens = 0;
  const key = (identity: DialerIdentity, scopeKey: string) =>
    JSON.stringify([identity.workspaceId, identity.userId, scopeKey]);
  const bindingKey = (a: CallAdmission) => JSON.stringify(a.participants);
  const stop = (k: string, entry: Entry) => {
    entry.abort.abort();
    entry.session.dispose();
    options.source?.release?.(entry.projectionId);
    if (entries.get(k) === entry) entries.delete(k);
  };
  const authorized = async (identity: DialerIdentity, scopeKey: string) => {
    try {
      if (!identity.workspaceId || !identity.userId || scopeKey.length > 256)
        throw new PlaybookAccessError('Call unavailable');
      const admission = await options.resolve(identity, scopeKey);
      if (
        admission.scope.workspaceId !== identity.workspaceId ||
        admission.policy.memberId !== identity.userId ||
        !admitCapability(
          admission.policy,
          admission.scope,
          'manual-reference',
          nowMs(),
        ).allowed
      )
        throw new PlaybookAccessError(
          'Call or manual-reference access is unavailable',
        );
      return admission;
    } catch (cause: unknown) {
      throw cause instanceof Error
        ? cause
        : new Error('Coaching operation failed', { cause });
    }
  };
  const renew = async (
    identity: DialerIdentity,
    scopeKey: string,
    entry: Entry,
  ) => {
    try {
      const admission = await authorized(identity, scopeKey);
      if (
        admission.scope.workspaceId !== entry.scope.workspaceId ||
        admission.scope.callSessionId !== entry.scope.callSessionId ||
        admission.scope.callGeneration !== entry.scope.callGeneration ||
        bindingKey(admission) !== entry.bindingKey
      )
        throw new PlaybookAccessError('Call binding changed; reopen coaching');
      const generation = await options.store.claim(identity, scopeKey, owner);
      if (generation !== entry.workerGeneration)
        throw new PlaybookAccessError('Coaching worker changed; reconnect');
      entry.lastAccess = nowMs();
      entry.session.renew(admission.policy);
      if (!admission.active) stop(key(identity, scopeKey), entry);
      return admission;
    } catch (error: unknown) {
      stop(key(identity, scopeKey), entry);
      throw error;
    }
  };
  const poll = async (
    identity: DialerIdentity,
    scopeKey: string,
    entry: Entry,
    admission: CallAdmission,
  ) => {
    try {
      if (
        !options.source ||
        entry.session.diagnostics().mode === 'off' ||
        !admitCapability(
          admission.policy,
          admission.scope,
          'live-coaching',
          nowMs(),
        ).allowed
      )
        return;
      if (entry.poll) return entry.poll;
      entry.poll = (async () => {
        try {
          let rows: Awaited<ReturnType<TranscriptSource['read']>>;
          try {
            rows = await options.source!.read({
              admission,
              afterCursor: entry.sourceCursor,
              cursor: entry.session.diagnostics().cursor,
              projectionId: entry.projectionId,
              signal: entry.abort.signal,
            });
          } catch (error: unknown) {
            // Only source availability failures may degrade to delayed. Renew
            // authority before returning any cached private presentation.
            await renew(identity, scopeKey, entry);
            if (entry.abort.signal.aborted) throw error;
            entry.session.unavailable('delayed');
            return;
          }
          const renewed = await renew(identity, scopeKey, entry);
          if (
            !renewed.active ||
            !admitCapability(
              renewed.policy,
              renewed.scope,
              'live-coaching',
              nowMs(),
            ).allowed
          )
            return;
          for (const row of rows) {
            if (entry.abort.signal.aborted) return;
            for (const event of row.events) {
              const result = await entry.session.ingest(event);
              if (result.status === 'rejected') {
                entry.session.unavailable();
                return;
              }
            }
            entry.sourceCursor = row.sourceCursor;
            await row.acknowledge?.();
          }
          await renew(identity, scopeKey, entry);
        } catch (cause: unknown) {
          throw cause instanceof Error
            ? cause
            : new Error('Coaching operation failed', { cause });
        }
      })().finally(() => {
        entry.poll = null;
      });
      return entry.poll;
    } catch (cause: unknown) {
      throw cause instanceof Error
        ? cause
        : new Error('Coaching operation failed', { cause });
    }
  };
  const serialize = async <T>(
    k: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    try {
      if (pendingOpens >= maximum * 2)
        throw new Error('Coaching admission capacity unavailable');
      pendingOpens++;
      const before = openJobs.get(k) ?? Promise.resolve();
      let release!: () => void;
      const done = new Promise<void>((resolve) => {
        release = resolve;
      });
      openJobs.set(k, done);
      try {
        await before;
        return await operation();
      } finally {
        pendingOpens--;
        release();
        if (openJobs.get(k) === done) openJobs.delete(k);
      }
    } catch (cause: unknown) {
      throw cause instanceof Error
        ? cause
        : new Error('Coaching operation failed', { cause });
    }
  };
  return {
    async open(identity, input, signal) {
      try {
        signal?.throwIfAborted();
        const k = key(identity, input.scopeKey),
          epoch = epochs.get(k) ?? 0;
        return serialize(k, async () => {
          try {
            const admission = await authorized(identity, input.scopeKey);
            if (!admission.active)
              throw new PlaybookAccessError('Call has ended');
            if ((epochs.get(k) ?? 0) !== epoch)
              throw new PlaybookAccessError(
                'Coaching selection was superseded',
              );
            const publication = await options.store.pin(identity, {
              ...input,
              callSessionId: admission.scope.callSessionId,
              callGeneration: admission.scope.callGeneration,
            });
            let entry = entries.get(k);
            if (
              entry &&
              (entry.session.diagnostics().mode === 'off' ||
                entry.bindingKey !== bindingKey(admission))
            ) {
              stop(k, entry);
              entry = undefined;
            }
            if (!entry) {
              for (const [oldKey, old] of entries)
                if (nowMs() - old.lastAccess > 300000) {
                  stop(oldKey, old);
                  if (!openJobs.has(oldKey)) epochs.delete(oldKey);
                }
              if (entries.size >= maximum)
                throw new Error('Coaching capacity unavailable');
              const generation = await options.store.claim(
                identity,
                input.scopeKey,
                owner,
                true,
              );
              if (generation === null)
                throw new PlaybookAccessError(
                  'Coaching already has an active worker',
                );
              entry = {
                publication,
                sourceCursor: 0,
                abort: new AbortController(),
                poll: null,
                lastAccess: nowMs(),
                workerGeneration: generation,
                scope: admission.scope,
                bindingKey: bindingKey(admission),
                projectionId: k + ':' + owner + ':' + generation,
                projectionToken: randomUUID(),
                session: createScriptSession({
                  scope: admission.scope,
                  participants: admission.participants,
                  compiled: publication.compiled,
                  policy: admission.policy,
                  nowMs,
                  selector: options.selector,
                  workerGeneration: generation,
                }),
              };
              if (signal?.aborted || (epochs.get(k) ?? 0) !== epoch) {
                stop(k, entry);
                throw new PlaybookAccessError(
                  'Coaching selection was superseded',
                );
              }
              entries.set(k, entry);
            }
            const onAbort = () => stop(k, entry!);
            signal?.addEventListener('abort', onAbort, { once: true });
            try {
              await renew(identity, input.scopeKey, entry);
              await poll(identity, input.scopeKey, entry, admission);
            } finally {
              signal?.removeEventListener('abort', onAbort);
            }
            if ((epochs.get(k) ?? 0) !== epoch || entry.abort.signal.aborted)
              throw new PlaybookAccessError(
                'Coaching selection was superseded',
              );
            return {
              view: entry.session.view(input.scopeKey),
              publishedVersion:
                entry.publication.compiled.playbook.publishedVersion,
              projectionToken: entry.projectionToken,
            };
          } catch (cause: unknown) {
            throw cause instanceof Error
              ? cause
              : new Error('Coaching operation failed', { cause });
          }
        });
      } catch (cause: unknown) {
        throw cause instanceof Error
          ? cause
          : new Error('Coaching operation failed', { cause });
      }
    },
    async read(identity, scopeKey, afterRevision) {
      try {
        const entry = entries.get(key(identity, scopeKey));
        if (!entry)
          throw new PlaybookAccessError(
            'Select a published script for this call',
          );
        const admission = await renew(identity, scopeKey, entry);
        await poll(identity, scopeKey, entry, admission);
        if (
          entry.abort.signal.aborted ||
          entries.get(key(identity, scopeKey)) !== entry
        )
          throw new PlaybookAccessError('Coaching projection is unavailable');
        const view = entry.session.view(scopeKey);
        return {
          view: afterRevision === view.revision ? null : view,
          publishedVersion:
            entry.publication.compiled.playbook.publishedVersion,
          projectionToken: entry.projectionToken,
        };
      } catch (cause: unknown) {
        throw cause instanceof Error
          ? cause
          : new Error('Coaching operation failed', { cause });
      }
    },
    async control(identity, scopeKey, action, projectionToken) {
      try {
        const k = key(identity, scopeKey);
        return serialize(k, async () => {
          try {
            const entry = entries.get(k);
            if (!entry)
              throw new PlaybookAccessError(
                'Select a published script for this call',
              );
            if (!projectionToken || projectionToken !== entry.projectionToken)
              throw new ScriptConflictError(
                'Coaching projection changed; reconnect before controlling it',
              );
            const admission = await renew(identity, scopeKey, entry);
            if (!admission.active)
              throw new PlaybookAccessError('Call has ended');
            if (action === 'off') {
              epochs.set(k, (epochs.get(k) ?? 0) + 1);
              entry.session.control('off');
              entry.abort.abort();
              options.source?.release?.(entry.projectionId);
            } else entry.session.control(action);
            return {
              view: entry.session.view(scopeKey),
              projectionToken: entry.projectionToken,
              publishedVersion:
                entry.publication.compiled.playbook.publishedVersion,
            };
          } catch (cause: unknown) {
            throw cause instanceof Error
              ? cause
              : new Error('Coaching operation failed', { cause });
          }
        });
      } catch (cause: unknown) {
        throw cause instanceof Error
          ? cause
          : new Error('Coaching operation failed', { cause });
      }
    },
    dispose() {
      for (const [k, entry] of entries) stop(k, entry);
      epochs.clear();
    },
  };
}
