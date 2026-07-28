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
import { listBundledSkills } from '../scripts/lib/skills';
import { workflows } from '../workflows/workflows';

describe('manifest overlay', () => {
  it('filters disabled tools without mutating the generated manifest file', () => {
    const base = readFullToolManifest();
    const tool = base.tools.find((entry) => entry.kind === 'facade-tool');
    expect(tool).toBeTruthy();

    const overlay = {
      ...emptyManifestOverlay(),
      disabledTools: [tool!.name],
      updatedAt: '2026-07-02T00:00:00.000Z',
    };

    const filtered = applyManifestOverlay(base, overlay);
    expect(filtered.tools.some((entry) => entry.name === tool!.name)).toBe(false);
    expect(readFullToolManifest().tools.some((entry) => entry.name === tool!.name)).toBe(true);
  });

  it('writes and reads manifest.overlay.json from the OS home', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-manifest-overlay-'));
    const tool = readFullToolManifest().tools.find((entry) => entry.kind === 'facade-tool');
    const skill = listBundledSkills()[0];
    const workflow = workflows[0];
    expect(tool).toBeTruthy();
    expect(skill).toBeTruthy();
    expect(workflow).toBeTruthy();

    patchManifestOverlay(home, { kind: 'tool', name: tool!.name, enabled: false });
    patchManifestOverlay(home, { kind: 'skill', name: skill!.name, enabled: false });
    const overlay = patchManifestOverlay(home, { kind: 'workflow', name: workflow!.id, enabled: false });
    expect(overlay).toMatchObject({
      disabledTools: [tool!.name],
      disabledSkills: [skill!.name],
      disabledWorkflows: [workflow!.id],
    });
    expect(fs.existsSync(manifestOverlayPath(home))).toBe(true);

    const restored = patchManifestOverlay(home, { kind: 'tool', name: tool!.name, enabled: true });
    expect(restored.disabledTools).toEqual([]);
    expect(readManifestOverlay(home).disabledTools).toEqual([]);
    expect(isManifestItemEnabled(restored, 'tool', tool!.name)).toBe(true);
  });
});
