export const DEFAULT_LOCAL_OS_PORT = 8960;

export type LocalOsServerConfig = {
  port: number;
  name: string;
};

function resolveLocalOsPort(): number {
  const configured = process.env.CONSUELO_OS_PORT ?? process.env.PORT;
  if (configured === undefined) return DEFAULT_LOCAL_OS_PORT;

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
    port: resolveLocalOsPort(),
    name: process.env.CONSUELO_OS_SERVER_NAME ?? 'consuelo-os',
  };
}
