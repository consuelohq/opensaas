import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createConnectorReadinessAcceptance } from '../scripts/lib/lifecycle';

const temporaryRoots: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('lifecycle connector readiness', () => {
  it('accepts a signed public MCP heartbeat when the separate health probe is transiently unavailable', async () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-connector-readiness-'));
    temporaryRoots.push(home);
    const osRoot = join(home, 'runtime-fixture');
    const configDirectory = join(home, 'node', 'security', 'generated');
    const scriptsDirectory = join(osRoot, 'scripts');
    mkdirSync(configDirectory, { recursive: true });
    mkdirSync(scriptsDirectory, { recursive: true });
    writeFileSync(
      join(configDirectory, 'workspace-node-heartbeat.json'),
      JSON.stringify({
        connectorHealthUrl: 'https://connector.example/health',
      }),
    );
    writeFileSync(
      join(scriptsDirectory, 'workspace-node-heartbeat.ts'),
      "process.stdout.write(JSON.stringify({ routeReady: true, mcpReady: true }) + '\\n');\n",
    );
    const heartbeatOutput = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(JSON.stringify({ routeReady: true, mcpReady: true })),
        );
        controller.close();
      },
    });
    const spawn = vi.fn(() => ({
      stdout: heartbeatOutput,
      exited: Promise.resolve(0),
    }));
    vi.stubGlobal('Bun', { spawn });
    const publicHealth = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('unavailable', { status: 503 }));

    const readiness = createConnectorReadinessAcceptance({
      home,
      osRoot,
      attempts: 1,
      intervalMs: 0,
      bunExecutable: process.execPath,
    });

    await expect(readiness.accept()).resolves.toBe(true);
    expect(spawn).toHaveBeenCalledOnce();
    expect(spawn.mock.calls[0]?.[0]).toEqual([
      process.execPath,
      join(scriptsDirectory, 'workspace-node-heartbeat.ts'),
      '--config',
      join(configDirectory, 'workspace-node-heartbeat.json'),
      '--accept-cached-mcp-proof',
    ]);
    expect(publicHealth).not.toHaveBeenCalled();
  });
});
