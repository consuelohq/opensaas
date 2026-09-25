import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { runSubagentProcess } from '../scripts/lib/subagent/runtime';

import {
  preserveFirstTerminationOutcome,
  providerOutcomeForClose,
  providerExitCodeForOutcome,
  scheduleProviderProcessEscalation,
  signalProviderProcess,
} from '../scripts/lib/subagent/process-termination';

describe('subagent runner termination', () => {
  it('forces a nonzero exit code for timed-out providers', () => {
    expect(providerExitCodeForOutcome('timed_out', 0)).toBe(124);
    expect(providerExitCodeForOutcome('timed_out', null)).toBe(124);
    expect(providerExitCodeForOutcome('timed_out', 143)).toBe(143);
    expect(providerExitCodeForOutcome('cancelled', 0)).toBe(0);
    expect(providerExitCodeForOutcome(undefined, 0)).toBe(0);
  });

  it('keeps setup failures failed when provider cleanup exits zero', () => {
    expect(providerOutcomeForClose(undefined, 'stdin handoff failed', 0)).toBe('failed');
  });

  it('preserves the first timeout or cancellation cause during escalation', () => {
    expect(preserveFirstTerminationOutcome(undefined, 'timed_out')).toBe('timed_out');
    expect(preserveFirstTerminationOutcome('timed_out', 'cancelled')).toBe('timed_out');
    expect(preserveFirstTerminationOutcome('cancelled', 'timed_out')).toBe('cancelled');
  });

  it('keeps SIGKILL escalation scheduled after the direct provider exits', () => {
    const provider = { pid: 7777, kill: vi.fn(() => true) };
    let scheduled: (() => void) | undefined;
    const unref = vi.fn();
    const schedule = vi.fn((callback: () => void) => {
      scheduled = callback;
      return { unref };
    });
    const signal = vi.fn(() => true);

    scheduleProviderProcessEscalation(provider, 250, schedule, signal);
    // Simulate the direct child having already emitted close/finished before escalation.
    scheduled?.();

    expect(schedule).toHaveBeenCalledWith(expect.any(Function), 250);
    expect(unref).not.toHaveBeenCalled();
    expect(signal).toHaveBeenCalledWith(provider, 'SIGKILL');
  });

  it('keeps the runner process alive until the escalation callback executes', () => {
    const root = mkdtempSync(join(tmpdir(), 'subagent-escalation-reference-'));
    const marker = join(root, 'escalated.txt');
    const script = join(root, 'probe.mjs');
    const helperUrl = pathToFileURL(fileURLToPath(new URL('../scripts/lib/subagent/process-termination.ts', import.meta.url))).href;
    writeFileSync(script, [
      `import { scheduleProviderProcessEscalation } from ${JSON.stringify(helperUrl)};`,
      `import { writeFileSync } from 'node:fs';`,
      `const marker = ${JSON.stringify(marker)};`,
      `scheduleProviderProcessEscalation({ pid: 7777, kill: () => true }, 50, undefined, (_provider, signal) => { writeFileSync(marker, signal); return true; });`,
    ].join('\n'));

    try {
      const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
      expect(result.status).toBe(0);
      expect(readFileSync(marker, 'utf8')).toBe('SIGKILL');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('tolerates EPIPE when a provider closes stdin before the prompt is written', async () => {
    const root = mkdtempSync(join(tmpdir(), 'subagent-stdin-epipe-'));
    const script = join(root, 'close-stdin.mjs');
    writeFileSync(script, [
      "import { closeSync } from 'node:fs';",
      'closeSync(0);',
      'setTimeout(() => process.exit(0), 50);',
    ].join('\n'));

    try {
      const result = await runSubagentProcess({
        command: process.execPath,
        args: [script],
        cwd: root,
        env: process.env,
        timeoutMs: 2_000,
        stdin: 'x'.repeat(8 * 1024 * 1024),
      });

      expect(result.timedOut).toBe(false);
      expect(result.exitCode).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes a completed exit marker when the detached provider closes stdin early', async () => {
    const root = mkdtempSync(join(tmpdir(), 'subagent-detached-stdin-epipe-'));
    const runDirectory = join(root, 'run');
    const provider = join(root, 'close-stdin-provider');
    mkdirSync(runDirectory, { recursive: true });
    writeFileSync(provider, [
      '#!/bin/sh',
      'exec 0<&-',
      'sleep 0.05',
      'exit 0',
    ].join('\n'));
    chmodSync(provider, 0o700);

    const stdinPath = join(runDirectory, 'stdin.txt');
    const stdoutLogPath = join(runDirectory, 'stdout.jsonl');
    const stderrLogPath = join(runDirectory, 'stderr.log');
    const exitMarkerPath = join(runDirectory, 'exit.json');
    const ownerMarkerPath = join(runDirectory, 'owner.json');
    const runId = 'run_runner_stdin_epipe';
    writeFileSync(stdinPath, 'x'.repeat(8 * 1024 * 1024));
    writeFileSync(stdoutLogPath, '');
    writeFileSync(stderrLogPath, '');
    writeFileSync(join(runDirectory, 'launch.json'), JSON.stringify({
      runId,
      ownerToken: 'owner-runner-stdin-epipe',
      command: [provider],
      cwd: root,
      stdinPath,
      stdoutLogPath,
      stderrLogPath,
      ownerMarkerPath,
      exitMarkerPath,
      timeoutMs: 5_000,
      deadlineAt: Date.now() + 5_000,
    }, null, 2));

    const runnerPath = fileURLToPath(new URL('../scripts/lib/subagent/runner.ts', import.meta.url));
    const child = spawn(process.execPath, [runnerPath, runDirectory], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let runnerStderr = '';
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk) => { runnerStderr += chunk; });

    try {
      const exitCode = await new Promise<number | null>((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      });
      expect(exitCode, runnerStderr).toBe(0);
      expect(existsSync(exitMarkerPath), runnerStderr).toBe(true);
      const marker = JSON.parse(readFileSync(exitMarkerPath, 'utf8')) as {
        outcome?: unknown;
        exitCode?: unknown;
        error?: unknown;
      };
      expect(marker.outcome).toBe('completed');
      expect(marker.exitCode).toBe(0);
      expect(marker.error).toBeUndefined();
    } finally {
      if (child.pid !== undefined) {
        try { process.kill(child.pid, 'SIGKILL'); } catch {}
      }
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('falls back to ChildProcess.kill on Windows', () => {
    const childKill = vi.fn(() => true);
    const groupKill = vi.fn(() => { throw new Error('negative pid unsupported'); });

    const signalled = signalProviderProcess(
      { pid: 1234, kill: childKill },
      'SIGTERM',
      'win32',
      groupKill,
    );

    expect(signalled).toBe(true);
    expect(groupKill).not.toHaveBeenCalled();
    expect(childKill).toHaveBeenCalledWith('SIGTERM');
  });

  it('falls back to ChildProcess.kill when POSIX group signalling fails', () => {
    const childKill = vi.fn(() => true);
    const groupKill = vi.fn(() => { throw new Error('group disappeared'); });

    expect(signalProviderProcess({ pid: 4321, kill: childKill }, 'SIGKILL', 'darwin', groupKill)).toBe(true);
    expect(groupKill).toHaveBeenCalledWith(-4321, 'SIGKILL');
    expect(childKill).toHaveBeenCalledWith('SIGKILL');
  });
});
