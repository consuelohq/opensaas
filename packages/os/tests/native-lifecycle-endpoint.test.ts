import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { connect } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  LifecycleEngine,
  LifecycleOperationResult,
} from '../scripts/lib/lifecycle';
import {
  NATIVE_LIFECYCLE_MAX_PAYLOAD_BYTES,
  createNativeLifecycleEndpointController,
  encodeNativeLifecycleFrame,
  startDefaultNativeLifecycleEndpoint,
  startNativeLifecycleEndpoint,
} from '../scripts/lib/native-lifecycle-endpoint';
import type {
  LifecycleRequest,
  LifecycleResponse,
} from '../scripts/lib/native-lifecycle-client';
import {
  readStoredOperatorToken,
  readStoredOperatorWorkspaceCredential,
  resolveStoredOperatorWorkspaceCredential,
} from '../scripts/lib/operator-token-store';

const temporaryRoots: string[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

const lifecycleResult = (
  operation: LifecycleOperationResult['operation'],
): LifecycleOperationResult => {
  return { operation, changed: true };
};

const fakeEngine = () => {
  const calls: string[] = [];
  const engine: LifecycleEngine = {
    status: vi.fn(async () => ({
      operation: 'status',
      changed: false,
      installState: 'valid',
      version: '1.4.0',
      bundleId: 'bundle-1.4.0',
      preferences: { channel: 'dev', notifications: { mode: 'on' } },
    })),
    install: vi.fn(async () => lifecycleResult('install')),
    update: vi.fn(async () => {
      calls.push('update');
      return lifecycleResult('update');
    }),
    restart: vi.fn(async () => {
      calls.push('restart');
      return lifecycleResult('restart');
    }),
    repair: vi.fn(async () => {
      calls.push('repair');
      return lifecycleResult('repair');
    }),
    rollback: vi.fn(async () => {
      calls.push('rollback');
      return lifecycleResult('rollback');
    }),
    uninstall: vi.fn(async () => {
      calls.push('uninstall');
      return lifecycleResult('uninstall');
    }),
    devReset: vi.fn(async () => lifecycleResult('reset')),
    setChannel: vi.fn(async (channel) => {
      calls.push(`channel:${channel}`);
      return lifecycleResult('channel');
    }),
    setUpdateNotifications: vi.fn(async (preference) => {
      calls.push(`notifications:${preference.mode}`);
      return lifecycleResult('notifications');
    }),
  };
  return { engine, calls };
};

const requestOverSocket = (
  socketPath: string,
  request: LifecycleRequest,
): Promise<LifecycleResponse> => {
  return new Promise((resolve, reject) => {
    const socket = connect(socketPath);
    const chunks: Buffer[] = [];
    socket.on('connect', () =>
      socket.write(encodeNativeLifecycleFrame(request)),
    );
    socket.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    socket.on('error', reject);
    socket.on('end', () => {
      const response = Buffer.concat(chunks);
      if (response.length < 4)
        return reject(new Error('missing framed response'));
      const length = response.readUInt32BE(0);
      resolve(
        JSON.parse(
          response.subarray(4, 4 + length).toString('utf8'),
        ) as LifecycleResponse,
      );
    });
  });
};

describe('native lifecycle endpoint', () => {
  it('reuses a valid stored operator credential for native workspace-node enrichment', async () => {
    const root = await mkdtemp(join(tmpdir(), 'consuelo-native-endpoint-'));
    temporaryRoots.push(root);
    const generated = join(root, 'node', 'security', 'generated');
    mkdirSync(generated, { recursive: true });
    writeFileSync(
      join(generated, 'operator-token.json'),
      JSON.stringify({
        version: 1,
        kind: 'consuelo-operator-token',
        authorityOrigin: 'https://os.consuelohq.com',
        workspaceHost: 'one.consuelohq.com',
        accessToken: 'operator-access-token',
        refreshToken: 'operator-refresh-token',
        expiresAt: Date.parse('2026-08-14T22:00:00.000Z'),
        scope: ['workspace:read', 'workspace:nodes:manage'],
        createdAt: '2026-08-14T20:00:00.000Z',
      }),
      { mode: 0o600 },
    );

    expect(
      readStoredOperatorWorkspaceCredential({
        home: root,
        nowMs: Date.parse('2026-08-14T21:00:00.000Z'),
      }),
    ).toEqual({
      authorityOrigin: 'https://os.consuelohq.com',
      workspaceHost: 'one.consuelohq.com',
      accessToken: 'operator-access-token',
      canManageNodes: true,
    });
  });

  it('rotates an expired stored operator credential before workspace-node enrichment', async () => {
    const root = await mkdtemp(join(tmpdir(), 'consuelo-native-endpoint-'));
    temporaryRoots.push(root);
    const generated = join(root, 'node', 'security', 'generated');
    mkdirSync(generated, { recursive: true });
    writeFileSync(
      join(generated, 'operator-token.json'),
      JSON.stringify({
        version: 1,
        kind: 'consuelo-operator-token',
        authorityOrigin: 'https://os.consuelohq.com',
        workspaceHost: 'one.consuelohq.com',
        accessToken: 'expired-access-token',
        refreshToken: 'operator-refresh-token',
        expiresAt: Date.parse('2026-08-14T20:59:00.000Z'),
        scope: ['workspace:read', 'workspace:nodes:manage'],
        createdAt: '2026-08-14T20:00:00.000Z',
      }),
      { mode: 0o600 },
    );

    let body: URLSearchParams | undefined;
    const credential = await resolveStoredOperatorWorkspaceCredential({
      home: root,
      nowMs: Date.parse('2026-08-14T21:00:00.000Z'),
      fetchImpl: async (_url, init) => {
        body = new URLSearchParams((init as RequestInit).body as string);
        return Response.json({
          access_token: 'fresh-access-token',
          refresh_token: 'fresh-refresh-token',
          expires_in: 3600,
          scope: 'workspace:read workspace:nodes:manage',
        });
      },
    });

    expect(body?.get('grant_type')).toBe('refresh_token');
    expect(body?.has('scope')).toBe(false);
    expect(credential).toEqual({
      authorityOrigin: 'https://os.consuelohq.com',
      workspaceHost: 'one.consuelohq.com',
      accessToken: 'fresh-access-token',
      canManageNodes: true,
    });
    expect(readStoredOperatorToken({ home: root })).toMatchObject({
      accessToken: 'fresh-access-token',
      refreshToken: 'fresh-refresh-token',
      scope: ['workspace:read', 'workspace:nodes:manage'],
    });
  });

  it('lists central workspace nodes from the stored operator credential', async () => {
    const root = await mkdtemp(join(tmpdir(), 'consuelo-native-endpoint-'));
    temporaryRoots.push(root);
    const generated = join(root, 'node', 'security', 'generated');
    mkdirSync(generated, { recursive: true });
    writeFileSync(
      join(generated, 'operator-token.json'),
      JSON.stringify({
        version: 1,
        kind: 'consuelo-operator-token',
        authorityOrigin: 'https://os.consuelohq.com',
        workspaceHost: 'one.consuelohq.com',
        accessToken: 'operator-access-token',
        expiresAt: Date.now() + 5 * 60_000,
        scope: ['workspace:read', 'workspace:nodes:manage'],
        createdAt: new Date().toISOString(),
      }),
      { mode: 0o600 },
    );

    const fetchMock = vi.fn(async (request: Request) => {
      expect(request.headers.get('authorization')).toBe(
        'Bearer operator-access-token',
      );
      return Response.json({
        workspaceId: 'workspace-one',
        workspaceHost: 'one.consuelohq.com',
        currentNodeId: 'node-mac',
        defaultNodeId: 'node-mac',
        nodes: [
          {
            workspaceId: 'workspace-one',
            nodeId: 'node-mac',
            displayName: 'Mac Mini',
            role: 'home',
            platform: 'darwin',
            architecture: 'arm64',
            channel: 'canary',
            connectorId: 'connector-mac',
            capabilities: [],
            agents: [],
            createdAt: '2026-08-14T20:00:00.000Z',
            lastSeenAt: '2026-08-14T21:00:00.000Z',
            presence: 'online',
            state: 'active',
            publicKeyThumbprint: 'thumb-mac',
          },
          {
            workspaceId: 'workspace-one',
            nodeId: 'cloud-1',
            displayName: 'Cloud node',
            role: 'member',
            platform: 'linux',
            architecture: 'arm64',
            channel: 'canary',
            connectorId: 'connector-cloud',
            capabilities: [],
            agents: [],
            createdAt: '2026-08-14T20:00:00.000Z',
            lastSeenAt: '2026-08-14T21:00:00.000Z',
            presence: 'online',
            state: 'active',
            publicKeyThumbprint: 'thumb-cloud',
          },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const endpoint = await startDefaultNativeLifecycleEndpoint({
      home: root,
      env: { CONSUELO_HOME: root },
    });
    try {
      await expect(
        requestOverSocket(endpoint.socketPath, { kind: 'status.get' }),
      ).resolves.toMatchObject({
        workspace: {
          workspaceId: 'workspace-one',
          defaultNodeId: 'node-mac',
          nodes: [
            { nodeId: 'node-mac', displayName: 'Mac Mini' },
            { nodeId: 'cloud-1', displayName: 'Cloud node', presence: 'online' },
          ],
        },
      });
    } finally {
      await endpoint.close();
    }
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('uses a fresh node-authenticated workspace snapshot for read-only discovery without operator OAuth', async () => {
    const root = await mkdtemp(join(tmpdir(), 'consuelo-native-endpoint-'));
    temporaryRoots.push(root);
    mkdirSync(join(root, 'node', 'cache'), { recursive: true });
    mkdirSync(join(root, 'node'), { recursive: true });
    mkdirSync(join(root, 'workspaces', 'workspace-one', 'shared'), { recursive: true });
    writeFileSync(join(root, 'consuelo.yaml'), [
      'version: 1',
      'activeWorkspace: workspace-one',
      'activeNode: node-home',
      'runtime: {}',
      'updates:',
      '  channel: canary',
      '  notifications:',
      '    mode: on',
      '',
    ].join('\n'));
    writeFileSync(join(root, 'node', 'node.yaml'), [
      'version: 1',
      'node:',
      '  id: node-home',
      '  name: Mac Mini',
      '  role: home',
      'capabilities: [mcp]',
      'workspaces:',
      '  - id: workspace-one',
      '    state: workspaces/workspace-one/state',
      '',
    ].join('\n'));
    writeFileSync(join(root, 'workspaces', 'workspace-one', 'shared', 'workspace.yaml'), [
      'version: 1',
      'workspace:',
      '  id: workspace-one',
      '  name: One',
      '  slug: one',
      '  host: one.consuelohq.com',
      'defaults: {}',
      'projects: []',
      'routing: {}',
      'policy: {}',
      'sites: {}',
      'agents: {}',
      '',
    ].join('\n'));
    writeFileSync(
      join(root, 'node', 'cache', 'workspace-nodes.json'),
      JSON.stringify({
        version: 1,
        kind: 'consuelo-workspace-node-snapshot',
        observedAt: new Date().toISOString(),
        workspaceId: 'workspace-one',
        currentNodeId: 'node-home',
        workspace: {
          workspaceId: 'workspace-one',
          workspaceHost: 'one.consuelohq.com',
          currentNodeId: 'node-home',
          defaultNodeId: 'cloud-1',
          nodes: [
            {
              workspaceId: 'workspace-one', nodeId: 'node-home', displayName: 'Mac Mini', role: 'home',
              platform: 'darwin', architecture: 'arm64', channel: 'canary', capabilities: ['mcp'], agents: [],
              createdAt: '2026-08-14T20:00:00.000Z', lastSeenAt: '2026-08-14T22:00:00.000Z', presence: 'online', state: 'active',
            },
            {
              workspaceId: 'workspace-one', nodeId: 'cloud-1', displayName: 'Cloud node', role: 'member',
              platform: 'linux', architecture: 'x64', channel: 'canary', capabilities: ['mcp', 'tools'], agents: null,
              createdAt: '2026-08-14T20:30:00.000Z', lastSeenAt: '2026-08-14T22:00:00.000Z', presence: 'online', state: 'active',
            },
          ],
        },
      }),
      { mode: 0o600 },
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const endpoint = await startDefaultNativeLifecycleEndpoint({ home: root, env: { CONSUELO_HOME: root } });
    try {
      await expect(requestOverSocket(endpoint.socketPath, { kind: 'status.get' })).resolves.toMatchObject({
        workspace: {
          workspaceId: 'workspace-one',
          currentNodeId: 'node-home',
          defaultNodeId: 'cloud-1',
          nodes: [
            { nodeId: 'node-home', displayName: 'Mac Mini' },
            { nodeId: 'cloud-1', displayName: 'Cloud node', presence: 'online' },
          ],
        },
      });
      await expect(requestOverSocket(endpoint.socketPath, {
        kind: 'workspace.default-node.set',
        nodeId: 'cloud-1',
      })).resolves.toMatchObject({
        accepted: false,
        error: expect.stringMatching(/management sign-in is required/i),
      });
    } finally {
      await endpoint.close();
    }
    const fetchedUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(fetchedUrls).toEqual([
      expect.stringMatching(
        /^https:\/\/install\.consuelohq\.com\/os\/releases\/channels\//,
      ),
    ]);
    expect(
      fetchedUrls.some((url) => url.includes('/workspace/nodes')),
    ).toBe(false);
  });

  it('builds a safe monotonic snapshot from the canonical lifecycle engine and local identity', async () => {
    const root = await mkdtemp(join(tmpdir(), 'consuelo-native-endpoint-'));
    temporaryRoots.push(root);
    mkdirSync(join(root, 'node'), { recursive: true });
    mkdirSync(join(root, 'workspaces', 'workspace-one', 'shared'), {
      recursive: true,
    });
    writeFileSync(
      join(root, 'consuelo.yaml'),
      [
        'version: 1',
        'activeWorkspace: workspace-one',
        'activeNode: node-home',
        'runtime: {}',
        'updates:',
        '  channel: dev',
        '  notifications:',
        '    mode: on',
        '',
      ].join('\n'),
    );
    writeFileSync(
      join(root, 'node', 'node.yaml'),
      [
        'version: 1',
        'node:',
        '  id: node-home',
        '  name: Mac Mini',
        '  role: home',
        'capabilities: [local-runtime, darwin]',
        'workspaces:',
        '  - id: workspace-one',
        '    state: workspaces/workspace-one/state',
        '',
      ].join('\n'),
    );
    writeFileSync(
      join(root, 'workspaces', 'workspace-one', 'shared', 'workspace.yaml'),
      [
        'version: 1',
        'workspace:',
        '  id: workspace-one',
        '  name: One',
        '  slug: one',
        '  host: one.consuelohq.com',
        'defaults: {}',
        'projects: []',
        'routing: {}',
        'policy: {}',
        'sites: {}',
        'agents: {}',
        '',
      ].join('\n'),
    );

    const { engine } = fakeEngine();
    const controller = createNativeLifecycleEndpointController({
      engine,
      home: root,
      platform: 'darwin',
      architecture: 'arm64',
      channelSelectionAllowed: true,
      inspectRelease: async () => ({
        available: 1,
        latestVersion: '1.5.0',
        rollbackVersion: '1.3.0',
        summary: 'Native endpoint repair',
      }),
      inspectConnector: async () => ({
        state: 'unknown',
        detail: 'Not configured',
      }),
      now: () => new Date('2026-07-27T02:00:00.000Z'),
    });

    const first = await controller.handle({ kind: 'status.get' });
    const second = await controller.handle({ kind: 'status.get' });

    expect(first).toMatchObject({
      schemaVersion: 1,
      sequence: 1,
      install: { state: 'installed' },
      runtime: { version: '1.4.0', channel: 'dev', state: 'running' },
      services: [{ id: 'consuelo-os', state: 'healthy', managedBy: 'launchd' }],
      connector: { state: 'unknown', detail: 'Not configured' },
      updates: {
        available: 1,
        latestVersion: '1.5.0',
        rollbackVersion: '1.3.0',
      },
      release: { summary: 'Native endpoint repair' },
      preferences: {
        channelSelectionAllowed: true,
        notifications: { state: 'on' },
      },
      workspace: {
        workspaceId: 'workspace-one',
        workspaceHost: 'one.consuelohq.com',
        currentNodeId: 'node-home',
        nodes: [{ nodeId: 'node-home', displayName: 'Mac Mini', role: 'home' }],
      },
      connection: { state: 'online' },
    });
    expect(second).toMatchObject({ sequence: 2 });
    expect(JSON.stringify(first)).not.toMatch(
      /token|secret|password|private.?key/i,
    );
  });

  it('dispatches restart-affecting mutations outside the daemon and reports persisted state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'consuelo-native-endpoint-'));
    temporaryRoots.push(root);
    const { engine, calls } = fakeEngine();
    const launched: NativeLifecycleOperationInput[] = [];
    let persisted: NativeLifecycleOperationState | undefined;
    const defaultNodeCalls: string[] = [];
    const diagnosticsPath = join(
      root,
      'support',
      'lifecycle-diagnostics.jsonl',
    );
    const controller = createNativeLifecycleEndpointController({
      engine,
      home: root,
      instanceId: 'daemon-a',
      inspectRelease: async () => ({
        available: 1,
        latestVersion: '1.5.0',
        rollbackVersion: '1.3.0',
      }),
      launchOperation: async (operation) => {
        launched.push(operation);
        persisted = {
          schemaVersion: 1,
          operationId: `detached-${launched.length}`,
          kind: operation.kind,
          phase: 'running',
          updatedAt: '2026-07-27T02:00:00.000Z',
        };
        return { accepted: true, operationId: persisted.operationId };
      },
      readOperationState: () => persisted,
      setDefaultNode: async (nodeId) => defaultNodeCalls.push(nodeId),
      exportDiagnostics: async () => diagnosticsPath,
      now: () => new Date('2026-07-27T02:00:00.000Z'),
      operationId: (() => {
        let value = 0;
        return () => `native-op-${++value}`;
      })(),
    });

    for (const request of [
      { kind: 'update.apply', targetVersion: '1.5.0' },
      { kind: 'update.rollback', targetVersion: '1.3.0' },
      { kind: 'repair.run', destructive: false },
      { kind: 'service.restart' },
      {
        kind: 'preferences.notifications.set',
        notifications: { state: 'off' },
      },
      { kind: 'preferences.channel.set', channel: 'beta' },
      { kind: 'workspace.default-node.set', nodeId: 'node-member' },
      { kind: 'diagnostics.export' },
      {
        kind: 'uninstall.execute',
        removeNode: false,
        removeUserContent: false,
      },
    ] satisfies LifecycleRequest[]) {
      await expect(controller.handle(request)).resolves.toMatchObject({
        accepted: true,
      });
    }

    expect(launched).toEqual([
      { kind: 'update', targetVersion: '1.5.0' },
      { kind: 'rollback', targetVersion: '1.3.0' },
      { kind: 'repair' },
      { kind: 'restart' },
      { kind: 'uninstall', removeNode: false, removeUserContent: false },
    ]);
    expect(calls).toEqual(['notifications:off', 'channel:beta']);
    expect(defaultNodeCalls).toEqual(['node-member']);
    const restartedController = createNativeLifecycleEndpointController({
      engine,
      home: root,
      instanceId: 'daemon-b',
      readOperationState: () => persisted,
    });
    const snapshot = await restartedController.handle({ kind: 'status.get' });
    expect(snapshot).toMatchObject({
      instanceId: 'daemon-b',
      operation: { kind: 'uninstall', phase: 'running' },
    });
  });

  it('shows a newly launched detached operation over a completed local mutation', async () => {
    const { engine } = fakeEngine();
    let persisted: NativeLifecycleOperationState | undefined;
    const controller = createNativeLifecycleEndpointController({
      engine,
      instanceId: 'daemon-operation-precedence',
      launchOperation: async (operation) => {
        persisted = {
          schemaVersion: 1,
          operationId: 'detached-restart',
          kind: operation.kind,
          phase: 'running',
          updatedAt: '2026-07-27T03:20:00.000Z',
        };
        return { accepted: true, operationId: persisted.operationId };
      },
      readOperationState: () => persisted,
    });

    await controller.handle({
      kind: 'preferences.notifications.set',
      notifications: { state: 'off' },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(
      controller.handle({ kind: 'service.restart' }),
    ).resolves.toEqual({
      accepted: true,
      operationId: 'detached-restart',
    });

    await expect(
      controller.handle({ kind: 'status.get' }),
    ).resolves.toMatchObject({
      operation: { kind: 'restart', phase: 'running' },
    });
  });

  it('rejects stale target versions, nightly menu mutations, and unavailable node authority', async () => {
    const { engine } = fakeEngine();
    const controller = createNativeLifecycleEndpointController({
      engine,
      inspectRelease: async () => ({
        available: 1,
        latestVersion: '1.5.0',
        rollbackVersion: '1.3.0',
      }),
    });

    await expect(
      controller.handle({ kind: 'update.apply', targetVersion: '9.9.9' }),
    ).rejects.toThrow('does not match the available release');
    await expect(
      controller.handle({ kind: 'update.rollback', targetVersion: '9.9.9' }),
    ).rejects.toThrow('does not match the retained rollback release');
    await expect(
      controller.handle({
        kind: 'preferences.channel.set',
        channel: 'nightly',
      }),
    ).rejects.toThrow('not user-selectable');
    await expect(
      controller.handle({ kind: 'repair.run', destructive: true }),
    ).rejects.toThrow('destructive repair is not supported');
    await expect(
      controller.handle({
        kind: 'workspace.default-node.set',
        nodeId: 'node-member',
      }),
    ).rejects.toThrow('workspace node authority is unavailable');
  });

  it('starts the production endpoint with the canonical lifecycle engine in a disposable home', async () => {
    const root = await mkdtemp('/tmp/cne-');
    temporaryRoots.push(root);
    const endpoint = await startDefaultNativeLifecycleEndpoint({
      home: root,
      env: {
        CONSUELO_HOME: root,
        CONSUELO_CHANNEL_SELECTION_ALLOWED: 'false',
      },
    });

    try {
      await expect(
        requestOverSocket(endpoint.socketPath, { kind: 'status.get' }),
      ).resolves.toMatchObject({
        schemaVersion: 1,
        install: { state: 'not-installed' },
        preferences: { channelSelectionAllowed: false },
        connection: { state: 'online' },
      });
    } finally {
      await endpoint.close();
    }
  });

  it('bounds optional remote enrichment so local status remains responsive', async () => {
    const root = await mkdtemp('/tmp/cne-latency-');
    temporaryRoots.push(root);
    const { engine } = fakeEngine();
    const delayed = <T>(value: T): Promise<T> =>
      new Promise((resolve) => setTimeout(() => resolve(value), 100));
    const controller = createNativeLifecycleEndpointController({
      engine,
      home: root,
      enrichmentTimeoutMs: 5,
      inspectRelease: () => delayed({ available: 1, latestVersion: '9.9.9' }),
      inspectConnector: () =>
        delayed({ state: 'connected' as const, detail: 'late' }),
      inspectWorkspace: () =>
        delayed({
          workspaceId: 'late',
          workspaceHost: 'late.consuelohq.com',
          nodes: [],
        }),
    });

    const startedAt = Date.now();
    const snapshot = await controller.handle({ kind: 'status.get' });

    expect(Date.now() - startedAt).toBeLessThan(70);
    expect(snapshot).toMatchObject({
      updates: { available: 0 },
      connector: { state: 'unknown' },
    });
    expect(snapshot).not.toHaveProperty('workspace');
  });

  it('redacts secrets and local user paths from framed rejection details', async () => {
    const root = await mkdtemp('/tmp/cne-redaction-');
    temporaryRoots.push(root);
    const socketPath = join(root, 'run', 'lifecycle.sock');
    const { engine } = fakeEngine();
    const controller = createNativeLifecycleEndpointController({
      engine,
      home: root,
      inspectRelease: async () => {
        throw new Error(
          'password=hunter2 Bearer abc.def /Users/operator/.consuelo',
        );
      },
    });
    const endpoint = await startNativeLifecycleEndpoint({
      socketPath,
      controller,
    });

    try {
      const rejected = await requestOverSocket(socketPath, {
        kind: 'update.apply',
        targetVersion: '9.9.9',
      });
      expect(rejected).toMatchObject({ accepted: false });
      expect(JSON.stringify(rejected)).not.toMatch(
        /hunter2|abc\.def|\/Users\/operator/,
      );
    } finally {
      await endpoint.close();
    }
  });

  it('serves framed JSON on an owner-only Unix socket and rejects oversized frames', async () => {
    const root = await mkdtemp(join(tmpdir(), 'consuelo-native-endpoint-'));
    temporaryRoots.push(root);
    const socketPath = join(root, 'run', 'lifecycle.sock');
    const { engine } = fakeEngine();
    const controller = createNativeLifecycleEndpointController({
      engine,
      home: root,
    });
    const endpoint = await startNativeLifecycleEndpoint({
      socketPath,
      controller,
    });

    try {
      const metadata = await stat(socketPath);
      expect(metadata.isSocket()).toBe(true);
      expect(metadata.mode & 0o077).toBe(0);
      await expect(
        requestOverSocket(socketPath, { kind: 'status.get' }),
      ).resolves.toMatchObject({
        schemaVersion: 1,
        connection: { state: 'online' },
      });
      await expect(
        requestOverSocket(socketPath, {
          kind: 'update.apply',
          targetVersion: '9.9.9',
        }),
      ).resolves.toMatchObject({
        accepted: false,
        operationId: expect.stringMatching(/^rejected-/),
        error: 'requested update target does not match the available release',
      });
      await new Promise<void>((resolve, reject) => {
        const socket = connect(socketPath);
        socket.on('connect', () => {
          const header = Buffer.alloc(4);
          header.writeUInt32BE(NATIVE_LIFECYCLE_MAX_PAYLOAD_BYTES + 1);
          socket.write(header);
        });
        socket.on('data', () =>
          reject(new Error('oversized request received a response')),
        );
        socket.on('error', reject);
        socket.on('end', resolve);
      });
    } finally {
      await endpoint.close();
    }
    expect(existsSync(socketPath)).toBe(false);
  });

  it('refuses to replace a non-socket endpoint or a socket owned with broad permissions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'consuelo-native-endpoint-'));
    temporaryRoots.push(root);
    const socketPath = join(root, 'run', 'lifecycle.sock');
    mkdirSync(join(root, 'run'), { recursive: true });
    writeFileSync(socketPath, 'do not replace');
    const { engine } = fakeEngine();
    const controller = createNativeLifecycleEndpointController({
      engine,
      home: root,
    });

    await expect(
      startNativeLifecycleEndpoint({ socketPath, controller }),
    ).rejects.toThrow('not a Unix socket');
    expect(readFileSync(socketPath, 'utf8')).toBe('do not replace');
  });
});
