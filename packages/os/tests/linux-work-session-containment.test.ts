import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import { runRuntimeEffect } from '../scripts/lib/code-call/process';
import {
  BUBBLEWRAP_EXECUTABLE,
  buildContainedRuntimeEnv,
  planLinuxWorkSessionContainment,
} from '../scripts/lib/code-call/linux-containment';

function plan(allowBoundaryWrites: boolean) {
  return planLinuxWorkSessionContainment({
    command: '/bin/sh',
    args: ['-c', 'echo test'],
    writeBoundaryRoot: '/tmp/cloud-work-session',
    scratchRoot: '/tmp/cloud-scratch-stage',
    protectedReadRoots: [
      '/var/lib/consuelo/node/keys',
      '/var/lib/consuelo/node/security/generated',
      '/var/lib/consuelo/node/tunnels',
    ],
    allowBoundaryWrites,
  });
}

describe('Linux work-session Bubblewrap planning', () => {
  it('mounts the entire host read-only and allows writes only to work and scratch roots', () => {
    const result = plan(true);
    expect(result.command).toBe(BUBBLEWRAP_EXECUTABLE);
    const args = result.args;
    expect(args.slice(0, 3)).toEqual(['--ro-bind', '/', '/']);
    expect(args).toContain('--unshare-user');
    expect(args).toContain('--unshare-pid');
    expect(args).toContain('--unshare-ipc');
    expect(args).toContain('--die-with-parent');
    expect(args).toContain('--new-session');
    expect(args).toContain('--dev');
    expect(args).toContain('--proc');
    expect(args.join(' ')).not.toContain('--dev-bind');
    expect(args).toEqual(expect.arrayContaining([
      '--bind', '/tmp/cloud-work-session', '/tmp/cloud-work-session',
      '--bind', '/tmp/cloud-scratch-stage', '/tmp/cloud-scratch-stage',
    ]));
    expect(args.slice(-4)).toEqual(['--', '/bin/sh', '-c', 'echo test']);
    const keyIndex = args.indexOf('/var/lib/consuelo/node/keys');
    expect(args[keyIndex - 1]).toBe('--tmpfs');
  });

  it('never gives write access to the work root in read mode', () => {
    const args = plan(false).args;
    expect(args.includes('/tmp/cloud-work-session')).toBe(false);
    expect(args).toEqual(expect.arrayContaining([
      '--bind', '/tmp/cloud-scratch-stage', '/tmp/cloud-scratch-stage',
    ]));
  });

  it('rejects invalid work or scratch boundaries before launching a child', () => {
    expect(() => planLinuxWorkSessionContainment({
      command: '/bin/sh',
      args: [],
      writeBoundaryRoot: '../relative',
      scratchRoot: '/tmp/scratch',
      protectedReadRoots: [],
      allowBoundaryWrites: true,
    })).toThrow(/absolute|invalid/i);
    expect(() => planLinuxWorkSessionContainment({
      command: '/bin/sh',
      args: [],
      writeBoundaryRoot: '/tmp/session',
      scratchRoot: '/tmp/session',
      protectedReadRoots: [],
      allowBoundaryWrites: true,
    })).toThrow(/scratch|distinct/i);
  });

  it('does not inherit daemon secrets, GitHub credentials or SSH agent sockets', () => {
    const env = buildContainedRuntimeEnv({
      PATH: '/home/consuelo/.bun/bin:/usr/bin',
      HOME: '/home/consuelo',
      USER: 'consuelo',
      LANG: 'en_US.UTF-8',
      GH_TOKEN: 'do-not-leak',
      ANTHROPIC_API_KEY: 'do-not-leak',
      OPENAI_API_KEY: 'do-not-leak',
      SSH_AUTH_SOCK: '/tmp/agent.sock',
      CONSUELO_EDGE_SECRET: 'do-not-leak',
    }, '/tmp/contained-scratch');
    expect(env).toMatchObject({
      PATH: '/home/consuelo/.bun/bin:/usr/bin',
      HOME: '/home/consuelo',
      USER: 'consuelo',
      LANG: 'en_US.UTF-8',
      TMPDIR: '/tmp/contained-scratch/',
      XDG_CACHE_HOME: '/tmp/contained-scratch',
    });
    for (const key of ['GH_TOKEN', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'SSH_AUTH_SOCK', 'CONSUELO_EDGE_SECRET']) {
      expect(env[key]).toBeUndefined();
    }
  });

  it.skipIf(process.platform !== 'linux' || !existsSync('/usr/bin/bwrap'))('enforces filesystem isolation with the Linux kernel', () => {
    const root = mkdtempSync(join(tmpdir(), 'consuelo-linux-sandbox-'));
    try {
      const work = join(root, 'work');
      const scratch = join(root, 'scratch');
      const outside = join(root, 'outside');
      const secrets = join(root, 'secrets');
      for (const p of [work, scratch, outside, secrets]) mkdirSync(p);
      writeFileSync(join(outside, 'existing.txt'), 'preserved');
      writeFileSync(join(secrets, 'key.txt'), 'must-not-read');
      symlinkSync(outside, join(work, 'escape-link'));
      const write = planLinuxWorkSessionContainment({
        command: '/bin/sh',
        args: ['-c', 'printf work > "$1/created.txt"; if printf escape > "$1/escape-link/wrong.txt" 2>/dev/null; then echo ESCAPED; else echo BLOCKED; fi; if cat "$2/key.txt" 2>/dev/null; then echo LEAKED; else echo MASKED; fi', 'sh', work, secrets],
        writeBoundaryRoot: work,
        scratchRoot: scratch,
        protectedReadRoots: [secrets],
        allowBoundaryWrites: true,
      });
      const result = spawnSync(write.command, write.args, { encoding: 'utf8', timeout: 12_000 });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('BLOCKED');
      expect(result.stdout).toContain('MASKED');
      expect(result.stdout).not.toContain('LEAKED');
      expect(readFileSync(join(work, 'created.txt'), 'utf8')).toBe('work');
      expect(readFileSync(join(outside, 'existing.txt'), 'utf8')).toBe('preserved');
      expect(existsSync(join(outside, 'wrong.txt'))).toBe(false);

      const readOnly = planLinuxWorkSessionContainment({
        command: '/bin/sh',
        args: ['-c', 'if printf denied > "$1/read-mode.txt" 2>/dev/null; then echo ESCAPED; else echo READ_ONLY; fi', 'sh', work],
        writeBoundaryRoot: work,
        scratchRoot: scratch,
        protectedReadRoots: [secrets],
        allowBoundaryWrites: false,
      });
      const ro = spawnSync(readOnly.command, readOnly.args, { encoding: 'utf8', timeout: 12_000 });
      expect(ro.status, ro.stderr).toBe(0);
      expect(ro.stdout).toContain('READ_ONLY');
      expect(existsSync(join(work, 'read-mode.txt'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform !== 'linux' || !existsSync('/usr/bin/bwrap'))('uses the sandbox in actual code.call process execution', async () => {
    const root = mkdtempSync(join(tmpdir(), 'consuelo-linux-runtime-'));
    try {
      const home = join(root, '.consuelo');
      const work = join(root, 'work');
      const scratch = join(root, 'scratch');
      const outside = join(root, 'outside');
      mkdirSync(join(home, 'node', 'keys'), { recursive: true });
      for (const p of [work, scratch, outside]) mkdirSync(p);
      writeFileSync(join(home, 'node', 'keys', 'test-secret.txt'), 'should-stay-hidden');
      const result = await Effect.runPromise(runRuntimeEffect('/bin/sh', [
        '-c',
        'printf inside > "$1/inside.txt"; if printf outside > "$2/escape.txt" 2>/dev/null; then echo ESCAPED; else echo BLOCKED; fi; if test -n "$GH_TOKEN"; then echo ENV_LEAKED; else echo ENV_CLEAN; fi; if cat "$3/node/keys/test-secret.txt" 2>/dev/null; then echo LEAKED; else echo MASKED; fi',
        'sh',
        work,
        outside,
        home,
      ], {
        cwd: work,
        env: { ...process.env, HOME: root, CONSUELO_HOME: home, GH_TOKEN: 'must-not-leak' },
        timeoutMs: 12_000,
        writeBoundaryRoot: work,
        scratchRoot: scratch,
        requireContainment: true,
        allowBoundaryWrites: true,
      }));
      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.containmentUnavailable).toBe(false);
      expect(result.stdout).toContain('BLOCKED');
      expect(result.stdout).toContain('ENV_CLEAN');
      expect(result.stdout).toContain('MASKED');
      expect(result.stdout).not.toContain('LEAKED');
      expect(existsSync(join(outside, 'escape.txt'))).toBe(false);
      expect(readFileSync(join(work, 'inside.txt'), 'utf8')).toBe('inside');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
