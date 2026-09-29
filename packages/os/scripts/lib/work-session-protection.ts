import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type WorkSessionProtectedRoot = {
  kind: 'consuelo-home' | 'managed-repository';
  path: string;
};

export function canonicalExistingPath(candidate: string): string {
  return fs.realpathSync(path.resolve(candidate));
}

function containsPath(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function prospectiveCanonicalPath(candidate: string): string {
  const resolved = path.resolve(candidate);
  if (fs.existsSync(resolved)) return canonicalExistingPath(resolved);

  const suffix: string[] = [];
  let cursor = resolved;
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    suffix.unshift(path.basename(cursor));
    cursor = parent;
  }
  const canonicalBase = fs.existsSync(cursor)
    ? canonicalExistingPath(cursor)
    : path.resolve(cursor);
  return path.join(canonicalBase, ...suffix);
}

export function pathsOverlap(first: string, second: string): boolean {
  return containsPath(first, second) || containsPath(second, first);
}

export function managedWorktreeRoots(managedRepoRoot: string): string[] {
  let canonicalManagedRoot: string;
  try {
    canonicalManagedRoot = canonicalExistingPath(managedRepoRoot);
  } catch {
    return [];
  }
  try {
    const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: canonicalManagedRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const roots = output
      .split('\n')
      .filter((line) => line.startsWith('worktree '))
      .map((line) => line.slice('worktree '.length).trim())
      .filter(Boolean)
      .map((candidate) => {
        try {
          return canonicalExistingPath(candidate);
        } catch {
          return path.resolve(candidate);
        }
      });
    if (!roots.includes(canonicalManagedRoot)) roots.push(canonicalManagedRoot);
    return roots;
  } catch (error: unknown) {
    throw new Error(
      `failed to enumerate managed Git worktrees from ${canonicalManagedRoot}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

export function findProtectedWorkSessionRoot(input: {
  root: string;
  consueloHome: string;
  managedRepoRoot?: string;
}): WorkSessionProtectedRoot | null {
  const root = canonicalExistingPath(input.root);
  const consueloHome = fs.existsSync(input.consueloHome)
    ? canonicalExistingPath(input.consueloHome)
    : path.resolve(input.consueloHome);
  if (pathsOverlap(root, consueloHome)) {
    return { kind: 'consuelo-home', path: consueloHome };
  }

  const managedRepoRoot = input.managedRepoRoot?.trim();
  if (!managedRepoRoot) return null;
  const protectedRoot = managedWorktreeRoots(managedRepoRoot)
    .find((candidate) => pathsOverlap(root, candidate));
  return protectedRoot
    ? { kind: 'managed-repository', path: protectedRoot }
    : null;
}

export function findProtectedProspectiveWorkSessionRoot(input: {
  root: string;
  consueloHome: string;
  managedRepoRoot?: string;
}): WorkSessionProtectedRoot | null {
  const root = prospectiveCanonicalPath(input.root);
  const consueloHome = prospectiveCanonicalPath(input.consueloHome);
  if (pathsOverlap(root, consueloHome)) {
    return { kind: 'consuelo-home', path: consueloHome };
  }

  const managedRepoRoot = input.managedRepoRoot?.trim();
  if (!managedRepoRoot) return null;
  const protectedRoot = managedWorktreeRoots(managedRepoRoot)
    .find((candidate) => pathsOverlap(root, candidate));
  return protectedRoot
    ? { kind: 'managed-repository', path: protectedRoot }
    : null;
}
