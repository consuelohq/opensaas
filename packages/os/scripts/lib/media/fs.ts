import { Effect } from 'effect';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, normalize } from 'node:path';

export type MediaFsService = {
  exists: (path: string) => Effect.Effect<boolean, Error>;
  readText: (path: string) => Effect.Effect<string, Error>;
  writeText: (path: string, content: string) => Effect.Effect<void, Error>;
  assertSafeRelativePath: (path: string) => Effect.Effect<string, Error>;
};

export const MediaFs = Symbol('MediaFs');

export function assertSafeRelativePath(path: string): string {
  const normalized = normalize(path);
  if (isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../')) {
    throw new Error('unsafe media output path: ' + path);
  }
  return normalized;
}

export const liveMediaFs: MediaFsService = {
  exists: (path) => Effect.succeed(existsSync(path)),
  readText: (path) => Effect.try({ try: () => readFileSync(path, 'utf8'), catch: (cause) => cause instanceof Error ? cause : new Error(String(cause)) }),
  writeText: (path, content) => Effect.try({
    try: () => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    },
    catch: (cause) => cause instanceof Error ? cause : new Error(String(cause)),
  }),
  assertSafeRelativePath: (path) => Effect.try({ try: () => assertSafeRelativePath(path), catch: (cause) => cause instanceof Error ? cause : new Error(String(cause)) }),
};
