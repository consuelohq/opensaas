#!/usr/bin/env bun

import { spawn } from 'node:child_process';

import {
  buildDiffCockpitUrl,
  parsePullRequestLocator,
} from '../../diff-cockpit/src/index';
import { refreshDiffCockpitCache } from '../hooks/diff-cockpit/cache-refresh';

const DEFAULT_REPO = 'consuelohq/opensaas';

type OpenOptions = {
  mode: 'open';
  locator?: string;
  repo: string;
  shouldOpen: boolean;
  shouldPrint: boolean;
};

type RefreshOptions = {
  mode: 'refresh';
  repo: string;
  pulls: number[];
  reason: string;
  origin?: string;
  token?: string;
};

type Options = OpenOptions | RefreshOptions;

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (options.mode === 'refresh') {
      const result = await refreshDiffCockpitCache({
        repo: options.repo,
        pulls: options.pulls,
        reason: options.reason,
        origin: options.origin,
        token: options.token,
      });
      writeLine(JSON.stringify(result, null, 2));
      return;
    }

    if (!options.locator) {
      writeError(`${usage()}\n`);
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
  if (args[0] === 'refresh') return parseRefreshArgs(args.slice(1));

  const options: OpenOptions = {
    mode: 'open',
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

function parseRefreshArgs(args: string[]): RefreshOptions {
  const pulls = new Set<number>();
  const options: RefreshOptions = {
    mode: 'refresh',
    repo: DEFAULT_REPO,
    pulls: [],
    reason: 'manual',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--repo') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--repo requires owner/repo');
      options.repo = value;
      index += 1;
      continue;
    }

    if (arg === '--pr' || arg === '--pull') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(arg + ' requires a pull request number');
      pulls.add(parsePullNumber(value));
      index += 1;
      continue;
    }

    if (arg === '--reason') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--reason requires a value');
      options.reason = value;
      index += 1;
      continue;
    }

    if (arg === '--origin') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--origin requires a URL');
      options.origin = value;
      index += 1;
      continue;
    }

    if (arg === '--token') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--token requires a value');
      options.token = value;
      index += 1;
      continue;
    }

    if (/^\d+$/.test(arg)) {
      pulls.add(parsePullNumber(arg));
      continue;
    }

    throw new Error(`Unexpected refresh argument: ${arg}`);
  }

  options.pulls = [...pulls];
  return options;
}

function parsePullNumber(value: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`Invalid pull request number: ${value}`);
  return number;
}

function usage(): string {
  return 'usage: bun run diff_cockpit -- <pr-number|github-pr-url|owner/repo/pull/number> [--repo owner/repo] [--print] [--no-open]\n       bun run diff_cockpit -- refresh [--repo owner/repo] [--pr|--pull number] [number...] [--reason task.pr] [--origin url] [--token token]';
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
