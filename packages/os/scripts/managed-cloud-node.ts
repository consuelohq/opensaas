#!/usr/bin/env bun

import { provisionManagedCloudNodeFoundation } from './lib/platform-managed-cloud-node';

type ManagedCloudNodeCliOptions = {
  command: 'plan' | 'apply';
  projectId: string;
  billingAccountId: string;
  region?: string;
  budgetAmountUsd?: number;
  json: boolean;
};

const usage = (): string =>
  [
    'usage: bun ./scripts/managed-cloud-node.ts <plan|apply> --project <project-id> --billing-account <billing-account-id> [--region <region>] [--budget-usd <amount>] [--json]',
    '',
    'Consuelo operator command for managed cloud-node infrastructure.',
    '`plan` performs no provider mutations. `apply` uses the same application service as the future product UI.',
    '',
  ].join('\n');

const readValue = (argv: string[], flag: string, index: number): string => {
  const value = argv[index + 1];
  if (!value || value.startsWith('-')) throw new Error(`${flag} requires a value`);
  return value;
};

export const parseManagedCloudNodeArgs = (
  argv: string[],
  env: Record<string, string | undefined> = process.env,
): ManagedCloudNodeCliOptions => {
  const command = argv[0];
  if (command !== 'plan' && command !== 'apply') {
    throw new Error(`expected command plan or apply\n\n${usage()}`);
  }
  let projectId = env.CONSUELO_GCP_PROJECT_ID?.trim() ?? '';
  let billingAccountId = env.CONSUELO_GCP_BILLING_ACCOUNT_ID?.trim() ?? '';
  let region: string | undefined;
  let budgetAmountUsd: number | undefined;
  let json = false;

  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--project') {
      projectId = readValue(argv, '--project', index);
      index += 1;
    } else if (argument === '--billing-account') {
      billingAccountId = readValue(argv, '--billing-account', index);
      index += 1;
    } else if (argument === '--region') {
      region = readValue(argv, '--region', index);
      index += 1;
    } else if (argument === '--budget-usd') {
      const value = Number(readValue(argv, '--budget-usd', index));
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('--budget-usd must be a positive number');
      }
      budgetAmountUsd = value;
      index += 1;
    } else if (argument === '--json') {
      json = true;
    } else if (argument === '--help' || argument === '-h') {
      process.stdout.write(usage());
      process.exit(0);
    } else {
      throw new Error(`unknown option: ${argument}`);
    }
  }

  if (!projectId) throw new Error('--project is required');
  if (!billingAccountId) throw new Error('--billing-account is required');
  return {
    command,
    projectId,
    billingAccountId,
    region,
    budgetAmountUsd,
    json,
  };
};

const main = async (): Promise<void> => {
  const options = parseManagedCloudNodeArgs(process.argv.slice(2));
  const provisionInput = {
    projectId: options.projectId,
    billingAccountId: options.billingAccountId,
    region: options.region,
    budgetAmountUsd: options.budgetAmountUsd,
  };
  let result: Awaited<ReturnType<typeof provisionManagedCloudNodeFoundation>>;
  try {
    result =
      options.command === 'apply'
        ? await provisionManagedCloudNodeFoundation({
            ...provisionInput,
            dryRun: false,
          })
        : await provisionManagedCloudNodeFoundation({
            ...provisionInput,
            dryRun: options.command === 'plan',
          });
  } catch (error: unknown) {
    throw new Error(
      `managed cloud node ${options.command} failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  process.stdout.write(
    [
      `managed cloud node foundation: ${result.status}`,
      `project: ${result.plan.projectId}`,
      `region: ${result.plan.region}`,
      `operations: ${result.operations.length}`,
      '',
    ].join('\n'),
  );
};

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
