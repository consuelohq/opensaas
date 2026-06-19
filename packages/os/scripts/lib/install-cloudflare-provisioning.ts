import {
  createCloudflareManagedOsMcpIngressPolicyClient,
  createOptionalManagedOsMcpIngressPolicyConfigFromEnv,
  ensureManagedOsMcpIngressPolicy,
  type WorkspaceCloudflareManagedOsMcpIngressPolicyClient,
  type WorkspaceCloudflareManagedOsMcpIngressPolicyResult,
} from './workspace-cloudflare-provisioning';

type CloudflareInstallEnv = Record<string, string | undefined>;

export type InstallManagedOsMcpIngressPolicyProvisioningResult =
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

export type InstallManagedOsMcpIngressPolicyProvisioningInput = {
  env: CloudflareInstallEnv;
  baseDomain: string;
  dryRun?: boolean;
  cloudflare?: WorkspaceCloudflareManagedOsMcpIngressPolicyClient;
  fetchImpl?: typeof fetch;
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const readRequiredEnvValue = (
  env: CloudflareInstallEnv,
  key: 'CLOUDFLARE_ACCOUNT_ID' | 'CLOUDFLARE_API_TOKEN',
): string => {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
};

export const provisionManagedOsMcpIngressPolicyFromEnv = async (
  input: InstallManagedOsMcpIngressPolicyProvisioningInput,
): Promise<InstallManagedOsMcpIngressPolicyProvisioningResult> => {
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
      `install managed OS MCP ingress policy provisioning failed: ${getErrorMessage(error)}`,
      { cause: error },
    );
  }
};
