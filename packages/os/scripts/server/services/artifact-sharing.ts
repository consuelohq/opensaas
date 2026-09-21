import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ARTIFACT_SHARE_DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
export const ARTIFACT_SHARE_MAX_TTL_SECONDS = 30 * 24 * 60 * 60;
const ARTIFACT_SHARE_MIN_TTL_SECONDS = 60;
const ARTIFACT_SHARE_SESSION_TTL_SECONDS = 12 * 60 * 60;
const MAX_SESSIONS_PER_SHARE = 8;

type ArtifactShareSessionRecord = {
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
};

export type ArtifactShareRecord = {
  id: string;
  artifactId: string;
  secretHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  sessions: ArtifactShareSessionRecord[];
};

type ArtifactShareStore = {
  version: 1;
  shares: Record<string, ArtifactShareRecord>;
};

export type ArtifactShareSummary = {
  id: string;
  artifactId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  active: boolean;
};

export type ArtifactShareStatus =
  | { kind: 'missing' }
  | { kind: 'expired'; share: ArtifactShareRecord }
  | { kind: 'revoked'; share: ArtifactShareRecord }
  | { kind: 'active'; share: ArtifactShareRecord };

function shareStorePath(home: string): string {
  return path.join(home, 'artifacts', 'shares.json');
}

function emptyStore(): ArtifactShareStore {
  return { version: 1, shares: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateStore(value: unknown): ArtifactShareStore {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.shares)) {
    throw new Error('artifact share store is invalid');
  }
  return value as ArtifactShareStore;
}

function readStore(home: string): ArtifactShareStore {
  const file = shareStorePath(home);
  if (!fs.existsSync(file)) return emptyStore();
  return validateStore(JSON.parse(fs.readFileSync(file, 'utf8')) as unknown);
}

function writeStore(home: string, store: ArtifactShareStore): void {
  const file = shareStorePath(home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporaryFile = `${file}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;
  fs.writeFileSync(temporaryFile, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporaryFile, file);
}

function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function equalHash(expectedHash: string, secret: string): boolean {
  if (!/^[a-f0-9]{64}$/u.test(expectedHash)) return false;
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(hashSecret(secret), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function randomSecret(): string {
  return randomBytes(32).toString('base64url');
}

function randomShareId(): string {
  return `share-${randomBytes(12).toString('base64url')}`;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function shareStatus(share: ArtifactShareRecord | undefined, nowMs: number): ArtifactShareStatus {
  if (!share) return { kind: 'missing' };
  if (share.revokedAt) return { kind: 'revoked', share };
  if (Date.parse(share.expiresAt) <= nowMs) return { kind: 'expired', share };
  return { kind: 'active', share };
}

export function getArtifactShareStatus(input: {
  home: string;
  shareId: string;
  nowMs: number;
}): ArtifactShareStatus {
  const store = readStore(input.home);
  return shareStatus(store.shares[input.shareId], input.nowMs);
}

function normalizeTtlSeconds(value: unknown): number {
  if (value === undefined) return ARTIFACT_SHARE_DEFAULT_TTL_SECONDS;
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < ARTIFACT_SHARE_MIN_TTL_SECONDS
    || value > ARTIFACT_SHARE_MAX_TTL_SECONDS
  ) {
    throw new Error(
      `expiresInSeconds must be an integer between ${ARTIFACT_SHARE_MIN_TTL_SECONDS} and ${ARTIFACT_SHARE_MAX_TTL_SECONDS}`,
    );
  }
  return value;
}

function summary(share: ArtifactShareRecord, nowMs: number): ArtifactShareSummary {
  return {
    id: share.id,
    artifactId: share.artifactId,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt,
    ...(share.revokedAt ? { revokedAt: share.revokedAt } : {}),
    active: shareStatus(share, nowMs).kind === 'active',
  };
}

export function createArtifactShare(input: {
  home: string;
  artifactId: string;
  expiresInSeconds?: unknown;
  nowMs: number;
}): ArtifactShareSummary & { secret: string; url: string } {
  const ttlSeconds = normalizeTtlSeconds(input.expiresInSeconds);
  const store = readStore(input.home);
  let id = randomShareId();
  while (store.shares[id]) id = randomShareId();
  const secret = randomSecret();
  const share: ArtifactShareRecord = {
    id,
    artifactId: input.artifactId,
    secretHash: hashSecret(secret),
    createdAt: iso(input.nowMs),
    expiresAt: iso(input.nowMs + ttlSeconds * 1000),
    sessions: [],
  };
  store.shares[id] = share;
  writeStore(input.home, store);
  return {
    ...summary(share, input.nowMs),
    secret,
    url: `/share/artifacts/${id}#${secret}`,
  };
}

export function listArtifactShares(input: {
  home: string;
  artifactId: string;
  nowMs: number;
}): ArtifactShareSummary[] {
  const store = readStore(input.home);
  return Object.values(store.shares)
    .filter((share) => share.artifactId === input.artifactId)
    .map((share) => summary(share, input.nowMs))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function revokeArtifactShare(input: {
  home: string;
  artifactId: string;
  shareId: string;
  nowMs: number;
}): ArtifactShareSummary | null {
  const store = readStore(input.home);
  const share = store.shares[input.shareId];
  if (!share || share.artifactId !== input.artifactId) return null;
  if (!share.revokedAt) {
    share.revokedAt = iso(input.nowMs);
    share.sessions = [];
    writeStore(input.home, store);
  }
  return summary(share, input.nowMs);
}

export function claimArtifactShare(input: {
  home: string;
  shareId: string;
  secret: string;
  nowMs: number;
}):
  | { ok: true; share: ArtifactShareRecord; sessionToken: string; sessionExpiresAt: string }
  | { ok: false; status: 'missing' | 'expired' | 'revoked' | 'invalid-secret' } {
  const store = readStore(input.home);
  const status = shareStatus(store.shares[input.shareId], input.nowMs);
  if (status.kind !== 'active') return { ok: false, status: status.kind };
  if (!equalHash(status.share.secretHash, input.secret)) {
    return { ok: false, status: 'invalid-secret' };
  }

  const sessionToken = randomSecret();
  const shareExpiresAtMs = Date.parse(status.share.expiresAt);
  const sessionExpiresAtMs = Math.min(
    shareExpiresAtMs,
    input.nowMs + ARTIFACT_SHARE_SESSION_TTL_SECONDS * 1000,
  );
  const session: ArtifactShareSessionRecord = {
    tokenHash: hashSecret(sessionToken),
    createdAt: iso(input.nowMs),
    expiresAt: iso(sessionExpiresAtMs),
  };
  status.share.sessions = [
    ...status.share.sessions
      .filter((candidate) => Date.parse(candidate.expiresAt) > input.nowMs)
      .slice(-(MAX_SESSIONS_PER_SHARE - 1)),
    session,
  ];
  store.shares[status.share.id] = status.share;
  writeStore(input.home, store);
  return {
    ok: true,
    share: status.share,
    sessionToken,
    sessionExpiresAt: session.expiresAt,
  };
}

export function authorizeArtifactShareSession(input: {
  home: string;
  shareId: string;
  sessionToken: string;
  nowMs: number;
}): ArtifactShareStatus {
  const store = readStore(input.home);
  const status = shareStatus(store.shares[input.shareId], input.nowMs);
  if (status.kind !== 'active') return status;
  const authorized = status.share.sessions.some(
    (session) =>
      Date.parse(session.expiresAt) > input.nowMs
      && equalHash(session.tokenHash, input.sessionToken),
  );
  return authorized ? status : { kind: 'missing' };
}
