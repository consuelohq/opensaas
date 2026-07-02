import fs from 'node:fs';
import path from 'node:path';

import {
  patchManifestOverlay,
  type ManifestOverlayPatch,
} from './manifest-overlay';
import { buildSettingsSnapshot } from './settings-snapshot';
import { buildSettingsSite } from './settings-site';
import { getSitesPaths } from './sites';

export type SettingsGatewayResult =
  | { ok: true; snapshot: ReturnType<typeof buildSettingsSnapshot> }
  | { ok: false; status: number; error: { code: string; message: string } };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseSettingsOverlayPatch(body: string): ManifestOverlayPatch | SettingsGatewayResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return {
      ok: false,
      status: 400,
      error: { code: 'INVALID_JSON', message: 'Settings overlay patch requires JSON.' },
    };
  }

  if (!isObject(parsed)) {
    return {
      ok: false,
      status: 400,
      error: { code: 'INVALID_PATCH', message: 'Settings overlay patch must be a JSON object.' },
    };
  }

  const kind = parsed.kind;
  const name = parsed.name;
  const enabled = parsed.enabled;

  if (kind !== 'tool' && kind !== 'skill' && kind !== 'workflow') {
    return {
      ok: false,
      status: 400,
      error: { code: 'INVALID_PATCH_KIND', message: 'Settings overlay patch kind must be tool, skill, or workflow.' },
    };
  }

  if (typeof name !== 'string' || name.trim().length === 0) {
    return {
      ok: false,
      status: 400,
      error: { code: 'INVALID_PATCH_NAME', message: 'Settings overlay patch requires a non-empty name.' },
    };
  }

  if (typeof enabled !== 'boolean') {
    return {
      ok: false,
      status: 400,
      error: { code: 'INVALID_PATCH_ENABLED', message: 'Settings overlay patch requires enabled: true|false.' },
    };
  }

  return { kind, name: name.trim(), enabled };
}

function refreshSettingsSite(home: string): void {
  const paths = getSitesPaths(home);
  fs.mkdirSync(paths.settingsDir, { recursive: true });
  fs.mkdirSync(paths.settingsDataDir, { recursive: true });
  const snapshot = buildSettingsSnapshot(home);
  fs.writeFileSync(paths.settingsIndexPath, buildSettingsSite(home), { mode: 0o600 });
  fs.writeFileSync(paths.settingsSnapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
}

export function readSettingsGatewaySnapshot(home: string): SettingsGatewayResult {
  return { ok: true, snapshot: buildSettingsSnapshot(home) };
}

export function applySettingsGatewayOverlayPatch(home: string, body: string): SettingsGatewayResult {
  const parsed = parseSettingsOverlayPatch(body);
  if ('ok' in parsed) return parsed;

  try {
    patchManifestOverlay(home, parsed);
    refreshSettingsSite(home);
    return { ok: true, snapshot: buildSettingsSnapshot(home) };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.slice(0, 240) : 'Settings overlay patch failed.';
    return {
      ok: false,
      status: 400,
      error: { code: 'OVERLAY_PATCH_FAILED', message },
    };
  }
}

export function resolveSettingsGatewayHome(): string {
  const home = process.env.CONSUELO_OS_HOME ?? process.env.CONSUELO_HOME ?? '';
  return home ? path.resolve(home) : '';
}

export function isSettingsGatewayRoute(pathname: string): boolean {
  return pathname === '/gateway/settings/snapshot' || pathname === '/gateway/settings/overlay';
}