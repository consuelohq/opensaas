import { execFileSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import path from 'node:path';

export type GitHubCliResolveOptions = {
  pathValue?: string;
  platform?: NodeJS.Platform;
  isExecutable?: (candidate: string) => boolean;
  readVersion?: (candidate: string) => string;
};

const defaultExecutableCheck = (candidate: string): boolean => {
  try {
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const defaultVersionReader = (candidate: string): string => {
  try {
    return execFileSync(candidate, ['--version'], {
      encoding: 'utf8',
      timeout: 5_000,
      maxBuffer: 64 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
};

export function resolveGitHubCliPath(
  options: GitHubCliResolveOptions = {},
): string {
  const platform = options.platform ?? process.platform;
  const pathValue = options.pathValue ?? process.env.PATH ?? '';
  const isExecutable = options.isExecutable ?? defaultExecutableCheck;
  const readVersion = options.readVersion ?? defaultVersionReader;
  const names = platform === 'win32' ? ['gh.exe', 'gh.cmd', 'gh'] : ['gh'];
  const seen = new Set<string>();

  for (const directory of pathValue.split(path.delimiter).filter(Boolean)) {
    for (const name of names) {
      const candidate = path.resolve(directory, name);
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      if (!isExecutable(candidate)) continue;
      const version = readVersion(candidate);
      if (/^gh version\s+\d+(?:\.\d+){1,}/i.test(version)) return candidate;
    }
  }

  throw new Error(
    'real GitHub CLI was not found on PATH; install/authenticate GitHub CLI instead of using the Consuelo gh tool shim',
  );
}

export function assertGitHubCliAuthenticated(ghPath: string): void {
  try {
    execFileSync(ghPath, ['auth', 'status'], {
      encoding: 'utf8',
      timeout: 10_000,
      maxBuffer: 128 * 1024,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
  } catch {
    throw new Error('GitHub CLI is installed but not authenticated; run `gh auth login` once on this node');
  }
}
