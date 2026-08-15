import { mkdirSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createMemoryDeviceGrantStore,
  DurableStore,
} from '../cloudflare/os-device-authority/src/stores';
import { proxyCentralMcpRequest } from '../cloudflare/os-device-authority/src/services/mcp-proxy';
import { hash } from '../cloudflare/os-device-authority/src/utils';
import { getInputSchema } from '../scripts/lib/facade/schemas';
import {
  handleMcpGatewayJsonRpc,
  resolveMcpGatewayRequiredScope,
} from '../scripts/lib/mcp-gateway';
import { inspectMcpNodeRoutingBody } from '../scripts/lib/mcp-node-routing';
import { MCP_ROUTE_SOURCE_HEADER } from '../scripts/lib/mcp-node-routing';
import { createDefaultNodeYamlConfig, resolveConsueloHomeLayout, writeYamlConfig } from '../scripts/lib/consuelo-home';
import { createWorkSession, readWorkSession } from '../scripts/lib/work-session';
import {
  createInMemoryWorkspaceRouteD1,
  migrateWorkspaceRouteD1,
  upsertWorkspaceHostnameInD1,
} from '../scripts/lib/workspace-cloudflare-d1-route-registry';
import { toolPackage } from '../tools/task-lifecycle/manifest';
import { removeSafeTempDir } from './safe-temp-cleanup';

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) removeSafeTempDir(root, 'consuelo-session-foundation-');
  }
});

function callBody(argumentsInput: Record<string, unknown>): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'call',
      arguments: {
        tool: 'task.current',
        input: {},
        ...argumentsInput,
      },
    },
  });
}

describe('session.start foundation', () => {
  it('should publish session.start when retaining task.start as a compatibility alias', () => {
    const definitions = new Map(toolPackage.definitions.map((definition) => [definition.name, definition]));
    expect(definitions.has('session.start')).toBe(true);
    expect(definitions.has('task.start')).toBe(true);
    expect(definitions.get('session.start')).toMatchObject({
      methodPath: ['session', 'start'],
      inputSchema: 'SessionStartInput',
      sessionRequired: false,
      workflowRole: 'task.start',
      description: expect.stringMatching(/canonical/i),
    });
    expect(definitions.get('task.start')).toMatchObject({
      description: expect.stringMatching(/compatibility alias/i),
    });
  });

  it('should validate task and work constructor inputs when parsing session.start', () => {
    const schema = getInputSchema('SessionStartInput');
    expect(schema).not.toBeNull();
    expect(schema?.safeParse({ kind: 'task', area: 'workspace-agent', title: 'example' }).success).toBe(true);
    expect(schema?.safeParse({ kind: 'work', path: '/tmp/example-work' }).success).toBe(true);
    expect(schema?.safeParse({ kind: 'work' }).success).toBe(false);
    expect(schema?.safeParse({ kind: 'task' }).success).toBe(false);
  });

  it('should create metadata-only work sessions when starting ordinary work', () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-session-foundation-'));
    tempRoots.push(home);
    const workPath = join(home, 'Raycast Extension');
    mkdirSync(workPath, { recursive: true });
    const layout = resolveConsueloHomeLayout(home);
    writeYamlConfig(
      layout.nodeConfigPath,
      createDefaultNodeYamlConfig({
        nodeId: 'node_test_owner',
        nodeName: 'Test Mac',
        workspaceId: 'workspace_test',
      }),
      false,
    );

    const metadata = createWorkSession({
      home,
      path: workPath,
      now: () => new Date('2026-08-15T01:00:00.000Z'),
      randomUUID: () => '12345678-1234-4234-9234-123456789abc',
    });

    expect(metadata).toMatchObject({
      version: 1,
      sessionKind: 'work',
      workSession: 'wrk_1234567812344234',
      ownerNodeId: 'node_test_owner',
      createdAt: '2026-08-15T01:00:00.000Z',
      updatedAt: '2026-08-15T01:00:00.000Z',
    });
    expect(realpathSync(metadata.path)).toBe(realpathSync(workPath));
    expect(readWorkSession({ home, workSession: metadata.workSession })).toEqual(metadata);
    expect(JSON.parse(readFileSync(metadata.metadataPath, 'utf8'))).toMatchObject({
      workSession: metadata.workSession,
      path: metadata.path,
    });
  });

  it('should preserve legacy task affinity reads when node affinity is generalized', async () => {
    const store = createMemoryDeviceGrantStore();
    const base = {
      accountId: 'account_test',
      workspaceId: 'workspace_test',
      workspaceHost: 'workspace-test.consuelohq.com',
      ownerNodeId: 'node_owner',
      createdAt: 1_000,
      updatedAt: 1_000,
      expiresAt: 10_000,
    };

    await expect(store.claimWorkspaceSessionAffinity({
      ...base,
      sessionKind: 'work',
      sessionId: 'wrk_test',
    })).resolves.toMatchObject({ status: 'created' });
    await expect(store.byWorkspaceSessionAffinity({
      accountId: base.accountId,
      workspaceHost: base.workspaceHost,
      sessionKind: 'work',
      sessionId: 'wrk_test',
      nowMs: 2_000,
    })).resolves.toMatchObject({ ownerNodeId: 'node_owner', sessionKind: 'work', sessionId: 'wrk_test' });

    await store.claimWorkspaceTaskAffinity({
      ...base,
      taskSession: 'tsk_legacy',
    });
    await expect(store.byWorkspaceSessionAffinity({
      accountId: base.accountId,
      workspaceHost: base.workspaceHost,
      sessionKind: 'task',
      sessionId: 'tsk_legacy',
      nowMs: 2_000,
    })).resolves.toMatchObject({ ownerNodeId: 'node_owner', sessionKind: 'task', sessionId: 'tsk_legacy' });
  });

  it('should persist work-session affinity when using the durable store contract', async () => {
    const values = new Map<string, unknown>();
    const storage = {
      async get<T>(key: string): Promise<T | undefined> {
        return values.get(key) as T | undefined;
      },
      async put<T>(key: string, value: T): Promise<void> {
        values.set(key, value);
      },
      async delete(key: string): Promise<boolean> {
        return values.delete(key);
      },
      async list<T>(input?: { prefix?: string }): Promise<Map<string, T>> {
        const entries = [...values.entries()]
          .filter(([key]) => !input?.prefix || key.startsWith(input.prefix))
          .map(([key, value]) => [key, value as T] as const);
        return new Map(entries);
      },
      async transaction<T>(callback: (transaction: typeof storage) => Promise<T>): Promise<T> {
        return callback(storage);
      },
    };
    const store = new DurableStore(storage);
    const affinity = {
      accountId: 'account_durable',
      workspaceId: 'workspace_durable',
      workspaceHost: 'durable.consuelohq.com',
      sessionKind: 'work' as const,
      sessionId: 'wrk_durable',
      ownerNodeId: 'node_durable',
      createdAt: 1_000,
      updatedAt: 1_000,
      expiresAt: 10_000,
    };

    await expect(store.claimWorkspaceSessionAffinity(affinity)).resolves.toMatchObject({
      status: 'created',
      affinity: { sessionId: 'wrk_durable', ownerNodeId: 'node_durable' },
    });
    await expect(store.byWorkspaceSessionAffinity({
      accountId: affinity.accountId,
      workspaceHost: affinity.workspaceHost,
      sessionKind: 'work',
      sessionId: affinity.sessionId,
      nowMs: 2_000,
    })).resolves.toMatchObject({ sessionId: 'wrk_durable', ownerNodeId: 'node_durable' });
    await expect(store.releaseWorkspaceSessionAffinity({
      accountId: affinity.accountId,
      workspaceHost: affinity.workspaceHost,
      sessionKind: 'work',
      sessionId: affinity.sessionId,
      ownerNodeId: affinity.ownerNodeId,
    })).resolves.toBe(true);
    await expect(store.byWorkspaceSessionAffinity({
      accountId: affinity.accountId,
      workspaceHost: affinity.workspaceHost,
      sessionKind: 'work',
      sessionId: affinity.sessionId,
    })).resolves.toBeUndefined();
  });

  it('should reject mixed session authority when inspecting a top-level work session', () => {
    expect(inspectMcpNodeRoutingBody(callBody({ workSession: 'wrk_test' }))).toMatchObject({
      ok: true,
      workSession: 'wrk_test',
    });
    expect(inspectMcpNodeRoutingBody(callBody({ taskSession: 'tsk_test', workSession: 'wrk_test' }))).toMatchObject({
      ok: false,
      code: 'INVALID_SESSION_ROUTE',
    });
  });

  it('should pass workSession into the local facade call when task authority is absent', async () => {
    const seen: Array<{ tool: string; input: Record<string, unknown> }> = [];
    const response = await handleMcpGatewayJsonRpc(callBody({ workSession: 'wrk_test' }), {
      getSteering: async () => 'steering',
      executeFacadeTool: async (tool, input) => {
        seen.push({ tool, input });
        return { ok: true };
      },
    });
    expect(response).toMatchObject({ result: { isError: false } });
    expect(seen).toEqual([{ tool: 'task.current', input: { workSession: 'wrk_test' } }]);

    expect(resolveMcpGatewayRequiredScope(callBody({
      taskSession: 'tsk_test',
      workSession: 'wrk_test',
    }))).toMatchObject({ ok: false, status: 400 });
  });

  it('should route a work session through its owner node when the central MCP edge resolves affinity', async () => {
    const origin = 'https://os.consuelohq.com';
    const workspaceHost = 'session-foundation.consuelohq.com';
    const accountId = 'google:session-foundation-user';
    const workspaceId = 'workspace_session_foundation';
    const token = 'coa_session_foundation';
    const nowMs = Date.parse('2026-08-15T01:00:00.000Z');
    const store = createMemoryDeviceGrantStore();
    await store.putMcpOAuthAccessToken({
      tokenHash: await hash(token),
      clientId: 'chatgpt-consuelo-os',
      scope: 'route:/mcp:read mcp:call',
      scopes: ['route:/mcp:read', 'mcp:call'],
      resource: `${origin}/mcp`,
      workspaceHost,
      accountId,
      email: 'session-foundation@example.com',
      issuedAt: nowMs,
      expiresAt: nowMs + 60_000,
    });
    await store.claimWorkspaceSessionAffinity({
      accountId,
      workspaceId,
      workspaceHost,
      sessionKind: 'work',
      sessionId: 'wrk_edge_owner',
      ownerNodeId: 'node-member',
      createdAt: nowMs,
      updatedAt: nowMs,
      expiresAt: nowMs + 60_000,
    });

    const routeRegistry = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(routeRegistry);
    await upsertWorkspaceHostnameInD1(routeRegistry, {
      workspaceId,
      workspaceSlug: 'session-foundation',
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
          lastSeenAt: nowMs,
          heartbeatTtlMs: 60_000,
        },
        {
          nodeId: 'node-member',
          connectorId: 'connector_node_member',
          connectorStatus: 'connected',
          tunnelOriginUrl: 'https://member.connector.test',
          state: 'active',
          lastSeenAt: nowMs,
          heartbeatTtlMs: 60_000,
        },
      ],
      routes: [{
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
      }],
    } as Parameters<typeof upsertWorkspaceHostnameInD1>[1]);

    let forwardedUrl = '';
    let routeSource = '';
    const response = await proxyCentralMcpRequest({
      request: new Request(`${origin}/mcp`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: callBody({ workSession: 'wrk_edge_owner' }),
      }),
      store,
      origin,
      nowMs,
      routeRegistry,
      fetchImpl: async (request) => {
        forwardedUrl = request.url;
        routeSource = request.headers.get(MCP_ROUTE_SOURCE_HEADER) ?? '';
        return new Response('{}', { status: 200 });
      },
    });

    expect(response.status).toBe(200);
    expect(forwardedUrl).toBe('https://member.connector.test/mcp');
    expect(routeSource).toBe('work');
  });

  it('should claim work-session affinity when session.start succeeds', async () => {
    const origin = 'https://os.consuelohq.com';
    const workspaceHost = 'session-claim.consuelohq.com';
    const accountId = 'google:session-claim-user';
    const workspaceId = 'workspace_session_claim';
    const token = 'coa_session_claim';
    const nowMs = Date.parse('2026-08-15T01:05:00.000Z');
    const store = createMemoryDeviceGrantStore();
    await store.putMcpOAuthAccessToken({
      tokenHash: await hash(token),
      clientId: 'chatgpt-consuelo-os',
      scope: 'route:/mcp:read mcp:call',
      scopes: ['route:/mcp:read', 'mcp:call'],
      resource: `${origin}/mcp`,
      workspaceHost,
      accountId,
      email: 'session-claim@example.com',
      issuedAt: nowMs,
      expiresAt: nowMs + 60_000,
    });
    const routeRegistry = createInMemoryWorkspaceRouteD1();
    await migrateWorkspaceRouteD1(routeRegistry);
    await upsertWorkspaceHostnameInD1(routeRegistry, {
      workspaceId,
      workspaceSlug: 'session-claim',
      hostname: workspaceHost,
      baseDomain: 'consuelohq.com',
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      defaultNodeId: 'node-home',
      nodeTargets: [{
        nodeId: 'node-home',
        connectorId: 'connector_node_home',
        connectorStatus: 'connected',
        tunnelOriginUrl: 'https://home.connector.test',
        state: 'active',
        lastSeenAt: nowMs,
        heartbeatTtlMs: 60_000,
      }],
      routes: [{
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
      }],
    } as Parameters<typeof upsertWorkspaceHostnameInD1>[1]);

    const facadeEnvelope = {
      jsonrpc: '2.0',
      id: 1,
      result: {
        isError: false,
        content: [{
          type: 'text',
          text: JSON.stringify({
            ok: true,
            data: { workSession: 'wrk_claimed_session' },
          }),
        }],
      },
    };
    const response = await proxyCentralMcpRequest({
      request: new Request(`${origin}/mcp`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'call',
            arguments: {
              tool: 'session.start',
              input: { kind: 'work', path: '/tmp/example' },
            },
          },
        }),
      }),
      store,
      origin,
      nowMs,
      routeRegistry,
      fetchImpl: async () => new Response(JSON.stringify(facadeEnvelope), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    });

    expect(response.status).toBe(200);
    await expect(store.byWorkspaceSessionAffinity({
      accountId,
      workspaceHost,
      sessionKind: 'work',
      sessionId: 'wrk_claimed_session',
      nowMs: nowMs + 1,
    })).resolves.toMatchObject({
      workspaceId,
      ownerNodeId: 'node-home',
      sessionKind: 'work',
      sessionId: 'wrk_claimed_session',
    });
  });

  it('should cap MCP workSession identifiers when advertising the call schema', async () => {
    const response = await handleMcpGatewayJsonRpc(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    }), {
      getSteering: async () => 'unused',
      executeFacadeTool: async () => ({ ok: false, code: 'UNUSED' }),
    });
    const tools = (response.result as { tools?: Array<Record<string, unknown>> } | undefined)?.tools ?? [];
    const call = tools.find((tool) => tool.name === 'call') as {
      inputSchema?: { properties?: { workSession?: { maxLength?: number } } };
    } | undefined;
    expect(call?.inputSchema?.properties?.workSession?.maxLength).toBe(240);
  });
});
