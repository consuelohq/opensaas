import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { readFullToolManifest } from '../scripts/lib/manifest';
import {
  applySettingsGatewayOverlayPatch,
  parseSettingsOverlayPatch,
  readSettingsGatewaySnapshot,
} from '../scripts/lib/settings-gateway';
import { manifestOverlayPath } from '../scripts/lib/manifest-overlay';

function writeMinimalOsHome(home: string): void {
  fs.writeFileSync(
    path.join(home, 'config.json'),
    JSON.stringify({
      version: 1,
      mode: 'local',
      home,
      port: 8787,
      artifactStorage: 'local',
      agents: [],
      createdAt: '2026-07-02T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
    }),
    'utf8',
  );
  fs.mkdirSync(path.join(home, 'security', 'overrides'), { recursive: true });
}

describe('settings gateway', () => {
  it('rejects invalid overlay patch payloads', () => {
    const invalid = parseSettingsOverlayPatch('{');
    expect(invalid).toMatchObject({ ok: false, status: 400 });
  });

  it('applies overlay patches and returns an updated snapshot', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-settings-gateway-'));
    writeMinimalOsHome(home);
    const tool = readFullToolManifest().tools.find((entry) => entry.kind === 'facade-tool');
    expect(tool).toBeTruthy();

    const snapshot = readSettingsGatewaySnapshot(home);
    expect(snapshot.ok).toBe(true);
    expect(snapshot.snapshot.overlay.path).toBe(manifestOverlayPath(home));

    const patched = applySettingsGatewayOverlayPatch(
      home,
      JSON.stringify({ kind: 'tool', name: tool!.name, enabled: false }),
    );
    expect(patched.ok).toBe(true);
    expect(patched.snapshot.overlay.disabledTools).toContain(tool!.name);
    expect(fs.existsSync(path.join(home, 'sites', 'settings', 'index.html'))).toBe(true);
  });
});