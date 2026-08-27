import { describe, expect, it } from 'vitest';

import { createOsDeviceAuthorityHandler } from '../cloudflare/os-device-authority/src/app';
import { registerApprovedWorkspaceRoute } from '../cloudflare/os-device-authority/src/services/connectors';
import { prepareGrantApproval } from '../cloudflare/os-device-authority/src/services/grants';
import {
  createMemoryDeviceGrantStore,
  DurableStore,
  WORKSPACE_NODE_NONCE_LIMIT,
} from '../cloudflare/os-device-authority/src/stores';
import type {
  Grant,
  StorageLike,
  StorageTransactionLike,
  WorkspaceNode,
} from '../cloudflare/os-device-authority/src/types';
import { WORKSPACE_NODE_SIGNATURE_MAX_AGE_MS } from '../cloudflare/os-device-authority/src/services/nodes';
import {
  createInMemoryWorkspaceRouteD1,
  createWorkspaceCloudflareD1RouteRegistry,
  migrateWorkspaceRouteD1,
  resolveWorkspaceRouteFromD1,
  upsertWorkspaceHostnameInD1,
} from '../scripts/lib/workspace-cloudflare-d1-route-registry';
import { createWorkspaceCloudflareEdgeRouter } from '../scripts/lib/workspace-cloudflare-edge-router';
import { deriveWorkspaceEdgeNodeSecret } from '../scripts/lib/workspace-edge-node-auth';
import {
  decodeMcpNodeRoutingContext,
  MCP_NODE_CONTEXT_HEADER,
  MCP_ROUTE_SOURCE_HEADER,
} from '../scripts/lib/mcp-node-routing';
import {
  createDevicePublicKeyProof,
  devicePublicKeyThumbprint,
  generateWorkspaceDeviceKeyPair,
} from '../scripts/lib/workspace-device-login-client';
import { hash } from '../cloudflare/os-device-authority/src/utils';

const origin = 'https://os.consuelohq.com';
const accountId = 'account_multi_node_test';
const workspaceId = 'workspace_multi_node_test';
const workspaceSlug = 'multi-node-test';
const workspaceHost = 'multi-node-test.consuelohq.com';
const baseNow = Date.parse('2026-07-22T20:00:00.000Z');
const heartbeatTtlMs = 60_000;

const node = (input: {
  nodeId: string;
  displayName: string;
  role: 'home' | 'member';
  connectorId: string;
  publicKeyJwk: string;
  publicKeyThumbprint: string;
  lastSeenAt?: number;
}): WorkspaceNode =>
  ({
    accountId,
    workspaceId,
    workspaceSlug,
    workspaceHost,
    nodeId: input.nodeId,
    nodeName: input.displayName,
    displayName: input.displayName,
    role: input.role,
    platform: 'darwin',
    architecture: 'arm64',
    channel: 'stable',
    connectorId: input.connectorId,
    capabilities: ['mcp', 'tools'],
    connectorStatus: 'connected',
    state: 'active',
    devicePublicKeyJwk: input.publicKeyJwk,
    devicePublicKeyThumbprint: input.publicKeyThumbprint,
    createdAt: baseNow,
    updatedAt: baseNow,
    lastSeenAt: input.lastSeenAt ?? baseNow,
  }) as WorkspaceNode;

async function authorizeWorkspace(
  store: ReturnType<typeof createMemoryDeviceGrantStore>,
  token: string,
  input?: {
    account?: string;
    host?: string;
    scopes?: string[];
  },
): Promise<void> {
  const scopes = input?.scopes ?? [
    'workspace:read',
    'workspace:nodes:manage',
    'route:/mcp:read',
  ];
  await store.putMcpOAuthAccessToken({
    tokenHash: await hash(token),
    clientId: 'workspace-node-settings-test',
    scope: scopes.join(' '),
    scopes,
    resource: `${origin}/mcp`,
    workspaceHost: input?.host ?? workspaceHost,
    accountId: input?.account ?? accountId,
    email: 'ko@example.com',
    expiresAt: baseNow + 3_600_000,
    issuedAt: baseNow,
  });
}

async function seedWorkspace(
  store: ReturnType<typeof createMemoryDeviceGrantStore>,
): Promise<{
  homeKey: ReturnType<typeof generateWorkspaceDeviceKeyPair>;
  memberKey: ReturnType<typeof generateWorkspaceDeviceKeyPair>;
}> {
  const homeKey = generateWorkspaceDeviceKeyPair();
  const memberKey = generateWorkspaceDeviceKeyPair();
  await store.putAccountWorkspace({
    accountId,
    workspaceId,
    workspaceSlug,
    workspaceHost,
    homeNodeId: 'node-home',
    defaultNodeId: 'node-home',
    updatedAt: baseNow,
  });
  await store.putWorkspaceNode(
    node({
      nodeId: 'node-home',
      displayName: 'Mac Mini',
      role: 'home',
      connectorId: 'connector_node_home',
      publicKeyJwk: homeKey.publicKeyJwk,
      publicKeyThumbprint: await devicePublicKeyThumbprint(
        homeKey.publicKeyJwk,
      ),
    }),
  );
  await store.putWorkspaceNode(
    node({
      nodeId: 'node-member',
      displayName: 'MacBook Air',
      role: 'member',
      connectorId: 'connector_node_member',
      publicKeyJwk: memberKey.publicKeyJwk,
      publicKeyThumbprint: await devicePublicKeyThumbprint(
        memberKey.publicKeyJwk,
      ),
    }),
  );
  return { homeKey, memberKey };
}

async function seedRoutes(
  db: ReturnType<typeof createInMemoryWorkspaceRouteD1>,
  nowMs = baseNow,
  presence?: { homeLastSeenAt?: number; memberLastSeenAt?: number },
): Promise<void> {
  await migrateWorkspaceRouteD1(db);
  await upsertWorkspaceHostnameInD1(db, {
    workspaceId,
    workspaceSlug,
    hostname: workspaceHost,
    baseDomain: 'consuelohq.com',
    provider: 'cloudflare',
    owner: 'consuelo-os-cloud',
    status: 'active',
    defaultNodeId: 'node-home',
    nodeTargets: [
      {
        nodeId: 'node-home',
        connectorId: 'connector_node_home',
        connectorStatus: 'connected',
        tunnelOriginUrl: 'https://home.connector.test',
        state: 'active',
        lastSeenAt: presence?.homeLastSeenAt ?? nowMs,
        heartbeatTtlMs,
      },
      {
        nodeId: 'node-member',
        connectorId: 'connector_node_member',
        connectorStatus: 'connected',
        tunnelOriginUrl: 'https://member.connector.test',
        state: 'active',
        lastSeenAt: presence?.memberLastSeenAt ?? nowMs,
        heartbeatTtlMs,
      },
    ],
    routes: [
      {
        surface: 'os',
        pathPrefix: '/mcp',
        auth: 'required',
        status: 'active',
        target: {
          kind: 'os-connector',
          connectorId: 'connector_node_home',
          connectorStatus: 'connected',
          tunnelOriginUrl: 'https://home.connector.test',
        },
      },
    ],
  } as Parameters<typeof upsertWorkspaceHostnameInD1>[1]);
}

describe('workspace node identity', () => {
  it('registers new nodes offline until a signed heartbeat arrives', async () => {
    const store = createMemoryDeviceGrantStore();
    const deviceKey = generateWorkspaceDeviceKeyPair();
    const grant: Grant = {
      hash: 'new-node-grant',
      userCode: 'NEWN-ODE1',
      workspaceSlug,
      workspaceHost,
      status: 'pending',
      expiresAt: baseNow + 300_000,
      interval: 5,
      devicePublicKeyJwk: deviceKey.publicKeyJwk,
      deviceKeyAlgorithm: 'Ed25519',
      devicePublicKeyThumbprint: await devicePublicKeyThumbprint(
        deviceKey.publicKeyJwk,
      ),
      nodeId: 'node-new',
      nodeName: 'New Mac',
    };

    await prepareGrantApproval({
      store,
      grant,
      accountId,
      authMethod: 'google',
      nowMs: baseNow,
    });

    await expect(
      store.byWorkspaceNode(accountId, 'node-new'),
    ).resolves.toMatchObject({
      connectorStatus: 'disconnected',
    });
    expect(
      (await store.byWorkspaceNode(accountId, 'node-new'))?.lastSeenAt,
    ).toBeUndefined();
    expect(grant.nodeLastSeenAt).toBeUndefined();
  });

  it('rejects another public key attempting to reuse an existing node ID', async () => {
    const store = createMemoryDeviceGrantStore();
    const existingKey = generateWorkspaceDeviceKeyPair();
    const attackerKey = generateWorkspaceDeviceKeyPair();
    await store.putAccountWorkspace({
      accountId,
      workspaceId,
      workspaceSlug,
      workspaceHost,
      homeNodeId: 'node-home',
      defaultNodeId: 'node-home',
      updatedAt: baseNow,
    });
    await store.putWorkspaceNode(
      node({
        nodeId: 'node-home',
        displayName: 'Mac Mini',
        role: 'home',
        connectorId: 'connector_node_home',
        publicKeyJwk: existingKey.publicKeyJwk,
        publicKeyThumbprint: await devicePublicKeyThumbprint(
          existingKey.publicKeyJwk,
        ),
      }),
    );
    const grant: Grant = {
      hash: 'grant_hash',
      userCode: 'ABCD-EFGH',
      workspaceSlug,
      workspaceHost,
      status: 'pending',
      expiresAt: baseNow + 300_000,
      interval: 5,
      devicePublicKeyJwk: attackerKey.publicKeyJwk,
      deviceKeyAlgorithm: 'Ed25519',
      devicePublicKeyThumbprint: await devicePublicKeyThumbprint(
        attackerKey.publicKeyJwk,
      ),
      nodeId: 'node-home',
      nodeName: 'Attacker',
    };

    await expect(
      prepareGrantApproval({
        store,
        grant,
        accountId,
        authMethod: 'google',
        nowMs: baseNow,
      }),
    ).rejects.toThrow('node identity key does not match');
  });

  it('accepts a declared identity replacement, which is what reinstalling a node produces', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedWorkspace(store);
    const existingKey = generateWorkspaceDeviceKeyPair();
    const reinstalledKey = generateWorkspaceDeviceKeyPair();
    await store.putWorkspaceNode(
      node({
        nodeId: 'node-home',
        displayName: 'Mac Mini',
        role: 'home',
        connectorId: 'connector_node_home',
        publicKeyJwk: existingKey.publicKeyJwk,
        publicKeyThumbprint: await devicePublicKeyThumbprint(
          existingKey.publicKeyJwk,
        ),
      }),
    );
    const grant: Grant = {
      hash: 'grant_hash',
      userCode: 'ABCD-EFGH',
      workspaceSlug,
      workspaceHost,
      status: 'pending',
      expiresAt: baseNow + 300_000,
      interval: 5,
      devicePublicKeyJwk: reinstalledKey.publicKeyJwk,
      deviceKeyAlgorithm: 'Ed25519',
      devicePublicKeyThumbprint: await devicePublicKeyThumbprint(
        reinstalledKey.publicKeyJwk,
      ),
      nodeId: 'node-home',
      nodeName: 'Mac Mini',
      nodeIdentityReplacement: true,
    };

    const approved = await prepareGrantApproval({
      store,
      grant,
      accountId,
      authMethod: 'google',
      nowMs: baseNow,
    });

    expect(approved.nodeIdentityRotatedAt).toBe(baseNow);
    expect(approved.nodeStatus).toBe('reconnected');
    const stored = await store.byWorkspaceNode(accountId, 'node-home');
    expect(stored?.devicePublicKeyThumbprint).toBe(
      await devicePublicKeyThumbprint(reinstalledKey.publicKeyJwk),
    );
    // The stored JWK must rotate with the thumbprint. Keeping the old key beside a new thumbprint
    // makes heartbeat verification check against a key the node no longer holds.
    expect(stored?.devicePublicKeyJwk).toBe(reinstalledKey.publicKeyJwk);
    expect(stored?.devicePublicKeyJwk).not.toBe(existingKey.publicKeyJwk);
  });

  it('does not stamp a rotation when the identity key is unchanged', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedWorkspace(store);
    const keyPair = generateWorkspaceDeviceKeyPair();
    const thumbprint = await devicePublicKeyThumbprint(keyPair.publicKeyJwk);
    await store.putWorkspaceNode(
      node({
        nodeId: 'node-home',
        displayName: 'Mac Mini',
        role: 'home',
        connectorId: 'connector_node_home',
        publicKeyJwk: keyPair.publicKeyJwk,
        publicKeyThumbprint: thumbprint,
      }),
    );

    const approved = await prepareGrantApproval({
      store,
      grant: {
        hash: 'grant_hash',
        userCode: 'ABCD-EFGH',
        workspaceSlug,
        workspaceHost,
        status: 'pending',
        expiresAt: baseNow + 300_000,
        interval: 5,
        devicePublicKeyJwk: keyPair.publicKeyJwk,
        deviceKeyAlgorithm: 'Ed25519',
        devicePublicKeyThumbprint: thumbprint,
        nodeId: 'node-home',
        nodeName: 'Mac Mini',
        nodeIdentityReplacement: true,
      },
      accountId,
      authMethod: 'google',
      nowMs: baseNow,
    });

    expect(approved.nodeIdentityRotatedAt).toBeUndefined();
  });

  it('restores the previous key when route provisioning fails after a replacement', async () => {
    const { failGrantWorkspaceRouteSetup } = await import(
      '../cloudflare/os-device-authority/src/services/grants'
    );
    const store = createMemoryDeviceGrantStore();
    await seedWorkspace(store);
    const existingKey = generateWorkspaceDeviceKeyPair();
    const reinstalledKey = generateWorkspaceDeviceKeyPair();
    const existingThumbprint = await devicePublicKeyThumbprint(
      existingKey.publicKeyJwk,
    );
    await store.putWorkspaceNode(
      node({
        nodeId: 'node-home',
        displayName: 'Mac Mini',
        role: 'home',
        connectorId: 'connector_node_home',
        publicKeyJwk: existingKey.publicKeyJwk,
        publicKeyThumbprint: existingThumbprint,
      }),
    );
    const grant: Grant = {
      hash: 'grant_hash',
      userCode: 'ABCD-EFGH',
      workspaceSlug,
      workspaceHost,
      status: 'pending',
      expiresAt: baseNow + 300_000,
      interval: 5,
      devicePublicKeyJwk: reinstalledKey.publicKeyJwk,
      deviceKeyAlgorithm: 'Ed25519',
      devicePublicKeyThumbprint: await devicePublicKeyThumbprint(
        reinstalledKey.publicKeyJwk,
      ),
      nodeId: 'node-home',
      nodeName: 'Mac Mini',
      nodeIdentityReplacement: true,
    };

    const approved = await prepareGrantApproval({
      store,
      grant,
      accountId,
      authMethod: 'google',
      nowMs: baseNow,
    });
    expect(approved.nodeReplacedThumbprint).toBe(existingThumbprint);

    // Route provisioning runs after the key swap; a failure here must not lock out the existing
    // installation, which still holds only the previous key.
    await failGrantWorkspaceRouteSetup({
      store,
      grant: approved,
      error: new Error('route provisioning exploded'),
    });

    const restored = await store.byWorkspaceNode(accountId, 'node-home');
    expect(restored?.devicePublicKeyJwk).toBe(existingKey.publicKeyJwk);
    expect(restored?.devicePublicKeyThumbprint).toBe(existingThumbprint);
  });

  it('refuses to resurrect a revoked node even with a declared replacement', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedWorkspace(store);
    const existingKey = generateWorkspaceDeviceKeyPair();
    const reinstalledKey = generateWorkspaceDeviceKeyPair();
    await store.putWorkspaceNode({
      // The shared `node()` helper does not model state, so revoke explicitly.
      ...node({
        nodeId: 'node-home',
        displayName: 'Mac Mini',
        role: 'home',
        connectorId: 'connector_node_home',
        publicKeyJwk: existingKey.publicKeyJwk,
        publicKeyThumbprint: await devicePublicKeyThumbprint(
          existingKey.publicKeyJwk,
        ),
      }),
      state: 'revoked',
    });

    await expect(
      prepareGrantApproval({
        store,
        grant: {
          hash: 'grant_hash',
          userCode: 'ABCD-EFGH',
          workspaceSlug,
          workspaceHost,
          status: 'pending',
          expiresAt: baseNow + 300_000,
          interval: 5,
          devicePublicKeyJwk: reinstalledKey.publicKeyJwk,
          deviceKeyAlgorithm: 'Ed25519',
          devicePublicKeyThumbprint: await devicePublicKeyThumbprint(
            reinstalledKey.publicKeyJwk,
          ),
          nodeId: 'node-home',
          nodeName: 'Mac Mini',
          nodeIdentityReplacement: true,
        },
        accountId,
        authMethod: 'google',
        nowMs: baseNow,
      }),
    ).rejects.toThrow('revoked');
  });
});

describe('workspace node management and presence', () => {
  it('recovers and backfills legacy durable node records without registry indexes', async () => {
    const keyPair = generateWorkspaceDeviceKeyPair();
    const rawNode = node({
      nodeId: 'node-legacy-unindexed',
      displayName: 'Legacy Mac',
      role: 'member',
      connectorId: 'connector_legacy_unindexed',
      publicKeyJwk: keyPair.publicKeyJwk,
      publicKeyThumbprint: await devicePublicKeyThumbprint(
        keyPair.publicKeyJwk,
      ),
    });
    const createLegacyStore = () => {
      const values = new Map<string, unknown>([
        [`wn:${accountId}:${rawNode.nodeId}`, rawNode],
      ]);
      const storage: StorageLike = {
        get: async <T>(key: string) => values.get(key) as T | undefined,
        put: async (key: string, value: unknown) => {
          values.set(key, value);
        },
        delete: async (key: string) => values.delete(key),
        list: async <T>(options?: { prefix?: string }) =>
          new Map(
            [...values.entries()]
              .filter(
                ([key]) => !options?.prefix || key.startsWith(options.prefix),
              )
              .map(([key, value]) => [key, value as T]),
          ),
      };
      return { store: new DurableStore(storage), values };
    };

    const identity = createLegacyStore();
    await expect(
      identity.store.byWorkspaceNodeId(rawNode.nodeId),
    ).resolves.toMatchObject({
      nodeId: rawNode.nodeId,
    });
    expect(identity.values.get(`wni:${rawNode.nodeId}`)).toBe(accountId);
    expect(identity.values.get(`wnl:${accountId}`)).toEqual([rawNode.nodeId]);
    expect(identity.values.get(`wnh:${workspaceHost}`)).toEqual([
      rawNode.nodeId,
    ]);

    const accountList = createLegacyStore();
    await expect(
      accountList.store.listWorkspaceNodes(accountId),
    ).resolves.toEqual([expect.objectContaining({ nodeId: rawNode.nodeId })]);
    expect(accountList.values.get(`wni:${rawNode.nodeId}`)).toBe(accountId);

    const hostList = createLegacyStore();
    await expect(
      hostList.store.listWorkspaceNodesByHost(workspaceHost),
    ).resolves.toEqual([expect.objectContaining({ nodeId: rawNode.nodeId })]);
    expect(hostList.values.get(`wnh:${workspaceHost}`)).toEqual([
      rawNode.nodeId,
    ]);
  });

  it('removes deleted durable nodes from the workspace host index', async () => {
    const values = new Map<string, unknown>();
    const storage: StorageLike = {
      get: async <T>(key: string) => values.get(key) as T | undefined,
      put: async (key: string, value: unknown) => {
        values.set(key, value);
      },
      delete: async (key: string) => {
        values.delete(key);
      },
      transaction: async <T>(
        callback: (transaction: StorageTransactionLike) => Promise<T>,
      ) => callback(storage),
    };
    const store = new DurableStore(storage);
    const keyPair = generateWorkspaceDeviceKeyPair();
    const registered = node({
      nodeId: 'node-deleted',
      displayName: 'Deleted Mac',
      role: 'member',
      connectorId: 'connector_deleted',
      publicKeyJwk: keyPair.publicKeyJwk,
      publicKeyThumbprint: await devicePublicKeyThumbprint(
        keyPair.publicKeyJwk,
      ),
    });

    await store.putWorkspaceNode(registered);
    expect(values.get(`wnh:${workspaceHost}`)).toEqual([registered.nodeId]);

    await store.delWorkspaceNode(accountId, registered.nodeId);

    expect(values.get(`wnh:${workspaceHost}`)).toEqual([]);
    await expect(
      store.listWorkspaceNodesByHost(workspaceHost),
    ).resolves.toEqual([]);
  });

  it('keeps provisioned nodes offline until their first heartbeat', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedWorkspace(store);
    const member = await store.byWorkspaceNode(accountId, 'node-member');
    expect(member).toBeDefined();
    await store.putWorkspaceNode({ ...member!, lastSeenAt: undefined });
    await authorizeWorkspace(store, 'workspace-never-seen-token');
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => baseNow,
    });

    const response = await handler(
      new Request(`${origin}/workspace/nodes`, {
        headers: { authorization: 'Bearer workspace-never-seen-token' },
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      presence: { online: 1, stale: 0, offline: 1 },
      nodes: expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'node-member',
          presence: 'offline',
          lastSeenAt: null,
        }),
      ]),
    });
  });

  it('claims durable heartbeat nonces transactionally', async () => {
    const values = new Map<string, unknown>();
    let transactions = 0;
    const storage: StorageLike = {
      get: async <T>(key: string) => values.get(key) as T | undefined,
      put: async (key: string, value: unknown) => {
        values.set(key, value);
      },
      delete: async (key: string) => {
        values.delete(key);
      },
      transaction: async <T>(
        callback: (transaction: StorageTransactionLike) => Promise<T>,
      ) => {
        transactions += 1;
        return callback(storage);
      },
    };
    const store = new DurableStore(storage);
    const nowMs = baseNow;
    expect(
      await store.claimWorkspaceNodeNonce(
        'node-member',
        'nonce-transactional',
        nowMs + 300_000,
        nowMs,
      ),
    ).toBe(true);
    expect(
      await store.claimWorkspaceNodeNonce(
        'node-member',
        'nonce-transactional',
        nowMs + 300_000,
        nowMs,
      ),
    ).toBe(false);
    expect(transactions).toBe(2);
  });

  it('should preserve task affinity ownership when claims race across nodes and workspaces', async () => {
    const values = new Map<string, unknown>();
    let transactions = 0;
    const storage: StorageLike = {
      get: async <T>(key: string) => values.get(key) as T | undefined,
      put: async (key: string, value: unknown) => {
        values.set(key, value);
      },
      delete: async (key: string) => values.delete(key),
      transaction: async <T>(
        callback: (transaction: StorageTransactionLike) => Promise<T>,
      ) => {
        transactions += 1;
        return callback(storage);
      },
    };
    const store = new DurableStore(storage);
    const affinity = {
      accountId,
      workspaceId,
      workspaceHost,
      taskSession: 'tsk_transactional_owner',
      ownerNodeId: 'node-home',
      createdAt: baseNow,
      updatedAt: baseNow,
    };

    await expect(store.claimWorkspaceTaskAffinity(affinity)).resolves.toMatchObject({
      status: 'created',
      affinity: { ownerNodeId: 'node-home' },
    });
    await expect(store.claimWorkspaceTaskAffinity(affinity)).resolves.toMatchObject({
      status: 'existing',
      affinity: { ownerNodeId: 'node-home' },
    });
    await expect(store.claimWorkspaceTaskAffinity({
      ...affinity,
      ownerNodeId: 'node-member',
    })).resolves.toMatchObject({
      status: 'conflict',
      affinity: { ownerNodeId: 'node-home' },
    });
    await expect(store.claimWorkspaceTaskAffinity({
      ...affinity,
      accountId: 'account_other_workspace',
      workspaceId: 'workspace_other',
      workspaceHost: 'other.consuelohq.com',
      ownerNodeId: 'node-other',
    })).resolves.toMatchObject({
      status: 'created',
      affinity: { ownerNodeId: 'node-other' },
    });

    await expect(store.releaseWorkspaceTaskAffinity({
      accountId,
      workspaceHost,
      taskSession: affinity.taskSession,
      ownerNodeId: 'node-member',
    })).resolves.toBe(false);
    await expect(store.releaseWorkspaceTaskAffinity({
      accountId,
      workspaceHost,
      taskSession: affinity.taskSession,
      ownerNodeId: 'node-home',
    })).resolves.toBe(true);
    await expect(store.byWorkspaceTaskAffinity({
      accountId,
      workspaceHost,
      taskSession: affinity.taskSession,
    })).resolves.toBeUndefined();
    await expect(store.byWorkspaceTaskAffinity({
      accountId: 'account_other_workspace',
      workspaceHost: 'other.consuelohq.com',
      taskSession: affinity.taskSession,
    })).resolves.toMatchObject({ ownerNodeId: 'node-other' });
    expect(transactions).toBe(6);
  });

  it('should expire task affinity when its bounded lifetime has elapsed', async () => {
    const values = new Map<string, unknown>();
    const storage: StorageLike = {
      get: async <T>(key: string) => values.get(key) as T | undefined,
      put: async (key: string, value: unknown) => { values.set(key, value); },
      delete: async (key: string) => values.delete(key),
      list: async <T>({ prefix } = {}) => new Map(
        [...values.entries()]
          .filter(([key]) => !prefix || key.startsWith(prefix))
          .map(([key, value]) => [key, value as T]),
      ),
      transaction: async <T>(callback: (transaction: StorageTransactionLike) => Promise<T>) =>
        callback(storage),
    };
    const store = new DurableStore(storage);
    const taskSession = 'tsk_expired_owner';
    await store.claimWorkspaceTaskAffinity({
      accountId,
      workspaceId,
      workspaceHost,
      taskSession,
      ownerNodeId: 'node-home',
      createdAt: baseNow - 10_000,
      updatedAt: baseNow - 10_000,
      expiresAt: baseNow - 1,
    });

    await expect(store.byWorkspaceTaskAffinity({
      accountId,
      workspaceHost,
      taskSession,
      nowMs: baseNow,
    })).resolves.toBeUndefined();
    await expect(store.claimWorkspaceTaskAffinity({
      accountId,
      workspaceId,
      workspaceHost,
      taskSession,
      ownerNodeId: 'node-member',
      createdAt: baseNow,
      updatedAt: baseNow,
      expiresAt: baseNow + 60_000,
    })).resolves.toMatchObject({
      status: 'created',
      affinity: { ownerNodeId: 'node-member' },
    });
  });

  it('should remove task affinity when its owner node is deleted', async () => {
    const values = new Map<string, unknown>();
    const storage: StorageLike = {
      get: async <T>(key: string) => values.get(key) as T | undefined,
      put: async (key: string, value: unknown) => { values.set(key, value); },
      delete: async (key: string) => values.delete(key),
      list: async <T>({ prefix } = {}) => new Map(
        [...values.entries()]
          .filter(([key]) => !prefix || key.startsWith(prefix))
          .map(([key, value]) => [key, value as T]),
      ),
      transaction: async <T>(callback: (transaction: StorageTransactionLike) => Promise<T>) =>
        callback(storage),
    };
    const store = new DurableStore(storage);
    const owner = node({
      nodeId: 'node-affinity-owner',
      displayName: 'Affinity Owner',
      role: 'member',
      connectorId: 'connector_affinity_owner',
      publicKeyJwk: '{"kty":"OKP","crv":"Ed25519","x":"affinity-owner"}',
      publicKeyThumbprint: 'dpk_affinity_owner',
    });
    await store.putWorkspaceNode(owner);
    await store.claimWorkspaceTaskAffinity({
      accountId,
      workspaceId,
      workspaceHost,
      taskSession: 'tsk_deleted_owner',
      ownerNodeId: owner.nodeId,
      createdAt: baseNow,
      updatedAt: baseNow,
      expiresAt: baseNow + 60_000,
    });

    await expect(store.delWorkspaceNodeIfMatch({
      accountId,
      nodeId: owner.nodeId,
      updatedAt: owner.updatedAt + 1,
      devicePublicKeyThumbprint: owner.devicePublicKeyThumbprint,
    })).resolves.toBe(false);
    await expect(store.byWorkspaceTaskAffinity({
      accountId,
      workspaceHost,
      taskSession: 'tsk_deleted_owner',
      nowMs: baseNow,
    })).resolves.toMatchObject({ ownerNodeId: owner.nodeId });

    await expect(store.delWorkspaceNodeIfMatch({
      accountId,
      nodeId: owner.nodeId,
      updatedAt: owner.updatedAt,
      devicePublicKeyThumbprint: owner.devicePublicKeyThumbprint,
    })).resolves.toBe(true);
    await expect(store.byWorkspaceTaskAffinity({
      accountId,
      workspaceHost,
      taskSession: 'tsk_deleted_owner',
      nowMs: baseNow,
    })).resolves.toBeUndefined();
  });

  it('bounds durable heartbeat nonces per node and prunes expired claims', async () => {
    const values = new Map<string, unknown>();
    const storage: StorageLike = {
      get: async <T>(key: string) => values.get(key) as T | undefined,
      put: async (key: string, value: unknown) => {
        values.set(key, value);
      },
      delete: async (key: string) => {
        values.delete(key);
      },
      transaction: async <T>(
        callback: (transaction: StorageTransactionLike) => Promise<T>,
      ) => callback(storage),
    };
    const store = new DurableStore(storage);
    for (let index = 0; index < WORKSPACE_NODE_NONCE_LIMIT; index += 1) {
      await expect(
        store.claimWorkspaceNodeNonce(
          'node-member',
          `nonce-${index}`,
          baseNow + 300_000,
          baseNow,
        ),
      ).resolves.toBe(true);
    }
    await expect(
      store.claimWorkspaceNodeNonce(
        'node-member',
        'nonce-overflow',
        baseNow + 300_000,
        baseNow,
      ),
    ).resolves.toBe(false);
    await expect(
      store.claimWorkspaceNodeNonce(
        'node-member',
        'nonce-after-expiry',
        baseNow + 600_001,
        baseNow + 300_001,
      ),
    ).resolves.toBe(true);
    const indexed = values.get('wnnl:node-member') as unknown[];
    expect(indexed).toHaveLength(1);
    expect(
      [...values.keys()].filter((key) => key.startsWith('wnn:node-member:')),
    ).toEqual(['wnn:node-member:nonce-after-expiry']);
  });

  it('retains accepted heartbeat nonces from receipt time', async () => {
    const backingStore = createMemoryDeviceGrantStore();
    const { memberKey } = await seedWorkspace(backingStore);
    let nonceClaim:
      | { nodeId: string; nonce: string; expiresAt: number; nowMs: number }
      | undefined;
    const store = {
      ...backingStore,
      claimWorkspaceNodeNonce: async (
        nodeId: string,
        nonce: string,
        expiresAt: number,
        nowMs: number,
      ) => {
        nonceClaim = { nodeId, nonce, expiresAt, nowMs };
        return backingStore.claimWorkspaceNodeNonce(
          nodeId,
          nonce,
          expiresAt,
          nowMs,
        );
      },
    };
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => baseNow,
    });
    const body = JSON.stringify({
      workspaceId,
      nodeId: 'node-member',
      timestamp: baseNow - WORKSPACE_NODE_SIGNATURE_MAX_AGE_MS + 1,
      nonce: 'heartbeat-receipt-retention',
      connectorStatus: 'connected',
      platform: 'darwin',
      architecture: 'arm64',
      capabilities: ['mcp'],
    });
    const signature = createDevicePublicKeyProof({
      deviceKeyPair: memberKey,
      payload: body,
    });

    const response = await handler(
      new Request(`${origin}/workspace/nodes/heartbeat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-consuelo-node-signature': signature,
        },
        body,
      }),
    );

    expect(response.status).toBe(200);
    expect(nonceClaim).toEqual({
      nodeId: 'node-member',
      nonce: 'heartbeat-receipt-retention',
      expiresAt: baseNow + WORKSPACE_NODE_SIGNATURE_MAX_AGE_MS,
      nowMs: baseNow,
    });
    await expect(backingStore.byWorkspaceNodeId('node-member')).resolves.toMatchObject({
      platform: 'darwin',
      architecture: 'arm64',
    });
  });

  it('lists only safe node metadata and supports rename, default selection, and revocation', async () => {
    let nowMs = baseNow;
    let upstreamCalls = 0;
    const store = createMemoryDeviceGrantStore();
    await seedWorkspace(store);
    await authorizeWorkspace(store, 'workspace-node-token');
    const routes = createInMemoryWorkspaceRouteD1();
    await seedRoutes(routes);
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => nowMs,
      workspaceRouteRegistry: routes,
      fetchImpl: async () => {
        upstreamCalls += 1;
        return Response.json({ ok: true });
      },
    });
    const auth = { authorization: 'Bearer workspace-node-token' };

    const list = await handler(
      new Request(`${origin}/workspace/nodes?current_node_id=node-home`, {
        headers: auth,
      }),
    );
    expect(list.status).toBe(200);
    const initial = (await list.json()) as Record<string, unknown>;
    expect(initial).toMatchObject({
      workspaceId,
      currentNodeId: 'node-home',
      defaultNodeId: 'node-home',
      nodeCount: 2,
      presence: { online: 2, stale: 0, offline: 0 },
    });
    expect(JSON.stringify(initial)).not.toMatch(
      /publicKeyJwk|private|token|tunnelOriginUrl|localService|\/Users\//i,
    );

    const rename = await handler(
      new Request(`${origin}/workspace/nodes/node-member`, {
        method: 'PATCH',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ displayName: 'Travel Mac' }),
      }),
    );
    expect(rename.status).toBe(200);
    await expect(rename.json()).resolves.toMatchObject({
      node: { nodeId: 'node-member', displayName: 'Travel Mac' },
    });

    const select = await handler(
      new Request(`${origin}/workspace/nodes/default`, {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ nodeId: 'node-member' }),
      }),
    );
    expect(select.status).toBe(200);
    await expect(select.json()).resolves.toMatchObject({
      defaultNodeId: 'node-member',
    });

    const revoke = await handler(
      new Request(`${origin}/workspace/nodes/node-member/revoke`, {
        method: 'POST',
        headers: auth,
      }),
    );
    expect(revoke.status).toBe(200);
    await expect(revoke.json()).resolves.toMatchObject({
      node: { nodeId: 'node-member', state: 'revoked' },
    });

    nowMs += 1;
    const finalList = await handler(
      new Request(`${origin}/workspace/nodes`, { headers: auth }),
    );
    await expect(finalList.json()).resolves.toMatchObject({
      defaultNodeId: 'node-member',
      nodeCount: 2,
    });

    const untargetedRevokedCall = await handler(
      new Request(`${origin}/mcp`, {
        method: 'POST',
        headers: {
          ...auth,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
    );
    expect(untargetedRevokedCall.status).toBe(404);
    await expect(untargetedRevokedCall.json()).resolves.toMatchObject({
      error: { code: 'WORKSPACE_NODE_REVOKED' },
    });
    expect(upstreamCalls).toBe(0);
  });

  it('should reject node mutations when an OAuth token has read-only workspace access', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedWorkspace(store);
    await authorizeWorkspace(store, 'workspace-read-only-token', {
      scopes: ['workspace:read', 'route:/mcp:read'],
    });
    const routes = createInMemoryWorkspaceRouteD1();
    await seedRoutes(routes);
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => baseNow,
      workspaceRouteRegistry: routes,
    });
    const auth = { authorization: 'Bearer workspace-read-only-token' };

    expect(
      (
        await handler(
          new Request(origin + '/workspace/nodes', { headers: auth }),
        )
      ).status,
    ).toBe(200);

    const requests = [
      new Request(origin + '/workspace/nodes/node-member', {
        method: 'PATCH',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ displayName: 'Should Not Change' }),
      }),
      new Request(origin + '/workspace/nodes/default', {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ nodeId: 'node-member' }),
      }),
      new Request(origin + '/workspace/nodes/node-member/revoke', {
        method: 'POST',
        headers: auth,
      }),
    ];

    for (const request of requests) {
      const response = await handler(request);
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'MISSING_SCOPE' },
      });
    }
  });

  it('should restore D1 routing when Durable Object node mutations fail', async () => {
    const backingStore = createMemoryDeviceGrantStore();
    await seedWorkspace(backingStore);
    await authorizeWorkspace(backingStore, 'workspace-compensation-token');
    const routes = createInMemoryWorkspaceRouteD1();
    await seedRoutes(routes);

    let failWorkspaceWrite = true;
    let failNodeWrite = false;
    const store = {
      ...backingStore,
      putAccountWorkspace: async (
        workspace: Parameters<typeof backingStore.putAccountWorkspace>[0],
      ) => {
        if (failWorkspaceWrite)
          throw new Error('injected workspace write failure');
        return backingStore.putAccountWorkspace(workspace);
      },
      putWorkspaceNode: async (
        workspaceNode: Parameters<typeof backingStore.putWorkspaceNode>[0],
      ) => {
        if (failNodeWrite && workspaceNode.state === 'revoked') {
          throw new Error('injected node write failure');
        }
        return backingStore.putWorkspaceNode(workspaceNode);
      },
    };
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => baseNow,
      workspaceRouteRegistry: routes,
    });
    const authorization = 'Bearer workspace-compensation-token';

    const select = await handler(
      new Request(origin + '/workspace/nodes/default', {
        method: 'POST',
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify({ nodeId: 'node-member' }),
      }),
    );
    expect(select.status).toBe(503);
    await expect(
      resolveWorkspaceRouteFromD1(routes, {
        host: workspaceHost,
        path: '/mcp',
        nowMs: baseNow,
      }),
    ).resolves.toMatchObject({ allowed: true, nodeId: 'node-home' });

    failWorkspaceWrite = false;
    failNodeWrite = true;
    const revoke = await handler(
      new Request(origin + '/workspace/nodes/node-member/revoke', {
        method: 'POST',
        headers: { authorization },
      }),
    );
    expect(revoke.status).toBe(503);
    await expect(
      resolveWorkspaceRouteFromD1(routes, {
        host: workspaceHost,
        path: '/mcp',
        nodeId: 'node-member',
        nowMs: baseNow,
      }),
    ).resolves.toMatchObject({ allowed: true, nodeId: 'node-member' });
    await expect(
      backingStore.byWorkspaceNode(accountId, 'node-member'),
    ).resolves.toMatchObject({ state: 'active' });
  });

  it('should preserve a legacy connector as the home default when a member node is added', async () => {
    const routes = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(routes);
    await upsertWorkspaceHostnameInD1(routes, {
      workspaceId,
      workspaceSlug,
      hostname: workspaceHost,
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      routes: [
        {
          surface: 'os',
          pathPrefix: '/mcp',
          auth: 'required',
          status: 'active',
          target: {
            kind: 'os-connector',
            connectorId: 'connector_legacy_home',
            connectorStatus: 'connected',
            tunnelOriginUrl: 'https://legacy-home.connector.test',
          },
        },
      ],
    });
    const registry =
      await import('../scripts/lib/workspace-cloudflare-d1-route-registry');
    await registry.upsertWorkspaceNodeTargetInD1(routes, {
      record: {
        workspaceId,
        workspaceSlug,
        hostname: workspaceHost,
        baseDomain: 'consuelohq.com',
        provider: 'cloudflare',
        owner: 'consuelo-os-cloud',
        status: 'active',
        routes: [
          {
            surface: 'os',
            pathPrefix: '/mcp',
            auth: 'required',
            status: 'active',
            target: {
              kind: 'os-connector',
              connectorId: 'connector_node_member',
              connectorStatus: 'connected',
              tunnelOriginUrl: 'https://member.connector.test',
            },
          },
        ],
      },
      target: {
        nodeId: 'node-member',
        connectorId: 'connector_node_member',
        connectorStatus: 'connected',
        tunnelOriginUrl: 'https://member.connector.test',
        state: 'active',
        lastSeenAt: baseNow,
        heartbeatTtlMs,
      },
    });

    await expect(
      resolveWorkspaceRouteFromD1(routes, {
        host: workspaceHost,
        path: '/mcp',
        nowMs: baseNow,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      nodeId: workspaceSlug,
      target: {
        connectorId: 'connector_legacy_home',
        tunnelOriginUrl: 'https://legacy-home.connector.test',
      },
    });
    await expect(
      resolveWorkspaceRouteFromD1(routes, {
        host: workspaceHost,
        path: '/mcp',
        nodeId: 'node-member',
        nowMs: baseNow,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      nodeId: 'node-member',
      target: { connectorId: 'connector_node_member' },
    });
  });

  it('accepts signed heartbeats, derives TTL presence, rejects replay, and blocks revoked nodes', async () => {
    let nowMs = baseNow;
    const store = createMemoryDeviceGrantStore();
    const { memberKey } = await seedWorkspace(store);
    const home = await store.byWorkspaceNode(accountId, 'node-home');
    expect(home).toBeDefined();
    await store.putWorkspaceNode({
      ...home!,
      lastSeenAt: baseNow - heartbeatTtlMs * 4,
    } as WorkspaceNode);
    await authorizeWorkspace(store, 'workspace-heartbeat-token');
    const routes = createInMemoryWorkspaceRouteD1();
    await seedRoutes(routes, baseNow - 300_000);
    const workspaceEdgeSigningMasterSecret = 'heartbeat-edge-master-secret';
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => nowMs,
      workspaceRouteRegistry: routes,
      workspaceEdgeInternalSigningSecret: workspaceEdgeSigningMasterSecret,
    });
    const body = JSON.stringify({
      workspaceId,
      nodeId: 'node-member',
      timestamp: nowMs,
      nonce: 'heartbeat-nonce-0001',
      connectorStatus: 'connected',
      capabilities: ['mcp', 'tools'],
      agents: ['opencode', 'codex', 'codex'],
    });
    const signature = createDevicePublicKeyProof({
      deviceKeyPair: memberKey,
      payload: body,
    });
    const heartbeatRequest = () =>
      new Request(`${origin}/workspace/nodes/heartbeat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-consuelo-node-signature': signature,
        },
        body,
      });

    const heartbeat = await handler(heartbeatRequest());
    expect(heartbeat.status).toBe(200);
    const heartbeatJson = await heartbeat.json() as Record<string, unknown>;
    expect(heartbeatJson).toMatchObject({
      nodeId: 'node-member',
      presence: 'online',
      connectorId: 'connector_node_member',
      edgeRequestSigningSecret: deriveWorkspaceEdgeNodeSecret({
        masterSecret: workspaceEdgeSigningMasterSecret,
        workspaceId,
        nodeId: 'node-member',
        connectorId: 'connector_node_member',
      }),
      agents: ['codex', 'opencode'],
      workspace: {
        workspaceId,
        workspaceHost,
        currentNodeId: 'node-member',
        defaultNodeId: 'node-home',
        nodes: [
          { nodeId: 'node-home', presence: 'offline' },
          { nodeId: 'node-member', presence: 'online' },
        ],
      },
    });
    expect(JSON.stringify(heartbeatJson.workspace)).not.toMatch(
      /connectorId|publicKeyThumbprint|edgeRequestSigningSecret|token|secret/i,
    );
    expect(
      (await store.byWorkspaceNode(accountId, 'node-member'))?.agents,
    ).toEqual(['codex', 'opencode']);
    expect((await handler(heartbeatRequest())).status).toBe(409);

    const onlineAgents = await handler(
      new Request(`${origin}/workspace/agents?workspace_host=${workspaceHost}`),
    );
    await expect(onlineAgents.json()).resolves.toMatchObject({
      state: 'online',
      connectedAgentCount: 2,
      agents: [
        { name: 'codex', label: 'Codex' },
        { name: 'opencode', label: 'OpenCode' },
      ],
    });

    const invalidBody = JSON.stringify({
      workspaceId,
      nodeId: 'node-member',
      timestamp: nowMs,
      nonce: 'heartbeat-nonce-invalid-agent',
      connectorStatus: 'connected',
      capabilities: ['mcp'],
      agents: ['unknown-agent'],
    });
    const invalidSignature = createDevicePublicKeyProof({
      deviceKeyPair: memberKey,
      payload: invalidBody,
    });
    const invalidAgents = await handler(
      new Request(`${origin}/workspace/nodes/heartbeat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-consuelo-node-signature': invalidSignature,
        },
        body: invalidBody,
      }),
    );
    expect(invalidAgents.status).toBe(400);

    const invalidStatusBody = JSON.stringify({
      workspaceId,
      nodeId: 'node-member',
      timestamp: nowMs,
      nonce: 'heartbeat-nonce-invalid-status',
      connectorStatus: 'unknown',
      capabilities: ['mcp'],
    });
    const invalidStatusSignature = createDevicePublicKeyProof({
      deviceKeyPair: memberKey,
      payload: invalidStatusBody,
    });
    const invalidStatus = await handler(
      new Request(`${origin}/workspace/nodes/heartbeat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-consuelo-node-signature': invalidStatusSignature,
        },
        body: invalidStatusBody,
      }),
    );
    expect(invalidStatus.status).toBe(400);

    const overflowBody = JSON.stringify({
      workspaceId,
      nodeId: 'node-member',
      timestamp: nowMs,
      nonce: 'heartbeat-nonce-capability-overflow',
      connectorStatus: 'connected',
      capabilities: Array.from(
        { length: 33 },
        (_, index) => `capability-${index}`,
      ),
    });
    const overflowSignature = createDevicePublicKeyProof({
      deviceKeyPair: memberKey,
      payload: overflowBody,
    });
    const overflow = await handler(
      new Request(`${origin}/workspace/nodes/heartbeat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-consuelo-node-signature': overflowSignature,
        },
        body: overflowBody,
      }),
    );
    expect(overflow.status).toBe(400);

    const normalizedCapabilitiesBody = JSON.stringify({
      workspaceId,
      nodeId: 'node-member',
      timestamp: nowMs,
      nonce: 'heartbeat-nonce-normalized-capabilities',
      connectorStatus: 'connected',
      capabilities: Array.from(
        { length: 33 },
        (_, index) => `${' '.repeat(index)}mcp`,
      ),
    });
    const normalizedCapabilitiesSignature = createDevicePublicKeyProof({
      deviceKeyPair: memberKey,
      payload: normalizedCapabilitiesBody,
    });
    const normalizedCapabilities = await handler(
      new Request(`${origin}/workspace/nodes/heartbeat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-consuelo-node-signature': normalizedCapabilitiesSignature,
        },
        body: normalizedCapabilitiesBody,
      }),
    );
    expect(normalizedCapabilities.status).toBe(200);
    expect(
      (await store.byWorkspaceNode(accountId, 'node-member'))?.capabilities,
    ).toEqual(['mcp']);

    const disconnectedBody = JSON.stringify({
      workspaceId,
      nodeId: 'node-member',
      timestamp: nowMs,
      nonce: 'heartbeat-nonce-disconnected',
      connectorStatus: 'disconnected',
      capabilities: ['mcp'],
    });
    const disconnectedSignature = createDevicePublicKeyProof({
      deviceKeyPair: memberKey,
      payload: disconnectedBody,
    });
    const disconnected = await handler(
      new Request(`${origin}/workspace/nodes/heartbeat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-consuelo-node-signature': disconnectedSignature,
        },
        body: disconnectedBody,
      }),
    );
    expect(disconnected.status).toBe(200);
    await expect(disconnected.json()).resolves.toMatchObject({
      presence: 'offline',
    });

    const auth = { authorization: 'Bearer workspace-heartbeat-token' };
    nowMs = baseNow + heartbeatTtlMs + 1;
    const stale = await handler(
      new Request(`${origin}/workspace/nodes`, { headers: auth }),
    );
    await expect(stale.json()).resolves.toMatchObject({
      presence: { online: 0, stale: 0, offline: 2 },
    });
    const staleAgents = await handler(
      new Request(`${origin}/workspace/agents?workspace_host=${workspaceHost}`),
    );
    await expect(staleAgents.json()).resolves.toMatchObject({
      state: 'offline',
      connectedAgentCount: 2,
    });
    nowMs = baseNow + heartbeatTtlMs * 3 + 1;
    const offline = await handler(
      new Request(`${origin}/workspace/nodes`, { headers: auth }),
    );
    await expect(offline.json()).resolves.toMatchObject({
      presence: { online: 0, stale: 0, offline: 2 },
    });
    const offlineAgents = await handler(
      new Request(`${origin}/workspace/agents?workspace_host=${workspaceHost}`),
    );
    await expect(offlineAgents.json()).resolves.toMatchObject({
      state: 'offline',
      connectedAgentCount: 2,
    });

    const revoke = await handler(
      new Request(`${origin}/workspace/nodes/node-member/revoke`, {
        method: 'POST',
        headers: auth,
      }),
    );
    expect(revoke.status).toBe(200);
    const revokedBody = JSON.stringify({
      workspaceId,
      nodeId: 'node-member',
      timestamp: nowMs,
      nonce: 'heartbeat-nonce-0002',
      connectorStatus: 'connected',
      capabilities: ['mcp'],
    });
    const revokedSignature = createDevicePublicKeyProof({
      deviceKeyPair: memberKey,
      payload: revokedBody,
    });
    const revokedHeartbeat = await handler(
      new Request(`${origin}/workspace/nodes/heartbeat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-consuelo-node-signature': revokedSignature,
        },
        body: revokedBody,
      }),
    );
    expect(revokedHeartbeat.status).toBe(403);
  });

  it('recreates missing workspace route state from durable node identity on a signed heartbeat', async () => {
    const store = createMemoryDeviceGrantStore();
    const { memberKey } = await seedWorkspace(store);
    const routes = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(routes);
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => baseNow,
      workspaceRouteRegistry: routes,
    });
    const body = JSON.stringify({
      workspaceId,
      nodeId: 'node-member',
      timestamp: baseNow,
      nonce: 'heartbeat-recreate-route-state',
      connectorStatus: 'connected',
      capabilities: ['mcp', 'tools'],
    });
    const signature = createDevicePublicKeyProof({
      deviceKeyPair: memberKey,
      payload: body,
    });

    const heartbeat = await handler(
      new Request(`${origin}/workspace/nodes/heartbeat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-consuelo-node-signature': signature,
        },
        body,
      }),
    );

    expect(heartbeat.status).toBe(200);
    await expect(heartbeat.json()).resolves.toMatchObject({
      nodeId: 'node-member',
      routeReady: true,
    });
    await expect(
      resolveWorkspaceRouteFromD1(routes, {
        host: workspaceHost,
        path: '/mcp',
        nodeId: 'node-member',
        nowMs: baseNow,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      nodeId: 'node-member',
      target: { connectorId: 'connector_node_member' },
    });
    await expect(
      resolveWorkspaceRouteFromD1(routes, {
        host: workspaceHost,
        path: '/mcp',
        nodeId: 'node-home',
        nowMs: baseNow,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      nodeId: 'node-home',
      target: { connectorId: 'connector_node_home' },
    });
  });

  it('preserves a newer published launcher snapshot during signed heartbeat reconciliation', async () => {
    const store = createMemoryDeviceGrantStore();
    const { memberKey } = await seedWorkspace(store);
    const routes = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(routes);
    await upsertWorkspaceHostnameInD1(routes, {
      workspaceId,
      workspaceSlug,
      hostname: workspaceHost,
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      defaultNodeId: 'node-home',
      nodeTargets: [
        {
          nodeId: 'node-home',
          connectorId: 'connector_node_home',
          connectorStatus: 'connected',
          tunnelOriginUrl: 'https://home.connector.test',
          state: 'active',
          lastSeenAt: baseNow,
          heartbeatTtlMs,
        },
        {
          nodeId: 'node-member',
          connectorId: 'connector_node_member',
          connectorStatus: 'connected',
          tunnelOriginUrl: 'https://member.connector.test',
          state: 'active',
          lastSeenAt: baseNow,
          heartbeatTtlMs,
        },
      ],
      routes: [
        {
          surface: 'sites',
          pathPrefix: '/',
          auth: 'workspace-session',
          status: 'active',
          target: {
            kind: 'site-snapshot',
            siteId: 'launcher',
            versionId: 'sha256-newer-launcher',
            manifestKey:
              'sites/workspace_testing/launcher/sha256-newer-launcher/index.html',
            htmlKey:
              'sites/workspace_testing/launcher/sha256-newer-launcher/index.html',
            cachePolicy: 'private-preview',
          },
        },
        {
          surface: 'os',
          pathPrefix: '/mcp',
          auth: 'required',
          status: 'active',
          target: {
            kind: 'os-connector',
            connectorId: 'connector_node_home',
            connectorStatus: 'connected',
            tunnelOriginUrl: 'https://home.connector.test',
          },
        },
      ],
    } as Parameters<typeof upsertWorkspaceHostnameInD1>[1]);

    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => baseNow,
      workspaceRouteRegistry: routes,
      defaultSiteSnapshot: {
        key: 'sites/workspace_testing/launcher/sha256-stale-default/index.html',
        versionId: 'sha256-stale-default',
      },
    });
    const body = JSON.stringify({
      workspaceId,
      nodeId: 'node-member',
      timestamp: baseNow,
      nonce: 'heartbeat-preserve-newer-launcher',
      connectorStatus: 'connected',
      capabilities: ['mcp', 'tools'],
    });
    const signature = createDevicePublicKeyProof({
      deviceKeyPair: memberKey,
      payload: body,
    });

    const heartbeat = await handler(
      new Request(origin + '/workspace/nodes/heartbeat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-consuelo-node-signature': signature,
        },
        body,
      }),
    );

    expect(heartbeat.status).toBe(200);
    await expect(
      resolveWorkspaceRouteFromD1(routes, {
        host: workspaceHost,
        path: '/',
        nowMs: baseNow,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      target: {
        kind: 'site-snapshot',
        siteId: 'launcher',
        versionId: 'sha256-newer-launcher',
      },
    });
    await expect(
      resolveWorkspaceRouteFromD1(routes, {
        host: workspaceHost,
        path: '/mcp',
        nodeId: 'node-member',
        nowMs: baseNow,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      nodeId: 'node-member',
      target: { connectorId: 'connector_node_member' },
    });
  });

  it('repairs a legacy default node to the signed current node and preserves that real default on later heartbeats', async () => {
    const store = createMemoryDeviceGrantStore();
    const { homeKey, memberKey } = await seedWorkspace(store);
    await store.putAccountWorkspace({
      accountId,
      workspaceId,
      workspaceSlug,
      workspaceHost,
      homeNodeId: 'node-home',
      defaultNodeId: 'internal',
      updatedAt: baseNow,
    });
    const routes = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(routes);
    await upsertWorkspaceHostnameInD1(routes, {
      workspaceId,
      workspaceSlug,
      hostname: workspaceHost,
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      defaultNodeId: 'internal',
      nodeTargets: [
        {
          nodeId: 'node-home',
          connectorId: 'connector_node_home',
          connectorStatus: 'connected',
          tunnelOriginUrl: 'https://home.connector.test',
          state: 'active',
          lastSeenAt: baseNow,
          heartbeatTtlMs,
        },
        {
          nodeId: 'node-member',
          connectorId: 'connector_node_member',
          connectorStatus: 'connected',
          tunnelOriginUrl: 'https://member.connector.test',
          state: 'active',
          lastSeenAt: baseNow,
          heartbeatTtlMs,
        },
      ],
      routes: [
        {
          surface: 'os',
          pathPrefix: '/mcp',
          auth: 'required',
          status: 'active',
          target: {
            kind: 'os-connector',
            connectorId: 'connector_node_home',
            connectorStatus: 'connected',
            tunnelOriginUrl: 'https://home.connector.test',
          },
        },
      ],
    });
    let nowMs = baseNow;
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => nowMs,
      workspaceRouteRegistry: routes,
    });

    const sendHeartbeat = async (input: {
      nodeId: 'node-home' | 'node-member';
      nonce: string;
      key: ReturnType<typeof generateWorkspaceDeviceKeyPair>;
    }) => {
      const body = JSON.stringify({
        workspaceId,
        nodeId: input.nodeId,
        timestamp: nowMs,
        nonce: input.nonce,
        connectorStatus: 'connected',
        capabilities: ['mcp', 'tools'],
      });
      const signature = createDevicePublicKeyProof({
        deviceKeyPair: input.key,
        payload: body,
      });
      return handler(
        new Request(`${origin}/workspace/nodes/heartbeat`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-consuelo-node-signature': signature,
          },
          body,
        }),
      );
    };

    const repaired = await sendHeartbeat({
      nodeId: 'node-member',
      nonce: 'heartbeat-repair-legacy-default',
      key: memberKey,
    });
    expect(repaired.status).toBe(200);
    expect((await store.byAccountWorkspace(accountId))?.defaultNodeId).toBe('node-member');
    await expect(
      resolveWorkspaceRouteFromD1(routes, {
        host: workspaceHost,
        path: '/mcp',
        nowMs,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      nodeId: 'node-member',
      target: { connectorId: 'connector_node_member' },
    });

    nowMs += 1_000;
    const laterHomeHeartbeat = await sendHeartbeat({
      nodeId: 'node-home',
      nonce: 'heartbeat-preserve-real-default',
      key: homeKey,
    });
    expect(laterHomeHeartbeat.status).toBe(200);
    expect((await store.byAccountWorkspace(accountId))?.defaultNodeId).toBe('node-member');
  });

  it('rejects cross-workspace node listing', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedWorkspace(store);
    await authorizeWorkspace(store, 'wrong-workspace-token', {
      host: 'other.consuelohq.com',
    });
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => baseNow,
    });
    const response = await handler(
      new Request(`${origin}/workspace/nodes?workspace_host=${workspaceHost}`, {
        headers: { authorization: 'Bearer wrong-workspace-token' },
      }),
    );
    expect(response.status).toBe(403);
  });
});

describe('multi-node connector routing', () => {
  it('keeps both provisioned connectors and preserves the home node as the default', async () => {
    const db = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(db);
    const provisioner = async (input: { connectorId: string }) => ({
      connectorId: input.connectorId,
      cloudflareTunnelToken: `secret-${input.connectorId}`,
      tunnelOriginUrl:
        input.connectorId === 'connector_node_home'
          ? 'https://home.connector.test'
          : 'https://member.connector.test',
      localServiceUrl: 'http://127.0.0.1:46321',
    });
    const grant = (nodeId: string, role: 'home' | 'member'): Grant => ({
      hash: `grant-${nodeId}`,
      userCode: 'ABCD-EFGH',
      workspaceSlug,
      workspaceHost,
      status: 'approved',
      expiresAt: baseNow + 300_000,
      interval: 5,
      nodeId,
      nodeRole: role,
      nodeLastSeenAt: baseNow,
    });

    await registerApprovedWorkspaceRoute({
      routeRegistry: db,
      workspaceConnectorProvisioner: provisioner,
      grant: grant('node-home', 'home'),
    });
    await registerApprovedWorkspaceRoute({
      routeRegistry: db,
      workspaceConnectorProvisioner: provisioner,
      grant: grant('node-member', 'member'),
    });

    await expect(
      resolveWorkspaceRouteFromD1(db, {
        host: workspaceHost,
        path: '/mcp',
        nowMs: baseNow,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      nodeId: 'node-home',
      target: { connectorId: 'connector_node_home' },
    });
    await expect(
      resolveWorkspaceRouteFromD1(db, {
        host: workspaceHost,
        path: '/mcp',
        nodeId: 'node-member',
        nowMs: baseNow,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      nodeId: 'node-member',
      target: { connectorId: 'connector_node_member' },
    });
  });

  it('routes explicit calls to the requested node and untargeted calls to the stable default', async () => {
    const db = createInMemoryWorkspaceRouteD1();
    await seedRoutes(db);
    const explicit = await resolveWorkspaceRouteFromD1(db, {
      host: workspaceHost,
      path: '/mcp',
      nodeId: 'node-member',
      nowMs: baseNow,
    } as Parameters<typeof resolveWorkspaceRouteFromD1>[1]);
    expect(explicit).toMatchObject({
      allowed: true,
      nodeId: 'node-member',
      target: { kind: 'os-connector', connectorId: 'connector_node_member' },
    });
    const implicit = await resolveWorkspaceRouteFromD1(db, {
      host: workspaceHost,
      path: '/mcp',
      nowMs: baseNow,
    } as Parameters<typeof resolveWorkspaceRouteFromD1>[1]);
    expect(implicit).toMatchObject({
      allowed: true,
      nodeId: 'node-home',
      target: { kind: 'os-connector', connectorId: 'connector_node_home' },
    });
  });

  it('fails when the default is unavailable instead of falling back to another online node', async () => {
    const db = createInMemoryWorkspaceRouteD1();
    await seedRoutes(db, baseNow - heartbeatTtlMs * 4);
    const result = await resolveWorkspaceRouteFromD1(db, {
      host: workspaceHost,
      path: '/mcp',
      nowMs: baseNow,
    } as Parameters<typeof resolveWorkspaceRouteFromD1>[1]);
    expect(result).toMatchObject({
      allowed: false,
      status: 503,
      errorCode: 'WORKSPACE_NODE_OFFLINE',
    });
  });

  it('uses the explicit/default node in the central MCP proxy and never crosses workspaces', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedWorkspace(store);
    await authorizeWorkspace(store, 'central-node-token');
    const db = createInMemoryWorkspaceRouteD1();
    await seedRoutes(db);
    const upstreams: string[] = [];
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => baseNow,
      workspaceRouteRegistry: db,
      fetchImpl: async (request) => {
        upstreams.push(typeof request === 'string' ? request : request.url);
        return Response.json({ ok: true });
      },
    });

    const explicit = await handler(
      new Request(`${origin}/mcp`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer central-node-token',
          'content-type': 'application/json',
          'x-consuelo-node-id': 'node-member',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
    );
    expect(explicit.status).toBe(200);
    expect(upstreams.at(-1)).toBe('https://member.connector.test/mcp');

    const implicit = await handler(
      new Request(`${origin}/mcp`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer central-node-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
      }),
    );
    expect(implicit.status).toBe(200);
    expect(upstreams.at(-1)).toBe('https://home.connector.test/mcp');

    const foreign = await handler(
      new Request(`${origin}/mcp`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer central-node-token',
          'content-type': 'application/json',
          'x-consuelo-node-id': 'node-from-other-workspace',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list' }),
      }),
    );
    expect(foreign.status).toBe(404);
    expect(upstreams).toHaveLength(2);
  });

  it('should use os.call nodeId as the central selector when body and header selectors are evaluated', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedWorkspace(store);
    await authorizeWorkspace(store, 'central-body-node-token', {
      scopes: ['workspace:read', 'route:/mcp:read', 'tool:*:read'],
    });
    const db = createInMemoryWorkspaceRouteD1();
    await seedRoutes(db);
    const upstreams: string[] = [];
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => baseNow,
      workspaceRouteRegistry: db,
      fetchImpl: async (request) => {
        upstreams.push(typeof request === 'string' ? request : request.url);
        return Response.json({ ok: true });
      },
    });
    const callBody = (id: number, nodeId?: string) => JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: 'call',
        arguments: {
          tool: 'status',
          input: {},
          ...(nodeId ? { nodeId } : {}),
        },
      },
    });
    const auth = {
      authorization: 'Bearer central-body-node-token',
      'content-type': 'application/json',
    };

    const explicit = await handler(new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: auth,
      body: callBody(10, 'node-member'),
    }));
    expect(explicit.status).toBe(200);
    expect(upstreams.at(-1)).toBe('https://member.connector.test/mcp');

    const implicit = await handler(new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: auth,
      body: callBody(11),
    }));
    expect(implicit.status).toBe(200);
    expect(upstreams.at(-1)).toBe('https://home.connector.test/mcp');

    const conflicting = await handler(new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: { ...auth, 'x-consuelo-node-id': 'node-home' },
      body: callBody(12, 'node-member'),
    }));
    expect(conflicting.status).toBe(400);
    await expect(conflicting.json()).resolves.toMatchObject({
      error: { code: 'NODE_ROUTE_MISMATCH' },
    });
    expect(upstreams).toHaveLength(2);

    const foreign = await handler(new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: auth,
      body: callBody(13, 'node-from-other-workspace'),
    }));
    expect(foreign.status).toBe(404);
    expect(upstreams).toHaveLength(2);
  });

  it('should add a safe workspace node directory when central get_steering is requested', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedWorkspace(store);
    await authorizeWorkspace(store, 'central-steering-node-token', {
      scopes: ['route:/mcp:read'],
    });
    const db = createInMemoryWorkspaceRouteD1();
    await seedRoutes(db);
    let upstreamRequest: Request | undefined;
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => baseNow,
      workspaceRouteRegistry: db,
      fetchImpl: async (request) => {
        upstreamRequest = request instanceof Request ? request : new Request(request);
        return Response.json({ ok: true });
      },
    });

    const response = await handler(new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer central-steering-node-token',
        'content-type': 'application/json',
        [MCP_NODE_CONTEXT_HEADER]: 'spoofed-client-value',
        [MCP_ROUTE_SOURCE_HEADER]: 'explicit',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 20,
        method: 'tools/call',
        params: { name: 'get_steering', arguments: {} },
      }),
    }));

    expect(response.status).toBe(200);
    expect(upstreamRequest).toBeDefined();
    expect(upstreamRequest!.headers.get('x-consuelo-node-id')).toBe('node-home');
    expect(upstreamRequest!.headers.get(MCP_ROUTE_SOURCE_HEADER)).toBe('default');
    const context = decodeMcpNodeRoutingContext(
      upstreamRequest!.headers.get(MCP_NODE_CONTEXT_HEADER),
    );
    expect(context).toMatchObject({
      version: 1,
      workspaceId,
      currentNodeId: 'node-home',
      defaultNodeId: 'node-home',
      routeSource: 'default',
      nodes: expect.arrayContaining([
        expect.objectContaining({
          nodeId: 'node-home',
          displayName: 'Mac Mini',
          presence: 'online',
        }),
        expect.objectContaining({
          nodeId: 'node-member',
          displayName: 'MacBook Air',
          presence: 'online',
        }),
      ]),
    });
    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain('connector_node_');
    expect(serialized).not.toContain('publicKey');
    expect(serialized).not.toContain('spoofed-client-value');
  });

  it('should report node-directory lookup failures when central steering remains fail-open', async () => {
    const backingStore = createMemoryDeviceGrantStore();
    await seedWorkspace(backingStore);
    await authorizeWorkspace(backingStore, 'central-steering-warning-token', {
      scopes: ['route:/mcp:read'],
    });
    const store = {
      ...backingStore,
      async listWorkspaceNodes(): Promise<WorkspaceNode[]> {
        throw new Error('simulated node directory outage');
      },
    };
    const db = createInMemoryWorkspaceRouteD1();
    await seedRoutes(db);
    const operationalEvents: unknown[] = [];
    let upstreamRequest: Request | undefined;
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => baseNow,
      workspaceRouteRegistry: db,
      operationalLogger: {
        warn: (message, context) => operationalEvents.push({ message, context }),
      },
      fetchImpl: async (request) => {
        upstreamRequest = request instanceof Request ? request : new Request(request);
        return Response.json({ ok: true });
      },
    });

    const response = await handler(new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer central-steering-warning-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 21,
        method: 'tools/call',
        params: { name: 'get_steering', arguments: {} },
      }),
    }));

    expect(response.status).toBe(200);
    expect(upstreamRequest).toBeDefined();
    expect(upstreamRequest!.headers.get(MCP_NODE_CONTEXT_HEADER)).toBeNull();
    expect(operationalEvents).toEqual([
      expect.objectContaining({
        message: '[OsDeviceAuthority] MCP node directory unavailable',
        context: expect.objectContaining({
          component: 'os-device-authority',
          operation: 'mcp-node-directory',
          accountId,
          workspaceId,
          workspaceHost,
          failure: 'Error',
        }),
      }),
    ]);
  });

  it('should forward only the resolved node when workspace-edge targeting is explicit', async () => {
    const db = createInMemoryWorkspaceRouteD1();
    await seedRoutes(db);
    const upstreams: Request[] = [];
    const router = createWorkspaceCloudflareEdgeRouter({
      registry: createWorkspaceCloudflareD1RouteRegistry(db),
      internalSigningSecret: 'edge-signing-secret',
      now: () => baseNow,
      createNonce: () => 'edge-nonce-0001',
      fetchUpstream: async (request) => {
        upstreams.push(request);
        return Response.json({ ok: true });
      },
    });

    const response = await router.fetch(
      new Request(`https://${workspaceHost}/mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-consuelo-node-id': 'node-member',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(upstreams).toHaveLength(1);
    expect(upstreams[0]?.url).toBe('https://member.connector.test/mcp');
    expect(upstreams[0]?.headers.get('x-consuelo-node-id')).toBe('node-member');
    expect(upstreams[0]?.headers.get('x-consuelo-connector-id')).toBe(
      'connector_node_member',
    );
  });

  it('should keep task-scoped calls on their owner when the workspace default changes', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedWorkspace(store);
    await authorizeWorkspace(store, 'central-task-affinity-token', {
      scopes: [
        'workspace:read',
        'workspace:nodes:manage',
        'route:/mcp:read',
        'mcp:call',
      ],
    });
    const db = createInMemoryWorkspaceRouteD1();
    await seedRoutes(db);
    const upstreams: string[] = [];
    const routeSources: Array<string | null> = [];
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => baseNow,
      workspaceRouteRegistry: db,
      fetchImpl: async (request) => {
        const upstream = request instanceof Request ? request : new Request(request);
        upstreams.push(upstream.url);
        routeSources.push(upstream.headers.get('x-consuelo-route-source'));
        const payload = await upstream.clone().json() as {
          id?: unknown;
          params?: { arguments?: { tool?: string } };
        };
        const tool = payload.params?.arguments?.tool;
        const facadeResult = tool === 'task.start'
          ? { ok: true, code: 'OK', data: { taskSession: 'tsk_owner_home' } }
          : { ok: true, code: 'OK', data: { routed: true } };
        return Response.json({
          jsonrpc: '2.0',
          id: payload.id ?? null,
          result: {
            content: [{ type: 'text', text: JSON.stringify(facadeResult) }],
            isError: false,
          },
        });
      },
    });
    const auth = {
      authorization: 'Bearer central-task-affinity-token',
      'content-type': 'application/json',
    };
    const callBody = (
      id: number,
      tool: string,
      input: Record<string, unknown>,
      taskSession?: string,
    ) => JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: 'call',
        arguments: {
          tool,
          input,
          ...(taskSession ? { taskSession } : {}),
        },
      },
    });

    const start = await handler(new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: auth,
      body: callBody(30, 'task.start', { area: 'os', title: 'Affinity task' }),
    }));
    expect(start.status).toBe(200);
    expect(upstreams).toEqual(['https://home.connector.test/mcp']);

    const select = await handler(new Request(`${origin}/workspace/nodes/default`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ nodeId: 'node-member' }),
    }));
    expect(select.status).toBe(200);

    const followup = await handler(new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: auth,
      body: callBody(31, 'fs.read', { path: 'README.md' }, 'tsk_owner_home'),
    }));
    expect(followup.status).toBe(200);
    expect(upstreams).toEqual([
      'https://home.connector.test/mcp',
      'https://home.connector.test/mcp',
    ]);
    expect(routeSources).toEqual(['default', 'task']);
  });

  it('should reject explicit node targeting when it conflicts with the task owner', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedWorkspace(store);
    await authorizeWorkspace(store, 'central-task-conflict-token', {
      scopes: ['route:/mcp:read', 'mcp:call'],
    });
    await store.claimWorkspaceTaskAffinity({
      accountId,
      workspaceId,
      workspaceHost,
      taskSession: 'tsk_conflict',
      ownerNodeId: 'node-home',
      createdAt: baseNow,
      updatedAt: baseNow,
    });
    const db = createInMemoryWorkspaceRouteD1();
    await seedRoutes(db);
    let upstreamCalls = 0;
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => baseNow,
      workspaceRouteRegistry: db,
      fetchImpl: async () => {
        upstreamCalls += 1;
        return Response.json({ ok: true });
      },
    });

    const response = await handler(new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer central-task-conflict-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 40,
        method: 'tools/call',
        params: {
          name: 'call',
          arguments: {
            tool: 'fs.read',
            input: { path: 'README.md' },
            taskSession: 'tsk_conflict',
            nodeId: 'node-member',
          },
        },
      }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'TASK_NODE_MISMATCH' },
    });
    expect(upstreamCalls).toBe(0);
  });

  it('should fail without fallback when the task owner is offline', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedWorkspace(store);
    await authorizeWorkspace(store, 'central-task-offline-token', {
      scopes: ['route:/mcp:read', 'mcp:call'],
    });
    await store.claimWorkspaceTaskAffinity({
      accountId,
      workspaceId,
      workspaceHost,
      taskSession: 'tsk_offline_owner',
      ownerNodeId: 'node-home',
      createdAt: baseNow,
      updatedAt: baseNow,
    });
    const db = createInMemoryWorkspaceRouteD1();
    await seedRoutes(db, baseNow, {
      homeLastSeenAt: baseNow - heartbeatTtlMs * 4,
      memberLastSeenAt: baseNow,
    });
    let upstreamCalls = 0;
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => baseNow,
      workspaceRouteRegistry: db,
      fetchImpl: async () => {
        upstreamCalls += 1;
        return Response.json({ ok: true });
      },
    });

    const response = await handler(new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer central-task-offline-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 41,
        method: 'tools/call',
        params: {
          name: 'call',
          arguments: {
            tool: 'fs.read',
            input: { path: 'README.md' },
            taskSession: 'tsk_offline_owner',
          },
        },
      }),
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'WORKSPACE_NODE_OFFLINE' },
    });
    expect(upstreamCalls).toBe(0);
  });

  it('should release task affinity when task.finish succeeds', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedWorkspace(store);
    await authorizeWorkspace(store, 'central-task-finish-token', {
      scopes: [
        'workspace:read',
        'workspace:nodes:manage',
        'route:/mcp:read',
        'mcp:call',
      ],
    });
    await store.claimWorkspaceTaskAffinity({
      accountId,
      workspaceId,
      workspaceHost,
      taskSession: 'tsk_finish_owner',
      ownerNodeId: 'node-home',
      createdAt: baseNow,
      updatedAt: baseNow,
    });
    const db = createInMemoryWorkspaceRouteD1();
    await seedRoutes(db);
    const upstreams: string[] = [];
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => baseNow,
      workspaceRouteRegistry: db,
      fetchImpl: async (request) => {
        const upstream = request instanceof Request ? request : new Request(request);
        upstreams.push(upstream.url);
        const payload = await upstream.clone().json() as { id?: unknown };
        return Response.json({
          jsonrpc: '2.0',
          id: payload.id ?? null,
          result: {
            content: [{ type: 'text', text: JSON.stringify({ ok: true, code: 'OK', data: {} }) }],
            isError: false,
          },
        });
      },
    });
    const auth = {
      authorization: 'Bearer central-task-finish-token',
      'content-type': 'application/json',
    };

    const select = await handler(new Request(`${origin}/workspace/nodes/default`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ nodeId: 'node-member' }),
    }));
    expect(select.status).toBe(200);

    const finish = await handler(new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 42,
        method: 'tools/call',
        params: {
          name: 'call',
          arguments: {
            tool: 'task.finish',
            input: {},
            taskSession: 'tsk_finish_owner',
          },
        },
      }),
    }));
    expect(finish.status).toBe(200);
    expect(upstreams).toEqual(['https://home.connector.test/mcp']);
    await expect(store.byWorkspaceTaskAffinity({
      accountId,
      workspaceHost,
      taskSession: 'tsk_finish_owner',
    })).resolves.toBeUndefined();

    const after = await handler(new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 43,
        method: 'tools/call',
        params: {
          name: 'call',
          arguments: {
            tool: 'fs.read',
            input: { path: 'README.md' },
            taskSession: 'tsk_finish_owner',
          },
        },
      }),
    }));
    expect(after.status).toBe(200);
    expect(upstreams).toEqual([
      'https://home.connector.test/mcp',
      'https://member.connector.test/mcp',
    ]);
  });

  it('should keep task affinity when task.finish fails', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedWorkspace(store);
    await authorizeWorkspace(store, 'central-task-finish-fail-token', {
      scopes: ['route:/mcp:read', 'mcp:call'],
    });
    await store.claimWorkspaceTaskAffinity({
      accountId,
      workspaceId,
      workspaceHost,
      taskSession: 'tsk_finish_fail',
      ownerNodeId: 'node-home',
      createdAt: baseNow,
      updatedAt: baseNow,
    });
    const db = createInMemoryWorkspaceRouteD1();
    await seedRoutes(db);
    const upstreams: string[] = [];
    let requestCount = 0;
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => baseNow,
      workspaceRouteRegistry: db,
      fetchImpl: async (request) => {
        requestCount += 1;
        const upstream = request instanceof Request ? request : new Request(request);
        upstreams.push(upstream.url);
        const payload = await upstream.clone().json() as { id?: unknown };
        const facade = requestCount === 1
          ? { ok: false, code: 'FAILED', data: null }
          : { ok: true, code: 'OK', data: {} };
        return Response.json({
          jsonrpc: '2.0',
          id: payload.id ?? null,
          result: {
            content: [{ type: 'text', text: JSON.stringify(facade) }],
            isError: facade.ok === false,
          },
        });
      },
    });
    const auth = {
      authorization: 'Bearer central-task-finish-fail-token',
      'content-type': 'application/json',
    };

    const finish = await handler(new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        jsonrpc: '2.0', id: 44, method: 'tools/call',
        params: { name: 'call', arguments: { tool: 'task.finish', input: {}, taskSession: 'tsk_finish_fail' } },
      }),
    }));
    expect(finish.status).toBe(200);
    await expect(store.byWorkspaceTaskAffinity({
      accountId,
      workspaceHost,
      taskSession: 'tsk_finish_fail',
    })).resolves.toMatchObject({ ownerNodeId: 'node-home' });

    const followup = await handler(new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        jsonrpc: '2.0', id: 45, method: 'tools/call',
        params: { name: 'call', arguments: { tool: 'fs.read', input: { path: 'README.md' }, taskSession: 'tsk_finish_fail' } },
      }),
    }));
    expect(followup.status).toBe(200);
    expect(upstreams).toEqual([
      'https://home.connector.test/mcp',
      'https://home.connector.test/mcp',
    ]);
  });

  it('should not bind task affinity when task.start fails', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedWorkspace(store);
    await authorizeWorkspace(store, 'central-task-start-fail-token', {
      scopes: ['route:/mcp:read', 'mcp:call'],
    });
    const db = createInMemoryWorkspaceRouteD1();
    await seedRoutes(db);
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => baseNow,
      workspaceRouteRegistry: db,
      fetchImpl: async () => Response.json({
        jsonrpc: '2.0',
        id: 46,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ok: false,
              code: 'TASK_START_FAILED',
              data: { taskSession: 'tsk_failed_start' },
            }),
          }],
          isError: true,
        },
      }),
    });

    const response = await handler(new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer central-task-start-fail-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 46, method: 'tools/call',
        params: { name: 'call', arguments: { tool: 'task.start', input: { area: 'os', title: 'Fail' } } },
      }),
    }));
    expect(response.status).toBe(200);
    await expect(store.byWorkspaceTaskAffinity({
      accountId,
      workspaceHost,
      taskSession: 'tsk_failed_start',
    })).resolves.toBeUndefined();
  });

  it('should not create task affinity when an unbound taskSession is used by a non-start call', async () => {
    const store = createMemoryDeviceGrantStore();
    await seedWorkspace(store);
    await authorizeWorkspace(store, 'central-unbound-task-token', {
      scopes: ['route:/mcp:read', 'mcp:call'],
    });
    const db = createInMemoryWorkspaceRouteD1();
    await seedRoutes(db);
    const handler = createOsDeviceAuthorityHandler({
      store,
      origin,
      now: () => baseNow,
      workspaceRouteRegistry: db,
      fetchImpl: async (request) => {
        const payload = await (request instanceof Request ? request : new Request(request)).clone().json() as { id?: unknown };
        return Response.json({
          jsonrpc: '2.0',
          id: payload.id ?? null,
          result: {
            content: [{ type: 'text', text: JSON.stringify({ ok: true, code: 'OK', data: {} }) }],
            isError: false,
          },
        });
      },
    });

    const response = await handler(new Request(`${origin}/mcp`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer central-unbound-task-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 47, method: 'tools/call',
        params: { name: 'call', arguments: { tool: 'fs.read', input: { path: 'README.md' }, taskSession: 'tsk_unbound_non_start' } },
      }),
    }));

    expect(response.status).toBe(200);
    await expect(store.byWorkspaceTaskAffinity({
      accountId,
      workspaceHost,
      taskSession: 'tsk_unbound_non_start',
      nowMs: baseNow,
    })).resolves.toBeUndefined();
  });

  it('should preserve the upstream task.start response when affinity bookkeeping fails after execution', async () => {
    for (const mode of ['conflict', 'throw'] as const) {
      const backingStore = createMemoryDeviceGrantStore();
      await seedWorkspace(backingStore);
      await authorizeWorkspace(backingStore, `central-post-upstream-${mode}-token`, {
        scopes: ['route:/mcp:read', 'mcp:call'],
      });
      const affinity = {
        accountId,
        workspaceId,
        workspaceHost,
        taskSession: `tsk_post_upstream_${mode}`,
        ownerNodeId: 'node-member',
        createdAt: baseNow,
        updatedAt: baseNow,
        expiresAt: baseNow + 60_000,
      };
      const store = {
        ...backingStore,
        async claimWorkspaceTaskAffinity() {
          if (mode === 'throw') throw new Error('simulated affinity storage failure');
          return { status: 'conflict' as const, affinity };
        },
      };
      const db = createInMemoryWorkspaceRouteD1();
      await seedRoutes(db);
      const warnings: Array<{ message: string; context: Record<string, unknown> }> = [];
      const handler = createOsDeviceAuthorityHandler({
        store,
        origin,
        now: () => baseNow,
        workspaceRouteRegistry: db,
        operationalLogger: {
          warn: (message, context) => warnings.push({ message, context }),
        },
        fetchImpl: async () => Response.json({
          jsonrpc: '2.0',
          id: 48,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                ok: true,
                code: 'OK',
                data: { taskSession: `tsk_post_upstream_${mode}` },
              }),
            }],
            isError: false,
          },
        }),
      });

      const response = await handler(new Request(`${origin}/mcp`, {
        method: 'POST',
        headers: {
          authorization: `Bearer central-post-upstream-${mode}-token`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 48, method: 'tools/call',
          params: { name: 'call', arguments: { tool: 'task.start', input: { area: 'os', title: 'Post-upstream bookkeeping' } } },
        }),
      }));

      expect(response.status).toBe(200);
      const body = await response.json() as { result?: { content?: Array<{ text?: string }> } };
      expect(body.result?.content?.[0]?.text).toContain(`tsk_post_upstream_${mode}`);
      expect(warnings).toEqual([
        expect.objectContaining({
          message: '[OsDeviceAuthority] Task affinity bookkeeping failed',
          context: expect.objectContaining({
            component: 'os-device-authority',
            operation: 'task-affinity-bookkeeping',
            accountId,
            workspaceId,
            workspaceHost,
            taskSession: `tsk_post_upstream_${mode}`,
            nodeId: 'node-home',
            outcome: mode === 'conflict' ? 'conflict' : 'error',
          }),
        }),
      ]);
    }
  });

  it('keeps OAuth discovery available when the default node is stale while normal MCP routing remains offline', async () => {
    const db = createInMemoryWorkspaceRouteD1();
    await seedRoutes(db, baseNow - heartbeatTtlMs * 4);
    const router = createWorkspaceCloudflareEdgeRouter({
      registry: createWorkspaceCloudflareD1RouteRegistry(db),
      now: () => baseNow,
      fetchUpstream: async () => {
        throw new Error('offline discovery must not reach a connector');
      },
    });

    const protectedResource = await router.fetch(
      new Request(
        `https://${workspaceHost}/.well-known/oauth-protected-resource`,
      ),
    );
    expect(protectedResource.status).toBe(200);
    await expect(protectedResource.json()).resolves.toMatchObject({
      resource: `https://${workspaceHost}/mcp`,
      authorization_servers: ['https://os.consuelohq.com'],
    });

    const authorizationServer = await router.fetch(
      new Request(
        `https://${workspaceHost}/.well-known/oauth-authorization-server`,
      ),
    );
    expect(authorizationServer.status).toBe(200);
    await expect(authorizationServer.json()).resolves.toMatchObject({
      issuer: 'https://os.consuelohq.com',
    });

    const mcp = await router.fetch(
      new Request(`https://${workspaceHost}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
    );
    expect(mcp.status).toBe(503);
    await expect(mcp.json()).resolves.toMatchObject({
      error: { code: 'WORKSPACE_NODE_OFFLINE' },
    });
  });
});
