#!/usr/bin/env bun

import { provisionPlatformManagedOsMcpIngressPolicyFromEnv } from './lib/platform-cloudflare-provisioning';

type ProvisionManagedOsMcpIngressPolicyOptions = {
  baseDomain: string;
  dryRun: boolean;
  json: boolean;
};

const DEFAULT_BASE_DOMAIN = 'consuelohq.com';

const readValue = (argv: string[], flag: string, index: number): string => {
  const value = argv[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
};

const parseArgs = (argv: string[]): ProvisionManagedOsMcpIngressPolicyOptions => {
  const options: ProvisionManagedOsMcpIngressPolicyOptions = {
    baseDomain: DEFAULT_BASE_DOMAIN,
    dryRun: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--base-domain') {
      options.baseDomain = readValue(argv, '--base-domain', index);
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(
        [
          'usage: bun ./scripts/provision-managed-os-mcp-ingress-policy.ts [--dry-run] [--json] [--base-domain <domain>]',
          '',
          'Consuelo platform/admin script for managed OS MCP Cloudflare ingress policy provisioning.',
          'Requires Consuelo-owned Cloudflare admin env vars when policy env is configured.',
          '',
        ].join('\n'),
      );
      process.exit(0);
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }

  return options;
};

const main = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));
  const result = await provisionPlatformManagedOsMcpIngressPolicyFromEnv({
    env: process.env,
    baseDomain: options.baseDomain,
    dryRun: options.dryRun,
  });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(`managed OS MCP ingress policy: ${result.status}\n`);
};

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
