import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import { readFullToolManifest } from '../scripts/lib/manifest';
import { readManifestOverlay } from '../scripts/lib/manifest-overlay';
import {
  applySettingsOverlayPatchEffect,
  readSettingsSnapshotEffect,
} from '../scripts/lib/settings-control-plane';

function writeMinimalOsHome(home: string): void {
  fs.writeFileSync(
    path.join(home, 'config.json'),
    JSON.stringify({
      version: 1,
      mode: 'local',
      home,
      port: 8787,
      artifactStorage: 'local',
      workspace: { id: 'wrk_settings', slug: 'settings', host: 'settings.consuelohq.com' },
      agents: [],
      createdAt: '2026-07-02T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
    }),
    'utf8',
  );
}

describe('settings control plane', () => {
  it('serializes concurrent overlay writes and records redacted audit events', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-settings-control-plane-'));
    writeMinimalOsHome(home);
    const tools = readFullToolManifest().tools.filter((entry) => entry.kind === 'facade-tool').slice(0, 2);
    expect(tools).toHaveLength(2);

    await Promise.all(tools.map((tool) => Effect.runPromise(applySettingsOverlayPatchEffect({
      home,
      patch: { kind: 'tool', name: tool.name, enabled: false },
      actor: {
        actorType: 'user',
        actorId: 'usr_settings',
        workspaceId: 'wrk_settings',
        correlationId: `corr_${tool.name}`,
      },
    }))));

    expect(readManifestOverlay(home).disabledTools).toEqual(expect.arrayContaining(tools.map((tool) => tool.name)));
    const auditPath = path.join(home, 'logs', 'control-plane-audit.jsonl');
    const events = fs.readFileSync(auditPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(events).toHaveLength(2);
    expect(events).toEqual(expect.arrayContaining(tools.map((tool) => expect.objectContaining({
      event: 'configuration.overlay.changed',
      outcome: 'allowed',
      workspaceId: 'wrk_settings',
      safeMetadata: expect.objectContaining({ kind: 'tool', name: tool.name, enabled: false }),
    }))));
    expect(JSON.stringify(events)).not.toMatch(/requestBody|authorization|secret|token/i);
  });

  it('exposes typed failures from the Effect service boundary', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-settings-control-plane-'));
    writeMinimalOsHome(home);

    const result = await Effect.runPromise(Effect.either(applySettingsOverlayPatchEffect({
      home,
      patch: { kind: 'tool', name: 'missing-tool', enabled: false },
      actor: {
        actorType: 'user',
        actorId: 'usr_settings',
        workspaceId: 'wrk_settings',
        correlationId: 'corr_missing',
      },
    })));

    expect(result).toMatchObject({
      _tag: 'Left',
      left: { code: 'UnknownTool' },
    });
  });

  it('reads private settings state only through the Effect snapshot service', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-settings-control-plane-'));
    writeMinimalOsHome(home);

    const snapshot = await Effect.runPromise(readSettingsSnapshotEffect({ home }));
    expect(snapshot.workspace.workspaceId).toBe('wrk_settings');
    expect(snapshot.overlay.path).toContain(home);
  });
});
