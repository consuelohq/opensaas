export const OS_TOOLS_SCOPE = 'os:tools';
export const MCP_CALL_SCOPE = 'mcp:call';

export const STANDARD_OS_MCP_SCOPES = [
  'route:/mcp:read',
  MCP_CALL_SCOPE,
  OS_TOOLS_SCOPE,
] as const;

export function normalizeGrantedScopes(scopes: readonly string[]): string[] {
  return [...new Set(scopes.map((scope) => scope.trim()).filter(Boolean))];
}

export function grantsRequiredScope(
  scopes: readonly string[],
  requiredScope: string,
): boolean {
  if (!requiredScope) return true;
  const granted = new Set(normalizeGrantedScopes(scopes));
  if (granted.has(requiredScope)) return true;

  const parts = requiredScope.split(':');
  if (parts.length !== 3 || parts[0] !== 'tool') return false;

  const category = parts[2];
  return (
    granted.has(OS_TOOLS_SCOPE) ||
    granted.has(MCP_CALL_SCOPE) ||
    granted.has(`tool:*:${category}`) ||
    granted.has('tool:*:*')
  );
}
