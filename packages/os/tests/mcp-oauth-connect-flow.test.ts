import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type WorkspaceMcpApprovedConnectorBinding = {
  workspaceId: string;
  connectorId: string;
  deviceId: string;
  subjectId: string;
  subjectEmail: string;
  capabilities: string[];
  status: 'active' | 'disabled' | 'revoked';
  approvedAt: string;
};

type WorkspaceMcpConnectionAuthContext = {
  workspaceId: string;
  hostname: string;
  connectorId: string;
};

type WorkspaceMcpConnectionAuthHandler = {
  fetch: (request: Request, context: WorkspaceMcpConnectionAuthContext) => Promise<Response | null>;
};

type WorkspaceMcpConnectionCredentialStore = {
  validate: (input: {
    credential: string;
    workspaceId: string;
    connectorId: string;
    requiredScope: string;
    now: string;
  }) => Promise<
    | {
        allowed: true;
        credentialId: string;
        workspaceId: string;
        connectorId: string;
        subjectId: string;
        scopes: string[];
      }
    | { allowed: false; status: 401 | 403; errorCode: string }
  >;
};

type WorkspaceMcpConnectionAuthContract = {
  createWorkspaceMcpConnectionAuthHandler: (input: {
    approvedBindings: {
      findApprovedBinding: (input: {
        workspaceId: string;
        connectorId: string;
        subjectId: string;
        now: string;
      }) => Promise<WorkspaceMcpApprovedConnectorBinding | null>;
    };
    credentials: ReturnType<WorkspaceMcpConnectionAuthContract['createWorkspaceMcpConnectionCredentialStore']>;
    oauthStateKv: WorkspaceMcpKv;
    googleOAuthClientId: string;
    googleOAuthClientSecret: string;
    googleIdentity?: (input: { code: string; redirectUri: string }) => Promise<{
      sub: string;
      email: string;
      emailVerified: boolean;
    }>;
    now?: () => string;
  }) => WorkspaceMcpConnectionAuthHandler;
  createWorkspaceMcpConnectionCredentialStore: (input: {
    kv: WorkspaceMcpKv;
    randomCredential?: () => string;
    now?: () => string;
  }) => WorkspaceMcpConnectionCredentialStore & {
    list: (input: { workspaceId: string; connectorId: string; subjectId: string }) => Promise<Array<{ credentialId: string; status: string; deviceId: string; scopes: string[] }>>;
  };
  createWorkspaceMcpApprovedConnectorBindingStore: (input: { kv: WorkspaceMcpKv }) => {
    findApprovedBinding: (input: {
      workspaceId: string;
      connectorId: string;
      subjectId: string;
      now: string;
    }) => Promise<WorkspaceMcpApprovedConnectorBinding | null>;
  };
  workspaceMcpApprovedBindingStorageKey: (input: {
    workspaceId: string;
    connectorId: string;
    subjectId: string;
  }) => string;
};

type WorkspaceMcpKv = {
  get: <T = unknown>(key: string, options?: unknown) => Promise<T | null>;
  put: (key: string, value: string, options?: unknown) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

const runContract = process.env.CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS === '1';
const contractDescribe = runContract ? describe : describe.skip;

const createMemoryKv = (): WorkspaceMcpKv & { entries: Map<string, string> } => {
  const entries = new Map<string, string>();

  return {
    entries,
    async get<T = unknown>(key: string, options?: unknown): Promise<T | null> {
      const value = entries.get(key);
      if (value === undefined) return null;
      const type = typeof options === 'object' && options !== null && 'type' in options
        ? (options as { type?: unknown }).type
        : undefined;
      return (type === 'json' ? JSON.parse(value) : value) as T;
    },
    async put(key: string, value: string): Promise<void> {
      entries.set(key, value);
    },
    async delete(key: string): Promise<void> {
      entries.delete(key);
    },
  };
};

async function loadWorkspaceMcpConnectionAuthContract(): Promise<WorkspaceMcpConnectionAuthContract> {
  const modulePath = pathToFileURL(
    join(process.cwd(), 'scripts', 'lib', 'workspace-mcp-connection-auth.ts'),
  ).href;
  const module = (await import(modulePath)) as Partial<WorkspaceMcpConnectionAuthContract>;
  const requiredExports: Array<keyof WorkspaceMcpConnectionAuthContract> = [
    'createWorkspaceMcpConnectionAuthHandler',
    'createWorkspaceMcpConnectionCredentialStore',
    'createWorkspaceMcpApprovedConnectorBindingStore',
    'workspaceMcpApprovedBindingStorageKey',
  ];
  const missingExports = requiredExports.filter((name) => typeof module[name] !== 'function');

  if (missingExports.length > 0) {
    throw new Error(`MCP connection auth module is missing exports: ${missingExports.join(', ')}`);
  }

  return module as WorkspaceMcpConnectionAuthContract;
}

const context: WorkspaceMcpConnectionAuthContext = {
  workspaceId: 'workspace_123',
  hostname: 'kokayi.consuelohq.com',
  connectorId: 'connector_123',
};

contractDescribe('MCP OAuth connection flow contract', () => {
  it('issues a persistent scoped MCP credential only after Google maps to an approved workspace/device/connector binding', async () => {
    const mcp = await loadWorkspaceMcpConnectionAuthContract();
    const credentialKv = createMemoryKv();
    const approvedKv = createMemoryKv();
    const oauthStateKv = createMemoryKv();
    const credentials = mcp.createWorkspaceMcpConnectionCredentialStore({
      kv: credentialKv,
      randomCredential: () => 'mcp_live_persistent_fixture',
      now: () => '2026-06-15T00:00:00.000Z',
    });
    await approvedKv.put(mcp.workspaceMcpApprovedBindingStorageKey({
      workspaceId: 'workspace_123',
      connectorId: 'connector_123',
      subjectId: 'google:sub_123',
    }), JSON.stringify({
      workspaceId: 'workspace_123',
      connectorId: 'connector_123',
      deviceId: 'device_mac_123',
      subjectId: 'google:sub_123',
      subjectEmail: 'owner@example.com',
      capabilities: ['tools:list', 'tools:call'],
      status: 'active',
      approvedAt: '2026-06-14T23:00:00.000Z',
    } satisfies WorkspaceMcpApprovedConnectorBinding));
    const handler = mcp.createWorkspaceMcpConnectionAuthHandler({
      approvedBindings: mcp.createWorkspaceMcpApprovedConnectorBindingStore({ kv: approvedKv }),
      credentials,
      oauthStateKv,
      googleOAuthClientId: 'google-client-id',
      googleOAuthClientSecret: 'google-client-secret',
      googleIdentity: async () => ({ sub: 'sub_123', email: 'owner@example.com', emailVerified: true }),
      now: () => '2026-06-15T00:00:00.000Z',
    });

    const start = await handler.fetch(new Request('https://kokayi.consuelohq.com/mcp/oauth/start'), context);
    expect(start?.status).toBe(302);
    const googleUrl = new URL(start?.headers.get('location') ?? '');
    const state = googleUrl.searchParams.get('state') ?? '';
    expect(googleUrl.hostname).toBe('accounts.google.com');
    expect(googleUrl.searchParams.get('client_id')).toBe('google-client-id');
    expect(state).toMatch(/^mcp_state_/);

    const callback = await handler.fetch(new Request(`https://kokayi.consuelohq.com/mcp/oauth/callback?state=${encodeURIComponent(state)}&code=google-code`), context);
    expect(callback?.status).toBe(201);
    const body = await callback?.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      token_type: 'bearer',
      workspace_id: 'workspace_123',
      connector_id: 'connector_123',
      device_id: 'device_mac_123',
      subject_id: 'google:sub_123',
      scopes: ['route:/mcp:access'],
      capabilities: ['tools:list', 'tools:call'],
    });
    expect(body).toHaveProperty('mcp_connection_credential', 'mcp_live_persistent_fixture');
    expect(body).not.toHaveProperty('expires_at');

    await expect(credentials.validate({
      credential: 'mcp_live_persistent_fixture',
      workspaceId: 'workspace_123',
      connectorId: 'connector_123',
      requiredScope: 'route:/mcp:access',
      now: '2026-06-15T00:01:00.000Z',
    })).resolves.toMatchObject({ allowed: true, subjectId: 'google:sub_123' });
  });

  it('does not let Google OAuth approve a device or connector by itself', async () => {
    const mcp = await loadWorkspaceMcpConnectionAuthContract();
    const handler = mcp.createWorkspaceMcpConnectionAuthHandler({
      approvedBindings: {
        async findApprovedBinding() {
          return null;
        },
      },
      credentials: mcp.createWorkspaceMcpConnectionCredentialStore({
        kv: createMemoryKv(),
        randomCredential: () => 'mcp_should_not_issue',
      }),
      oauthStateKv: createMemoryKv(),
      googleOAuthClientId: 'google-client-id',
      googleOAuthClientSecret: 'google-client-secret',
      googleIdentity: async () => ({ sub: 'unapproved_sub', email: 'owner@example.com', emailVerified: true }),
      now: () => '2026-06-15T00:00:00.000Z',
    });

    const start = await handler.fetch(new Request('https://kokayi.consuelohq.com/mcp/oauth/start'), context);
    const state = new URL(start?.headers.get('location') ?? '').searchParams.get('state') ?? '';
    const callback = await handler.fetch(new Request(`https://kokayi.consuelohq.com/mcp/oauth/callback?state=${encodeURIComponent(state)}&code=google-code`), context);

    expect(callback?.status).toBe(403);
    await expect(callback?.json()).resolves.toMatchObject({
      error: { code: 'WORKSPACE_MCP_CONNECTOR_APPROVAL_REQUIRED' },
    });
  });

  it('supports list, rotate, revoke, and audit lifecycle APIs without returning stored secrets in lists or audit', async () => {
    const mcp = await loadWorkspaceMcpConnectionAuthContract();
    const credentialKv = createMemoryKv();
    const approvedKv = createMemoryKv();
    const oauthStateKv = createMemoryKv();
    let issued = 0;
    const credentials = mcp.createWorkspaceMcpConnectionCredentialStore({
      kv: credentialKv,
      randomCredential: () => (issued++ === 0 ? 'mcp_first_secret' : 'mcp_rotated_secret'),
      now: () => '2026-06-15T00:00:00.000Z',
    });
    await approvedKv.put(mcp.workspaceMcpApprovedBindingStorageKey({
      workspaceId: 'workspace_123',
      connectorId: 'connector_123',
      subjectId: 'google:sub_123',
    }), JSON.stringify({
      workspaceId: 'workspace_123',
      connectorId: 'connector_123',
      deviceId: 'device_mac_123',
      subjectId: 'google:sub_123',
      subjectEmail: 'owner@example.com',
      capabilities: ['tools:list'],
      status: 'active',
      approvedAt: '2026-06-14T23:00:00.000Z',
    } satisfies WorkspaceMcpApprovedConnectorBinding));
    const handler = mcp.createWorkspaceMcpConnectionAuthHandler({
      approvedBindings: mcp.createWorkspaceMcpApprovedConnectorBindingStore({ kv: approvedKv }),
      credentials,
      oauthStateKv,
      googleOAuthClientId: 'google-client-id',
      googleOAuthClientSecret: 'google-client-secret',
      googleIdentity: async () => ({ sub: 'sub_123', email: 'owner@example.com', emailVerified: true }),
      now: () => '2026-06-15T00:00:00.000Z',
    });
    const start = await handler.fetch(new Request('https://kokayi.consuelohq.com/mcp/oauth/start'), context);
    const state = new URL(start?.headers.get('location') ?? '').searchParams.get('state') ?? '';
    const issuedResponse = await handler.fetch(new Request(`https://kokayi.consuelohq.com/mcp/oauth/callback?state=${encodeURIComponent(state)}&code=google-code`), context);
    const issuedBody = await issuedResponse?.json() as { credential_id: string; mcp_connection_credential: string };

    const list = await handler.fetch(new Request('https://kokayi.consuelohq.com/mcp/connections', {
      headers: { authorization: `Bearer ${issuedBody.mcp_connection_credential}` },
    }), context);
    expect(list?.status).toBe(200);
    const listBody = await list?.json() as { connections: Array<Record<string, unknown>> };
    expect(listBody.connections).toHaveLength(1);
    expect(JSON.stringify(listBody)).toContain(issuedBody.credential_id);
    expect(JSON.stringify(listBody)).not.toContain(issuedBody.mcp_connection_credential);

    const rotate = await handler.fetch(new Request(`https://kokayi.consuelohq.com/mcp/connections/${issuedBody.credential_id}/rotate`, {
      method: 'POST',
      headers: { authorization: `Bearer ${issuedBody.mcp_connection_credential}` },
    }), context);
    expect(rotate?.status).toBe(201);
    const rotateBody = await rotate?.json() as { credential_id: string; mcp_connection_credential: string };
    expect(rotateBody.mcp_connection_credential).toBe('mcp_rotated_secret');
    await expect(credentials.validate({ credential: issuedBody.mcp_connection_credential, workspaceId: 'workspace_123', connectorId: 'connector_123', requiredScope: 'route:/mcp:access', now: '2026-06-15T00:02:00.000Z' })).resolves.toMatchObject({ allowed: false, errorCode: 'WORKSPACE_MCP_CREDENTIAL_ROTATED' });
    await expect(credentials.validate({ credential: rotateBody.mcp_connection_credential, workspaceId: 'workspace_123', connectorId: 'connector_123', requiredScope: 'route:/mcp:access', now: '2026-06-15T00:02:00.000Z' })).resolves.toMatchObject({ allowed: true });

    const audit = await handler.fetch(new Request(`https://kokayi.consuelohq.com/mcp/connections/${rotateBody.credential_id}/audit`, {
      headers: { authorization: `Bearer ${rotateBody.mcp_connection_credential}` },
    }), context);
    expect(audit?.status).toBe(200);
    const auditText = await audit?.text() ?? '';
    expect(auditText).toMatch(/issued|rotated/);
    expect(auditText).not.toMatch(/mcp_first_secret|mcp_rotated_secret/);

    const revoke = await handler.fetch(new Request(`https://kokayi.consuelohq.com/mcp/connections/${rotateBody.credential_id}/revoke`, {
      method: 'POST',
      headers: { authorization: `Bearer ${rotateBody.mcp_connection_credential}` },
    }), context);
    expect(revoke?.status).toBe(200);
    await expect(revoke?.json()).resolves.toMatchObject({ revoked: true, credential_id: rotateBody.credential_id });
    await expect(credentials.validate({ credential: rotateBody.mcp_connection_credential, workspaceId: 'workspace_123', connectorId: 'connector_123', requiredScope: 'route:/mcp:access', now: '2026-06-15T00:03:00.000Z' })).resolves.toMatchObject({ allowed: false, errorCode: 'WORKSPACE_MCP_CREDENTIAL_REVOKED' });
  });
});
