import fs from 'node:fs';
import path from 'node:path';

import { buildSettingsSnapshot, type SettingsSnapshot } from './settings-snapshot';
import { renderSettingsSite } from './settings-site';

export type SettingsMaterializationPaths = {
  settingsDir: string;
  settingsDataDir: string;
  settingsIndexPath: string;
  settingsSnapshotPath: string;
};

export type MaterializedSettingsSite = SettingsMaterializationPaths & {
  snapshot: SettingsSnapshot;
};

export function getSettingsMaterializationPaths(home: string): SettingsMaterializationPaths {
  const sitesDir = path.join(home, 'sites');
  const settingsDir = path.join(sitesDir, 'settings');
  const settingsDataDir = path.join(sitesDir, '.data', 'settings');
  return {
    settingsDir,
    settingsDataDir,
    settingsIndexPath: path.join(settingsDir, 'index.html'),
    settingsSnapshotPath: path.join(settingsDataDir, 'snapshot.json'),
  };
}

export function materializeSettingsSite(
  home: string,
  snapshot: SettingsSnapshot = buildSettingsSnapshot(home),
): MaterializedSettingsSite {
  const paths = getSettingsMaterializationPaths(home);
  fs.mkdirSync(paths.settingsDir, { recursive: true });
  fs.mkdirSync(paths.settingsDataDir, { recursive: true });
  fs.writeFileSync(paths.settingsIndexPath, renderSettingsSite(), { mode: 0o600 });
  fs.writeFileSync(paths.settingsSnapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
  return { ...paths, snapshot };
}
