export type McpOriginValidationResult =
  | { ok: true }
  | {
      ok: false;
      status: 403;
      code: 'INVALID_MCP_ORIGIN';
      message: string;
    };

function configuredAllowedOrigins(): string[] {
  return (process.env.CONSUELO_OS_MCP_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizedOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function validateMcpRequestOrigin(
  request: Request,
  input: { workspaceHost: string; allowedOrigins?: string[] },
): McpOriginValidationResult {
  const rawOrigin = request.headers.get('origin')?.trim();
  if (!rawOrigin) return { ok: true };
  if (rawOrigin === 'null') {
    return {
      ok: false,
      status: 403,
      code: 'INVALID_MCP_ORIGIN',
      message: 'MCP request Origin is not allowed.',
    };
  }

  const origin = normalizedOrigin(rawOrigin);
  const requestOrigin = normalizedOrigin(new URL(request.url).origin);
  const workspaceOrigin = normalizedOrigin(`https://${input.workspaceHost}`);
  const allowed = new Set(
    [
      requestOrigin,
      workspaceOrigin,
      ...(input.allowedOrigins ?? configuredAllowedOrigins()).map(normalizedOrigin),
    ].filter((value): value is string => Boolean(value)),
  );

  if (origin && allowed.has(origin)) return { ok: true };
  return {
    ok: false,
    status: 403,
    code: 'INVALID_MCP_ORIGIN',
    message: 'MCP request Origin is not allowed.',
  };
}
