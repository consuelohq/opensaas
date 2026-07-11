export const DEFAULT_LOCAL_OS_PORT = 46321;

export type LocalOsServerConfig = {
  port: number;
  name: string;
};

export function resolveLocalOsPortOverride(
  env: NodeJS.ProcessEnv = process.env,
): number | undefined {
  const configured = env.CONSUELO_OS_PORT ?? env.PORT;
  if (configured === undefined) return undefined;

  const normalized = configured.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      'Invalid local OS port: expected a valid integer between 1 and 65535.',
    );
  }

  const port = Number(normalized);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(
      'Invalid local OS port: expected a valid integer between 1 and 65535.',
    );
  }
  return port;
}

export function loadLocalOsServerConfig(): LocalOsServerConfig {
  return {
    port: resolveLocalOsPortOverride() ?? DEFAULT_LOCAL_OS_PORT,
    name: process.env.CONSUELO_OS_SERVER_NAME ?? 'consuelo-os',
  };
}
