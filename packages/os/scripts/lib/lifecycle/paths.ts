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
  lockPath: string;
  diagnosticsPath: string;
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
    lockPath: join(layout.runtimeDir, 'lifecycle.lock'),
    diagnosticsPath: join(layout.nodeLogsDir, 'lifecycle.jsonl'),
  };
}

export function isPathWithin(parent: string, candidate: string): boolean {
  const root = resolve(parent);
  const target = resolve(candidate);
  return target === root || target.startsWith(`${root}${sep}`);
}
