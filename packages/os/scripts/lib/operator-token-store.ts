import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { exchangeRefreshToken } from './operator-login';

export type StoredOperatorToken = {
  version: 1;
  kind: 'consuelo-operator-token';
  authorityOrigin: string;
  workspaceHost: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope: string[];
  createdAt: string;
};

export type OperatorWorkspaceCredential = {
  authorityOrigin: string;
  workspaceHost: string;
  accessToken: string;
  canManageNodes: boolean;
};

const REFRESH_SKEW_MS = 60_000;
const refreshFlights = new Map<
  string,
  Promise<OperatorWorkspaceCredential | undefined>
>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validAuthorityOrigin = (value: string): boolean => {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash)
      return false;
    if (url.protocol === 'https:') return true;
    return (
      url.protocol === 'http:' &&
      (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]')
    );
  } catch (_error: unknown) {
    return false;
  }
};

export const operatorTokenPath = (home: string): string =>
  path.join(home, 'node', 'security', 'generated', 'operator-token.json');

export function writeStoredOperatorToken(home: string, token: StoredOperatorToken): void {
  const file = operatorTokenPath(home);
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  const temporaryFile = `${file}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;
  try {
    fs.writeFileSync(temporaryFile, `${JSON.stringify(token, null, 2)}\n`, {
      mode: 0o600,
      flag: 'wx',
    });
    fs.chmodSync(temporaryFile, 0o600);
    fs.renameSync(temporaryFile, file);
    fs.chmodSync(file, 0o600);
  } finally {
    try {
      fs.unlinkSync(temporaryFile);
    } catch (_error: unknown) {
      // The atomic rename removes the temporary path on success.
    }
  }
}

export function readStoredOperatorToken(input: {
  home: string;
  workspaceHost?: string;
  nowMs?: number;
  allowExpired?: boolean;
}): StoredOperatorToken | undefined {
  const file = operatorTokenPath(input.home);
  try {
    const metadata = fs.lstatSync(file);
    if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) return undefined;
    if (typeof process.geteuid === 'function' && metadata.uid !== process.geteuid()) return undefined;

    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!isRecord(parsed)) return undefined;
    if (parsed.version !== 1 || parsed.kind !== 'consuelo-operator-token') return undefined;
    if (typeof parsed.authorityOrigin !== 'string' || !validAuthorityOrigin(parsed.authorityOrigin))
      return undefined;
    if (typeof parsed.workspaceHost !== 'string' || parsed.workspaceHost.trim() === '') return undefined;
    if (
      input.workspaceHost &&
      parsed.workspaceHost.trim().toLowerCase() !== input.workspaceHost.trim().toLowerCase()
    )
      return undefined;
    if (typeof parsed.accessToken !== 'string' || parsed.accessToken.trim() === '') return undefined;
    if (
      parsed.refreshToken !== undefined &&
      (typeof parsed.refreshToken !== 'string' || parsed.refreshToken.trim() === '')
    )
      return undefined;
    if (parsed.expiresAt !== undefined && typeof parsed.expiresAt !== 'number') return undefined;
    if (
      !input.allowExpired &&
      typeof parsed.expiresAt === 'number' &&
      parsed.expiresAt <= (input.nowMs ?? Date.now())
    )
      return undefined;
    if (!Array.isArray(parsed.scope) || !parsed.scope.every((scope) => typeof scope === 'string'))
      return undefined;
    if (typeof parsed.createdAt !== 'string' || !Number.isFinite(Date.parse(parsed.createdAt)))
      return undefined;

    return {
      version: 1,
      kind: 'consuelo-operator-token',
      authorityOrigin: parsed.authorityOrigin,
      workspaceHost: parsed.workspaceHost,
      accessToken: parsed.accessToken,
      ...(typeof parsed.refreshToken === 'string' ? { refreshToken: parsed.refreshToken } : {}),
      ...(typeof parsed.expiresAt === 'number' ? { expiresAt: parsed.expiresAt } : {}),
      scope: [...parsed.scope],
      createdAt: parsed.createdAt,
    };
  } catch (_error: unknown) {
    return undefined;
  }
}

export function readStoredOperatorWorkspaceCredential(input: {
  home: string;
  workspaceHost?: string;
  nowMs?: number;
}): OperatorWorkspaceCredential | undefined {
  const stored = readStoredOperatorToken(input);
  return stored ? workspaceCredential(stored) : undefined;
}

const workspaceCredential = (
  stored: StoredOperatorToken,
): OperatorWorkspaceCredential | undefined => {
  if (!stored.scope.includes('workspace:read')) return undefined;
  return {
    authorityOrigin: stored.authorityOrigin,
    workspaceHost: stored.workspaceHost,
    accessToken: stored.accessToken,
    canManageNodes: stored.scope.includes('workspace:nodes:manage'),
  };
};

export async function resolveStoredOperatorWorkspaceCredential(input: {
  home: string;
  workspaceHost?: string;
  nowMs?: number;
  refreshSkewMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<OperatorWorkspaceCredential | undefined> {
  const nowMs = input.nowMs ?? Date.now();
  const stored = readStoredOperatorToken({
    home: input.home,
    ...(input.workspaceHost ? { workspaceHost: input.workspaceHost } : {}),
    allowExpired: true,
  });
  if (!stored) return undefined;
  const credential = workspaceCredential(stored);
  if (!credential) return undefined;

  const expiresAt = stored.expiresAt;
  if (
    expiresAt === undefined ||
    expiresAt > nowMs + (input.refreshSkewMs ?? REFRESH_SKEW_MS)
  ) {
    return credential;
  }
  if (!stored.refreshToken) return undefined;

  const file = operatorTokenPath(input.home);
  const existingFlight = refreshFlights.get(file);
  if (existingFlight) return existingFlight;

  const refreshFlight = refreshWorkspaceCredential({
    home: input.home,
    stored,
    fetchImpl: input.fetchImpl,
  });
  refreshFlights.set(file, refreshFlight);
  try {
    return await refreshFlight;
  } finally {
    if (refreshFlights.get(file) === refreshFlight) refreshFlights.delete(file);
  }
}

async function refreshWorkspaceCredential(input: {
  home: string;
  stored: StoredOperatorToken;
  fetchImpl?: typeof fetch;
}): Promise<OperatorWorkspaceCredential | undefined> {
  try {
    const result = await exchangeRefreshToken({
      authorityOrigin: input.stored.authorityOrigin,
      refreshToken: input.stored.refreshToken ?? '',
      resource: new URL('/mcp', input.stored.authorityOrigin).toString(),
      fetchImpl: input.fetchImpl,
    });
    const scope = result.scope.length > 0 ? result.scope : input.stored.scope;
    if (scope.some((value) => !input.stored.scope.includes(value))) return undefined;
    if (!result.refreshToken || result.expiresAt === undefined) return undefined;

    const refreshed: StoredOperatorToken = {
      ...input.stored,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      scope,
      createdAt: new Date().toISOString(),
    };
    writeStoredOperatorToken(input.home, refreshed);
    return workspaceCredential(refreshed);
  } catch (_error: unknown) {
    return undefined;
  }
}
