import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { describe, expect, it, vi } from 'vitest';

import { createLocalOsApp } from '../scripts/server/app';
import { createHealthRoutes } from '../scripts/server/routes/health';
import { drainWorkerServer, runDrainAndExit } from '../scripts/server/main';
import { createWorkerRuntimeState } from '../scripts/server/worker-runtime-state';

async function readJsonLine(stream: NodeJS.ReadableStream): Promise<Record<string, unknown>> {
  const lines = createInterface({ input: stream });
  for await (const line of lines) {
    lines.close();
    return JSON.parse(line) as Record<string, unknown>;
  }
  throw new Error('worker drain fixture did not publish its port');
}

describe('local OS health readiness', () => {
  it('should return unavailable when runtime manifests cannot be read', async () => {
    const app = createHealthRoutes(
      { name: 'consuelo-os', port: 46321 },
      {
        assertReady: () => {
          throw new Error('/private/path/tool.manifest.json was not found');
        },
      },
    );

    const response = await app.request('http://127.0.0.1:46321/health');
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(body)).toEqual({
      status: 'unavailable',
      name: 'consuelo-os',
      error: {
        code: 'OS_RUNTIME_NOT_READY',
        message: 'Consuelo OS runtime is not ready.',
      },
    });
    expect(body).not.toContain('/private/path');
  });

  it('should report the active runtime identity for lifecycle acceptance', async () => {
    const app = createHealthRoutes(
      { name: 'consuelo-os', port: 46321 },
      {
        assertReady: () => {},
        runtimeIdentity: () => ({ bundleId: 'bundle-active', version: '2.3.4' }),
      },
    );

    const response = await app.request('http://127.0.0.1:46321/health');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      name: 'consuelo-os',
      bundleId: 'bundle-active',
      version: '2.3.4',
    });
  });

  it('should expose worker readiness and fail closed once draining starts', async () => {
    const workerState = createWorkerRuntimeState({
      workerId: 'worker-1',
      workerInstanceId: 'instance-9',
    });
    const app = createHealthRoutes(
      { name: 'consuelo-os', port: 46322 },
      {
        assertReady: () => {},
        workerState,
      },
    );

    const ready = await app.request('http://127.0.0.1:46322/ready');
    expect(ready.status).toBe(200);
    await expect(ready.json()).resolves.toMatchObject({
      status: 'ready',
      name: 'consuelo-os',
      workerId: 'worker-1',
      workerInstanceId: 'instance-9',
      draining: false,
    });

    workerState.startDraining();
    const draining = await app.request('http://127.0.0.1:46322/ready');
    expect(draining.status).toBe(503);
    await expect(draining.json()).resolves.toMatchObject({
      status: 'unavailable',
      name: 'consuelo-os',
      workerId: 'worker-1',
      workerInstanceId: 'instance-9',
      error: { code: 'OS_WORKER_DRAINING' },
    });
  });

  it('should allow partial dependency overrides and retain default readiness checks', async () => {
    const workerState = createWorkerRuntimeState({
      workerId: 'worker-2',
      workerInstanceId: 'instance-partial',
    });
    const app = createHealthRoutes(
      { name: 'consuelo-os', port: 46323 },
      { workerState },
    );

    const response = await app.request('http://127.0.0.1:46323/ready');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ready',
      workerId: 'worker-2',
      workerInstanceId: 'instance-partial',
    });
  });

  it('keeps worker request accounting active until the response body is consumed', async () => {
    const workerState = createWorkerRuntimeState({
      workerId: 'worker-response',
      workerInstanceId: 'instance-response',
    });
    const app = createLocalOsApp(
      { name: 'consuelo-os', port: 46324 },
      { workerState },
    );

    const response = await app.request('http://127.0.0.1:46324/not-a-real-route');
    expect(response.status).toBe(404);
    expect(workerState.snapshot().activeRequests).toBe(1);

    await response.text();
    expect(workerState.snapshot().activeRequests).toBe(0);
  });

  it('releases worker request accounting when the response body is canceled', async () => {
    const workerState = createWorkerRuntimeState({
      workerId: 'worker-cancel',
      workerInstanceId: 'instance-cancel',
    });
    const app = createLocalOsApp(
      { name: 'consuelo-os', port: 46325 },
      { workerState },
    );

    const response = await app.request('http://127.0.0.1:46325/not-a-real-route');
    expect(workerState.snapshot().activeRequests).toBe(1);
    expect(response.body).not.toBeNull();

    await response.body!.cancel('client disconnected');
    expect(workerState.snapshot().activeRequests).toBe(0);
  });

  it('should release worker request accounting when a HEAD response body is discarded by Hono', async () => {
    const workerState = createWorkerRuntimeState({
      workerId: 'worker-head',
      workerInstanceId: 'instance-head',
    });
    const app = createLocalOsApp(
      { name: 'consuelo-os', port: 46326 },
      { workerState },
    );

    const response = await app.request('http://127.0.0.1:46326/not-a-real-route', {
      method: 'HEAD',
    });

    expect(response.status).toBe(404);
    expect(response.body).toBeNull();
    expect(workerState.snapshot().activeRequests).toBe(0);
  });

  it('waits for active work and a response-flush window before closing the listener', async () => {
    const workerState = createWorkerRuntimeState({
      workerId: 'worker-1',
      workerInstanceId: 'instance-drain',
    });
    expect(workerState.beginRequest()).toBe(true);
    const events: string[] = [];
    let sleepCount = 0;
    const server = {
      stop: vi.fn(async (force?: boolean) => {
        events.push(`stop:${force === true ? 'force' : 'graceful'}`);
        expect(workerState.snapshot().activeRequests).toBe(0);
        expect(workerState.beginRequest()).toBe(false);
      }),
    };

    const draining = drainWorkerServer({
      server: server as never,
      workerState,
      reason: 'SIGTERM',
      propagationMs: 25,
      drainTimeoutMs: 100,
      sleep: async (milliseconds) => {
        sleepCount += 1;
        events.push(`${sleepCount === 1 ? 'evacuate' : 'flush'}:${milliseconds}`);
        expect(workerState.snapshot().draining).toBe(true);
      },
      report: () => {},
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(server.stop).not.toHaveBeenCalled();
    workerState.endRequest();
    await draining;

    expect(events).toEqual(['evacuate:25', 'flush:25', 'stop:graceful']);
    expect(server.stop).toHaveBeenCalledTimes(1);
  });

  it('preserves a real in-flight response when the worker exits after draining', async () => {
    const mainUrl = new URL('../scripts/server/main.ts', import.meta.url).href;
    const workerStateUrl = new URL('../scripts/server/worker-runtime-state.ts', import.meta.url).href;
    const responseBytes = 2_000_000;
    const childSource = `
      import { drainWorkerServer, runDrainAndExit } from ${JSON.stringify(mainUrl)};
      import { createWorkerRuntimeState } from ${JSON.stringify(workerStateUrl)};

      const workerState = createWorkerRuntimeState({ workerId: 'worker-test', workerInstanceId: 'instance-test' });
      const body = 'x'.repeat(${responseBytes});
      let drainStarted = false;
      let server;
      server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        async fetch(request) {
          if (new URL(request.url).pathname !== '/slow') return new Response('not found', { status: 404 });
          if (!workerState.beginRequest()) return new Response('draining', { status: 503 });
          if (!drainStarted) {
            drainStarted = true;
            setTimeout(() => {
              void runDrainAndExit(() => drainWorkerServer({
                server,
                workerState,
                reason: 'test',
                propagationMs: 250,
                drainTimeoutMs: 5_000,
                report: () => {},
              }));
            }, 10);
          }
          try {
            await Bun.sleep(750);
            return new Response(body);
          } finally {
            workerState.endRequest();
          }
        },
      });
      process.stdout.write(JSON.stringify({ port: server.port }) + '\\n');
    `;
    const child = spawn('bun', ['-e', childSource], { stdio: ['ignore', 'pipe', 'pipe'] });
    const exited = new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    try {
      const ready = await readJsonLine(child.stdout);
      const port = ready.port;
      expect(typeof port).toBe('number');
      const response = await fetch(`http://127.0.0.1:${port}/slow`);
      const body = await response.text();
      expect(response.status).toBe(200);
      expect(body).toHaveLength(responseBytes);
      const exitCode = await exited;
      expect(exitCode, stderr).toBe(0);
    } finally {
      if (child.exitCode === null) child.kill();
    }
  });

  it('preserves a slow app response stream while a real Bun worker drains', async () => {
    const appUrl = new URL('../scripts/server/app.ts', import.meta.url).href;
    const mainUrl = new URL('../scripts/server/main.ts', import.meta.url).href;
    const workerStateUrl = new URL('../scripts/server/worker-runtime-state.ts', import.meta.url).href;
    const chunkBytes = 100_000;
    const chunkCount = 10;
    const childSource = `
      import { createLocalOsApp } from ${JSON.stringify(appUrl)};
      import { drainWorkerServer, runDrainAndExit } from ${JSON.stringify(mainUrl)};
      import { createWorkerRuntimeState } from ${JSON.stringify(workerStateUrl)};

      const workerState = createWorkerRuntimeState({ workerId: 'worker-stream', workerInstanceId: 'instance-stream' });
      const app = createLocalOsApp({ name: 'consuelo-os', port: 0 }, { workerState });
      const chunk = new TextEncoder().encode('x'.repeat(${chunkBytes}));
      let server;
      app.get('/slow-stream', () => {
        setTimeout(() => {
          void runDrainAndExit(() => drainWorkerServer({
            server,
            workerState,
            reason: 'test-stream',
            propagationMs: 250,
            drainTimeoutMs: 5_000,
            report: () => {},
          }));
        }, 10);
        let sent = 0;
        return new Response(new ReadableStream({
          async pull(controller) {
            if (sent >= ${chunkCount}) {
              controller.close();
              return;
            }
            await Bun.sleep(100);
            controller.enqueue(chunk);
            sent += 1;
          },
        }));
      });
      server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: app.fetch });
      process.stdout.write(JSON.stringify({ port: server.port }) + '\\n');
    `;
    const child = spawn('bun', ['-e', childSource], { stdio: ['ignore', 'pipe', 'pipe'] });
    const exited = new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    try {
      const ready = await readJsonLine(child.stdout);
      const port = ready.port;
      expect(typeof port).toBe('number');
      const response = await fetch(`http://127.0.0.1:${port}/slow-stream`);
      const body = await response.text();
      expect(response.status).toBe(200);
      expect(body).toHaveLength(chunkBytes * chunkCount);
      const exitCode = await exited;
      expect(exitCode, stderr).toBe(0);
    } finally {
      if (child.exitCode === null) child.kill();
    }
  });

  it('force-closes when active work exceeds the drain timeout', async () => {
    const workerState = createWorkerRuntimeState({
      workerId: 'worker-timeout',
      workerInstanceId: 'instance-timeout',
    });
    expect(workerState.beginRequest()).toBe(true);
    const server = { stop: vi.fn(async () => {}) };

    await drainWorkerServer({
      server: server as never,
      workerState,
      reason: 'test-timeout',
      propagationMs: 0,
      drainTimeoutMs: 0,
      sleep: async () => {},
      report: () => {},
    });

    expect(server.stop).toHaveBeenCalledTimes(1);
    expect(server.stop).toHaveBeenCalledWith(true);
  });

  it('should report drain failures and exit nonzero', async () => {
    const exit = vi.fn();
    const report = vi.fn();

    await runDrainAndExit(async () => {
      throw new Error('Invalid OS worker drain timeout');
    }, { exit, report });

    expect(report).toHaveBeenCalledWith(expect.stringContaining('Invalid OS worker drain timeout'));
    expect(exit).toHaveBeenCalledWith(1);
  });
});
