import type { IntegrationStore, DecryptFn } from './types.js';
import { INTEGRATION_REGISTRY } from './registry.js';

export type SandboxEnvResult = {
  envVars: Record<string, string>;
  sdkPackages: string[];
};

// build sandbox environment variables from connected integrations
export const buildSandboxEnv = async (
  store: IntegrationStore,
  decrypt: DecryptFn,
  workspaceId: string,
  userId: string,
  requiredIntegrations?: string[],
): Promise<SandboxEnvResult> => {
  try {
    const connections = await store.findByUser(workspaceId, userId);

    // filter to healthy connections only
    const healthy = connections.filter((conn) => conn.status === 'connected');

    // optionally filter to required integrations
    const filtered = requiredIntegrations
      ? healthy.filter((conn) => requiredIntegrations.includes(conn.integrationId))
      : healthy;

    const envVars: Record<string, string> = {};
    const sdkPackages: string[] = [];

    for (const conn of filtered) {
      const def = INTEGRATION_REGISTRY.get(conn.integrationId);
      if (!def) continue;

      const encrypted = conn.metadata?.encryptedCredentials;
      if (typeof encrypted !== 'string') continue;

      const credentials = JSON.parse(await decrypt(encrypted)) as Record<string, string>;
      const prefix = def.envVarPrefix;

      // map credentials to env vars: {PREFIX}_{FIELD_NAME_SCREAMING_CASE}
      if (def.authMethod === 'oauth2') {
        // oauth tokens: inject access_token
        if (credentials.access_token) {
          envVars[`${prefix}_ACCESS_TOKEN`] = credentials.access_token;
        }
        if (credentials.refresh_token) {
          envVars[`${prefix}_REFRESH_TOKEN`] = credentials.refresh_token;
        }
      } else {
        // api_key / bearer / basic: map each field
        for (const [key, value] of Object.entries(credentials)) {
          const envKey = `${prefix}_${toScreamingSnake(key)}`;
          envVars[envKey] = value;
        }
      }

      if (def.sdkPackage) {
        sdkPackages.push(def.sdkPackage);
      }
    }

    return { envVars, sdkPackages };
  } catch (err: unknown) {
    // Sentry.captureException(err) — handled by consuming app
    throw err;
  }
};

const toScreamingSnake = (str: string): string =>
  str.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
