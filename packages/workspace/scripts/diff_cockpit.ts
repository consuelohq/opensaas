#!/usr/bin/env bun

import { spawn } from 'node:child_process';

import {
  buildDiffCockpitUrl,
  parsePullRequestLocator,
} from '../../diff-cockpit/src/index';

const DEFAULT_REPO = 'consuelohq/opensaas';

type Options = {
  locator?: string;
  repo: string;
  shouldOpen: boolean;
  shouldPrint: boolean;
};

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (!options.locator) {
      writeError(`usage: bun run diff_cockpit -- <pr-number|github-pr-url|owner/repo/pull/number> [--repo owner/repo] [--print] [--no-open]\n`);
      process.exitCode = 1;
      return;
    }

    const locator = parsePullRequestLocator(options.locator, options.repo);
    const url = buildDiffCockpitUrl(locator);

    if (options.shouldPrint) {
      writeLine(url);
    }

    if (options.shouldOpen) {
      await openUrl(url);
    }
  } catch (error: unknown) {
    writeError(error instanceof Error ? `${error.message}\n` : `${String(error)}\n`);
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    repo: DEFAULT_REPO,
    shouldOpen: true,
    shouldPrint: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--repo') {
      const value = args[index + 1];
      if (!value) throw new Error('--repo requires owner/repo');
      options.repo = value;
      index += 1;
      continue;
    }

    if (arg === '--print') {
      options.shouldPrint = true;
      continue;
    }

    if (arg === '--no-open') {
      options.shouldOpen = false;
      continue;
    }

    if (arg === '--open') {
      options.shouldOpen = true;
      continue;
    }

    if (!options.locator) {
      options.locator = arg;
      continue;
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  return options;
}

function openUrl(url: string): Promise<void> {
  const child = spawn('open', ['-a', 'Arc', url], {
    stdio: 'ignore',
  });

  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`open exited with code ${code}`));
    });
  });
}

function writeLine(value: string): void {
  process.stdout.write(`${value}\n`);
}

function writeError(value: string): void {
  process.stderr.write(value);
}

void main();
