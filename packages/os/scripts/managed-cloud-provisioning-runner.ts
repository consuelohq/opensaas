#!/usr/bin/env bun

import {
  createManagedCloudProvisioningAuthorityClient,
  runManagedCloudProvisioningOnce,
} from './lib/managed-cloud-provisioning-runner';
import type { ManagedCloudNodeReleaseBootstrap } from './lib/managed-cloud-node';

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const releaseFromEnv = (): ManagedCloudNodeReleaseBootstrap => {
  const raw = requiredEnv('CONSUELO_MANAGED_CLOUD_RELEASE_JSON');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error: unknown) {
    throw new Error('CONSUELO_MANAGED_CLOUD_RELEASE_JSON must contain valid JSON', { cause: error });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('CONSUELO_MANAGED_CLOUD_RELEASE_JSON must contain a release object');
  }
  return parsed as ManagedCloudNodeReleaseBootstrap;
};

const parseArgs = (argv: string[]): { once: boolean; intervalMs: number } => {
  let once = false;
  let intervalMs = 5_000;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--once') {
      once = true;
    } else if (argument === '--interval-ms') {
      const value = Number.parseInt(argv[index + 1] ?? '', 10);
      if (!Number.isSafeInteger(value) || value < 1_000 || value > 60_000) {
        throw new Error('--interval-ms must be between 1000 and 60000');
      }
      intervalMs = value;
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      process.stdout.write(
        'usage: bun ./scripts/managed-cloud-provisioning-runner.ts [--once] [--interval-ms 5000]\n',
      );
      process.exit(0);
    } else {
      throw new Error(`unknown option: ${argument}`);
    }
  }
  return { once, intervalMs };
};

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const main = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));
  const authority = createManagedCloudProvisioningAuthorityClient({
    authorityOrigin:
      process.env.CONSUELO_OS_DEVICE_AUTH_ORIGIN?.trim() || 'https://os.consuelohq.com',
    provisionerSecret: requiredEnv('CONSUELO_MANAGED_CLOUD_PROVISIONER_SECRET'),
  });
  const projectId = requiredEnv('CONSUELO_GCP_PROJECT_ID');
  const release = releaseFromEnv();

  do {
    try {
      const result = await runManagedCloudProvisioningOnce({ authority, projectId, release });
      if (options.once || result.status === 'provisioned') {
        process.stdout.write(`${JSON.stringify(result)}\n`);
      }
    } catch (error: unknown) {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
      if (options.once) throw error;
    }
    if (!options.once) await sleep(options.intervalMs);
  } while (!options.once);
};

if (import.meta.main) {
  try {
    await main();
  } catch {
    process.exit(1);
  }
}
