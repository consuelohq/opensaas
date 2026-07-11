export const LOCAL_OS_ROUTE_POLICIES = [
  { method: 'ANY', path: '/health', trust: 'public' },
  { method: 'GET', path: '/gateway/traces/recent', trust: 'signed' },
  { method: 'GET', path: '/gateway/traces/summary', trust: 'signed' },
  { method: 'GET', path: '/gateway/traces/aggregates', trust: 'signed' },
  { method: 'GET', path: '/gateway/traces/events', trust: 'signed' },
  { method: 'ANY', path: '/mcp', trust: 'signed-or-oauth' },
  { method: 'GET', path: '/get_steering', trust: 'signed' },
  { method: 'POST', path: '/get_steering', trust: 'signed' },
  { method: 'POST', path: '/call', trust: 'signed' },
  { method: 'ANY', path: '*', trust: 'signed-fallback' },
] as const;
