import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { runAgentBrowser } from '../scripts/lib/browser/process';

const safeChromeLauncher = join(import.meta.dirname, '..', 'scripts', 'chrome-stderr-safe.sh');

describe('OS browser child process and Chrome stderr safety', () => {
  it('keeps draining >64 KiB stderr while CDP-like output continues, with bounded diagnostics', async () => {
    const result = await runAgentBrowser({
      args: ['-e', "process.stderr.write('X'.repeat(192 * 1024)); process.stdout.write('CDP_READY')"],
      timeoutMs: 4_000,
    }, 4_000, { command: process.execPath });

    expect(result).toMatchObject({ exitCode: 0, timedOut: false, runtimeMissing: false });
    expect(result.stdout).toContain('CDP_READY');
    expect(result.stderr).toContain('X');
    expect(Buffer.byteLength(result.stderr, 'utf8')).toBeLessThanOrEqual(65_536 + 100);
    expect(result.stderr).toContain('truncated');
  });

  it('settles child failures and permits a fresh successful helper invocation', async () => {
    const fail = await runAgentBrowser({
      args: ['-e', "process.stderr.write('helper failed'); process.exit(17)"],
    }, 3_000, { command: process.execPath });
    const retry = await runAgentBrowser({
      args: ['-e', "process.stdout.write('attached')"],
    }, 3_000, { command: process.execPath });

    expect(fail).toMatchObject({ exitCode: 17, timedOut: false });
    expect(fail.stderr).toContain('helper failed');
    expect(retry).toMatchObject({ stdout: 'attached', exitCode: 0, timedOut: false });
  });

  it('kills an unresponsive child and returns a typed timeout', async () => {
    const result = await runAgentBrowser({
      args: ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"],
      timeoutMs: 250,
    }, 3_000, { command: process.execPath });

    expect(result).toMatchObject({ exitCode: 124, timedOut: true });
  });

  it('does not hang when an exited helper leaves a descendant holding its stderr pipe', async () => {
    const started = Date.now();
    const fixture = [
      "const { spawn } = require('node:child_process')",
      "const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 1500)'], { stdio: ['ignore', 'ignore', 'inherit'] })",
      'child.unref()',
      "process.stdout.write('finished')",
    ].join('; ');
    const result = await runAgentBrowser({
      args: ['-e', fixture],
      timeoutMs: 3_000,
    }, 3_000, { command: process.execPath });

    expect(result).toMatchObject({ exitCode: 0, stdout: 'finished' });
    expect(Date.now() - started).toBeLessThan(1100);
  });

  it('routes owned Chrome stderr to a non-blocking sink without swallowing exit status', () => {
    const directory = mkdtempSync(join(tmpdir(), 'dev1628-chrome-'));
    try {
      const fakeChrome = join(directory, 'chrome-stderr-fixture.sh');
      const outcomeFile = join(directory, 'outcome');
      writeFileSync(fakeChrome, [
        '#!/bin/sh',
        'head -c 196608 /dev/zero >&2',
        'printf %s CDP_READY > "$DEV1628_RESULT_FILE"',
        '',
      ].join('\n'));
      chmodSync(fakeChrome, 0o700);
      const result = spawnSync(safeChromeLauncher, ['--headless', '--remote-debugging-port=0'], {
        encoding: 'utf8',
        timeout: 3_000,
        env: {
          ...process.env,
          CONSUELO_BROWSER_CHROME_BINARY: fakeChrome,
          DEV1628_RESULT_FILE: outcomeFile,
        },
      });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(readFileSync(outcomeFile, 'utf8')).toBe('CDP_READY');
      expect(result.stderr).toBe('');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('sets a safe Chrome executable for agent-browser without replacing user-specified paths', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dev1628-env-'));
    try {
      const fakeChrome = join(directory, 'chrome');
      writeFileSync(fakeChrome, '#!/bin/sh\nexit 0\n');
      chmodSync(fakeChrome, 0o700);
      const result = await runAgentBrowser({
        args: ['-e', "process.stdout.write(process.env.AGENT_BROWSER_EXECUTABLE_PATH || 'none')"],
      }, 3_000, {
        command: process.execPath,
        env: {
          ...process.env,
          CONSUELO_BROWSER_CHROME_BINARY: fakeChrome,
          AGENT_BROWSER_EXECUTABLE_PATH: undefined,
        },
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(safeChromeLauncher);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('preserves an explicitly configured browser executable as an opt-out', async () => {
    const customExecutable = '/tmp/dev1628-custom-browser';
    const result = await runAgentBrowser({
      args: ['-e', "process.stdout.write(process.env.AGENT_BROWSER_EXECUTABLE_PATH || 'none')"],
    }, 3_000, {
      command: process.execPath,
      env: {
        ...process.env,
        AGENT_BROWSER_EXECUTABLE_PATH: customExecutable,
        CONSUELO_BROWSER_CHROME_BINARY: undefined,
      },
    });
    expect(result).toMatchObject({ exitCode: 0, stdout: customExecutable });
  });
});
