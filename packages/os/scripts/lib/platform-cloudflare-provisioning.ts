import {
  createCloudflareManagedOsMcpIngressPolicyClient,
  createOptionalManagedOsMcpIngressPolicyConfigFromEnv,
  ensureManagedOsMcpIngressPolicy,
  type WorkspaceCloudflareManagedOsMcpIngressPolicyClient,
  type WorkspaceCloudflareManagedOsMcpIngressPolicyResult,
} from './workspace-cloudflare-provisioning';

type PlatformCloudflareEnv = Record<string, string | undefined>;

export type PlatformManagedOsMcpIngressPolicyProvisioningResult =
  | {
      status: 'skipped';
      reason: 'managed OS MCP ingress policy env not configured';
    }
  | {
      status: 'planned';
      zoneId: string;
      allowedIpsListName: string;
    }
  | ({ status: 'provisioned' } & WorkspaceCloudflareManagedOsMcpIngressPolicyResult);

export type PlatformManagedOsMcpIngressPolicyProvisioningInput = {
  env: PlatformCloudflareEnv;
  baseDomain: string;
  dryRun?: boolean;
  cloudflare?: WorkspaceCloudflareManagedOsMcpIngressPolicyClient;
  fetchImpl?: typeof fetch;
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const readRequiredEnvValue = (
  env: PlatformCloudflareEnv,
  key: 'CLOUDFLARE_ACCOUNT_ID' | 'CLOUDFLARE_API_TOKEN',
): string => {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
};

export const provisionPlatformManagedOsMcpIngressPolicyFromEnv = async (
  input: PlatformManagedOsMcpIngressPolicyProvisioningInput,
): Promise<PlatformManagedOsMcpIngressPolicyProvisioningResult> => {
  try {
    const config = createOptionalManagedOsMcpIngressPolicyConfigFromEnv({
      env: input.env,
      baseDomain: input.baseDomain,
    });
    if (!config) {
      return {
        status: 'skipped',
        reason: 'managed OS MCP ingress policy env not configured',
      };
    }

    const accountId = readRequiredEnvValue(input.env, 'CLOUDFLARE_ACCOUNT_ID');
    const apiToken = readRequiredEnvValue(input.env, 'CLOUDFLARE_API_TOKEN');

    if (input.dryRun) {
      return {
        status: 'planned',
        zoneId: config.zoneId,
        allowedIpsListName: config.mcpAllowedIpsListName,
      };
    }

    const cloudflare = input.cloudflare ??
      createCloudflareManagedOsMcpIngressPolicyClient({
        accountId,
        apiToken,
        apiBaseUrl: input.env.CLOUDFLARE_API_BASE_URL,
        fetchImpl: input.fetchImpl,
      });
    const result = await ensureManagedOsMcpIngressPolicy({
      cloudflare,
      config,
    });

    return { status: 'provisioned', ...result };
  } catch (error: unknown) {
    throw new Error(
      `platform managed OS MCP ingress policy provisioning failed: ${getErrorMessage(error)}`,
      { cause: error },
    );
  }
};
