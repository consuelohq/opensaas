export const CLOUDFLARE_WORKER_RELEASE_CONFIGS = {
  'workspace-edge': {
    displayName: 'Workspace edge',
    configPath: 'cloudflare/workspace-edge/wrangler.toml',
    requiredSecrets: [
      'CONSUELO_EDGE_SIGNING_SECRET',
      'WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET',
      'OS_INTERNAL_DASHBOARD_ACCESS_TEAM_DOMAIN',
      'OS_INTERNAL_DASHBOARD_ACCESS_AUD',
      'OS_INTERNAL_DASHBOARD_ALLOWED_EMAILS',
    ],
  },
  'os-device-authority': {
    displayName: 'Device authority',
    configPath: 'cloudflare/os-device-authority/wrangler.toml',
    requiredSecrets: [
      'CLOUDFLARE_API_TOKEN',
      'WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET',
      'OS_MANAGED_CLOUD_PROVISIONER_SECRET',
      'OS_MANAGED_CLOUD_ENROLLMENT_SECRET',
    ],
  },
} as const;

export type CloudflareWorkerReleaseTarget =
  keyof typeof CLOUDFLARE_WORKER_RELEASE_CONFIGS;

export type CloudflareWorkerCommandRunner = (input: {
  argv: string[];
  cwd?: string;
}) => Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}>;

type WorkerSecretMetadata = {
  name?: unknown;
};

const parseWorkerSecretMetadata = (
  displayName: string,
  input: unknown,
): WorkerSecretMetadata[] => {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      throw new Error(displayName + ' secret list response was not valid JSON');
    }
  }

  if (Array.isArray(value)) return value as WorkerSecretMetadata[];
  if (
    value &&
    typeof value === 'object' &&
    Array.isArray((value as { secrets?: unknown }).secrets)
  ) {
    return (value as { secrets: WorkerSecretMetadata[] }).secrets;
  }
  throw new Error(displayName + ' secret list response was not an array');
};

export const configuredCloudflareWorkerSecretNames = (
  target: CloudflareWorkerReleaseTarget,
  input: unknown,
): Set<string> => {
  const config = CLOUDFLARE_WORKER_RELEASE_CONFIGS[target];
  return new Set(
    parseWorkerSecretMetadata(config.displayName, input)
      .map((secret) =>
        typeof secret.name === 'string' ? secret.name.trim() : '',
      )
      .filter(Boolean),
  );
};

export const assertRequiredCloudflareWorkerSecrets = (
  target: CloudflareWorkerReleaseTarget,
  input: unknown,
): void => {
  const config = CLOUDFLARE_WORKER_RELEASE_CONFIGS[target];
  const configured = configuredCloudflareWorkerSecretNames(target, input);

  for (const requiredSecret of config.requiredSecrets) {
    if (!configured.has(requiredSecret)) {
      throw new Error(
        config.displayName + ' secret ' + requiredSecret + ' is not configured',
      );
    }
  }
};

const defaultRunner: CloudflareWorkerCommandRunner = async ({ argv, cwd }) => {
  try {
    const process = Bun.spawn(argv, {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ]);
    return { exitCode, stdout, stderr };
  } catch (error: unknown) {
    throw new Error('Cloudflare Worker command could not be executed', {
      cause: error,
    });
  }
};

export const deployCloudflareWorker = async (input: {
  target: CloudflareWorkerReleaseTarget;
  cwd?: string;
  runner?: CloudflareWorkerCommandRunner;
}): Promise<void> => {
  const config = CLOUDFLARE_WORKER_RELEASE_CONFIGS[input.target];
  const runner = input.runner ?? defaultRunner;
  try {
    const secretList = await runner({
      argv: [
        'wrangler',
        'secret',
        'list',
        '--config',
        config.configPath,
      ],
      cwd: input.cwd,
    });
    if (secretList.exitCode !== 0) {
      throw new Error(
        config.displayName +
          ' secret readiness check failed: ' +
          (secretList.stderr.trim() || 'wrangler exited non-zero'),
      );
    }

    assertRequiredCloudflareWorkerSecrets(input.target, secretList.stdout);

    const deploy = await runner({
      argv: ['wrangler', 'deploy', '--config', config.configPath],
      cwd: input.cwd,
    });
    if (deploy.exitCode !== 0) {
      throw new Error(
        config.displayName +
          ' deployment failed: ' +
          (deploy.stderr.trim() || 'wrangler exited non-zero'),
      );
    }
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error(config.displayName + ' deployment failed');
  }
};
