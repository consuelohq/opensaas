export type WebSecuritySurface =
  | 'health'
  | 'oauth-metadata'
  | 'device-code'
  | 'google-login'
  | 'google-callback'
  | 'mcp-authorization'
  | 'mcp-oauth'
  | 'mcp-introspection'
  | 'central-mcp'
  | 'workspace-chooser'
  | 'handoff'
  | 'logout'
  | 'launcher'
  | 'gtm'
  | 'traces'
  | 'trace-feed'
  | 'connector-origin'
  | 'route-not-found'
  | 'unsupported-method';

export type WebSecurityRouteContract = {
  surface: WebSecuritySurface;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'ALL';
  path: string;
  authClass:
    | 'public-health'
    | 'public-metadata'
    | 'public-oauth'
    | 'authority-session'
    | 'workspace-session'
    | 'oauth-bearer'
    | 'internal-service'
    | 'signed-edge-hmac'
    | 'none';
  status: {
    success: number;
    unauthenticated?: number;
    invalid?: number;
  };
  headers: readonly string[];
  storage: readonly string[];
  destination:
    | 'device-authority'
    | 'durable-object'
    | 'workspace-edge'
    | 'workspace-connector-private-tunnel'
    | 'local-node-loopback'
    | 'hono-not-found';
  wafClass:
    | 'public-metadata'
    | 'general-public'
    | 'session-protected'
    | 'managed-mcp-provider-only'
    | 'connector-origin-private';
  evidence: readonly string[];
};

export const WEB_SECURITY_ROUTE_MATRIX = [
  {
    surface: 'health',
    method: 'ALL',
    path: '/health',
    authClass: 'public-health',
    status: { success: 200 },
    headers: ['content-type: application/json'],
    storage: ['none'],
    destination: 'device-authority',
    wafClass: 'general-public',
    evidence: ['tests/os-device-authority-worker.test.ts'],
  },
  {
    surface: 'oauth-metadata',
    method: 'ALL',
    path: '/.well-known/oauth-protected-resource',
    authClass: 'public-metadata',
    status: { success: 200 },
    headers: ['content-type: application/json'],
    storage: ['none'],
    destination: 'device-authority',
    wafClass: 'public-metadata',
    evidence: [
      'tests/os-device-authority-architecture.test.ts',
      'tests/workspace-node-registry-routing.test.ts',
    ],
  },
  {
    surface: 'device-code',
    method: 'POST',
    path: '/login/device/code',
    authClass: 'public-oauth',
    status: { success: 200, invalid: 400 },
    headers: ['content-type: application/json', 'cache-control: no-store'],
    storage: ['DEVICE_GRANTS durable object'],
    destination: 'durable-object',
    wafClass: 'general-public',
    evidence: ['tests/os-device-authority-worker.test.ts'],
  },
  {
    surface: 'google-login',
    method: 'GET',
    path: '/login/google/start',
    authClass: 'public-oauth',
    status: { success: 302, invalid: 400 },
    headers: ['location: accounts.google.com', 'cache-control: no-store'],
    storage: ['authority login state in DEVICE_GRANTS'],
    destination: 'durable-object',
    wafClass: 'general-public',
    evidence: ['tests/os-universal-login.test.ts'],
  },
  {
    surface: 'google-callback',
    method: 'GET',
    path: '/login/google/callback',
    authClass: 'public-oauth',
    status: { success: 302, invalid: 400 },
    headers: ['location: validated return target', 'cache-control: no-store'],
    storage: ['atomic Google OAuth state consumption in DEVICE_GRANTS'],
    destination: 'durable-object',
    wafClass: 'general-public',
    evidence: [
      'tests/os-device-authority-worker.test.ts',
      'tests/os-universal-login.test.ts',
    ],
  },
  {
    surface: 'mcp-authorization',
    method: 'GET',
    path: '/oauth/authorize',
    authClass: 'public-oauth',
    status: { success: 302, invalid: 400 },
    headers: ['location: accounts.google.com', 'cache-control: no-store'],
    storage: ['PKCE S256 authorization state in DEVICE_GRANTS'],
    destination: 'durable-object',
    wafClass: 'general-public',
    evidence: ['tests/os-device-authority-worker.test.ts'],
  },
  {
    surface: 'mcp-oauth',
    method: 'POST',
    path: '/oauth/token',
    authClass: 'public-oauth',
    status: { success: 200, invalid: 400 },
    headers: ['content-type: application/json', 'cache-control: no-store'],
    storage: ['atomic MCP OAuth token pair in DEVICE_GRANTS'],
    destination: 'durable-object',
    wafClass: 'general-public',
    evidence: [
      'tests/os-device-authority-worker.test.ts',
      'tests/mcp-oauth-refresh-rotation.test.ts',
    ],
  },
  {
    surface: 'mcp-introspection',
    method: 'POST',
    path: '/oauth/introspect',
    authClass: 'internal-service',
    status: { success: 200, invalid: 400 },
    headers: ['content-type: application/json', 'cache-control: no-store'],
    storage: ['OAuth access token in DEVICE_GRANTS'],
    destination: 'durable-object',
    wafClass: 'session-protected',
    evidence: [
      'tests/os-device-authority-worker.test.ts',
      'tests/mcp-gateway.test.ts',
    ],
  },
  {
    surface: 'central-mcp',
    method: 'POST',
    path: '/mcp',
    authClass: 'oauth-bearer',
    status: { success: 200, unauthenticated: 401, invalid: 404 },
    headers: [
      'www-authenticate: Bearer resource_metadata',
      'cache-control: no-store',
    ],
    storage: ['OAuth access token in DEVICE_GRANTS', 'workspace route in D1'],
    destination: 'workspace-connector-private-tunnel',
    wafClass: 'managed-mcp-provider-only',
    evidence: [
      'tests/os-device-authority-architecture.test.ts',
      'tests/workspace-node-registry-routing.test.ts',
      'tests/cloudflare-provisioning-contract.test.ts',
    ],
  },
  {
    surface: 'workspace-chooser',
    method: 'GET',
    path: '/auth/workspaces',
    authClass: 'authority-session',
    status: { success: 200, unauthenticated: 401 },
    headers: ['content-type: application/json', 'cache-control: no-store'],
    storage: ['authority session and workspace memberships in DEVICE_GRANTS'],
    destination: 'durable-object',
    wafClass: 'session-protected',
    evidence: ['tests/os-universal-login.test.ts'],
  },
  {
    surface: 'handoff',
    method: 'GET',
    path: '/auth/consume',
    authClass: 'public-oauth',
    status: { success: 302, invalid: 400 },
    headers: [
      'set-cookie: __Host-consuelo_os_session',
      'cache-control: no-store',
    ],
    storage: ['atomic expiring host-bound handoff in DEVICE_GRANTS'],
    destination: 'durable-object',
    wafClass: 'general-public',
    evidence: ['tests/os-universal-login.test.ts'],
  },
  {
    surface: 'logout',
    method: 'POST',
    path: '/auth/logout',
    authClass: 'workspace-session',
    status: { success: 200, unauthenticated: 401, invalid: 403 },
    headers: [
      'set-cookie: expired workspace session',
      'cache-control: no-store',
    ],
    storage: ['workspace session deletion in DEVICE_GRANTS'],
    destination: 'durable-object',
    wafClass: 'session-protected',
    evidence: ['tests/os-universal-login.test.ts'],
  },
  {
    surface: 'launcher',
    method: 'GET',
    path: '/',
    authClass: 'workspace-session',
    status: { success: 200, unauthenticated: 302 },
    headers: ['cache-control: private, no-store', 'vary: cookie'],
    storage: ['workspace session in DEVICE_GRANTS', 'launcher snapshot in R2'],
    destination: 'workspace-edge',
    wafClass: 'session-protected',
    evidence: [
      'tests/os-universal-login.test.ts',
      'tests/workspace-edge-sites-gateway-integration.test.ts',
    ],
  },
  {
    surface: 'gtm',
    method: 'GET',
    path: '/gtm',
    authClass: 'workspace-session',
    status: { success: 200, unauthenticated: 302, invalid: 503 },
    headers: ['cache-control: private, no-store', 'x-consuelo-edge-signature'],
    storage: ['workspace session in DEVICE_GRANTS', 'workspace route in D1'],
    destination: 'workspace-connector-private-tunnel',
    wafClass: 'session-protected',
    evidence: [
      'tests/cloudflare-edge-router.test.ts',
      'tests/workspace-edge-sites-gateway-integration.test.ts',
    ],
  },
  {
    surface: 'traces',
    method: 'GET',
    path: '/traces',
    authClass: 'workspace-session',
    status: { success: 200, unauthenticated: 401 },
    headers: ['cache-control: private, no-store', 'vary: x-consuelo-node-id'],
    storage: ['workspace session at edge', 'redacted local trace store'],
    destination: 'local-node-loopback',
    wafClass: 'session-protected',
    evidence: ['tests/traces-hono-routes.test.ts'],
  },
  {
    surface: 'trace-feed',
    method: 'GET',
    path: '/gateway/traces/recent',
    authClass: 'signed-edge-hmac',
    status: { success: 200, unauthenticated: 401, invalid: 409 },
    headers: ['cache-control: private, no-store', 'x-consuelo-node-id'],
    storage: ['redacted local trace store scoped by workspace and node'],
    destination: 'local-node-loopback',
    wafClass: 'session-protected',
    evidence: ['tests/traces-hono-routes.test.ts'],
  },
  {
    surface: 'connector-origin',
    method: 'ALL',
    path: '/*',
    authClass: 'signed-edge-hmac',
    status: { success: 200, unauthenticated: 401, invalid: 403 },
    headers: [
      'x-consuelo-edge-signature',
      'x-consuelo-edge-timestamp',
      'x-consuelo-edge-nonce',
    ],
    storage: ['local replay nonce cache', 'local gateway credentials'],
    destination: 'local-node-loopback',
    wafClass: 'connector-origin-private',
    evidence: [
      'tests/security-gateway.test.ts',
      'tests/connector-origin-hostname.test.ts',
      'tests/cloudflare-edge-router.test.ts',
    ],
  },
  {
    surface: 'route-not-found',
    method: 'ALL',
    path: '/__not_found__',
    authClass: 'none',
    status: { success: 404 },
    headers: ['content-type: application/json'],
    storage: ['none'],
    destination: 'hono-not-found',
    wafClass: 'general-public',
    evidence: ['tests/os-device-authority-architecture.test.ts'],
  },
  {
    surface: 'unsupported-method',
    method: 'GET',
    path: '/oauth/token',
    authClass: 'none',
    status: { success: 405 },
    headers: ['content-type: application/json'],
    storage: ['none'],
    destination: 'device-authority',
    wafClass: 'general-public',
    evidence: ['tests/os-device-authority-architecture.test.ts'],
  },
] as const satisfies readonly WebSecurityRouteContract[];

export function assertWebSecurityRouteMatrix(
  matrix: readonly WebSecurityRouteContract[],
): void {
  const required = new Set<WebSecuritySurface>([
    'health',
    'oauth-metadata',
    'device-code',
    'google-login',
    'google-callback',
    'mcp-authorization',
    'mcp-oauth',
    'mcp-introspection',
    'central-mcp',
    'workspace-chooser',
    'handoff',
    'logout',
    'launcher',
    'gtm',
    'traces',
    'trace-feed',
    'connector-origin',
    'route-not-found',
    'unsupported-method',
  ]);
  const seen = new Set<WebSecuritySurface>();
  for (const row of matrix) {
    if (seen.has(row.surface)) {
      throw new Error(`duplicate web security surface: ${row.surface}`);
    }
    seen.add(row.surface);
    if (!row.path.startsWith('/')) {
      throw new Error(`web security path must be absolute: ${row.surface}`);
    }
    if (
      row.headers.length === 0 ||
      row.storage.length === 0 ||
      row.evidence.length === 0
    ) {
      throw new Error(`web security row is incomplete: ${row.surface}`);
    }
    if (
      row.wafClass === 'managed-mcp-provider-only' &&
      !row.path.startsWith('/mcp')
    ) {
      throw new Error(`managed MCP WAF class is too broad: ${row.path}`);
    }
  }
  for (const surface of required) {
    if (!seen.has(surface)) {
      throw new Error(`missing web security surface: ${surface}`);
    }
  }
}
