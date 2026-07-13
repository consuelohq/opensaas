import fs from 'node:fs';

import {
  manifestOverlayPath,
  patchManifestOverlay,
  readManifestOverlay,
  type ManifestOverlayPatch,
} from './manifest-overlay';
import { ensureRuntimePaths } from './runtime-state';
import { buildSettingsSnapshot } from './settings-snapshot';
import { buildSettingsSite } from './settings-site';
import { getSitesPaths } from './sites';

export type SettingsOverlayCommandResult = {
  ok: boolean;
  command: string;
  home: string;
  overlayPath: string;
  overlay: ReturnType<typeof readManifestOverlay>;
  message: string;
};

function refreshSettingsSite(home: string): void {
  const paths = getSitesPaths(home);
  fs.mkdirSync(paths.settingsDir, { recursive: true });
  fs.mkdirSync(paths.settingsDataDir, { recursive: true });
  const snapshot = buildSettingsSnapshot(home);
  fs.writeFileSync(paths.settingsIndexPath, buildSettingsSite(home), { mode: 0o600 });
  fs.writeFileSync(paths.settingsSnapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
}

function patchFromCommand(
  home: string,
  patch: ManifestOverlayPatch,
): SettingsOverlayCommandResult {
  const overlay = patchManifestOverlay(home, patch);
  refreshSettingsSite(home);
  return {
    ok: true,
    command: 'settings',
    home,
    overlayPath: manifestOverlayPath(home),
    overlay,
    message: `${patch.enabled ? 'Enabled' : 'Disabled'} ${patch.kind} ${patch.name}.`,
  };
}

export function runSettingsOverlayCommand(args: string[]): SettingsOverlayCommandResult {
  const runtimePaths = ensureRuntimePaths();
  const home = runtimePaths.home;
  const [action, kind, name] = args;

  if (action === 'status') {
    const overlay = readManifestOverlay(home);
    return {
      ok: true,
      command: 'settings status',
      home,
      overlayPath: manifestOverlayPath(home),
      overlay,
      message: 'Settings overlay status loaded.',
    };
  }

  const enabled = action === 'enable-tool' || action === 'enable-skill' || action === 'enable-workflow';
  const disabled = action === 'disable-tool' || action === 'disable-skill' || action === 'disable-workflow';
  if (!enabled && !disabled) {
    throw new Error('settings requires enable-tool|disable-tool|enable-skill|disable-skill|enable-workflow|disable-workflow|status');
  }

  const patchKind = action.endsWith('-tool')
    ? 'tool'
    : action.endsWith('-skill')
      ? 'skill'
      : 'workflow';

  if (!name || name.trim().length === 0) {
    throw new Error(`settings ${action} requires a name`);
  }

  return patchFromCommand(home, {
    kind: patchKind,
    name: name.trim(),
    enabled,
  });
}