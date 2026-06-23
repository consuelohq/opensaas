#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';

import { checkMediaDependenciesForCli } from './lib/media/dependencies';
import { createMediaInstallPlan } from './lib/media/install-plan';

type ParsedArgs = {
  command: string;
  json: boolean;
  dryRun: boolean;
  allProfiles: boolean;
  profiles: string[];
  maxEstimatedSizeMb?: number;
};

function parseArgs(argv: string[]): ParsedArgs {
  const [command = 'help', ...rest] = argv;
  const args: ParsedArgs = { command, json: false, dryRun: false, allProfiles: false, profiles: [] };
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    switch (item) {
      case '--json':
        args.json = true;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--all-profiles':
        args.allProfiles = true;
        break;
      case '--profile': {
        const value = rest[index + 1];
        if (!value || value.startsWith('--')) throw new Error('missing value for --profile');
        args.profiles.push(value);
        index += 1;
        break;
      }
      case '--max-estimated-size-mb': {
        const value = rest[index + 1];
        if (!value || value.startsWith('--')) throw new Error('missing value for --max-estimated-size-mb');
        args.maxEstimatedSizeMb = Number(value);
        if (!Number.isFinite(args.maxEstimatedSizeMb)) throw new Error('invalid --max-estimated-size-mb');
        index += 1;
        break;
      }
      default:
        throw new Error('unknown media flag: ' + item);
    }
  }
  return args;
}

function writeJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function hasHomebrew(): boolean {
  if (process.env.CONSUELO_MEDIA_TEST_DISABLE_HOMEBREW === '1') return false;
  const result = spawnSync('/usr/bin/env', ['which', 'brew'], { encoding: 'utf8' });
  return result.status === 0;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'doctor') {
    writeJson(await checkMediaDependenciesForCli({ profiles: args.profiles, allProfiles: args.allProfiles }));
    return;
  }
  if (args.command === 'install') {
    if (!args.dryRun && !hasHomebrew()) {
      writeJson({ schema: 'media.install-error.v1', ok: false, code: 'HOMEBREW_UNAVAILABLE', message: 'Homebrew is required for media install. Run a dry-run or install Homebrew first.' });
      process.exitCode = 1;
      return;
    }
    if (!args.dryRun) {
      writeJson({ schema: 'media.install-error.v1', ok: false, code: 'INSTALL_REQUIRES_EXPLICIT_FUTURE_APPROVAL', message: 'Media install execution is intentionally not implemented in branch 1. Use --dry-run for now.' });
      process.exitCode = 1;
      return;
    }
    writeJson(createMediaInstallPlan({ profiles: args.profiles, dryRun: args.dryRun, maxEstimatedSizeMb: args.maxEstimatedSizeMb }));
    return;
  }
  writeJson({ schema: 'media.help.v1', commands: ['doctor', 'install'] });
}

main().catch((error: unknown) => {
  writeJson({ schema: 'media.error.v1', ok: false, message: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
