export const DEFAULT_LOCAL_OS_PORT = 8960;

export type LocalOsServerConfig = {
  port: number;
  name: string;
};

export function loadLocalOsServerConfig(): LocalOsServerConfig {
  return {
    port: Number(
      process.env.CONSUELO_OS_PORT ??
        process.env.PORT ??
        DEFAULT_LOCAL_OS_PORT,
    ),
    name: process.env.CONSUELO_OS_SERVER_NAME ?? 'consuelo-os',
  };
}
