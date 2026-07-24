import { existsSync, lstatSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

import { lifecycleError } from './errors';
import { isPathWithin, resolveLifecyclePaths } from './paths';

export type LifecycleUninstallOptions = {
  dryRun?: boolean;
  removeNode?: boolean;
  removeUserContent?: boolean;
  removeConfig?: boolean;
};

function removeManagedPath(input: {
  home: string;
  path: string;
  dryRun: boolean;
  removedPaths: string[];
}): void {
  const resolvedHome = resolve(input.home);
  const resolvedPath = resolve(input.path);
  if (resolvedPath === resolvedHome || !isPathWithin(resolvedHome, resolvedPath)) {
    throw lifecycleError('UNINSTALL_FAILED', `refusing to remove path outside managed home: ${resolvedPath}`);
  }
  if (!existsSync(resolvedPath) && !lstatExists(resolvedPath)) return;
  const stat = lstatSync(resolvedPath);
  if (!input.dryRun) {
    if (stat.isSymbolicLink()) rmSync(resolvedPath, { force: true });
    else rmSync(resolvedPath, { recursive: true, force: true });
  }
  input.removedPaths.push(resolvedPath);
}

function lstatExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

export function removeLifecycleManagedContent(
  home: string | undefined,
  options: LifecycleUninstallOptions = {},
): { removedPaths: string[] } {
  const paths = resolveLifecyclePaths(home);
  const dryRun = options.dryRun ?? false;
  const removedPaths: string[] = [];
  const remove = (path: string): void => removeManagedPath({
    home: paths.home,
    path,
    dryRun,
    removedPaths,
  });

  remove(paths.runtimeDir);

  if (options.removeNode) {
    remove(paths.nodeDir);
  } else {
    for (const path of [
      paths.nodeSecurityGeneratedDir,
      paths.nodeTunnelsDir,
      paths.nodeCaddyDir,
      paths.nodeCacheDir,
      paths.nodeTmpDir,
      paths.nodeRunsDir,
      paths.nodeLogsDir,
    ]) remove(path);
  }

  if (options.removeUserContent) remove(paths.workspacesDir);
  if (options.removeConfig) {
    remove(paths.configPath);
    remove(paths.legacyHome);
  }

  return { removedPaths };
}
