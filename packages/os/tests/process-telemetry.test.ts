import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tempHome: string;
let dbPath: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-os-process-telemetry-'));
  dbPath = join(tempHome, 'consuelo.db');
});

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
});

function runBun(source: string): string {
  return execFileSync('bun', ['-e', source], {
    cwd: process.cwd(),
    env: { ...process.env, CONSUELO_HOME: tempHome, TEST_DB_PATH: dbPath },
    encoding: 'utf8',
  });
}

describe('process telemetry', () => {
  it('classifies broad process families while tagging Consuelo paths', () => {
    const output = runBun(`
      const { classifyProcess } = await import('./scripts/lib/process-telemetry.ts');
      process.stdout.write(JSON.stringify({
        consuelo: classifyProcess('/Users/kokayi/.consuelo/os/scripts/server.ts'),
        windowServer: classifyProcess('/System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon'),
        appRenderer: classifyProcess('/Applications/Example.app/Contents/MacOS/Example Helper (Renderer) --type=renderer'),
      }));
    `);
    const result = JSON.parse(output) as Record<string, { normalizedName: string; family: string; role: string; tags: string[] }>;

    expect(result.consuelo.family).toBe('consuelo');
    expect(result.consuelo.tags).toContain('consuelo');
    expect(result.windowServer).toMatchObject({
      normalizedName: 'WindowServer',
      family: 'macos',
      role: 'display-server',
    });
    expect(result.appRenderer).toMatchObject({
      normalizedName: 'Example',
      family: 'app',
      role: 'renderer',
    });
  });

  it('creates process telemetry tables in consuelo.db', () => {
    const output = runBun(`
      const { Database } = await import('bun:sqlite');
      const { ensureProcessTelemetrySchema } = await import('./scripts/lib/process-telemetry.ts');
      const db = new Database(process.env.TEST_DB_PATH, { create: true });
      try {
        ensureProcessTelemetrySchema(db);
        const tables = db.query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();
        process.stdout.write(JSON.stringify(tables.map((row) => row.name)));
      } finally {
        db.close();
      }
    `);
    const tables = JSON.parse(output) as string[];

    expect(tables).toEqual(expect.arrayContaining([
      'process_commands',
      'process_identities',
      'process_metric_rollups',
      'process_samples',
    ]));
  });

  it('returns an in-depth packet instead of a raw process dump', () => {
    const output = runBun(`
      const { buildProcessTelemetryPacket, recordProcessTelemetrySamples } = await import('./scripts/lib/process-telemetry.ts');
      const now = Date.UTC(2026, 0, 1, 12, 0, 0);
      recordProcessTelemetrySamples([
        {
          tsEpochMs: now - 30000,
          pid: 10,
          ppid: 1,
          command: '/Users/kokayi/.consuelo/os/scripts/server.ts',
          cpuPercent: 0.4,
          memPercent: 0.2,
          rssBytes: 45 * 1024 * 1024,
          cpuSeconds: 1,
          elapsedSeconds: 100,
          sampleReason: 'consuelo',
        },
        {
          tsEpochMs: now - 20000,
          pid: 20,
          ppid: 1,
          command: '/Applications/Example.app/Contents/MacOS/Example Helper (Renderer) --type=renderer',
          cpuPercent: 72,
          memPercent: 4,
          rssBytes: 700 * 1024 * 1024,
          cpuSeconds: 30,
          elapsedSeconds: 100,
          sampleReason: 'cpu-threshold',
        },
        {
          tsEpochMs: now - 10000,
          pid: 30,
          ppid: 1,
          command: '/System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer -daemon',
          cpuPercent: 22,
          memPercent: 0.5,
          rssBytes: 80 * 1024 * 1024,
          cpuSeconds: 10,
          elapsedSeconds: 100,
          sampleReason: 'cpu-threshold',
        },
      ], { dbPath: process.env.TEST_DB_PATH });
      process.stdout.write(JSON.stringify(buildProcessTelemetryPacket({ dbPath: process.env.TEST_DB_PATH, since: '1h', nowMs: now, limit: 20 })));
    `);
    const packet = JSON.parse(output) as {
      summary: { answer: string };
      hotProcesses: Array<{ name: string; family: string; role: string }>;
      consueloProcesses: Array<{ name: string; family: string }>;
      families: Array<{ family: string }>;
      guidance: string[];
    };

    expect(packet.summary.answer).toContain('Consuelo was not the primary heat source');
    expect(packet.hotProcesses.length).toBeGreaterThanOrEqual(3);
    expect(packet.hotProcesses[0]).toMatchObject({ name: 'Example', family: 'app', role: 'renderer' });
    expect(packet.consueloProcesses).toContainEqual(expect.objectContaining({ name: 'Consuelo OS', family: 'consuelo' }));
    expect(packet.families.map((row) => row.family)).toEqual(expect.arrayContaining(['app', 'consuelo', 'macos']));
    expect(JSON.stringify(packet)).not.toContain('/Applications/Example.app/Contents/MacOS/Example Helper');
    expect(packet.guidance.length).toBeGreaterThan(2);
  });
});
