import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';

import { createBrowserProcess } from '../scripts/lib/browser/process';

const packageRoot = join(import.meta.dirname, '..');
const browserScript = join(packageRoot, 'scripts', 'browser.js');
const bunExecutable = spawnSync('which', ['bun'], { encoding: 'utf8' }).stdout.trim();
const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'browser-review-'));
  temporaryDirectories.push(directory);
  return directory;
}

function fakeAgentBrowser(source: string): { bin: string; log: string } {
  const directory = temporaryDirectory();
  const bin = join(directory, 'agent-browser');
  const log = join(directory, 'calls.log');
  writeFileSync(bin, source);
  chmodSync(bin, 0o755);
  return { bin, log };
}

function cliEnvironment(bin: string, log: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: join(bin, '..') + ':' + process.env.PATH,
    AGENT_BROWSER_PROFILE: '/tmp/agent-browser-profile',
    FAKE_AGENT_BROWSER_LOG: log,
    ...extra,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe.sequential('browser review contracts', () => {
  it('should return a nonzero timeout result and force termination after the grace period', async () => {
    const { bin } = fakeAgentBrowser(`#!/usr/bin/env bun
process.on('SIGTERM', () => setTimeout(() => process.exit(0), 1500));
setInterval(() => {}, 1000);
`);
    const previousPath = process.env.PATH;
    process.env.PATH = join(bin, '..') + ':' + previousPath;
    const startedAt = Date.now();
    try {
      const result = await Effect.runPromise(createBrowserProcess(200).run({ args: ['hang'] }));
      expect(result.timedOut).toBe(true);
      expect(result.exitCode).not.toBe(0);
      expect(Date.now() - startedAt).toBeLessThan(1000);
    } finally {
      process.env.PATH = previousPath;
    }
  }, 3000);

  it('should preserve raw upstream flags when dispatching browser commands', () => {
    const { bin, log } = fakeAgentBrowser(`#!/usr/bin/env bun
import { appendFileSync } from 'node:fs';
appendFileSync(process.env.FAKE_AGENT_BROWSER_LOG!, JSON.stringify(process.argv.slice(2)) + '\\n');
`);
    const result = spawnSync(bunExecutable, [browserScript, 'raw', '--json', 'get', 'url', '--provider', 'ios'], {
      encoding: 'utf8',
      env: cliEnvironment(bin, log),
    });

    expect(result.status, JSON.stringify({ stdout: result.stdout, stderr: result.stderr, error: String(result.error || '') })).toBe(0);
    expect(JSON.parse(readFileSync(log, 'utf8').trim())).toEqual([
      '--profile', '/tmp/agent-browser-profile', '--json', 'get', 'url', '--provider', 'ios',
    ]);
  });

  it('should report failed command output once with an exit-code fallback', () => {
    const { bin, log } = fakeAgentBrowser(`#!/usr/bin/env bun
import { appendFileSync } from 'node:fs';
appendFileSync(process.env.FAKE_AGENT_BROWSER_LOG!, JSON.stringify(process.argv.slice(2)) + '\\n');
process.stdout.write('partial output\\n');
process.exit(2);
`);
    const result = spawnSync(bunExecutable, [browserScript, 'raw', 'get', 'url'], {
      encoding: 'utf8',
      env: cliEnvironment(bin, log),
    });

    expect(result.status).toBe(1);
    expect(result.stdout.match(/partial output/g)).toHaveLength(1);
    expect(result.stdout).toContain('error: exit code 2');
    expect(result.stdout).not.toContain('error: partial output');
  });

  it('should snapshot updated elements after typing text', () => {
    const { bin, log } = fakeAgentBrowser(`#!/usr/bin/env bun
import { appendFileSync } from 'node:fs';
appendFileSync(process.env.FAKE_AGENT_BROWSER_LOG!, JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.argv.includes('snapshot')) process.stdout.write('@e1 button Submit\\n');
`);
    const result = spawnSync(bunExecutable, [browserScript, 'type', '@e1', 'hello', 'world'], {
      encoding: 'utf8',
      env: cliEnvironment(bin, log),
    });

    expect(result.status, JSON.stringify({ stdout: result.stdout, stderr: result.stderr, error: String(result.error || '') })).toBe(0);
    const calls = readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    expect(calls).toEqual([
      ['--profile', '/tmp/agent-browser-profile', 'type', '@e1', 'hello world'],
      ['--profile', '/tmp/agent-browser-profile', 'wait', '500'],
      ['--profile', '/tmp/agent-browser-profile', 'snapshot', '-i'],
    ]);
    expect(result.stdout).toContain('--- updated elements ---');
  });
});
