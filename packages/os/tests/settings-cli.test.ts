import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { readFullToolManifest } from '../scripts/lib/manifest';

const packageRoot = path.resolve(import.meta.dirname, '..');
const osScript = path.join(packageRoot, 'scripts', 'os.ts');

describe('settings CLI', () => {
  it('applies the requested tool mutation instead of treating flags as the tool name', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-settings-cli-'));
    const tool = readFullToolManifest().tools.find((entry) => entry.kind === 'facade-tool');
    expect(tool).toBeTruthy();
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

    const result = spawnSync('bun', [osScript, 'settings', 'disable-tool', tool!.name, '--json'], {
      cwd: packageRoot,
      env: {
        ...process.env,
        CONSUELO_HOME: home,
        CONSUELO_OS_HOME: home,
      },
      encoding: 'utf8',
      timeout: 20_000,
    });

    expect(result.status, result.stderr).toBe(0);
    const payload = JSON.parse(result.stdout) as { overlay: { disabledTools: string[] } };
    expect(payload.overlay.disabledTools).toContain(tool!.name);
    expect(payload.overlay.disabledTools).not.toContain('--json');
    expect(fs.existsSync(path.join(home, 'logs', 'control-plane-audit.jsonl'))).toBe(true);
  });
});
