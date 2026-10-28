import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { readFullToolManifest } from '../scripts/lib/manifest';

const packageRoot = path.resolve(import.meta.dirname, '..');
const osScript = path.join(packageRoot, 'scripts', 'os.ts');

function makeHome(): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-configuration-cli-'));
  fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({
    version: 1,
    mode: 'local',
    home,
    port: 8787,
    artifactStorage: 'local',
    agents: [],
    createdAt: '2026-07-02T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:00.000Z',
  }), 'utf8');
  return home;
}

function run(home: string, command: 'configuration' | 'settings', toolName: string) {
  return spawnSync('bun', [osScript, command, 'disable-tool', toolName, '--json'], {
    cwd: packageRoot,
    env: { ...process.env, CONSUELO_HOME: home, CONSUELO_OS_HOME: home },
    encoding: 'utf8',
    timeout: 20_000,
  });
}

describe('configuration CLI', () => {
  it('uses configuration as the canonical command', () => {
    const home = makeHome();
    const tool = readFullToolManifest().tools.find((entry) => entry.kind === 'facade-tool');
    expect(tool).toBeTruthy();

    const result = run(home, 'configuration', tool!.name);

    expect(result.status, result.stderr).toBe(0);
    const payload = JSON.parse(result.stdout) as { command: string; overlay: { disabledTools: string[] } };
    expect(payload.command).toBe('configuration');
    expect(payload.overlay.disabledTools).toContain(tool!.name);
    expect(payload.overlay.disabledTools).not.toContain('--json');
    expect(fs.existsSync(path.join(home, 'logs', 'control-plane-audit.jsonl'))).toBe(true);
  });

  it('keeps settings as a CLI compatibility alias', () => {
    const home = makeHome();
    const tool = readFullToolManifest().tools.find((entry) => entry.kind === 'facade-tool');
    expect(tool).toBeTruthy();

    const result = run(home, 'settings', tool!.name);

    expect(result.status, result.stderr).toBe(0);
    const payload = JSON.parse(result.stdout) as { command: string; overlay: { disabledTools: string[] } };
    expect(payload.command).toBe('configuration');
    expect(payload.overlay.disabledTools).toContain(tool!.name);
  });
});
