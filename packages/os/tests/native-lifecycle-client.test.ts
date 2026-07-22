import { describe, expect, test } from 'vitest';

import {
  createNativeLifecycleClient,
  releaseChannels,
  type LifecycleSnapshot,
  type NativeLifecycleTransport,
} from '../scripts/lib/native-lifecycle-client';

const healthySnapshot: LifecycleSnapshot = {
  schemaVersion: 1,
  sequence: 7,
  observedAt: '2026-07-22T20:00:00.000Z',
  runtime: {
    version: '1.4.0',
    channel: 'stable',
    state: 'running',
  },
  services: [
    { id: 'consuelo-os', state: 'healthy', managedBy: 'launchd' },
    { id: 'consuelo-gateway', state: 'degraded', managedBy: 'launchd' },
  ],
  updates: {
    available: 2,
    latestVersion: '1.6.0',
    rollbackVersion: '1.3.2',
  },
};

function createTransport(): NativeLifecycleTransport & {
  requests: unknown[];
  emit(snapshot: LifecycleSnapshot): void;
} {
  const requests: unknown[] = [];
  let listener: ((snapshot: LifecycleSnapshot) => void) | undefined;
  return {
    requests,
    async request(request) {
      requests.push(request);
      if (request.kind === 'status.get') return healthySnapshot;
      return { accepted: true, operationId: `op-${requests.length}` };
    },
    subscribe(next) {
      listener = next;
      return () => {
        listener = undefined;
      };
    },
    emit(snapshot) {
      listener?.(snapshot);
    },
  };
}

describe('native lifecycle client', () => {
  test('loads structured status and exposes version, channel, health, and update count', async () => {
    const client = createNativeLifecycleClient({ transport: createTransport() });

    const snapshot = await client.refresh();

    expect(snapshot.runtime).toEqual({
      version: '1.4.0',
      channel: 'stable',
      state: 'running',
    });
    expect(snapshot.services.map(({ id, state }) => ({ id, state }))).toEqual([
      { id: 'consuelo-os', state: 'healthy' },
      { id: 'consuelo-gateway', state: 'degraded' },
    ]);
    expect(snapshot.updates.available).toBe(2);
  });

  test('sends typed update and rollback requests without parsing CLI text', async () => {
    const transport = createTransport();
    const client = createNativeLifecycleClient({ transport });

    await expect(client.applyUpdate('1.6.0')).resolves.toMatchObject({ accepted: true });
    await expect(client.rollback('1.3.2')).resolves.toMatchObject({ accepted: true });

    expect(transport.requests).toEqual([
      { kind: 'update.apply', targetVersion: '1.6.0' },
      { kind: 'update.rollback', targetVersion: '1.3.2' },
    ]);
  });

  test('preserves the last snapshot when the local service is offline', async () => {
    const client = createNativeLifecycleClient({
      initialSnapshot: healthySnapshot,
      transport: {
        async request() {
          throw new Error('named pipe unavailable');
        },
        subscribe() {
          return () => undefined;
        },
      },
    });

    await expect(client.refresh()).resolves.toMatchObject({
      runtime: { state: 'offline' },
      connection: { state: 'offline', reason: 'named pipe unavailable' },
      sequence: 7,
    });
  });

  test('closing the shell only unsubscribes; it never sends a service stop request', async () => {
    const transport = createTransport();
    const client = createNativeLifecycleClient({ transport });
    client.connect(() => undefined);

    client.closeShell();

    expect(transport.requests).toEqual([]);
  });

  test('accepts monotonic lifecycle events and ignores stale snapshots', () => {
    const transport = createTransport();
    const client = createNativeLifecycleClient({
      initialSnapshot: healthySnapshot,
      transport,
    });
    const observed: number[] = [];
    client.connect((snapshot) => observed.push(snapshot.sequence));

    transport.emit({ ...healthySnapshot, sequence: 6 });
    transport.emit({ ...healthySnapshot, sequence: 8 });

    expect(observed).toEqual([8]);
  });

  test('supports every existing distribution channel plus nightly', () => {
    expect(releaseChannels).toEqual(['stable', 'beta', 'canary', 'dev', 'nightly']);
  });

  test('accepts an equal-sequence online event after a local offline projection', async () => {
    let listener: ((snapshot: LifecycleSnapshot) => void) | undefined;
    const transport: NativeLifecycleTransport & { emit(snapshot: LifecycleSnapshot): void } = {
      async request() {
        throw new Error('socket unavailable');
      },
      subscribe(next) {
        listener = next;
        return () => {
          if (listener === next) listener = undefined;
        };
      },
      emit(next) {
        listener?.(next);
      },
    };
    const client = createNativeLifecycleClient({ initialSnapshot: healthySnapshot, transport });
    const observed: LifecycleSnapshot[] = [];

    await client.refresh();
    client.connect((snapshot) => observed.push(snapshot));
    transport.emit(healthySnapshot);

    expect(observed).toHaveLength(1);
    expect(observed[0]).toMatchObject({
      sequence: 7,
      runtime: { state: 'running' },
      connection: { state: 'online' },
    });
  });

  test('a stale cleanup cannot unsubscribe a replacement connection', () => {
    const listeners = new Map<number, (snapshot: LifecycleSnapshot) => void>();
    let nextId = 0;
    const transport: NativeLifecycleTransport & { emit(snapshot: LifecycleSnapshot): void } = {
      async request() {
        return healthySnapshot;
      },
      subscribe(listener) {
        const id = ++nextId;
        listeners.set(id, listener);
        return () => {
          listeners.delete(id);
        };
      },
      emit(snapshot) {
        for (const listener of listeners.values()) listener(snapshot);
      },
    };
    const client = createNativeLifecycleClient({ initialSnapshot: healthySnapshot, transport });
    const first: number[] = [];
    const second: number[] = [];

    const cleanupFirst = client.connect((snapshot) => first.push(snapshot.sequence));
    client.connect((snapshot) => second.push(snapshot.sequence));
    cleanupFirst();
    transport.emit({ ...healthySnapshot, sequence: 8 });

    expect(first).toEqual([]);
    expect(second).toEqual([8]);
  });


  test('restores a retained offline snapshot from an equal-sequence successful refresh', async () => {
    const retainedOfflineSnapshot: LifecycleSnapshot = {
      ...healthySnapshot,
      runtime: { ...healthySnapshot.runtime, state: 'offline' },
      connection: { state: 'offline', reason: 'shell restarted while service was unavailable' },
    };
    const client = createNativeLifecycleClient({
      initialSnapshot: retainedOfflineSnapshot,
      transport: createTransport(),
    });

    await expect(client.refresh()).resolves.toMatchObject({
      sequence: 7,
      runtime: { state: 'running' },
      connection: { state: 'online' },
    });
    expect(client.current()).toMatchObject({
      sequence: 7,
      runtime: { state: 'running' },
      connection: { state: 'online' },
    });
  });
  test('keeps a newer subscribed snapshot when an older refresh resolves later', async () => {
    let resolveStatus: ((snapshot: LifecycleSnapshot) => void) | undefined;
    let listener: ((snapshot: LifecycleSnapshot) => void) | undefined;
    const transport: NativeLifecycleTransport & { emit(snapshot: LifecycleSnapshot): void } = {
      request(request) {
        if (request.kind !== 'status.get') {
          return Promise.resolve({ accepted: true, operationId: 'unexpected-operation' });
        }
        return new Promise<LifecycleSnapshot>((resolve) => {
          resolveStatus = resolve;
        });
      },
      subscribe(next) {
        listener = next;
        return () => {
          if (listener === next) listener = undefined;
        };
      },
      emit(snapshot) {
        listener?.(snapshot);
      },
    };
    const client = createNativeLifecycleClient({ initialSnapshot: healthySnapshot, transport });
    client.connect(() => undefined);

    const refresh = client.refresh();
    transport.emit({ ...healthySnapshot, sequence: 9, runtime: { ...healthySnapshot.runtime, version: '1.9.0' } });
    resolveStatus?.({ ...healthySnapshot, sequence: 8, runtime: { ...healthySnapshot.runtime, version: '1.8.0' } });

    await expect(refresh).resolves.toMatchObject({ sequence: 9, runtime: { version: '1.9.0' } });
    expect(client.current()).toMatchObject({ sequence: 9, runtime: { version: '1.9.0' } });
  });
});
