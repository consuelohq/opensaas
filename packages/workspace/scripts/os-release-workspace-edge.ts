#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

type Options = {
  dryRun: boolean;
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
  writeOut(`Usage: bun run os:release-workspace-edge -- [options]

Release the Consuelo Workspace Edge Worker and apply the remote D1 route-registry migrations.

Options:
  --dry-run    Validate the Worker bundle without mutating Cloudflare
  --no-verify  Accepted for release-orchestrator parity; Worker deploy readiness remains enforced
  --help       Show this help
`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = { dryRun: false, noVerify: false };
  for (const arg of argv) {
    switch (arg) {
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--no-verify':
        options.noVerify = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function runPackageScript(scriptName: string): void {
  const args = ['run', '--cwd', 'packages/os', scriptName];
  writeOut(`$ bun ${args.join(' ')}`);
  const result = spawnSync('bun', args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (result.error) throw new Error(`Failed to spawn bun: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`bun ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  writeOut('release=consuelo-workspace-edge');
  if (options.dryRun) {
    runPackageScript('cloudflare:workspace-edge:deploy:dry-run');
    writeOut('Consuelo Workspace Edge dry run complete');
    return;
  }

  runPackageScript('cloudflare:workspace-edge:migrate');
  runPackageScript('cloudflare:workspace-edge:deploy');
  writeOut(
    options.noVerify
      ? 'Consuelo Workspace Edge release complete (external verification skipped)'
      : 'Consuelo Workspace Edge release complete',
  );
}

try {
  main();
} catch (error: unknown) {
  writeErr(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
