import { EmbedSessionExpiredError } from './api-client.js';
import type { MercuryCueView } from './mercury-cues.js';
import type {
  MercuryControl,
  MercuryFeedApi,
  MercuryResponse,
} from './mercury-feed-api.js';

export type MercuryFeedStatus =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'updating'
  | 'reconnecting'
  | 'unavailable'
  | 'unknown'
  | 'denied';
type Configuration = {
  scopeKey: string;
  scriptId: string;
  enabled: boolean;
  authEpoch: string;
};
export const createMercuryFeed = (input: {
  api: MercuryFeedApi;
  onView: (view: MercuryCueView | null) => void;
  onStatus: (status: MercuryFeedStatus) => void;
  onSessionExpired?: () => void;
  schedule?: (callback: () => void, delay: number) => () => void;
}) => {
  const schedule =
    input.schedule ??
    ((callback, delay) => {
      const timer = setTimeout(callback, delay);
      return () => clearTimeout(timer);
    });
  let generation = 0;
  let configKey = '';
  let active: Configuration | null = null;
  let createdScope: string | null = null;
  let createdToken: string | null = null;
  let version: string | null = null;
  let revision = -1;
  let stopTimer: (() => void) | undefined;
  let readController: AbortController | undefined;
  let transition: Promise<void> = Promise.resolve();
  let controlPending = false;
  let failures = 0;
  const clearRead = () => {
    stopTimer?.();
    stopTimer = undefined;
    readController?.abort();
    readController = undefined;
  };
  const current = (epoch: number) => epoch === generation;
  const deny = (error: unknown): boolean =>
    error instanceof EmbedSessionExpiredError ||
    (typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      [401, 403, 409].includes(Number(error.status)));
  const failed = (error: unknown, epoch: number) => {
    if (!current(epoch)) return;
    if (error instanceof EmbedSessionExpiredError) input.onSessionExpired?.();
    if (deny(error)) {
      input.onView(null);
      input.onStatus('denied');
    } else input.onStatus('unavailable');
  };
  const accept = (result: MercuryResponse, epoch: number) => {
    if (!current(epoch)) return;
    if (!createdToken || result.projectionToken !== createdToken)
      throw new Error('The coaching session changed.');
    if (version && version !== result.publishedVersion)
      throw new Error('The pinned playbook version changed.');
    version = result.publishedVersion;
    if (result.view && result.view.revision > revision) {
      revision = result.view.revision;
      input.onView(result.view);
    }
    failures = 0;
    input.onStatus('ready');
  };
  const poll = async (epoch: number): Promise<void> => {
    if (!current(epoch) || !active?.enabled || !createdScope) return;
    const controller = new AbortController();
    readController = controller;
    try {
      const result = await input.api.read(
        createdScope,
        Math.max(0, revision),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      accept(result, epoch);
    } catch (error: unknown) {
      if (!current(epoch) || controller.signal.aborted) return;
      failures++;
      failed(error, epoch);
      if (deny(error)) return;
      input.onStatus('reconnecting');
    } finally {
      if (readController === controller) readController = undefined;
    }
    if (current(epoch) && active?.enabled)
      stopTimer = schedule(
        () => void poll(epoch),
        Math.min(8000, 1500 * 2 ** Math.min(failures, 3)),
      );
  };
  const close = async (epoch: number): Promise<boolean> => {
    const scope = createdScope;
    const token = createdToken;
    if (!scope) return true;
    if (!token) {
      // The latest server projection may belong to another device. Only our own
      // admission response proves which token we may use to mutate it.
      if (active?.enabled && active.scopeKey && active.scopeKey !== scope) {
        createdScope = null;
        return true;
      }
      if (current(epoch)) input.onStatus('unknown');
      return false;
    }
    try {
      await input.api.control(
        scope,
        'off',
        token,
        new AbortController().signal,
      );
      if (createdScope === scope && createdToken === token) {
        createdScope = null;
        createdToken = null;
      }
      return true;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        (error.status === 404 ||
          // Failure to clean up one caller must not lock assistance for an
          // independent call. Keep same-call failures fenced to our own token.
          ([403, 409].includes(Number(error.status)) &&
            current(epoch) &&
            active?.enabled &&
            !!active.scopeKey &&
            active.scopeKey !== scope))
      ) {
        if (createdScope === scope && createdToken === token) {
          createdScope = null;
          createdToken = null;
        }
        return true;
      }
      failed(error, epoch);
      return false;
    }
  };
  const configure = (next: Configuration) => {
    const key = JSON.stringify(next);
    if (key === configKey) return;
    configKey = key;
    active = next;
    const epoch = ++generation;
    clearRead();
    input.onView(null);
    input.onStatus(next.enabled ? 'connecting' : 'idle');
    // Admission is a mutation. Let it settle, then close its result before a new generation.
    // Aborting a POST cannot prove the server did not commit it.
    transition = transition.then(async () => {
      if (!(await close(epoch)) || !current(epoch) || !next.enabled) return;
      version = null;
      revision = -1;
      failures = 0;
      try {
        createdScope = next.scopeKey;
        createdToken = null;
        const result = await input.api.start(
          { scopeKey: next.scopeKey, scriptId: next.scriptId },
          new AbortController().signal,
        );
        createdToken = result.projectionToken;
        if (!current(epoch)) return;
        accept(result, epoch);
        stopTimer = schedule(() => void poll(epoch), 1500);
      } catch (error: unknown) {
        // A typed admission denial is definitive; no worker was admitted.
        if (deny(error) && createdScope === next.scopeKey) {
          createdScope = null;
          createdToken = null;
        }
        failed(error, epoch);
        if (
          !deny(error) &&
          createdScope === next.scopeKey &&
          !createdToken &&
          current(epoch)
        )
          input.onStatus('unknown');
      }
    });
  };
  return {
    configure,
    control: async (
      action: Exclude<MercuryControl, 'off'>,
    ): Promise<boolean> => {
      if (!createdScope || !createdToken || !active?.enabled || controlPending)
        return false;
      controlPending = true;
      clearRead();
      const epoch = generation;
      input.onStatus('updating');
      let succeeded = false;
      transition = transition.then(async () => {
        if (!current(epoch) || !createdScope || !createdToken) return;
        try {
          const result = await input.api.control(
            createdScope,
            action,
            createdToken,
            new AbortController().signal,
          );
          accept(result, epoch);
          succeeded = current(epoch);
        } catch (error: unknown) {
          failed(error, epoch);
        } finally {
          if (current(epoch) && active?.enabled)
            stopTimer = schedule(() => void poll(epoch), 1500);
        }
      });
      await transition;
      controlPending = false;
      return succeeded;
    },
    dispose: () => {
      if (!active) return;
      configKey = '';
      configure({ ...active, enabled: false });
    },
  };
};
