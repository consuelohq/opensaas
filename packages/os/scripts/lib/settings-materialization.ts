import fs from 'node:fs';
import path from 'node:path';

import { buildSettingsSnapshot, type SettingsSnapshot } from './settings-snapshot';
import {
  renderConfigurationSite,
  type ConfigurationPageId,
} from './settings-site';

export const CONFIGURATION_SITE_PAGES: ConfigurationPageId[] = [
  'configuration',
  'tools',
  'nodes',
  'environments',
  'secrets',
];

export type ConfigurationMaterializationPaths = {
  configurationDir: string;
  configurationDataDir: string;
  configurationIndexPath: string;
  configurationSnapshotPath: string;
  toolsDir: string;
  toolsIndexPath: string;
  nodesDir: string;
  nodesIndexPath: string;
  environmentsDir: string;
  environmentsIndexPath: string;
  secretsDir: string;
  secretsIndexPath: string;
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
  const toolsDir = path.join(sitesDir, 'tools');
  const nodesDir = path.join(sitesDir, 'nodes');
  const environmentsDir = path.join(sitesDir, 'environments');
  const secretsDir = path.join(sitesDir, 'secrets');

  return {
    configurationDir,
    configurationDataDir,
    configurationIndexPath: path.join(configurationDir, 'index.html'),
    configurationSnapshotPath: path.join(configurationDataDir, 'snapshot.json'),
    toolsDir,
    toolsIndexPath: path.join(toolsDir, 'index.html'),
    nodesDir,
    nodesIndexPath: path.join(nodesDir, 'index.html'),
    environmentsDir,
    environmentsIndexPath: path.join(environmentsDir, 'index.html'),
    secretsDir,
    secretsIndexPath: path.join(secretsDir, 'index.html'),
  };
}

export function materializeConfigurationSite(
  home: string,
  snapshot: SettingsSnapshot = buildSettingsSnapshot(home),
): MaterializedConfigurationSite {
  const paths = getConfigurationMaterializationPaths(home);

  for (const directory of [
    paths.configurationDir,
    paths.configurationDataDir,
    paths.toolsDir,
    paths.nodesDir,
    paths.environmentsDir,
    paths.secretsDir,
  ]) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const pagePaths: Array<[ConfigurationPageId, string]> = [
    ['configuration', paths.configurationIndexPath],
    ['tools', paths.toolsIndexPath],
    ['nodes', paths.nodesIndexPath],
    ['environments', paths.environmentsIndexPath],
    ['secrets', paths.secretsIndexPath],
  ];
  for (const [page, indexPath] of pagePaths) {
    fs.writeFileSync(indexPath, renderConfigurationSite(page), { mode: 0o600 });
  }

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
