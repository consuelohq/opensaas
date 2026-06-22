import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { Effect } from 'effect';

import { findGitRootEffect } from './location';

const DIR_SNAPSHOT_FILE_LIMIT = 1000;

export type Snapshot =
  | { kind: 'git'; root: string; files: Map<string, string> }
  | { kind: 'dir'; root: string; files: Map<string, string> }
  | { kind: 'none'; root: string };

function parsePorcelain(stdout: string): Map<string, string> {
  const files = new Map<string, string>();
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    const rawPath = line.slice(3).replace(/^"|"$/g, '');
    const normalizedPath = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1) || rawPath : rawPath;
    files.set(normalizedPath, line.slice(0, 2));
  }
  return files;
}

const captureGitSnapshotEffect = (cwd: string) => Effect.gen(function* () {
  const root = yield* findGitRootEffect(cwd);
  if (!root) return null;

  return yield* Effect.try({
    try: () => {
      const stdout = execFileSync('git', ['status', '--porcelain', '-uall'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return { kind: 'git', root, files: parsePorcelain(stdout) } satisfies Snapshot;
    },
    catch: () => ({ kind: 'none', root: cwd } satisfies Snapshot),
  }).pipe(Effect.catchAll((snapshot) => Effect.succeed(snapshot)));
});

function captureDirectorySnapshotUnsafe(root: string): Snapshot {
  const files = new Map<string, string>();
  let count = 0;
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);
      count += 1;
      if (count > DIR_SNAPSHOT_FILE_LIMIT) throw new Error('directory snapshot limit exceeded');
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      const stat = statSync(absolute);
      files.set(relative, String(stat.size) + ':' + String(stat.mtimeMs));
    }
  };

  walk(root);
  return { kind: 'dir', root, files };
}

const captureDirectorySnapshotEffect = (root: string) => Effect.try({
  try: () => captureDirectorySnapshotUnsafe(root),
  catch: () => ({ kind: 'none', root } satisfies Snapshot),
}).pipe(Effect.catchAll((snapshot) => Effect.succeed(snapshot)));

export const captureSnapshotEffect = (cwd: string) => Effect.gen(function* () {
  const gitSnapshot = yield* captureGitSnapshotEffect(cwd);
  if (gitSnapshot) return gitSnapshot;
  return yield* captureDirectorySnapshotEffect(cwd);
});

export function changedFiles(before: Snapshot, after: Snapshot): string[] {
  if (before.kind === 'none' || after.kind === 'none') return [];
  if (before.kind !== after.kind || before.root !== after.root) return [];

  const changed = new Set<string>();
  for (const [file, marker] of after.files) {
    if (before.files.get(file) !== marker) changed.add(file);
  }
  for (const file of before.files.keys()) {
    if (!after.files.has(file)) changed.add(file);
  }
  return [...changed].sort();
}
