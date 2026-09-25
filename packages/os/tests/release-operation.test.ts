import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createReleaseOperationManager,
  releaseOperationId,
} from '../scripts/lib/release-operation';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('durable release operations', () => {
  it('flushes state replacements and their directory before reporting success', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const source = readFileSync(resolve(root, 'scripts/lib/release-operation.ts'), 'utf8');
    expect(source).toContain('fsyncSync(tempDescriptor)');
    expect(source).toContain('fsyncSync(directoryDescriptor)');
  });

  it('recovers a stale start lock owned by a dead process', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-release-operation-lock-'));
    roots.push(home);
    const request = {
      repo: 'consuelohq/opensaas',
      pr: 2550,
      channel: 'stable' as const,
      mergeMethod: 'merge' as const,
      releaseOnly: true,
    };
    const operationId = releaseOperationId(request);
    const operationDir = join(home, 'node', 'runs', 'releases', operationId);
    mkdirSync(operationDir, { recursive: true });
    writeFileSync(join(operationDir, '.start.lock'), '999999\n', { mode: 0o600 });
    let spawns = 0;
    const manager = createReleaseOperationManager({
      home,
      executable: '/usr/local/bin/bun',
      scriptPath: '/runtime/scripts/release.ts',
      processAlive: () => false,
      spawnProcess() {
        spawns += 1;
        return { pid: 4321, unref() {}, once() { return undefined; } };
      },
    });

    const started = await manager.start(request);
    expect(started.operationId).toBe(operationId);
    expect(spawns).toBe(1);
  });

  it('deduplicates identical starts and returns before the detached worker completes', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-release-operation-'));
    roots.push(home);
    mkdirSync(join(home, 'node', 'runs'), { recursive: true });
    const spawns: Array<{ command: string; args: string[]; detached?: boolean }> = [];
    let unrefCount = 0;
    const manager = createReleaseOperationManager({
      home,
      executable: '/usr/local/bin/bun',
      scriptPath: '/runtime/scripts/release.ts',
      spawnProcess(command, args, options) {
        spawns.push({ command, args, detached: options.detached });
        return {
          pid: 4321,
          unref() { unrefCount += 1; },
          once() { return undefined; },
        };
      },
      processAlive: () => true,
      now: () => new Date('2026-09-23T02:00:00.000Z'),
    });
    const request = {
      repo: 'consuelohq/opensaas',
      pr: 2550,
      channel: 'canary' as const,
      mergeMethod: 'merge' as const,
      releaseOnly: false,
    };

    const first = await manager.start(request);
    const second = await manager.start(request);

    expect(first.operationId).toMatch(/^release-[a-f0-9]{24}$/);
    expect(second).toMatchObject({ operationId: first.operationId, reused: true });
    expect(spawns).toHaveLength(1);
    expect(spawns[0]).toMatchObject({
      command: '/usr/local/bin/bun',
      args: ['/runtime/scripts/release.ts', '--operation-worker', first.operationId],
      detached: true,
    });
    expect(unrefCount).toBe(1);
    expect(manager.status(first.operationId)).toMatchObject({
      operationId: first.operationId,
      phase: 'running',
      workerPid: 4321,
      request,
    });
  });

  it('resumes a stale operation with the same id and exposes bounded logs', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-release-operation-'));
    roots.push(home);
    const manager = createReleaseOperationManager({
      home,
      executable: '/usr/local/bin/bun',
      scriptPath: '/runtime/scripts/release.ts',
      spawnProcess() {
        return { pid: 9001, unref() {}, once() { return undefined; } };
      },
      processAlive: () => false,
    });
    const started = await manager.start({
      repo: 'consuelohq/opensaas',
      pr: 2550,
      channel: 'stable',
      mergeMethod: 'merge',
      releaseOnly: true,
    });
    const state = manager.status(started.operationId)!;
    manager.writeState({ ...state, phase: 'failed', message: 'transport ended; safe to resume' });
    const logPath = manager.logPath(started.operationId);
    writeFileSync(logPath, Array.from({ length: 80 }, (_, index) => `line-${index + 1}`).join('\n'));

    const resumed = await manager.resume(started.operationId);
    expect(resumed).toMatchObject({ operationId: started.operationId, resumed: true });
    expect(manager.logs(started.operationId, 3).lines).toEqual(['line-78', 'line-79', 'line-80']);
    expect(readFileSync(manager.statePath(started.operationId), 'utf8')).not.toContain('GH_TOKEN');
  });
});
