import { join, resolve, sep } from 'node:path';

import { resolveConsueloHome, resolveConsueloHomeLayout } from '../consuelo-home';

export type LifecyclePaths = {
  home: string;
  configPath: string;
  legacyHome: string;
  runtimeDir: string;
  releasesDir: string;
  currentLink: string;
  previousLink: string;
  stagingDir: string;
  testHomesDir: string;
  devSlotsDir: string;
  activationJournalPath: string;
  retentionStatePath: string;
  lockPath: string;
  diagnosticsPath: string;
  nodeDir: string;
  nodeSecurityGeneratedDir: string;
  nodeTunnelsDir: string;
  nodeCaddyDir: string;
  nodeCacheDir: string;
  nodeTmpDir: string;
  nodeRunsDir: string;
  nodeLogsDir: string;
  workspacesDir: string;
};

export function resolveLifecyclePaths(home?: string): LifecyclePaths {
  const layout = resolveConsueloHomeLayout(resolveConsueloHome(home));
  return {
    home: layout.home,
    configPath: layout.globalConfigPath,
    legacyHome: layout.legacyOsHome,
    runtimeDir: layout.runtimeDir,
    releasesDir: layout.runtimeReleasesDir,
    currentLink: layout.runtimeCurrentDir,
    previousLink: join(layout.runtimeDir, 'previous'),
    stagingDir: join(layout.runtimeDir, 'staging'),
    testHomesDir: join(layout.runtimeDir, 'test-homes'),
    devSlotsDir: join(layout.runtimeDir, 'dev-slots'),
    activationJournalPath: join(layout.runtimeDir, 'activation.json'),
    retentionStatePath: join(layout.runtimeDir, 'retention.json'),
    lockPath: join(layout.runtimeDir, 'lifecycle.lock'),
    diagnosticsPath: join(layout.nodeLogsDir, 'lifecycle.jsonl'),
    nodeDir: layout.nodeDir,
    nodeSecurityGeneratedDir: layout.nodeSecurityGeneratedDir,
    nodeTunnelsDir: layout.nodeTunnelsDir,
    nodeCaddyDir: layout.nodeCaddyDir,
    nodeCacheDir: layout.nodeCacheDir,
    nodeTmpDir: layout.nodeTmpDir,
    nodeRunsDir: layout.nodeRunsDir,
    nodeLogsDir: layout.nodeLogsDir,
    workspacesDir: layout.workspacesDir,
  };
}

export function isPathWithin(parent: string, candidate: string): boolean {
  const root = resolve(parent);
  const target = resolve(candidate);
  return target === root || target.startsWith(`${root}${sep}`);
}
