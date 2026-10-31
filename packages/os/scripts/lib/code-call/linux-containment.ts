import path from 'node:path';

export const BUBBLEWRAP_EXECUTABLE = '/usr/bin/bwrap';

export type LinuxWorkSessionContainmentInput = {
  command: string;
  args: string[];
  writeBoundaryRoot: string;
  scratchRoot: string;
  protectedReadRoots: string[];
  allowBoundaryWrites: boolean;
};

function overlaps(first: string, second: string): boolean {
  const inside = (root: string, candidate: string): boolean => {
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  };
  return inside(first, second) || inside(second, first);
}

function requireAbsoluteRoot(value: string, name: string): string {
  if (!path.isAbsolute(value) || path.normalize(value) !== value || value === '/') {
    throw new Error(name + ' must be a normalized absolute directory other than /');
  }
  return value;
}

/**
 * Produce a process-level Linux filesystem boundary. The host is read-only,
 * with writable mounts limited to the session root (edit only) and staged
 * scratch. User and PID namespaces prevent the child from escaping through
 * the host process namespace. Networking remains available, as on macOS.
 */
export function planLinuxWorkSessionContainment(input: LinuxWorkSessionContainmentInput): {
  command: string;
  args: string[];
} {
  const writeRoot = requireAbsoluteRoot(input.writeBoundaryRoot, 'write boundary');
  const scratchRoot = requireAbsoluteRoot(input.scratchRoot, 'scratch root');
  if (overlaps(writeRoot, scratchRoot)) {
    throw new Error('scratch and session roots must be distinct and nonoverlapping');
  }

  const protectedRoots = [...new Set(input.protectedReadRoots
    .map((root) => requireAbsoluteRoot(root, 'protected read root')))];
  for (const protectedRoot of protectedRoots) {
    if (overlaps(writeRoot, protectedRoot) || overlaps(scratchRoot, protectedRoot)) {
      throw new Error('contained writable roots must not overlap protected read roots');
    }
  }

  return {
    command: BUBBLEWRAP_EXECUTABLE,
    args: [
      '--ro-bind', '/', '/',
      '--dev', '/dev',
      '--proc', '/proc',
      '--unshare-user',
      '--unshare-pid',
      '--unshare-ipc',
      '--die-with-parent',
      '--new-session',
      ...protectedRoots.flatMap((root) => ['--tmpfs', root]),
      '--bind', scratchRoot, scratchRoot,
      ...(input.allowBoundaryWrites
        ? ['--bind', writeRoot, writeRoot]
        : []),
      '--',
      input.command,
      ...input.args,
    ],
  };
}

/**
 * A work-session command cannot inherit the OS daemon's signing keys,
 * provider credentials or SSH/GitHub agent access through environment vars.
 * Explicit provider operations use their own typed, authorized OS tools.
 */
export function buildContainedRuntimeEnv(baseEnv: NodeJS.ProcessEnv, scratchRoot: string): NodeJS.ProcessEnv {
  const allow = [
    'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'LC_ALL',
    'LC_CTYPE', 'LC_MESSAGES', 'TERM', 'COLORTERM', 'TZ',
    'SSL_CERT_FILE', 'SSL_CERT_DIR',
  ] as const;
  const result: NodeJS.ProcessEnv = {};
  for (const key of allow) {
    if (typeof baseEnv[key] === 'string') result[key] = baseEnv[key];
  }
  result.PATH ??= '/usr/local/bin:/usr/bin:/bin';
  return {
    ...result,
    TMPDIR: scratchRoot + '/',
    TMP: scratchRoot,
    TEMP: scratchRoot,
    XDG_CACHE_HOME: scratchRoot,
    PYTHONPYCACHEPREFIX: scratchRoot,
  };
}
