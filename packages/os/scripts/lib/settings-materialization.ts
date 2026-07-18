import fs from 'node:fs';
import path from 'node:path';

import { buildSettingsSnapshot, type SettingsSnapshot } from './settings-snapshot';
import { renderSettingsSite } from './settings-site';

export type ConfigurationMaterializationPaths = {
  configurationDir: string;
  configurationDataDir: string;
  configurationIndexPath: string;
  configurationSnapshotPath: string;
};

export type MaterializedConfigurationSite = ConfigurationMaterializationPaths & {
  snapshot: SettingsSnapshot;
};

export function getConfigurationMaterializationPaths(
  home: string,
): ConfigurationMaterializationPaths {
  const sitesDir = path.join(home, 'sites');
  const configurationDir = path.join(sitesDir, 'configuration');
  const configurationDataDir = path.join(sitesDir, '.data', 'configuration');
  return {
    configurationDir,
    configurationDataDir,
    configurationIndexPath: path.join(configurationDir, 'index.html'),
    configurationSnapshotPath: path.join(configurationDataDir, 'snapshot.json'),
  };
}

export function materializeConfigurationSite(
  home: string,
  snapshot: SettingsSnapshot = buildSettingsSnapshot(home),
): MaterializedConfigurationSite {
  const paths = getConfigurationMaterializationPaths(home);
  fs.mkdirSync(paths.configurationDir, { recursive: true });
  fs.mkdirSync(paths.configurationDataDir, { recursive: true });
  fs.writeFileSync(paths.configurationIndexPath, renderSettingsSite(), { mode: 0o600 });
  fs.writeFileSync(
    paths.configurationSnapshotPath,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    { mode: 0o600 },
  );
  return { ...paths, snapshot };
}

export type SettingsMaterializationPaths = ConfigurationMaterializationPaths;
export type MaterializedSettingsSite = MaterializedConfigurationSite;
export const getSettingsMaterializationPaths = getConfigurationMaterializationPaths;
export const materializeSettingsSite = materializeConfigurationSite;
