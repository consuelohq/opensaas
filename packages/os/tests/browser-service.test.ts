import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  closeBrowserEffect,
  headedBrowserEffect,
  openBrowserEffect,
  statusBrowserEffect,
} from '../scripts/lib/browser/service';
import type { BrowserProcessRequest, BrowserProcessResult } from '../scripts/lib/browser/types';

const profilePath = '/Users/kokayi/.agent-browser-ko';

type RecordedCall = BrowserProcessRequest;

function successfulResult(stdout = ''): BrowserProcessResult {
  return { stdout, stderr: '', exitCode: 0, timedOut: false, runtimeMissing: false };
}

function context(outputs: Record<string, string> = {}) {
  const calls: RecordedCall[] = [];
  return {
    calls,
    value: {
      config: {
        profilePath,
        screenshotDir: '/tmp/opensaas-screenshots',
        defaultTimeoutMs: 30_000,
      },
      process: {
        run: (request: BrowserProcessRequest) => Effect.sync(() => {
          calls.push(request);
          const key = request.args.join(' ');
          return successfulResult(outputs[key] ?? '');
        }),
      },
    },
  };
}

function manifest(packageName: 'workspace' | 'os'): Array<{ name: string; description: string }> {
  const repoRoot = join(import.meta.dirname, '..', '..', '..');
  const path = packageName === 'workspace'
    ? join(repoRoot, 'packages', 'workspace', 'tooling', 'tool-manifest.json')
    : join(repoRoot, 'packages', 'os', 'tooling', 'dev-tool-manifest.json');
  return JSON.parse(readFileSync(path, 'utf8')) as Array<{ name: string; description: string }>;
}

describe('browser persistent headed handoff', () => {
  it('should leave a headed browser running when user login is required', async () => {
    const testContext = context({
      [`--profile ${profilePath} get url`]: 'https://dash.cloudflare.com/',
      [`--profile ${profilePath} get title`]: 'Cloudflare',
    });

    const result = await Effect.runPromise(headedBrowserEffect({
      url: 'https://dash.cloudflare.com',
    }, testContext.value));

    expect(testContext.calls.map((call) => call.args)).toEqual([
      ['close', '--all'],
      ['--profile', profilePath, '--headed', 'open', 'about:blank'],
      ['--profile', profilePath, 'open', 'https://dash.cloudflare.com'],
      ['--profile', profilePath, 'get', 'url'],
      ['--profile', profilePath, 'get', 'title'],
    ]);
    expect(testContext.calls.flatMap((call) => call.args)).not.toContain('auth');
    expect(testContext.calls.filter((call) => call.args[0] === 'close')).toHaveLength(1);
    expect(result).toMatchObject({
      mode: 'headed',
      profilePath,
      url: 'https://dash.cloudflare.com/',
      title: 'Cloudflare',
      leftRunning: true,
    });
  });

  it('should open headed mode when no browser daemon is currently running', async () => {
    const calls: RecordedCall[] = [];
    const testContext = {
      config: {
        profilePath,
        screenshotDir: '/tmp/opensaas-screenshots',
        defaultTimeoutMs: 30_000,
      },
      process: {
        run: (request: BrowserProcessRequest) => Effect.sync(() => {
          calls.push(request);
          if (request.args[0] === 'close') {
            return { stdout: '', stderr: 'no active browser session', exitCode: 1, timedOut: false, runtimeMissing: false };
          }
          return successfulResult();
        }),
      },
    };

    const result = await Effect.runPromise(headedBrowserEffect({
      url: 'https://github.com',
    }, testContext));

    expect(calls[0]?.args).toEqual(['close', '--all']);
    expect(calls[1]?.args).toEqual(['--profile', profilePath, '--headed', 'open', 'about:blank']);
    expect(calls[2]?.args).toEqual(['--profile', profilePath, 'open', 'https://github.com']);
    expect(result.leftRunning).toBe(true);
  });

  it('should use headed handoff behavior when open requests headed mode', async () => {
    const testContext = context();

    await Effect.runPromise(openBrowserEffect({
      url: 'https://github.com',
      headed: true,
    }, testContext.value));

    expect(testContext.calls[0]?.args).toEqual(['close', '--all']);
    expect(testContext.calls[1]?.args).toEqual([
      '--profile', profilePath, '--headed', 'open', 'about:blank',
    ]);
    expect(testContext.calls[2]?.args).toEqual([
      '--profile', profilePath, 'open', 'https://github.com',
    ]);
  });

  it('should preserve the current daemon when ordinary browsing is requested', async () => {
    const testContext = context();

    await Effect.runPromise(openBrowserEffect({
      url: 'https://example.com',
    }, testContext.value));

    expect(testContext.calls[0]?.args).toEqual([
      '--profile', profilePath, 'open', 'https://example.com',
    ]);
    expect(testContext.calls.some((call) => call.args[0] === 'close')).toBe(false);
  });

  it('should report safe browser status without authentication values', async () => {
    const testContext = context({
      [`--profile ${profilePath} session list`]: 'Active sessions:\n→ default',
      [`--profile ${profilePath} get url`]: 'https://dash.cloudflare.com/',
      [`--profile ${profilePath} get title`]: 'Cloudflare Dashboard',
    });

    const result = await Effect.runPromise(statusBrowserEffect({}, testContext.value));
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({
      profilePath,
      reachable: true,
      url: 'https://dash.cloudflare.com/',
      title: 'Cloudflare Dashboard',
    });
    expect(serialized).not.toMatch(/cookie|localStorage|sessionStorage|token|password/i);
  });

  it('should not launch a browser while reporting an inactive status', async () => {
    const calls: RecordedCall[] = [];
    const testContext = {
      config: {
        profilePath,
        screenshotDir: '/tmp/opensaas-screenshots',
        defaultTimeoutMs: 30_000,
      },
      process: {
        run: (request: BrowserProcessRequest) => Effect.sync(() => {
          calls.push(request);
          return request.args.includes('session')
            ? successfulResult('No active sessions')
            : successfulResult();
        }),
      },
    };

    const result = await Effect.runPromise(statusBrowserEffect({}, testContext));

    expect(calls.map((call) => call.args)).toEqual([
      ['--profile', profilePath, 'session', 'list'],
    ]);
    expect(result).toMatchObject({ reachable: false, url: '', title: '' });
  });

  it('should close the browser only when explicitly requested', async () => {
    const testContext = context();

    await Effect.runPromise(closeBrowserEffect(testContext.value));

    expect(testContext.calls.map((call) => call.args)).toEqual([['close', '--all']]);
  });

  it('should keep workspace and OS browser runtimes byte-identical', () => {
    const repoRoot = join(import.meta.dirname, '..', '..', '..');
    const files = [
      'scripts/browser.js',
      'scripts/lib/browser/cli.ts',
      'scripts/lib/browser/config.ts',
      'scripts/lib/browser/errors.ts',
      'scripts/lib/browser/process.ts',
      'scripts/lib/browser/service.ts',
      'scripts/lib/browser/types.ts',
    ];

    for (const file of files) {
      const workspaceFile = readFileSync(join(repoRoot, 'packages', 'workspace', file));
      const osFile = readFileSync(join(repoRoot, 'packages', 'os', file));
      expect(osFile.equals(workspaceFile), file).toBe(true);
    }
  });

  it.each(['login', 'reauth'])('should reject removed %s commands without invoking browser auth', (command) => {
    const packageRoot = join(import.meta.dirname, '..');
    const result = spawnSync('bun', [join(packageRoot, 'scripts', 'browser.js'), command, 'consuelo'], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('browser.login and browser.reauth were removed');
    expect(result.stdout).toContain('browser.headed <url>');
    expect(result.stdout).not.toContain('Timed out waiting for username field');
    expect(result.stderr).not.toMatch(/BrowserServiceError|at .*browser/i);
  });

  it.each(['workspace', 'os'] as const)('should expose headed handoff and remove auth-vault tools in %s', (packageName) => {
    const entries = manifest(packageName);
    const names = entries.map((entry) => entry.name);
    const headed = entries.find((entry) => entry.name === 'browser.headed');

    expect(names).toContain('browser.headed');
    expect(names).toContain('browser.status');
    expect(names).not.toContain('browser.login');
    expect(names).not.toContain('browser.reauth');
    expect(headed?.description).toMatch(/user.*login|login.*user|human/i);
  });
});
