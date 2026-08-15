export type RouteTrust =
  | 'public'
  | 'oauth'
  | 'authority-session'
  | 'workspace-session'
  | 'device-proof'
  | 'webhook-signature'
  | 'node-bootstrap'
  | 'internal';
export type RouteMethod = 'ANY' | 'GET' | 'POST';

export const DEVICE_AUTHORITY_ROUTE_POLICIES = [
  { method: 'GET', path: '/', trust: 'public' },
  { method: 'ANY', path: '/health', trust: 'public' },
  {
    method: 'ANY',
    path: '/.well-known/oauth-authorization-server',
    trust: 'public',
  },
  {
    method: 'ANY',
    path: '/.well-known/oauth-protected-resource',
    trust: 'public',
  },
  {
    method: 'ANY',
    path: '/.well-known/oauth-protected-resource/mcp',
    trust: 'public',
  },
  { method: 'GET', path: '/oauth/authorize', trust: 'public' },
  { method: 'GET', path: '/oauth/google/callback', trust: 'public' },
  { method: 'POST', path: '/oauth/token', trust: 'oauth' },
  { method: 'POST', path: '/oauth/revoke', trust: 'oauth' },
  { method: 'POST', path: '/oauth/introspect', trust: 'internal' },
  { method: 'ANY', path: '/mcp', trust: 'oauth' },
  { method: 'ANY', path: '/mcp/*', trust: 'oauth' },
  { method: 'GET', path: '/login/device', trust: 'public' },
  { method: 'GET', path: '/login/google/start', trust: 'public' },
  { method: 'GET', path: '/login/google/callback', trust: 'public' },
  { method: 'GET', path: '/auth/workspaces', trust: 'authority-session' },
  { method: 'POST', path: '/auth/handoff', trust: 'authority-session' },
  { method: 'GET', path: '/auth/consume', trust: 'public' },
  { method: 'POST', path: '/auth/logout', trust: 'workspace-session' },
  { method: 'GET', path: '/auth/synthetic/checkout', trust: 'authority-session' },
  { method: 'POST', path: '/auth/synthetic/checkout/start', trust: 'authority-session' },
  { method: 'GET', path: '/auth/synthetic/checkout/result', trust: 'authority-session' },
  { method: 'POST', path: '/webhooks/stripe', trust: 'webhook-signature' },
  { method: 'POST', path: '/webhooks/stripe-synthetic', trust: 'webhook-signature' },
  {
    method: 'POST',
    path: '/internal/auth/session/validate',
    trust: 'internal',
  },
  { method: 'POST', path: '/login/device/code', trust: 'device-proof' },
  { method: 'POST', path: '/login/device/workspace', trust: 'device-proof' },
  { method: 'POST', path: '/login/device/approve', trust: 'internal' },
  { method: 'POST', path: '/login/oauth/access_token', trust: 'device-proof' },
  { method: 'POST', path: '/internal/managed-cloud/provisioning/claim', trust: 'internal' },
  { method: 'POST', path: '/internal/managed-cloud/provisioning/state', trust: 'internal' },
  { method: 'POST', path: '/managed-cloud/provisioning/enroll', trust: 'node-bootstrap' },
  { method: 'GET', path: '/workspace/agents', trust: 'public' },
  { method: 'POST', path: '/workspace/agents', trust: 'node-bootstrap' },
] as const satisfies ReadonlyArray<{
  method: RouteMethod;
  path: string;
  trust: RouteTrust;
}>;
