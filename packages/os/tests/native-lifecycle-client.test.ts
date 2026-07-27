import { describe, expect, test } from 'vitest';

import {
  createNativeLifecycleClient,
  releaseChannels,
  type NotificationPreference,
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

const createTransport = (): NativeLifecycleTransport & {
  requests: unknown[];
  emit(snapshot: LifecycleSnapshot): void;
} => {
  const requests: unknown[] = [];
  let listener: ((snapshot: LifecycleSnapshot) => void) | undefined;
  return {
    requests,
    request: async (request) => {
      requests.push(request);
      if (request.kind === 'status.get') return healthySnapshot;
      return { accepted: true, operationId: `op-${requests.length}` };
    },
    subscribe: (next) => {
      listener = next;
      return () => {
        listener = undefined;
      };
    },
    emit: (snapshot) => {
      listener?.(snapshot);
    },
  };
};

describe('native lifecycle client', () => {
  test('should expose structured status when the endpoint returns a snapshot', async () => {
    const client = createNativeLifecycleClient({
      transport: createTransport(),
    });

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

  test('should send typed update and rollback requests when mutations are invoked', async () => {
    const transport = createTransport();
    const client = createNativeLifecycleClient({ transport });

    await expect(client.applyUpdate('1.6.0')).resolves.toMatchObject({
      accepted: true,
    });
    await expect(client.rollback('1.3.2')).resolves.toMatchObject({
      accepted: true,
    });

    expect(transport.requests).toEqual([
      { kind: 'update.apply', targetVersion: '1.6.0' },
      { kind: 'update.rollback', targetVersion: '1.3.2' },
    ]);
  });

  test('should reject the operation when the endpoint returns an error acknowledgement', async () => {
    const transport: NativeLifecycleTransport = {
      request: async (request) => {
        if (request.kind === 'status.get') return healthySnapshot;
        return {
          accepted: false,
          operationId: 'rejected-1',
          error: 'target release is unavailable',
        };
      },
      subscribe: () => () => undefined,
    };
    const client = createNativeLifecycleClient({ transport });

    await expect(client.applyUpdate('9.9.9')).rejects.toThrow(
      'target release is unavailable',
    );
  });

  test('should send allowlisted lifecycle requests when menu mutations are invoked', async () => {
    const transport = createTransport();
    const client = createNativeLifecycleClient({ transport });
    const snoozed: NotificationPreference = {
      state: 'snoozed',
      until: '2026-07-27T20:00:00.000Z',
    };

    await client.repair(false);
    await client.repair(true);
    await client.restart();
    await client.setNotifications(snoozed);
    await client.setChannel('beta');
    await client.setDefaultNode('node-member');
    await client.exportDiagnostics();
    await client.uninstall({ removeNode: false, removeUserContent: false });

    expect(transport.requests).toEqual([
      { kind: 'repair.run', destructive: false },
      { kind: 'repair.run', destructive: true },
      { kind: 'service.restart' },
      { kind: 'preferences.notifications.set', notifications: snoozed },
      { kind: 'preferences.channel.set', channel: 'beta' },
      { kind: 'workspace.default-node.set', nodeId: 'node-member' },
      { kind: 'diagnostics.export' },
      {
        kind: 'uninstall.execute',
        removeNode: false,
        removeUserContent: false,
      },
    ]);
  });

  test('should preserve optional safe metadata when an enriched snapshot flows through the client', () => {
    const transport = createTransport();
    const client = createNativeLifecycleClient({ transport });
    client.connect(() => undefined);
    const enriched: LifecycleSnapshot = {
      ...healthySnapshot,
      install: { state: 'installed' },
      connector: { state: 'connected' },
      release: { summary: 'Reliability fixes' },
      preferences: {
        channelSelectionAllowed: true,
        notifications: { state: 'on' },
      },
      workspace: {
        workspaceId: 'workspace_one',
        workspaceHost: 'one.consuelohq.com',
        currentNodeId: 'node-home',
        defaultNodeId: 'node-home',
        nodes: [
          {
            workspaceId: 'workspace_one',
            nodeId: 'node-home',
            displayName: 'Mac Mini',
            role: 'home',
            platform: 'darwin',
            architecture: 'arm64',
            channel: 'dev',
            connectorId: 'connector_home',
            capabilities: ['local-runtime', 'darwin'],
            createdAt: '2026-07-20T12:00:00.000Z',
            lastSeenAt: '2026-07-26T19:59:45.000Z',
            presence: 'online',
            state: 'active',
            publicKeyThumbprint: 'thumbprint',
          },
        ],
      },
    };

    transport.emit(enriched);

    expect(client.current()?.workspace?.nodes[0]).toMatchObject({
      role: 'home',
      presence: 'online',
      capabilities: ['local-runtime', 'darwin'],
    });
    expect(healthySnapshot.install).toBeUndefined();
  });

  test('should preserve the last snapshot when the local service becomes offline', async () => {
    const client = createNativeLifecycleClient({
      initialSnapshot: healthySnapshot,
      transport: {
        request: async () => {
          throw new Error('named pipe unavailable');
        },
        subscribe: () => {
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

  test('should only unsubscribe when the shell closes', async () => {
    const transport = createTransport();
    const client = createNativeLifecycleClient({ transport });
    client.connect(() => undefined);

    client.closeShell();

    expect(transport.requests).toEqual([]);
  });

  test('should accept a lower sequence when a newer daemon instance appears', () => {
    const transport = createTransport();
    const client = createNativeLifecycleClient({
      initialSnapshot: {
        ...healthySnapshot,
        instanceId: 'daemon-old',
        sequence: 100,
        observedAt: '2026-07-27T03:00:00.000Z',
      },
      transport,
    });
    const observed: Array<[string | undefined, number]> = [];
    client.connect((snapshot) =>
      observed.push([snapshot.instanceId, snapshot.sequence]),
    );

    transport.emit({
      ...healthySnapshot,
      instanceId: 'daemon-new',
      sequence: 1,
      observedAt: '2026-07-27T03:01:00.000Z',
    });
    transport.emit({
      ...healthySnapshot,
      instanceId: 'daemon-old',
      sequence: 101,
      observedAt: '2026-07-27T03:00:30.000Z',
    });

    expect(observed).toEqual([['daemon-new', 1]]);
  });

  test('should accept monotonic events when stale snapshots arrive later', () => {
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

  test('should support every distribution channel when snapshots are decoded', () => {
    expect(releaseChannels).toEqual([
      'stable',
      'beta',
      'canary',
      'dev',
      'nightly',
    ]);
  });

  test('should accept an equal-sequence event when an offline projection was local', async () => {
    let listener: ((snapshot: LifecycleSnapshot) => void) | undefined;
    const transport: NativeLifecycleTransport & {
      emit(snapshot: LifecycleSnapshot): void;
    } = {
      request: async () => {
        throw new Error('socket unavailable');
      },
      subscribe: (next) => {
        listener = next;
        return () => {
          if (listener === next) listener = undefined;
        };
      },
      emit: (next) => {
        listener?.(next);
      },
    };
    const client = createNativeLifecycleClient({
      initialSnapshot: healthySnapshot,
      transport,
    });
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

  test('should preserve a replacement connection when stale cleanup runs', () => {
    const listeners = new Map<number, (snapshot: LifecycleSnapshot) => void>();
    let nextId = 0;
    const transport: NativeLifecycleTransport & {
      emit(snapshot: LifecycleSnapshot): void;
    } = {
      request: async () => {
        return healthySnapshot;
      },
      subscribe: (listener) => {
        const id = ++nextId;
        listeners.set(id, listener);
        return () => {
          listeners.delete(id);
        };
      },
      emit: (snapshot) => {
        for (const listener of listeners.values()) listener(snapshot);
      },
    };
    const client = createNativeLifecycleClient({
      initialSnapshot: healthySnapshot,
      transport,
    });
    const first: number[] = [];
    const second: number[] = [];

    const cleanupFirst = client.connect((snapshot) =>
      first.push(snapshot.sequence),
    );
    client.connect((snapshot) => second.push(snapshot.sequence));
    cleanupFirst();
    transport.emit({ ...healthySnapshot, sequence: 8 });

    expect(first).toEqual([]);
    expect(second).toEqual([8]);
  });

  test('should restore a retained snapshot when an equal-sequence refresh succeeds', async () => {
    const retainedOfflineSnapshot: LifecycleSnapshot = {
      ...healthySnapshot,
      runtime: { ...healthySnapshot.runtime, state: 'offline' },
      connection: {
        state: 'offline',
        reason: 'shell restarted while service was unavailable',
      },
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
  test('should keep the newer subscription snapshot when an older refresh resolves later', async () => {
    let resolveStatus: ((snapshot: LifecycleSnapshot) => void) | undefined;
    let listener: ((snapshot: LifecycleSnapshot) => void) | undefined;
    const transport: NativeLifecycleTransport & {
      emit(snapshot: LifecycleSnapshot): void;
    } = {
      request: (request) => {
        if (request.kind !== 'status.get') {
          return Promise.resolve({
            accepted: true,
            operationId: 'unexpected-operation',
          });
        }
        return new Promise<LifecycleSnapshot>((resolve) => {
          resolveStatus = resolve;
        });
      },
      subscribe: (next) => {
        listener = next;
        return () => {
          if (listener === next) listener = undefined;
        };
      },
      emit: (snapshot) => {
        listener?.(snapshot);
      },
    };
    const client = createNativeLifecycleClient({
      initialSnapshot: healthySnapshot,
      transport,
    });
    client.connect(() => undefined);

    const refresh = client.refresh();
    transport.emit({
      ...healthySnapshot,
      sequence: 9,
      runtime: { ...healthySnapshot.runtime, version: '1.9.0' },
    });
    resolveStatus?.({
      ...healthySnapshot,
      sequence: 8,
      runtime: { ...healthySnapshot.runtime, version: '1.8.0' },
    });

    await expect(refresh).resolves.toMatchObject({
      sequence: 9,
      runtime: { version: '1.9.0' },
    });
    expect(client.current()).toMatchObject({
      sequence: 9,
      runtime: { version: '1.9.0' },
    });
  });
});
