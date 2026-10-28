import { Database } from 'bun:sqlite';
import { Effect } from 'effect';
import fs from 'node:fs';
import path from 'node:path';

import { executeTool } from '../../scripts/lib/facade/executor';
import { recordToolTraceSafely, resolveCanonicalTraceDbPath } from '../../scripts/lib/trace-persistence';

const action = process.argv[2] ?? '';
const home = process.argv[3] ?? '';
const workerId = process.argv[4] ?? 'worker';
const barrierDir = process.argv[5] ?? '';
const expectedWorkers = Number.parseInt(process.argv[6] ?? '2', 10);
const extra = process.argv.slice(7);

if (!action || !home) throw new Error('usage: os-replica-correctness-worker <action> <home> <workerId> <barrierDir> [expectedWorkers] [...extra]');

function sleepSync(ms: number): void {
  const view = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(view, 0, 0, ms);
}

function waitForFiles(directory: string, prefix: string, count: number, timeoutMs = 10_000): void {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const matches = fs.existsSync(directory)
      ? fs.readdirSync(directory).filter((name) => name.startsWith(prefix)).length
      : 0;
    if (matches >= count) return;
    sleepSync(10);
  }
  throw new Error(`timed out waiting for ${count} ${prefix} files`);
}

function synchronize(prefix: string): void {
  fs.mkdirSync(barrierDir, { recursive: true });
  fs.writeFileSync(path.join(barrierDir, `${prefix}-${workerId}`), `${process.pid}\n`, { flag: 'wx' });
  waitForFiles(barrierDir, `${prefix}-`, expectedWorkers);
}

function installSnapshotBarrier(targetPath: string): void {
  const originalReadFileSync = fs.readFileSync.bind(fs);
  let synchronized = false;
  fs.readFileSync = ((filePath: fs.PathOrFileDescriptor, ...args: unknown[]) => {
    const normalized = typeof filePath === 'string' ? path.resolve(filePath) : null;
    if (!synchronized && normalized === path.resolve(targetPath)) {
      const value = originalReadFileSync(filePath, ...(args as [BufferEncoding])) as string | Buffer;
      synchronized = true;
      if (!fs.existsSync(`${targetPath}.consuelo.lock`)) synchronize('snapshot');
      return value;
    }
    return originalReadFileSync(filePath, ...(args as [BufferEncoding]));
  }) as typeof fs.readFileSync;
}

async function runSettings(): Promise<unknown> {
  const toolName = extra[0];
  if (!toolName) throw new Error('settings action requires tool name');
  const overlayPath = path.join(home, 'security', 'overrides', 'manifest.overlay.json');
  installSnapshotBarrier(overlayPath);
  try {
    const { applySettingsOverlayPatchEffect } = await import('../../scripts/lib/settings-control-plane');
    const snapshot = await Effect.runPromise(applySettingsOverlayPatchEffect({
      home,
      patch: { kind: 'tool', name: toolName, enabled: false },
      actor: {
        actorType: 'user',
        actorId: `usr_${workerId}`,
        workspaceId: 'wrk_replica',
        correlationId: `corr_${workerId}`,
      },
    }));
    return { toolName, disabledTools: snapshot.overlay.disabledTools };
  } catch (error: unknown) {
    throw new Error('settings replica worker failed', { cause: error });
  }
}

async function runEnvironment(): Promise<unknown> {
  const name = extra[0];
  if (!name) throw new Error('environment action requires name');
  const registryPath = path.join(home, 'config', 'environments.json');
  installSnapshotBarrier(registryPath);
  try {
    const { upsertEnvironmentEffect } = await import('../../scripts/lib/environment-control-plane');
    const result = await Effect.runPromise(upsertEnvironmentEffect({
      home,
      workspaceId: 'wrk_replica',
      actor: {
        actorType: 'user',
        actorId: `usr_${workerId}`,
        workspaceId: 'wrk_replica',
        correlationId: `corr_${workerId}`,
      },
      input: {
        name,
        scope: { kind: 'workspace' },
        metadata: { REGION: workerId },
      },
    }));
    return { environmentId: result.environment.environmentId, name: result.environment.name };
  } catch (error: unknown) {
    throw new Error('environment replica worker failed', { cause: error });
  }
}

async function runBrowser(): Promise<unknown> {
  const profilePath = path.join(home, 'browser-profile');
  fs.mkdirSync(profilePath, { recursive: true });
  synchronize('browser-start');
  const collisionPath = path.join(barrierDir, 'browser-collision');
  const activePath = path.join(barrierDir, 'browser-active');
  const toolName = extra[0] ?? 'browser.open';
  const executor = extra[1] === 'workspace'
    ? (await import('../../../workspace/scripts/lib/facade/executor')).executeTool
    : executeTool;
  const toolInput = toolName === 'browser'
    ? { command: 'open', url: `https://example.com/${workerId}` }
    : { url: `https://example.com/${workerId}` };
  const result = await executor(toolName, toolInput, {
    cwd: process.cwd(),
    env: { ...process.env, AGENT_BROWSER_PROFILE: profilePath },
    runner: async () => {
      let descriptor: number | undefined;
      try {
        descriptor = fs.openSync(activePath, 'wx', 0o600);
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          fs.writeFileSync(collisionPath, `${workerId}\n`, { flag: 'a' });
        } else {
          throw error;
        }
      }
      await Bun.sleep(150);
      if (descriptor !== undefined) {
        fs.closeSync(descriptor);
        fs.rmSync(activePath, { force: true });
      }
      return { stdout: 'ok', stderr: '', exitCode: 0 };
    },
    logMode: 'silent',
  });
  return { result, collision: fs.existsSync(collisionPath) };
}

async function runTrace(): Promise<unknown> {
  process.env.CONSUELO_HOME = home;
  delete process.env.CONSUELO_TRACE_DB;
  delete process.env.TRACE_DB;
  synchronize('trace-start');
  const count = Number.parseInt(extra[0] ?? '40', 10);
  let recorded = 0;
  for (let index = 0; index < count; index += 1) {
    if (recordToolTraceSafely({
      traceId: `trc_${workerId}_${String(index).padStart(3, '0')}`,
      source: 'replica-test',
      tool: 'status',
      status: 'ok',
      ok: true,
      code: 'OK',
    })) recorded += 1;
  }
  return { recorded, dbPath: resolveCanonicalTraceDbPath() };
}

async function runTaskSession(): Promise<unknown> {
  const taskSession = extra[0];
  const worktreeRoot = extra[1];
  if (!taskSession || !worktreeRoot) throw new Error('task-session action requires taskSession and worktreeRoot');
  const env = { ...process.env, WORKSPACE_WORKTREE_ROOT: worktreeRoot };
  try {
    return await executeTool('fs.read', {
      path: 'README.md',
      taskSession,
    }, {
      cwd: process.cwd(),
      env,
      runner: async (plan) => ({
        stdout: JSON.stringify(plan),
        stderr: '',
        exitCode: 0,
      }),
      logMode: 'silent',
    });
  } catch (error: unknown) {
    throw new Error('task-session replica worker failed', { cause: error });
  }
}

function countTraceRows(dbPath: string): number {
  const db = new Database(dbPath, { readonly: true });
  try {
    const row = db.query('SELECT COUNT(*) AS count FROM tool_traces').get() as { count: number };
    return Number(row.count);
  } finally {
    db.close();
  }
}

let output: unknown;
if (action === 'settings') output = await runSettings();
else if (action === 'environment') output = await runEnvironment();
else if (action === 'browser') output = await runBrowser();
else if (action === 'trace') output = await runTrace();
else if (action === 'task-session') output = await runTaskSession();
else if (action === 'trace-count') output = { count: countTraceRows(extra[0] ?? resolveCanonicalTraceDbPath()) };
else throw new Error(`unknown action: ${action}`);

process.stdout.write(`${JSON.stringify(output)}\n`);
