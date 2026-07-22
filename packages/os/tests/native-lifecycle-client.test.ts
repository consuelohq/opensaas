import { describe, expect, test } from 'vitest';

import {
  createNativeLifecycleClient,
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
});
