import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  buildGoogleCommand,
  createGoogleService,
  GoogleError,
} from '../tools/google/service';
import type { ProviderProcess } from '../tools/deployment-provider/types';

const successfulProcess = (calls: Array<{ command: string; args: string[] }>): ProviderProcess => ({
  execPath: process.execPath,
  run: (request) => {
    calls.push({ command: request.command, args: [...request.args] });
    return Effect.succeed({
      stdout: JSON.stringify({ ok: true }),
      stderr: '',
      exitCode: 0,
      timedOut: false,
      cancelled: false,
      runtimeMissing: false,
      stdoutTruncated: false,
      stderrTruncated: false,
    });
  },
});

describe('google tool service', () => {
  it('uses the non-blocking auth status primitive for connection checks', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const service = createGoogleService({
      process: successfulProcess(calls),
      executable: '/managed/gog',
    });
    await Effect.runPromise(service.status());
    expect(calls).toEqual([{
      command: '/managed/gog',
      args: ['--json', '--no-input', 'auth', 'status'],
    }]);
  });

  it('forces read requests through gog readonly JSON automation safeguards', () => {
    const command = buildGoogleCommand({
      executable: '/managed/gog',
      args: ['gmail', 'search', 'from:billing@example.com'],
      mode: 'read',
    });
    expect(command.command).toBe('/managed/gog');
    expect(command.args).toEqual([
      '--json',
      '--no-input',
      '--wrap-untrusted',
      '--readonly',
      'gmail',
      'search',
      'from:billing@example.com',
    ]);
  });

  it('allows only the six Google Workspace service families', () => {
    expect(() => buildGoogleCommand({
      executable: '/managed/gog',
      args: ['youtube', 'search', 'cats'],
      mode: 'read',
    })).toThrow(/gmail.*calendar.*drive.*docs.*sheets.*contacts/i);
  });

  it('rejects caller-controlled root flags that could bypass wrapper policy', () => {
    expect(() => buildGoogleCommand({
      executable: '/managed/gog',
      args: ['gmail', 'search', 'x', '--access-token', 'secret'],
      mode: 'read',
    })).toThrow(/access-token/i);
  });

  it('requires explicit approval for write mode before launching gog', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const service = createGoogleService({
      process: successfulProcess(calls),
      executable: '/managed/gog',
    });
    const exit = await Effect.runPromiseExit(service.run({
      args: ['gmail', 'send', '--to', 'person@example.com', '--subject', 'Hello', '--body', 'Hi'],
      mode: 'write',
    }));
    expect(exit._tag).toBe('Failure');
    expect(calls).toHaveLength(0);
    if (exit._tag === 'Failure') {
      const failure = String(exit.cause);
      expect(failure).toContain('APPROVAL_REQUIRED');
    }
  });

  it('executes approved writes without the readonly flag', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const service = createGoogleService({
      process: successfulProcess(calls),
      executable: '/managed/gog',
    });
    await Effect.runPromise(service.run({
      args: ['calendar', 'create', 'primary', '--summary', 'Review'],
      mode: 'write',
      approval: { approved: true, reason: 'User approved calendar mutation' },
    }));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args).not.toContain('--readonly');
    expect(calls[0]?.args.slice(0, 3)).toEqual(['--json', '--no-input', '--wrap-untrusted']);
  });

  it('uses a typed Google error surface', () => {
    const error = new GoogleError({ code: 'AUTH_REQUIRED', message: 'Connect Google.' });
    expect(error.code).toBe('AUTH_REQUIRED');
  });
});
