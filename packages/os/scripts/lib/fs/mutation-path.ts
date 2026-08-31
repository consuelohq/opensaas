import fs from 'node:fs';
import path from 'node:path';

export type BoundedMutationPath = {
  rawPath: string;
  resolved: string;
  rootRealPath: string;
};

function containsPath(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function existingAncestor(candidatePath: string): string {
  let current = candidatePath;
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return current;
}

export function resolveBoundedMutationPath(
  rawPath: string,
  options: {
    root?: string;
    mustExist?: boolean;
    allowRoot?: boolean;
  } = {},
): BoundedMutationPath {
  if (!rawPath || typeof rawPath !== 'string') throw new Error('unsafe mutation path: empty path');
  if (path.isAbsolute(rawPath)) throw new Error(`unsafe mutation path: absolute paths are not allowed: ${rawPath}`);
  const parts = rawPath.split(/[\\/]+/u).filter(Boolean);
  if (parts.includes('..') || parts.includes('.git')) throw new Error(`unsafe mutation path: ${rawPath}`);

  const root = path.resolve(options.root ?? process.cwd());
  const rootRealPath = fs.realpathSync(root);
  const resolved = path.resolve(rootRealPath, rawPath);
  if (!containsPath(rootRealPath, resolved)) throw new Error(`unsafe mutation path escapes allowed root: ${rawPath}`);
  if (options.allowRoot !== true && resolved === rootRealPath) {
    throw new Error(`unsafe mutation path targets the session root: ${rawPath}`);
  }

  if (fs.existsSync(resolved)) {
    const realTarget = fs.realpathSync(resolved);
    if (!containsPath(rootRealPath, realTarget)) {
      throw new Error(`unsafe mutation path resolves outside allowed root: ${rawPath}`);
    }
  } else {
    if (options.mustExist === true) throw new Error(`mutation target not found: ${rawPath}`);
    const ancestor = existingAncestor(path.dirname(resolved));
    const realAncestor = fs.realpathSync(ancestor);
    if (!containsPath(rootRealPath, realAncestor)) {
      throw new Error(`unsafe mutation path parent resolves outside allowed root: ${rawPath}`);
    }
  }

  return { rawPath, resolved, rootRealPath };
}
