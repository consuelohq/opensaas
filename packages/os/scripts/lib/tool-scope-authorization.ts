export const OS_TOOLS_SCOPE = 'os:tools';
export const MCP_CALL_SCOPE = 'mcp:call';

export const CENTRAL_MCP_READ_ONLY_FACADE_TOOLS = new Set([
  'artifacts.check',
  'artifacts.getDesignSystem',
  'artifacts.listDesignSystems',
  'artifacts.listSkills',
  'artifacts.railwayCheck',
  'artifacts.uiLogs',
  'artifacts.uiStatus',
  'artifacts.upstreamStatus',
  'audit',
  'browser.snap',
  'browser.status',
  'checkFiles',
  'confidenceScore',
  'confirm',
  'decideNext',
  'deployment.context',
  'deployment.detect',
  'deployment.list',
  'deployment.logs',
  'deployment.status',
  'doctor',
  'exploit',
  'explore',
  'fs.list',
  'fs.read',
  'fs.search',
  'git.diff',
  'git.status',
  'linear.issue',
  'linear.labels',
  'linear.projects',
  'linear.search',
  'linear.states',
  'linear.teams',
  'mac.list',
  'mac.port',
  'mac.read',
  'mac.search',
  'media.clip.search',
  'media.probe',
  'media.qa',
  'media.timeline.validate',
  'prReview',
  'review.run',
  'sentry.config',
  'sentry.event',
  'sentry.issue',
  'sentry.issueEvent',
  'sentry.issues',
  'sentry.projects',
  'sentry.trace',
  'status',
  'stream.context',
  'stream.list',
  'task.current',
  'task.ensureSynced',
  'task.prs',
  'taskMeta.smoke',
  'tools.search',
  'wait',
]);

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function resolveToolActionCategory(
  toolName: string,
  toolInput: unknown,
): 'read' | 'dangerous' | null {
  if (toolName !== 'mac.process') return null;

  return isJsonObject(toolInput) && toolInput.action === 'list'
    ? 'read'
    : 'dangerous';
}

export function resolveCentralMcpFacadeScope(
  toolName: string,
  toolInput: unknown = {},
): string {
  const normalized = toolName.trim();
  const actionCategory = resolveToolActionCategory(normalized, toolInput);
  if (actionCategory) return 'tool:' + normalized + ':' + actionCategory;

  return CENTRAL_MCP_READ_ONLY_FACADE_TOOLS.has(normalized)
    ? 'tool:' + normalized + ':read'
    : MCP_CALL_SCOPE;
}

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
