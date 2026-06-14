#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

type Options = {
  dryRun: boolean;
  installOnly: boolean;
  deviceAuthOnly: boolean;
  noVerify: boolean;
};

const REPO_ROOT = resolve(import.meta.dir, '..', '..', '..');

function writeOut(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function writeErr(message = ''): void {
  process.stderr.write(`${message}\n`);
}

function printHelp(): void {
  writeOut(`Usage: bun run os:release -- [options]

Release all public Consuelo OS surfaces.

By default this releases:
  1. install.consuelohq.com/os
  2. os.consuelohq.com device approval authority

Options:
  --dry-run             Run both deploys in dry-run mode
  --install-only        Release only install.consuelohq.com/os
  --device-auth-only    Release only os.consuelohq.com device approval authority
  --no-verify           Skip live verification in child release scripts
  --help                Show this help

Examples:
  bun run os:release -- --dry-run
  bun run os:release
  bun run os:release -- --install-only
  bun run os:release -- --device-auth-only
`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    dryRun: false,
    installOnly: false,
    deviceAuthOnly: false,
    noVerify: false,
  };

  for (const arg of argv) {
    switch (arg) {
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--install-only':
        options.installOnly = true;
        break;
      case '--device-auth-only':
        options.deviceAuthOnly = true;
        break;
      case '--no-verify':
        options.noVerify = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.installOnly && options.deviceAuthOnly) {
    throw new Error('--install-only and --device-auth-only are mutually exclusive');
  }

  return options;
}

function runScript(scriptName: string, options: Pick<Options, 'dryRun' | 'noVerify'>): void {
  const args = ['run', scriptName];
  const childArgs: string[] = [];

  if (options.dryRun) childArgs.push('--dry-run');
  if (options.noVerify) childArgs.push('--no-verify');
  if (childArgs.length > 0) args.push('--', ...childArgs);

  writeOut(`$ bun ${args.join(' ')}`);
  const result = spawnSync('bun', args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });

  if (result.error) {
    throw new Error(`Failed to spawn bun: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`bun ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));

  writeOut('release=consuelo-os');

  if (!options.deviceAuthOnly) {
    runScript('os:release-install', options);
  }

  if (!options.installOnly) {
    runScript('os:release-device-auth', options);
  }

  writeOut('Consuelo OS release complete');
}

try {
  main();
} catch (error: unknown) {
  writeErr(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
