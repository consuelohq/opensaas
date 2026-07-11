export function redactWorkspaceRouteSetupFailure(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const normalized = raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(
      /\bAuthorization\s*[:=]\s*Bearer\s+[^\s,;]+/gi,
      'Authorization=[redacted]',
    )
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(
      /\b(CLOUDFLARE_API_TOKEN|api[_ -]?token|authorization|access_token|refresh_token|bootstrap_token|secret|password|cookie|code|state)\s*[:=]\s*[^\s,;]+/gi,
      '$1=[redacted]',
    )
    .replace(
      /([?&](?:access_token|refresh_token|authorization|bootstrap_token|token|secret|password|cookie|code|state)=)[^&#\s]+/gi,
      '$1[redacted]',
    )
    .trim();
  return (normalized || 'workspace connector provisioning failed').slice(
    0,
    320,
  );
}
