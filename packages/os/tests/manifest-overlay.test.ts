import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { readFullToolManifest } from '../scripts/lib/manifest';
import {
  applyManifestOverlay,
  emptyManifestOverlay,
  isManifestItemEnabled,
  manifestOverlayPath,
  patchManifestOverlay,
  readManifestOverlay,
} from '../scripts/lib/manifest-overlay';

describe('manifest overlay', () => {
  it('filters disabled tools and skills without mutating the generated manifest file', () => {
    const base = readFullToolManifest();
    const skill = base.tools.find((entry) => entry.kind === 'os-skill');
    const tool = base.tools.find((entry) => entry.kind === 'facade-tool');
    expect(skill).toBeTruthy();
    expect(tool).toBeTruthy();

    const overlay = {
      ...emptyManifestOverlay(),
      disabledSkills: [skill!.name],
      disabledTools: [tool!.name],
      updatedAt: '2026-07-02T00:00:00.000Z',
    };

    const filtered = applyManifestOverlay(base, overlay);
    expect(filtered.tools.some((entry) => entry.name === skill!.name)).toBe(false);
    expect(filtered.tools.some((entry) => entry.name === tool!.name)).toBe(false);
    expect(readFullToolManifest().tools.some((entry) => entry.name === skill!.name)).toBe(true);
    expect(readFullToolManifest().tools.some((entry) => entry.name === tool!.name)).toBe(true);
  });

  it('writes and reads manifest.overlay.json from the OS home', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-manifest-overlay-'));
    const tool = readFullToolManifest().tools.find((entry) => entry.kind === 'facade-tool');
    expect(tool).toBeTruthy();

    const overlay = patchManifestOverlay(home, { kind: 'tool', name: tool!.name, enabled: false });
    expect(overlay.disabledTools).toEqual([tool!.name]);
    expect(fs.existsSync(manifestOverlayPath(home))).toBe(true);

    const restored = patchManifestOverlay(home, { kind: 'tool', name: tool!.name, enabled: true });
    expect(restored.disabledTools).toEqual([]);
    expect(readManifestOverlay(home).disabledTools).toEqual([]);
    expect(isManifestItemEnabled(restored, 'tool', tool!.name)).toBe(true);
  });
});