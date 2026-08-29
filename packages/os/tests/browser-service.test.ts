import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  closeBrowserEffect,
  headedBrowserEffect,
  openBrowserEffect,
  runBrowserCommandEffect,
  statusBrowserEffect,
} from '../scripts/lib/browser/service';
import { BrowserServiceError } from '../scripts/lib/browser/errors';
import type { BrowserProcessRequest, BrowserProcessResult } from '../scripts/lib/browser/types';
import { toolPackage as osUtilitiesToolPackage } from '../tools/utilities/manifest';

const profilePath = '/tmp/agent-browser-profile';

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

function manifest(packageName: 'workspace' | 'os'): Array<{
  name: string;
  description: string;
  capabilities?: { readOnly: boolean; mutating: boolean; safeToRetry: boolean };
}> {
  if (packageName === 'os') {
    return osUtilitiesToolPackage.definitions.map((definition) => ({
      name: definition.name,
      description: String(definition.description ?? ''),
      capabilities: definition.capabilities as {
        readOnly: boolean;
        mutating: boolean;
        safeToRetry: boolean;
      } | undefined,
    }));
  }

  const repoRoot = join(import.meta.dirname, '..', '..', '..');
  const path = join(repoRoot, 'packages', 'workspace', 'tooling', 'tool-manifest.json');
  type Entry = {
    name: string;
    description: string;
    capabilities?: { readOnly: boolean; mutating: boolean; safeToRetry: boolean };
  };
  return JSON.parse(readFileSync(path, 'utf8')) as Entry[];

}

describe('browser persistent headed handoff', () => {
  it('should leave a headed browser running when user login is required', async () => {
    const testContext = context({
      '--session consuelo-human --headed get url': 'https://dash.cloudflare.com/',
      '--session consuelo-human --headed get title': 'Cloudflare',
    });

    const result = await Effect.runPromise(headedBrowserEffect({
      url: 'https://dash.cloudflare.com',
    }, testContext.value));

    expect(testContext.calls.map((call) => call.args)).toEqual([
      ['--session', 'consuelo-human', '--profile', profilePath, '--headed', 'open', 'https://dash.cloudflare.com/'],
      ['--session', 'consuelo-human', '--headed', 'get', 'url'],
      ['--session', 'consuelo-human', '--headed', 'get', 'title'],
    ]);
    expect(testContext.calls.flatMap((call) => call.args)).not.toContain('auth');
    expect(testContext.calls.flatMap((call) => call.args)).not.toContain('close');
    expect(result).toMatchObject({
      mode: 'headed',
      profilePath,
      url: 'https://dash.cloudflare.com/',
      title: 'Cloudflare',
      leftRunning: true,
    });
  });

  it('should open headed mode when no browser daemon is currently running', async () => {
    const testContext = context();

    const result = await Effect.runPromise(headedBrowserEffect({
      url: 'https://github.com',
    }, testContext.value));

    expect(testContext.calls[0]?.args).toEqual([
      '--session', 'consuelo-human', '--profile', profilePath, '--headed', 'open', 'https://github.com/',
    ]);
    expect(testContext.calls.some((call) => call.args.includes('close'))).toBe(false);
    expect(result.leftRunning).toBe(true);
  });

  it('should use headed handoff behavior when open requests headed mode', async () => {
    const testContext = context();

    await Effect.runPromise(openBrowserEffect({
      url: 'https://github.com',
      headed: true,
    }, testContext.value));

    expect(testContext.calls[0]?.args).toEqual([
      '--session', 'consuelo-human', '--profile', profilePath, '--headed', 'open', 'https://github.com/',
    ]);
    expect(testContext.calls.some((call) => call.args.includes('close'))).toBe(false);
  });

  it('should preserve the current daemon when ordinary browsing is requested', async () => {
    const testContext = context();

    await Effect.runPromise(openBrowserEffect({
      url: 'https://example.com',
    }, testContext.value));

    expect(testContext.calls[0]?.args).toEqual(['session', 'list']);
    expect(testContext.calls[1]?.args).toEqual([
      '--profile', profilePath, 'open', 'https://example.com/',
    ]);
    expect(testContext.calls.some((call) => call.args[0] === 'close')).toBe(false);
  });


  it('should forward provider options when opening existing or headed browsers', async () => {
    const existingContext = context();
    await Effect.runPromise(openBrowserEffect({
      url: 'https://example.com',
      provider: 'ios',
    }, existingContext.value));
    expect(existingContext.calls[0]?.args).toEqual(['session', 'list']);
    expect(existingContext.calls[1]?.args).toEqual([
      '--profile', profilePath, '--provider', 'ios', 'open', 'https://example.com/',
    ]);

    const headedContext = context();
    await Effect.runPromise(openBrowserEffect({
      url: 'https://example.com',
      headed: true,
      provider: 'ios',
    }, headedContext.value));
    expect(headedContext.calls.map((call) => call.args)).toEqual([
      ['--session', 'consuelo-human', '--profile', profilePath, '--provider', 'ios', '--headed', 'open', 'https://example.com/'],
      ['--session', 'consuelo-human', '--provider', 'ios', '--headed', 'get', 'url'],
      ['--session', 'consuelo-human', '--provider', 'ios', '--headed', 'get', 'title'],
    ]);
  });

  it('should route follow-up commands to the persistent human session when it exists', async () => {
    const testContext = context({
      'session list': 'Active sessions:\n  default\n→ consuelo-human',
    });

    await Effect.runPromise(runBrowserCommandEffect({
      args: ['snapshot', '-i'],
    }, testContext.value));

    expect(testContext.calls.map((call) => call.args)).toEqual([
      ['session', 'list'],
      ['--session', 'consuelo-human', '--headed', 'snapshot', '-i'],
    ]);
  });

  it('should preserve explicit session and profile routing without injecting the shared profile', async () => {
    const explicitProfile = '/tmp/checkout-profile';
    const explicitArgs = [
      '--session', 'checkout-e2e-human',
      '--profile', explicitProfile,
      '--headed',
      'get', 'url',
    ];
    const testContext = context();

    await Effect.runPromise(runBrowserCommandEffect({ args: explicitArgs }, testContext.value));

    expect(testContext.calls.map((call) => call.args)).toEqual([explicitArgs]);
    expect(testContext.calls[0]?.args.filter((arg) => arg === '--profile')).toHaveLength(1);
    expect(testContext.calls[0]?.args).not.toContain(profilePath);
  });

  it.each([
    ['runtime missing', { stdout: '', stderr: 'missing', exitCode: 1, timedOut: false, runtimeMissing: true }, 'BROWSER_RUNTIME_MISSING'],
    ['timeout', { stdout: '', stderr: '', exitCode: 124, timedOut: true, runtimeMissing: false }, 'BROWSER_TIMEOUT'],
  ] as const)('should propagate a typed %s failure when browser status cannot run', async (_label, result, code) => {
    const testContext = {
      config: {
        profilePath,
        screenshotDir: '/tmp/opensaas-screenshots',
        defaultTimeoutMs: 30_000,
      },
      process: {
        run: (_request: BrowserProcessRequest) => Effect.succeed(result),
      },
    };

    const failure = await Effect.runPromise(Effect.flip(statusBrowserEffect({}, testContext)));
    expect(failure).toBeInstanceOf(BrowserServiceError);
    expect((failure as BrowserServiceError).code).toBe(code);
  });

  it('should return invalid URL errors through the Effect error channel', async () => {
    const testContext = context();
    const failure = await Effect.runPromise(Effect.flip(openBrowserEffect({
      url: 'not a valid URL',
    }, testContext.value)));

    expect(failure).toBeInstanceOf(BrowserServiceError);
    expect((failure as BrowserServiceError).code).toBe('BROWSER_INVALID_URL');
    expect(testContext.calls).toEqual([]);
  });

  it('should report safe browser status without authentication values', async () => {
    const testContext = context({
      'session list': 'Active sessions:\n→ default',
      '--session default get url': 'https://dash.cloudflare.com/',
      '--session default get title': 'Cloudflare Dashboard',
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
      ['session', 'list'],
    ]);
    expect(result).toMatchObject({ reachable: false, url: '', title: '' });
  });

  it('should inspect the human session without reopening or demoting it', async () => {
    const testContext = context({
      'session list': 'Active sessions:\n  default\n→ consuelo-human',
      '--session consuelo-human --headed get url': 'https://github.com/',
      '--session consuelo-human --headed get title': 'GitHub',
    });

    const result = await Effect.runPromise(statusBrowserEffect({}, testContext.value));

    expect(testContext.calls.map((call) => call.args)).toEqual([
      ['session', 'list'],
      ['--session', 'consuelo-human', '--headed', 'get', 'url'],
      ['--session', 'consuelo-human', '--headed', 'get', 'title'],
    ]);
    expect(result).toMatchObject({ reachable: true, url: 'https://github.com/', title: 'GitHub' });
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

    const snap = entries.find((entry) => entry.name === 'browser.snap');
    expect(snap?.capabilities).toMatchObject({ readOnly: true, mutating: false, safeToRetry: true });

    const screenshot = entries.find((entry) => entry.name === 'browser.screenshot');
    expect(screenshot?.capabilities).toMatchObject({ readOnly: false, mutating: false, safeToRetry: false });
  });
});
