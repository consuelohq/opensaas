import { realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, relative } from 'node:path';

function isInsideDirectory(targetPath: string, parentPath: string): boolean {
  const relativePath = relative(parentPath, targetPath);

  return relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath);
}

export function removeSafeTempDir(targetPath: string, expectedNamePrefix: string): void {
  const resolvedTargetPath = realpathSync(targetPath);
  const resolvedTmpDir = realpathSync(tmpdir());

  if (
    !isInsideDirectory(resolvedTargetPath, resolvedTmpDir) ||
    !basename(resolvedTargetPath).startsWith(expectedNamePrefix)
  ) {
    throw new Error(`Refusing to remove unsafe temp path for ${expectedNamePrefix}`);
  }

  rmSync(resolvedTargetPath, { recursive: true, force: true });
}
