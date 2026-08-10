import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  cancelDurableSubagentRun,
  reconcileDurableSubagentRun,
  resolveSubagentRunDirectory,
  startDurableSubagentRun,
  waitForDurableSubagentRun,
  type DurableSubagentRun,
} from '../scripts/lib/subagent/lifecycle';

function makeEnvironment(home: string, counterPath?: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CONSUELO_HOME: home,
    ...(counterPath ? { SPAWN_COUNTER: counterPath } : {}),
  };
}

function writeExecutable(root: string, name: string, source: string): string {
  const executable = join(root, name);
  writeFileSync(executable, source);
  chmodSync(executable, 0o700);
  return executable;
}

function readRegularFiles(root: string): string[] {
  const contents: string[] = [];
  for (const entry of readdirSync(root)) {
    const filePath = join(root, entry);
    if (statSync(filePath).isDirectory()) contents.push(...readRegularFiles(filePath));
    else if (statSync(filePath).isFile()) contents.push(readFileSync(filePath, 'utf8'));
  }
  return contents;
}

function startInput(
  executable: string,
  home: string,
  instructionPath: string,
  requestId: string,
  timeoutMs = 5_000,
) {
  return {
    requestId,
    fingerprint: JSON.stringify({ executable, instructionPath }),
    provider: 'codex',
    model: 'gpt-5.6-luna',
    policy: 'read',
    cwd: home,
    instructionPath,
    command: [executable],
    env: makeEnvironment(home),
    stdin: 'read the instruction',
    timeoutMs,
    traceId: 'trace-' + requestId,
  };
}

function runConcurrentStarter(code: string, env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('bun', ['-e', code], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (exitCode) => {
      if (exitCode === 0) resolve(stdout);
      else reject(new Error(stderr || 'starter exited with ' + exitCode));
    });
  });
}

async function waitForProcessGroupExit(pid: number): Promise<boolean> {
  const deadline = Date.now() + 1_000;
  while (Date.now() < deadline) {
    try {
      process.kill(-pid, 0);
    } catch {
      try {
        process.kill(pid, 0);
      } catch {
        return true;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return false;
}

async function waitForProviderPid(run: DurableSubagentRun): Promise<number> {
  if (!run.ownerMarkerPath) throw new Error('missing owner marker path');
  const deadline = Date.now() + 1_000;
  while (Date.now() < deadline) {
    try {
      const marker = JSON.parse(readFileSync(run.ownerMarkerPath, 'utf8')) as { providerPid?: unknown };
      if (typeof marker.providerPid === 'number') return marker.providerPid;
    } catch {
      // The runner publishes the marker atomically after it owns the provider.
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('provider owner marker was not published');
}

describe('durable subagent lifecycle regressions', () => {
  it('atomically claims a requestId so concurrent starts spawn exactly once', async () => {
    const home = mkdtempSync(join(tmpdir(), 'os-lifecycle-home-'));
    const instructionPath = join(home, 'instructions.md');
    const counterPath = join(home, 'provider-spawns.log');
    const barrierPath = join(home, 'claim-barrier');
    try {
      const executable = writeExecutable(home, 'provider', [
        '#!/bin/sh',
        'printf "%s\\n" spawn >> "$SPAWN_COUNTER"',
        'sleep 0.2',
      ].join('\n'));
      writeFileSync(instructionPath, 'instruction');
      mkdirSync(barrierPath);
      writeFileSync(join(barrierPath, '.keep'), '');
      const modulePath = join(process.cwd(), 'packages/os/scripts/lib/subagent/lifecycle.ts');
      const values = { executable, home, instructionPath };
      const code = [
        "import { readdirSync, writeFileSync } from 'node:fs';",
        "import { join } from 'node:path';",
        "const barrierPath = process.env.CLAIM_BARRIER_DIR;",
        "if (!barrierPath) throw new Error('missing claim barrier');",
        "const beforeInitialClaim = () => {",
        "  writeFileSync(join(barrierPath, process.pid + '.ready'), 'ready');",
        "  const signal = new Int32Array(new SharedArrayBuffer(4));",
        "  const deadline = Date.now() + 5_000;",
        "  while (readdirSync(barrierPath).filter((name) => name.endsWith('.ready')).length < 8 && Date.now() < deadline) Atomics.wait(signal, 0, 0, 10);",
        "};",
        'const { startDurableSubagentRun } = await import(' + JSON.stringify(modulePath) + ');',
        'const v = ' + JSON.stringify(values) + ';',
        "const r = startDurableSubagentRun({ requestId: 'req-concurrent', fingerprint: JSON.stringify(v), provider: 'codex', policy: 'read', cwd: v.home, instructionPath: v.instructionPath, command: [v.executable], env: process.env, stdin: 'instruction', timeoutMs: 5000, traceId: 'trace-concurrent' }, { beforeInitialClaim });",
        'process.stdout.write(JSON.stringify(r));',
      ].join('\n');
      const env = { ...makeEnvironment(home, counterPath), CLAIM_BARRIER_DIR: barrierPath };
      const outputs = await Promise.all(Array.from({ length: 8 }, () => runConcurrentStarter(code, env)));
      await new Promise((resolve) => setTimeout(resolve, 400));
      const spawnLines = readFileSync(counterPath, 'utf8').trim().split('\n').filter(Boolean);
      const results = outputs.map((output) => JSON.parse(output) as {
        ok: boolean;
        reused: boolean;
        run: { runId: string };
      });
      const runIds = new Set(results.map((result) => result.run.runId));
      const fresh = results.filter((result) => result.reused === false);
      const reused = results.filter((result) => result.reused === true);

      expect(outputs).toHaveLength(8);
      expect(spawnLines).toHaveLength(1);
      expect(runIds.size).toBe(1);
      expect(fresh).toHaveLength(1);
      expect(reused).toHaveLength(7);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('marks a claimed run completion_unknown after startup grace when no runner PID was published', () => {
    const home = mkdtempSync(join(tmpdir(), 'subagent-pre-spawn-'));
    const environment = makeEnvironment(home);
    const executable = writeExecutable(home, 'never-spawned-provider', '#!/bin/sh\nexit 0\n');
    const instructionPath = join(home, 'instructions.md');
    writeFileSync(instructionPath, 'read only');
    const input = startInput(executable, home, instructionPath, 'pre-spawn-recovery');
    let claimed: DurableSubagentRun | undefined;

    expect(() => startDurableSubagentRun(input, {
      beforeRunnerSpawn: (run) => {
        claimed = run;
        throw new Error('simulate winner crash before runner spawn');
      },
    })).toThrow('simulate winner crash before runner spawn');
    expect(claimed).toBeDefined();

    const aged = {
      ...claimed,
      startedAt: Date.now() - 2_000 - 10,
      updatedAt: Date.now() - 2_000 - 10,
      deadlineAt: Date.now() + input.timeoutMs,
      pid: undefined,
    } as DurableSubagentRun;
    const runDirectory = resolveSubagentRunDirectory(aged.runId, environment);
    writeFileSync(join(runDirectory, 'state.json'), JSON.stringify(aged, null, 2));

    const reconciled = reconcileDurableSubagentRun(aged, environment, () => ({ completed: false }));
    expect(reconciled.status).toBe('completion_unknown');
    expect(reconciled.error).toContain('startup ownership');

    const retry = startDurableSubagentRun(input);
    expect(retry.ok).toBe(true);
    if (retry.ok) {
      expect(retry.reused).toBe(true);
      expect(retry.run.runId).toBe(aged.runId);
      expect(retry.run.status).toBe('completion_unknown');
    }
    rmSync(home, { recursive: true, force: true });
  });

  it('does not terminalize a run during runner owner publication', async () => {
    const home = mkdtempSync(join(tmpdir(), 'os-lifecycle-home-'));
    const instructionPath = join(home, 'instructions.md');
    try {
      const executable = writeExecutable(home, 'fast-provider', [
        '#!/bin/sh',
        "echo '{\"finalMessage\":\"startup complete\"}'",
      ].join(String.fromCharCode(10)));
      writeFileSync(instructionPath, 'instruction');
      const started = startDurableSubagentRun(startInput(executable, home, instructionPath, 'req-startup'));
      if (!started.ok) throw new Error(started.message);

      const observed = reconcileDurableSubagentRun(started.run, makeEnvironment(home), (stdout) => ({
        completed: stdout.includes('startup complete'),
        finalMessage: stdout.includes('startup complete') ? 'startup complete' : undefined,
      }));

      expect(observed.status).not.toBe('completion_unknown');
      const waited = await waitForDurableSubagentRun(started.run, makeEnvironment(home), 2_000, (stdout) => ({
        completed: stdout.includes('startup complete'),
        finalMessage: stdout.includes('startup complete') ? 'startup complete' : undefined,
      }));
      expect(waited.run.status).toBe('completed');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('recovers a final event from the bounded log tail', async () => {
    const home = mkdtempSync(join(tmpdir(), 'os-lifecycle-home-'));
    const instructionPath = join(home, 'instructions.md');
    try {
      const executable = writeExecutable(home, 'long-provider', [
        '#!/bin/sh',
        "head -c 9000 /dev/zero | tr '\\0' x",
        "printf '\\n{\"finalMessage\":\"tail complete\"}\\n'",
      ].join('\n'));
      writeFileSync(instructionPath, 'instruction');
      const started = startDurableSubagentRun(startInput(executable, home, instructionPath, 'req-tail'));
      if (!started.ok) throw new Error(started.message);
      const waited = await waitForDurableSubagentRun(started.run, makeEnvironment(home), 2_000, (stdout) => ({
        completed: stdout.includes('tail complete'),
        finalMessage: stdout.includes('tail complete') ? 'tail complete' : undefined,
      }));

      expect(waited.run.status).toBe('completed');
      expect(waited.run.finalMessage).toBe('tail complete');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('records timed_out when an owned provider remains alive past its deadline', async () => {
    const home = mkdtempSync(join(tmpdir(), 'os-lifecycle-home-'));
    const instructionPath = join(home, 'instructions.md');
    let run: DurableSubagentRun | undefined;
    try {
      const executable = writeExecutable(home, 'stuck-provider', [
        '#!/bin/sh',
        'sleep 5',
      ].join('\n'));
      writeFileSync(instructionPath, 'instruction');
      const started = startDurableSubagentRun(startInput(executable, home, instructionPath, 'req-deadline', 20));
      if (!started.ok) throw new Error(started.message);
      run = started.run;
      const providerPid = await waitForProviderPid(run);
      await new Promise((resolve) => setTimeout(resolve, 80));
      const reconciled = reconcileDurableSubagentRun(run, makeEnvironment(home), () => ({ completed: false }));

      expect(reconciled.status).toBe('timed_out');
      expect(run.pid).toBeDefined();
      expect(await waitForProcessGroupExit(providerPid)).toBe(true);
    } finally {
      if (run) cancelDurableSubagentRun(run, makeEnvironment(home));
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('passes inherited secrets to the provider without persisting them', async () => {
    const home = mkdtempSync(join(tmpdir(), 'os-lifecycle-home-'));
    const instructionPath = join(home, 'instructions.md');
    const receivedPath = join(home, 'provider-received.txt');
    const sentinel = 'do-not-persist-' + randomUUID();
    try {
      const executable = writeExecutable(home, 'secret-aware-provider', [
        '#!/bin/sh',
        'if [ "$SUBAGENT_SECRET_SENTINEL" = "' + sentinel + '" ]; then printf received > "$RECEIVED_MARKER"; fi',
        "echo '{\"finalMessage\":\"secret complete\"}'",
      ].join(String.fromCharCode(10)));
      writeFileSync(instructionPath, 'instruction');
      const environment = {
        ...makeEnvironment(home),
        SUBAGENT_SECRET_SENTINEL: sentinel,
        RECEIVED_MARKER: receivedPath,
      };
      const started = startDurableSubagentRun({
        ...startInput(executable, home, instructionPath, 'req-secret'),
        env: environment,
      });
      if (!started.ok) throw new Error(started.message);
      const runDirectory = resolveSubagentRunDirectory(started.run.runId, environment);
      const persistedFiles = readRegularFiles(runDirectory);
      expect(persistedFiles.some((content) => content.includes(sentinel))).toBe(false);
      const waited = await waitForDurableSubagentRun(started.run, environment, 2_000, (stdout) => ({
        completed: stdout.includes('secret complete'),
        finalMessage: stdout.includes('secret complete') ? 'secret complete' : undefined,
      }));

      expect(readFileSync(receivedPath, 'utf8')).toContain('received');
      expect(waited.run.status).toBe('completed');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('cancels an owned provider through the runner control marker', async () => {
    const home = mkdtempSync(join(tmpdir(), 'os-lifecycle-home-'));
    const instructionPath = join(home, 'instructions.md');
    let run: DurableSubagentRun | undefined;
    try {
      const executable = writeExecutable(home, 'cancellable-provider', [
        '#!/bin/sh',
        'sleep 5',
      ].join(String.fromCharCode(10)));
      writeFileSync(instructionPath, 'instruction');
      const environment = makeEnvironment(home);
      const started = startDurableSubagentRun(startInput(executable, home, instructionPath, 'req-cancel'));
      if (!started.ok) throw new Error(started.message);
      run = started.run;
      const providerPid = await waitForProviderPid(run);
      const cancelled = cancelDurableSubagentRun(run, environment);
      const exitMarker = JSON.parse(readFileSync(run.exitMarkerPath || '', 'utf8')) as { outcome?: unknown };

      expect(cancelled.status).toBe('cancelled');
      expect(exitMarker.outcome).toBe('cancelled');
      expect(await waitForProcessGroupExit(providerPid)).toBe(true);
    } finally {
      if (run) cancelDurableSubagentRun(run, makeEnvironment(home));
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('cancels safely when requested during starting before runner PID publication', async () => {
    const home = mkdtempSync(join(tmpdir(), 'os-lifecycle-home-'));
    const instructionPath = join(home, 'instructions.md');
    let run: DurableSubagentRun | undefined;
    try {
      const executable = writeExecutable(home, 'starting-cancellable-provider', [
        '#!/bin/sh',
        'sleep 5',
      ].join(String.fromCharCode(10)));
      writeFileSync(instructionPath, 'instruction');
      const environment = makeEnvironment(home);
      const started = startDurableSubagentRun(
        startInput(executable, home, instructionPath, 'req-starting-cancel'),
        {
          beforeRunnerSpawn: (claimed) => {
            const requested = cancelDurableSubagentRun(claimed, environment);
            expect(requested.status).toBe('starting');
          },
        },
      );
      if (!started.ok) throw new Error(started.message);
      run = started.run;
      const providerPid = await waitForProviderPid(run);
      const waited = await waitForDurableSubagentRun(run, environment, 2_000, () => ({ completed: false }));
      const exitMarker = JSON.parse(readFileSync(run.exitMarkerPath || '', 'utf8')) as { outcome?: unknown };

      expect(waited.run.status).toBe('cancelled');
      expect(exitMarker.outcome).toBe('cancelled');
      expect(await waitForProcessGroupExit(providerPid)).toBe(true);
    } finally {
      if (run) cancelDurableSubagentRun(run, makeEnvironment(home));
      rmSync(home, { recursive: true, force: true });
    }
  });
});
