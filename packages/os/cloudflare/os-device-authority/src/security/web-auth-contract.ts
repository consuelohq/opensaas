export type WorkspaceMembership = {
  workspaceId: string;
  workspaceHost: string;
};

export type MembershipChoice =
  | { kind: 'none' }
  | { kind: 'single'; workspaceId: string; workspaceHost: string }
  | { kind: 'multiple'; count: number };

export function resolveMembershipChoice(
  memberships: readonly WorkspaceMembership[],
): MembershipChoice {
  if (memberships.length === 0) return { kind: 'none' };
  if (memberships.length === 1) {
    const [membership] = memberships;
    return {
      kind: 'single',
      workspaceId: membership.workspaceId,
      workspaceHost: membership.workspaceHost,
    };
  }
  return { kind: 'multiple', count: memberships.length };
}

export function normalizeAuthReturnPath(value: string | null | undefined): string {
  const candidate = value?.trim() ?? '';
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return '/';
  }
  try {
    const parsed = new URL(candidate, 'https://return-path.invalid');
    return parsed.origin === 'https://return-path.invalid'
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : '/';
  } catch {
    return '/';
  }
}

type WorkspaceHandoffRecord = {
  accountId: string;
  workspaceId: string;
  workspaceHost: string;
  returnPath: string;
  expiresAt: number;
};

export type WorkspaceHandoffConsumeResult =
  | ({ ok: true } & WorkspaceHandoffRecord)
  | { ok: false; error: 'invalid_handoff' };

export function createMemoryWorkspaceHandoffStore() {
  const handoffs = new Map<string, WorkspaceHandoffRecord>();
  return {
    async issue(input: {
      accountId: string;
      workspaceId: string;
      workspaceHost: string;
      returnPath: string;
      nowMs: number;
      ttlMs: number;
    }): Promise<{ token: string; expiresAt: number }> {
      const token = `handoff_${crypto.randomUUID().replaceAll('-', '')}`;
      const expiresAt = input.nowMs + input.ttlMs;
      handoffs.set(token, {
        accountId: input.accountId,
        workspaceId: input.workspaceId,
        workspaceHost: input.workspaceHost.toLowerCase(),
        returnPath: normalizeAuthReturnPath(input.returnPath),
        expiresAt,
      });
      return { token, expiresAt };
    },
    async consume(input: {
      token: string;
      audience: string;
      nowMs: number;
    }): Promise<WorkspaceHandoffConsumeResult> {
      const record = handoffs.get(input.token);
      if (!record) return { ok: false, error: 'invalid_handoff' };
      if (input.nowMs >= record.expiresAt) {
        handoffs.delete(input.token);
        return { ok: false, error: 'invalid_handoff' };
      }
      if (record.workspaceHost !== input.audience.toLowerCase()) {
        return { ok: false, error: 'invalid_handoff' };
      }
      handoffs.delete(input.token);
      return { ok: true, ...record };
    },
  };
}

export function buildWorkspaceSessionCookie(input: {
  value: string;
  maxAgeSeconds: number;
}): string {
  return [
    `__Host-consuelo_os_session=${encodeURIComponent(input.value)}`,
    'Path=/',
    `Max-Age=${Math.max(0, Math.floor(input.maxAgeSeconds))}`,
    'Secure',
    'HttpOnly',
    'SameSite=Lax',
  ].join('; ');
}

export type UniversalAuthRouteContract = {
  method: 'GET' | 'POST' | 'ALL';
  path: string;
  access:
    | 'public-preauth'
    | 'public-oauth'
    | 'public-health'
    | 'public-oauth-metadata'
    | 'authority-session'
    | 'public-handoff-consumer'
    | 'workspace-session'
    | 'preserved-device-oauth'
    | 'preserved-mcp-oauth'
    | 'preserved-bearer'
    | 'public-sanitized-status'
    | 'public-signed-webhook'
    | 'node-bootstrap-bearer';
  owner: 'worker-14' | 'existing';
};

export const UNIVERSAL_AUTH_ROUTE_MATRIX: readonly UniversalAuthRouteContract[] = [
  { method: 'GET', path: '/', access: 'public-preauth', owner: 'worker-14' },
  { method: 'ALL', path: '/health', access: 'public-health', owner: 'existing' },
  { method: 'ALL', path: '/.well-known/oauth-authorization-server', access: 'public-oauth-metadata', owner: 'existing' },
  { method: 'ALL', path: '/.well-known/oauth-protected-resource', access: 'public-oauth-metadata', owner: 'existing' },
  { method: 'ALL', path: '/.well-known/oauth-protected-resource/mcp', access: 'public-oauth-metadata', owner: 'existing' },
  { method: 'GET', path: '/login/google/start', access: 'public-oauth', owner: 'existing' },
  { method: 'GET', path: '/login/google/callback', access: 'public-oauth', owner: 'existing' },
  { method: 'GET', path: '/auth/workspaces', access: 'authority-session', owner: 'worker-14' },
  { method: 'POST', path: '/auth/handoff', access: 'authority-session', owner: 'worker-14' },
  { method: 'GET', path: '/auth/consume', access: 'public-handoff-consumer', owner: 'worker-14' },
  { method: 'POST', path: '/auth/logout', access: 'workspace-session', owner: 'worker-14' },
  { method: 'GET', path: '/auth/synthetic/checkout', access: 'authority-session', owner: 'worker-14' },
  { method: 'POST', path: '/auth/synthetic/checkout/start', access: 'authority-session', owner: 'worker-14' },
  { method: 'GET', path: '/auth/synthetic/checkout/result', access: 'authority-session', owner: 'worker-14' },
  { method: 'POST', path: '/webhooks/stripe', access: 'public-signed-webhook', owner: 'worker-14' },
  { method: 'POST', path: '/webhooks/stripe-synthetic', access: 'public-signed-webhook', owner: 'worker-14' },
  { method: 'GET', path: '/login/device', access: 'preserved-device-oauth', owner: 'existing' },
  { method: 'POST', path: '/login/device/code', access: 'preserved-device-oauth', owner: 'existing' },
  { method: 'POST', path: '/login/device/workspace', access: 'preserved-device-oauth', owner: 'existing' },
  { method: 'POST', path: '/login/device/approve', access: 'preserved-device-oauth', owner: 'existing' },
  { method: 'POST', path: '/login/oauth/access_token', access: 'preserved-device-oauth', owner: 'existing' },
  { method: 'ALL', path: '/oauth/authorize', access: 'preserved-mcp-oauth', owner: 'existing' },
  { method: 'ALL', path: '/oauth/google/callback', access: 'preserved-mcp-oauth', owner: 'existing' },
  { method: 'ALL', path: '/oauth/token', access: 'preserved-mcp-oauth', owner: 'existing' },
  { method: 'ALL', path: '/oauth/revoke', access: 'preserved-mcp-oauth', owner: 'existing' },
  { method: 'ALL', path: '/oauth/introspect', access: 'preserved-mcp-oauth', owner: 'existing' },
  { method: 'ALL', path: '/mcp', access: 'preserved-bearer', owner: 'existing' },
  { method: 'ALL', path: '/mcp/*', access: 'preserved-bearer', owner: 'existing' },
  { method: 'GET', path: '/workspace/agents', access: 'public-sanitized-status', owner: 'existing' },
  { method: 'POST', path: '/workspace/agents', access: 'node-bootstrap-bearer', owner: 'existing' },
  { method: 'GET', path: '/workspace/nodes', access: 'preserved-bearer', owner: 'existing' },
  { method: 'POST', path: '/workspace/nodes/default', access: 'preserved-bearer', owner: 'existing' },
  { method: 'POST', path: '/workspace/nodes/heartbeat', access: 'node-bootstrap-bearer', owner: 'existing' },
  { method: 'ALL', path: '/workspace/nodes/*', access: 'preserved-bearer', owner: 'existing' },
] as const;
