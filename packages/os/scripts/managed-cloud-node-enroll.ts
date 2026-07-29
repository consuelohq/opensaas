#!/usr/bin/env bun

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  runManagedCloudNodeEnrollment,
  writeManagedCloudNodeEnrollmentStatus,
  type ManagedCloudNodeOnboarding,
} from './lib/managed-cloud-node-enrollment';

export type ManagedCloudNodeEnrollmentCliOptions = {
  home: string;
  onboardingPath: string;
  statusPath: string;
};

const readValue = (argv: string[], flag: string, index: number): string => {
  const value = argv[index + 1];
  if (!value || value.startsWith('-')) throw new Error(`${flag} requires a value`);
  return value;
};

export const parseManagedCloudNodeEnrollmentArgs = (
  argv: string[],
): ManagedCloudNodeEnrollmentCliOptions => {
  let home = '';
  let onboardingPath = '';
  let statusPath = '';
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--home') {
      home = readValue(argv, '--home', index);
      index += 1;
    } else if (argument === '--onboarding') {
      onboardingPath = readValue(argv, '--onboarding', index);
      index += 1;
    } else if (argument === '--status') {
      statusPath = readValue(argv, '--status', index);
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      process.stdout.write(
        'usage: bun ./scripts/managed-cloud-node-enroll.ts --home <path> --onboarding <path> --status <path>\n',
      );
      process.exit(0);
    } else {
      throw new Error(`unknown option: ${argument}`);
    }
  }
  if (!home) throw new Error('--home is required');
  if (!onboardingPath) throw new Error('--onboarding is required');
  if (!statusPath) throw new Error('--status is required');
  return {
    home: resolve(home),
    onboardingPath: resolve(onboardingPath),
    statusPath: resolve(statusPath),
  };
};

const readOnboarding = (path: string): ManagedCloudNodeOnboarding => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error: unknown) {
    throw new Error(
      `failed to read managed cloud node onboarding ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('managed cloud node onboarding must be an object');
  }
  const record = parsed as Record<string, unknown>;
  const required = [
    'workspaceId',
    'workspaceSlug',
    'workspaceHost',
    'nodeId',
    'nodeName',
  ] as const;
  for (const key of required) {
    if (typeof record[key] !== 'string' || !record[key].trim()) {
      throw new Error(`managed cloud node onboarding requires ${key}`);
    }
  }
  return {
    workspaceId: String(record.workspaceId).trim(),
    workspaceSlug: String(record.workspaceSlug).trim(),
    workspaceHost: String(record.workspaceHost).trim(),
    nodeId: String(record.nodeId).trim(),
    nodeName: String(record.nodeName).trim(),
    ...(typeof record.authorityOrigin === 'string' && record.authorityOrigin.trim()
      ? { authorityOrigin: record.authorityOrigin.trim() }
      : {}),
  };
};

const main = async (): Promise<void> => {
  const options = parseManagedCloudNodeEnrollmentArgs(process.argv.slice(2));
  const onboarding = readOnboarding(options.onboardingPath);
  const result = await runManagedCloudNodeEnrollment({
    home: options.home,
    onboarding,
    dependencies: {
      writeStatus: (status) =>
        writeManagedCloudNodeEnrollmentStatus(options.statusPath, status),
    },
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
};

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
