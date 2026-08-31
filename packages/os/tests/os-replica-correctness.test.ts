import { Database } from 'bun:sqlite';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { manifestOverlayPath, readManifestOverlay } from '../scripts/lib/manifest-overlay';
import { resolveCanonicalTraceDbPath } from '../scripts/lib/trace-persistence';
import { removeSafeTempDir } from './safe-temp-cleanup';

const workerScript = path.join(import.meta.dirname, 'fixtures', 'os-replica-correctness-worker.ts');
const homes: Array<{ home: string; prefix: string }> = [];

type WorkerResult = { stdout: string; stderr: string; exitCode: number | null };

function tempHome(prefix: string): string {
  const home = fs.mkdtempSync(path.join(tmpdir(), prefix));
  homes.push({ home, prefix });
  return home;
}

function runWorker(args: string[]): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerScript, ...args], {
      cwd: path.join(import.meta.dirname, '..'),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (exitCode) => resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode }));
  });
}

function expectWorkersSucceeded(results: WorkerResult[]): void {
  for (const result of results) {
    expect(result.exitCode, result.stderr).toBe(0);
  }
}

function generatedFacadeToolNames(): string[] {
  const manifest = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'manifests', 'generated', 'tool.manifest.json'), 'utf8')) as {
    tools?: Array<{ name?: unknown; kind?: unknown }>;
  };
  return (manifest.tools ?? [])
    .filter((entry) => entry.kind === 'facade-tool' && typeof entry.name === 'string')
    .map((entry) => entry.name as string);
}

afterEach(() => {
  while (homes.length > 0) {
    const entry = homes.pop();
    if (entry) removeSafeTempDir(entry.home, entry.prefix);
  }
});

describe('OS same-node replica correctness', () => {
  it('should preserve independent settings mutations when separate processes read the same starting overlay', async () => {
    const home = tempHome('consuelo-replica-settings-');
    const barrierDir = path.join(home, 'barriers');
    const overlayPath = manifestOverlayPath(home);
    fs.mkdirSync(path.dirname(overlayPath), { recursive: true });
    fs.writeFileSync(overlayPath, `${JSON.stringify({
      version: 1,
      disabledSkills: [],
      disabledTools: [],
      disabledWorkflows: [],
      updatedAt: null,
    }, null, 2)}\n`);
    const [firstTool, secondTool] = generatedFacadeToolNames();
    if (!firstTool || !secondTool) throw new Error('expected at least two generated facade tools');

    const results = await Promise.all([
      runWorker(['settings', home, 'a', barrierDir, '2', firstTool]),
      runWorker(['settings', home, 'b', barrierDir, '2', secondTool]),
    ]);
    expectWorkersSucceeded(results);

    expect(readManifestOverlay(home).disabledTools).toEqual(expect.arrayContaining([firstTool, secondTool]));
  });

  it('should preserve independent environment mutations when separate processes read the same registry snapshot', async () => {
    const home = tempHome('consuelo-replica-environment-');
    const barrierDir = path.join(home, 'barriers');
    const registryPath = path.join(home, 'config', 'environments.json');
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    fs.writeFileSync(registryPath, `${JSON.stringify({ version: 1, workspaceId: 'wrk_replica', environments: [] }, null, 2)}\n`);

    const results = await Promise.all([
      runWorker(['environment', home, 'a', barrierDir, '2', 'Alpha']),
      runWorker(['environment', home, 'b', barrierDir, '2', 'Beta']),
    ]);
    expectWorkersSucceeded(results);

    const document = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as { environments?: Array<{ name?: string }> };
    expect(document.environments?.map((environment) => environment.name).sort()).toEqual(['Alpha', 'Beta']);
  });

  it('should serialize shared browser profile operations across separate processes', async () => {
    const home = tempHome('consuelo-replica-browser-');
    const barrierDir = path.join(home, 'barriers');

    const results = await Promise.all([
      runWorker(['browser', home, 'a', barrierDir, '2', 'browser.open', 'os']),
      runWorker(['browser', home, 'b', barrierDir, '2', 'browser', 'workspace']),
    ]);
    expectWorkersSucceeded(results);
    for (const result of results) {
      expect(JSON.parse(result.stdout)).toMatchObject({ result: { ok: true }, collision: false });
    }

    expect(fs.existsSync(path.join(barrierDir, 'browser-collision'))).toBe(false);
  });

  it('should retain all trace rows when independent processes write the same trace database', async () => {
    const home = tempHome('consuelo-replica-trace-');
    const barrierDir = path.join(home, 'barriers');
    const workerCount = 4;
    const rowsPerWorker = 40;

    const results = await Promise.all(Array.from({ length: workerCount }, (_, index) => (
      runWorker(['trace', home, `w${index}`, barrierDir, String(workerCount), String(rowsPerWorker)])
    )));
    expectWorkersSucceeded(results);
    for (const result of results) {
      expect(JSON.parse(result.stdout)).toMatchObject({ recorded: rowsPerWorker });
    }

    const dbPath = resolveCanonicalTraceDbPath({ home, env: {} });
    const db = new Database(dbPath, { readonly: true });
    try {
      const row = db.query("SELECT COUNT(*) AS count FROM tool_traces WHERE source = 'replica-test'").get() as { count: number };
      expect(Number(row.count)).toBe(workerCount * rowsPerWorker);
    } finally {
      db.close();
    }
  });

  it('should resolve one taskSession to the same task worktree in separate processes', async () => {
    const home = tempHome('consuelo-replica-task-session-');
    const worktreeRoot = path.join(home, 'worktrees');
    const taskWorktree = path.join(worktreeRoot, 'task-os-replica-fixture');
    const sessionDir = path.join(taskWorktree, '.task', 'os', 'replica-fixture');
    const taskSession = 'tsk_replica_fixture';
    const branch = 'task/os/replica-fixture';
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'session.json'), `${JSON.stringify({
      taskSession,
      branch,
      taskBranch: branch,
      worktree: taskWorktree,
      worktreePath: taskWorktree,
    }, null, 2)}\n`);

    const results = await Promise.all([
      runWorker(['task-session', home, 'a', path.join(home, 'barriers-a'), '1', taskSession, worktreeRoot]),
      runWorker(['task-session', home, 'b', path.join(home, 'barriers-b'), '1', taskSession, worktreeRoot]),
    ]);
    expectWorkersSucceeded(results);

    const outputs = results.map((result) => JSON.parse(result.stdout) as { ok?: boolean; data?: unknown; code?: string });
    expect(outputs[0]).toMatchObject({ ok: true });
    expect(outputs[1]).toMatchObject({ ok: true });
    expect(outputs[0].data).toEqual(outputs[1].data);
    expect(JSON.stringify(outputs[0].data)).toContain(branch);
  });
});
