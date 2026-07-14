export type RouteTrust = 'public' | 'oauth' | 'device-proof' | 'internal';
export type RouteMethod = 'ANY' | 'GET' | 'POST';

export const DEVICE_AUTHORITY_ROUTE_POLICIES = [
  { method: 'ANY', path: '/', trust: 'public' },
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
  { method: 'POST', path: '/login/device/code', trust: 'device-proof' },
  { method: 'POST', path: '/login/device/workspace', trust: 'device-proof' },
  { method: 'POST', path: '/login/device/approve', trust: 'internal' },
  { method: 'POST', path: '/login/oauth/access_token', trust: 'device-proof' },
] as const satisfies ReadonlyArray<{
  method: RouteMethod;
  path: string;
  trust: RouteTrust;
}>;
