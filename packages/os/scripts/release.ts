#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import {
  createPublicKey,
  randomUUID,
  verify as verifyBytes,
} from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  orchestrateRelease,
  selectRuntimePublishCandidate,
  type ReleaseAdapter,
  type ReleaseChannel,
  type ReleaseCheck,
  type ReleaseIdentity,
  type ReleasePr,
  type ReleaseRun,
  type RuntimePublishListRow,
} from './lib/release-orchestrator';
import {
  assertGitHubCliAuthenticated,
  resolveGitHubCliPath,
} from './lib/github-cli';
import { selectReleasePlatformBundleId } from './lib/release-platform-bundle';
import { resolveConsueloHomeLayout } from './lib/consuelo-home';
import {
  resolveImmutableReleaseIdentityFromEvidence,
  type ImmutableReleaseTag,
} from './lib/release-immutable';
import {
  createReleaseOperationManager,
  type ReleaseOperationRequest,
} from './lib/release-operation';
import {
  canonicalBundleSignatureJson,
  type BundleSignaturePayload,
  type DetachedReleaseSignature,
} from './lib/distribution/release-channels';
import {
  RELEASE_PROMOTION_LOCK_BRANCH,
  RELEASE_PROMOTION_LOCK_PATH,
  withReleasePromotionDispatchLock,
  type ReleasePromotionDispatchLockAdapter,
  type ReleasePromotionLockLease,
  type ReleasePromotionLockMarker,
} from './lib/release-promotion-dispatch-lock';
import {
  evaluatePromotionCorrelation,
  promotionDeadline,
  RELEASE_STATE_WORKFLOWS,
  selectActiveReleaseStateRun,
  type PromotionRunRow,
} from './lib/release-promotion-correlation';

const DEFAULT_REPO = 'consuelohq/opensaas';
// These workflow filenames are part of the operator release contract; keep them aligned with GitHub Actions.
const [RUNTIME_PUBLISH_WORKFLOW, RUNTIME_PROMOTE_WORKFLOW, RUNTIME_ROLLBACK_WORKFLOW] =
  RELEASE_STATE_WORKFLOWS;
const DEFAULT_RELEASE_BASE_URL = 'https://install.consuelohq.com/os/releases';
const PACKAGE_ROOT = path.resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_SCRIPT_PATH = fileURLToPath(import.meta.url);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function trustedReleasePublicKeys(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const keys: Record<string, string> = {};
  const raw = clean(env.CONSUELO_OS_RELEASE_TRUSTED_PUBLIC_KEYS);
  if (raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('CONSUELO_OS_RELEASE_TRUSTED_PUBLIC_KEYS is not valid JSON');
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('CONSUELO_OS_RELEASE_TRUSTED_PUBLIC_KEYS must be a JSON object');
    }
    for (const [keyId, publicKey] of Object.entries(parsed as Record<string, unknown>)) {
      if (!keyId.trim() || typeof publicKey !== 'string' || !publicKey.trim()) {
        throw new Error('CONSUELO_OS_RELEASE_TRUSTED_PUBLIC_KEYS contains an invalid key');
      }
      keys[keyId] = publicKey;
    }
  }
  const keyId = clean(env.CONSUELO_OS_RELEASE_SIGNING_KEY_ID);
  const publicKey = clean(env.CONSUELO_OS_RELEASE_SIGNING_PUBLIC_KEY);
  if (keyId || publicKey) {
    if (!keyId || !publicKey) {
      throw new Error(
        'CONSUELO_OS_RELEASE_SIGNING_KEY_ID and CONSUELO_OS_RELEASE_SIGNING_PUBLIC_KEY must be configured together',
      );
    }
    keys[keyId] = publicKey;
  }
  if (Object.keys(keys).length === 0) {
    throw new Error('trusted Consuelo OS release public keys are required');
  }
  return keys;
}

function safeErrorText(value: unknown): string {
  return clean(value)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [REDACTED]')
    .replace(/\bgithub_pat_[A-Za-z0-9_]+\b/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/\bgh[pousr]_[A-Za-z0-9]+\b/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_SECRET]')
    .slice(0, 800);
}

function parseJson<T>(value: string, context: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`${context} returned invalid JSON`);
  }
}

function parseArgs(argv: string[]) {
  const parsed: {
    action: 'start' | 'status' | 'logs' | 'attach' | 'resume';
    pr?: number;
    repo: string;
    channel: ReleaseChannel;
    mergeMethod: 'merge' | 'squash' | 'rebase';
    releaseOnly: boolean;
    dryRun: boolean;
    json: boolean;
    operationId?: string;
    tailLines: number;
  } = {
    action: 'start',
    repo: DEFAULT_REPO,
    channel: 'canary',
    mergeMethod: 'merge',
    releaseOnly: false,
    dryRun: false,
    json: false,
    tailLines: 80,
  };

  const next = (index: number, flag: string) => {
    const value = argv[index + 1];
    if (!value || value.startsWith('-')) throw new Error(`${flag} requires a value`);
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--action') {
      const value = next(index, arg) as typeof parsed.action;
      if (!['start', 'status', 'logs', 'attach', 'resume'].includes(value)) {
        throw new Error(`unsupported release action: ${value}`);
      }
      parsed.action = value;
      index += 1;
    } else if (arg === '--pr') {
      parsed.pr = Number(next(index, arg));
      index += 1;
    } else if (arg === '--repo') {
      parsed.repo = next(index, arg);
      index += 1;
    } else if (arg === '--channel') {
      const value = next(index, arg) as ReleaseChannel;
      if (!['dev', 'canary', 'beta', 'stable'].includes(value)) {
        throw new Error(`unsupported release channel: ${value}`);
      }
      parsed.channel = value;
      index += 1;
    } else if (arg === '--merge-method') {
      const value = next(index, arg) as 'merge' | 'squash' | 'rebase';
      if (!['merge', 'squash', 'rebase'].includes(value)) {
        throw new Error(`unsupported merge method: ${value}`);
      }
      parsed.mergeMethod = value;
      index += 1;
    } else if (arg === '--release-only') {
      parsed.releaseOnly = true;
    } else if (arg === '--operation-id') {
      parsed.operationId = next(index, arg);
      index += 1;
    } else if (arg === '--tail-lines') {
      parsed.tailLines = Number(next(index, arg));
      index += 1;
    } else if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else if (arg === '--json') {
      parsed.json = true;
    } else if (arg === '--help' || arg === '-h') {
      process.stdout.write(
        'release [--action start] --pr <number> [--channel dev|canary|beta|stable] [--merge-method merge|squash|rebase] [--release-only] [--dry-run] [--json]\n' +
        'release --action status|logs|attach|resume --operation-id <release-id> [--tail-lines <1-500>] [--json]\n',
      );
      process.exit(0);
    } else {
      throw new Error(`unknown release option: ${arg}`);
    }
  }

  if (!Number.isInteger(parsed.tailLines) || parsed.tailLines < 1 || parsed.tailLines > 500) {
    throw new Error('release --tail-lines must be an integer from 1 to 500');
  }
  if (parsed.action === 'start') {
    if (!Number.isInteger(parsed.pr) || Number(parsed.pr) <= 0) {
      throw new Error('release start requires --pr <positive-number>');
    }
    if (parsed.operationId) throw new Error('release start does not accept --operation-id');
  } else {
    if (!parsed.operationId || !/^release-[a-f0-9]{8,64}$/.test(parsed.operationId)) {
      throw new Error(`release ${parsed.action} requires --operation-id <release-id>`);
    }
    if (parsed.pr !== undefined) throw new Error(`release ${parsed.action} does not accept --pr`);
  }
  return parsed;
}

function commandOutput(command: string, args: string[], timeout = 30_000): string {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout,
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) throw new Error(safeErrorText(result.error.message));
  if ((result.status ?? 1) !== 0) {
    throw new Error(safeErrorText(result.stderr || result.stdout || `command exited ${result.status}`));
  }
  return clean(result.stdout);
}

function commandAttempt(
  command: string,
  args: string[],
  timeout = 30_000,
): { stdout: string; stderr: string; status: number } {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout,
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) throw new Error(safeErrorText(result.error.message));
  return {
    stdout: clean(result.stdout),
    stderr: safeErrorText(result.stderr),
    status: result.status ?? 1,
  };
}

function httpStatusFromErrorText(value: string): number | null {
  const match = value.match(/\(HTTP\s+(\d{3})\)/i);
  return match ? Number(match[1]) : null;
}

function commandOutputAllowingStatus(
  command: string,
  args: string[],
  allowed: number[],
  timeout = 30_000,
): { stdout: string; status: number } {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout,
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) throw new Error(safeErrorText(result.error.message));
  const status = result.status ?? 1;
  if (!allowed.includes(status)) {
    throw new Error(safeErrorText(result.stderr || result.stdout || `command exited ${status}`));
  }
  return { stdout: clean(result.stdout), status };
}

function checkBucket(value: unknown): ReleaseCheck['bucket'] {
  const bucket = clean(value).toLowerCase();
  if (bucket === 'pass' || bucket === 'fail' || bucket === 'pending' || bucket === 'skipping' || bucket === 'cancel') {
    return bucket;
  }
  return 'pending';
}

function releaseStepError(context: string, error: unknown): Error {
  const message = safeErrorText(error instanceof Error ? error.message : error);
  return new Error(`${context}: ${message || 'unknown error'}`);
}

function createAdapter(repo: string, ghPath: string): ReleaseAdapter {
  const ghJson = <T>(args: string[], timeout?: number): T =>
    parseJson<T>(commandOutput(ghPath, [...args, '--repo', repo], timeout), `gh ${args.join(' ')}`);
  const ghApiAttempt = (args: string[], timeout?: number) =>
    commandAttempt(ghPath, ['api', ...args], timeout);

  const createPromotionLockAdapter = (
    sourceCommit: string,
    listReleaseStateRuns: () => PromotionRunRow[],
  ): ReleasePromotionDispatchLockAdapter => {
    const refEndpoint = `repos/${repo}/git/ref/heads/${RELEASE_PROMOTION_LOCK_BRANCH}`;
    const refsEndpoint = `repos/${repo}/git/refs`;
    const contentsEndpoint = `repos/${repo}/contents/${RELEASE_PROMOTION_LOCK_PATH}`;

    const ensureLockBranch = () => {
      const current = ghApiAttempt(['--method', 'GET', refEndpoint]);
      if (current.status === 0) return;
      if (httpStatusFromErrorText(current.stderr) !== 404) {
        throw new Error(current.stderr || current.stdout || 'failed to read release lock branch');
      }

      const created = ghApiAttempt([
        '--method',
        'POST',
        refsEndpoint,
        '-f',
        `ref=refs/heads/${RELEASE_PROMOTION_LOCK_BRANCH}`,
        '-f',
        `sha=${sourceCommit}`,
      ]);
      if (created.status === 0) return;
      if (httpStatusFromErrorText(created.stderr) === 422) {
        const raced = ghApiAttempt(['--method', 'GET', refEndpoint]);
        if (raced.status === 0) return;
      }
      throw new Error(created.stderr || created.stdout || 'failed to create release lock branch');
    };

    const readRawLock = (): {
      marker: ReleasePromotionLockMarker;
      blobSha: string;
    } | null => {
      ensureLockBranch();
      const result = ghApiAttempt([
        '--method',
        'GET',
        contentsEndpoint,
        '-f',
        `ref=${RELEASE_PROMOTION_LOCK_BRANCH}`,
      ]);
      if (result.status !== 0) {
        if (httpStatusFromErrorText(result.stderr) === 404) return null;
        throw new Error(result.stderr || result.stdout || 'failed to read release promotion lock');
      }
      const body = parseJson<{
        sha?: string;
        content?: string;
        encoding?: string;
      }>(result.stdout, 'release promotion lock contents');
      const blobSha = clean(body.sha);
      if (!blobSha || clean(body.encoding) !== 'base64' || !clean(body.content)) {
        throw new Error('release promotion lock contents are malformed');
      }
      const decoded = Buffer.from(clean(body.content).replace(/\s+/g, ''), 'base64').toString('utf8');
      const marker = parseJson<ReleasePromotionLockMarker>(decoded, 'release promotion lock marker');
      if (
        !clean(marker.ownerId) ||
        !clean(marker.operationId) ||
        !Number.isFinite(marker.acquiredAtMs) ||
        marker.acquiredAtMs <= 0
      ) {
        throw new Error('release promotion lock marker is malformed');
      }
      return { marker, blobSha };
    };

    return {
      now: () => Date.now(),
      sleep,
      async createMarker({ operationId, acquiredAtMs }) {
        return {
          ownerId: randomUUID(),
          operationId,
          acquiredAtMs,
        };
      },
      async tryCreateLock(marker) {
        ensureLockBranch();
        const content = Buffer.from(JSON.stringify(marker), 'utf8').toString('base64');
        const result = ghApiAttempt([
          '--method',
          'PUT',
          contentsEndpoint,
          '-f',
          `message=lock Consuelo OS runtime promotion (${marker.ownerId})`,
          '-f',
          `content=${content}`,
          '-f',
          `branch=${RELEASE_PROMOTION_LOCK_BRANCH}`,
        ]);
        if (result.status === 0) return true;
        const httpStatus = httpStatusFromErrorText(result.stderr);
        if (httpStatus === 409 || httpStatus === 422) return false;
        throw new Error(result.stderr || result.stdout || 'failed to acquire release promotion lock');
      },
      async readLock() {
        return readRawLock()?.marker ?? null;
      },
      async renewLockIfOwned(ownerId, renewedAtMs) {
        const current = readRawLock();
        if (!current || current.marker.ownerId !== ownerId) return false;
        const renewedMarker: ReleasePromotionLockMarker = {
          ...current.marker,
          acquiredAtMs: renewedAtMs,
        };
        const content = Buffer.from(JSON.stringify(renewedMarker), 'utf8').toString('base64');
        const result = ghApiAttempt([
          '--method',
          'PUT',
          contentsEndpoint,
          '-f',
          `message=renew Consuelo OS runtime promotion lock (${ownerId})`,
          '-f',
          `content=${content}`,
          '-f',
          `sha=${current.blobSha}`,
          '-f',
          `branch=${RELEASE_PROMOTION_LOCK_BRANCH}`,
        ]);
        if (result.status === 0) return true;
        const httpStatus = httpStatusFromErrorText(result.stderr);
        if (httpStatus === 404 || httpStatus === 409 || httpStatus === 422) return false;
        throw new Error(result.stderr || result.stdout || 'failed to renew promotion lock');
      },
      async deleteLockIfOwned(ownerId) {
        const current = readRawLock();
        if (!current || current.marker.ownerId !== ownerId) return false;
        const result = ghApiAttempt([
          '--method',
          'DELETE',
          contentsEndpoint,
          '-f',
          `message=unlock Consuelo OS runtime promotion (${ownerId})`,
          '-f',
          `sha=${current.blobSha}`,
          '-f',
          `branch=${RELEASE_PROMOTION_LOCK_BRANCH}`,
        ]);
        if (result.status === 0) return true;
        const httpStatus = httpStatusFromErrorText(result.stderr);
        if (httpStatus === 404 || httpStatus === 409 || httpStatus === 422) return false;
        throw new Error(result.stderr || result.stdout || 'failed to release promotion lock');
      },
      async hasActiveReleaseStateRun() {
        return Boolean(selectActiveReleaseStateRun(listReleaseStateRuns()));
      },
    };
  };

  const listChecks = (pr: number): ReleaseCheck[] => {
    const result = commandOutputAllowingStatus(
      ghPath,
      [
        'pr',
        'checks',
        String(pr),
        '--repo',
        repo,
        '--json',
        'name,bucket,state,workflow,link',
      ],
      [0, 1, 8],
    );
    if (!result.stdout) return [];
    const rows = parseJson<Array<{ name?: string; bucket?: string }>>(result.stdout, 'gh pr checks');
    return rows.map((row) => ({ name: clean(row.name) || 'unnamed check', bucket: checkBucket(row.bucket) }));
  };

  const listRequiredChecks = (pr: number): ReleaseCheck[] => {
    const result = commandOutputAllowingStatus(
      ghPath,
      [
        'pr',
        'checks',
        String(pr),
        '--repo',
        repo,
        '--required',
        '--json',
        'name,bucket,state,workflow,link',
      ],
      [0, 1, 8],
    );
    if (!result.stdout) return [];
    const rows = parseJson<Array<{ name?: string; bucket?: string }>>(
      result.stdout,
      'gh pr checks --required',
    );
    return rows.map((row) => ({
      name: clean(row.name) || 'unnamed required check',
      bucket: checkBucket(row.bucket),
    }));
  };

  const inspectPr = async (pr: number): Promise<ReleasePr> => {
    const view = ghJson<{
      number: number;
      state: string;
      baseRefName: string;
      isDraft: boolean;
      mergeStateStatus?: string;
      mergeable?: string;
      reviewDecision?: string;
      mergeCommit?: { oid?: string } | null;
    }>([
      'pr',
      'view',
      String(pr),
      '--json',
      'number,state,baseRefName,isDraft,mergeStateStatus,mergeable,reviewDecision,mergeCommit',
    ]);
    const state = clean(view.state).toUpperCase();
    return {
      number: view.number,
      state: state === 'MERGED' ? 'MERGED' : state === 'OPEN' ? 'OPEN' : 'CLOSED',
      baseRefName: clean(view.baseRefName),
      isDraft: Boolean(view.isDraft),
      mergeStateStatus: clean(view.mergeStateStatus),
      mergeable: clean(view.mergeable),
      reviewDecision: clean(view.reviewDecision),
      checks: state === 'OPEN' ? listChecks(pr) : [],
      requiredChecks: state === 'OPEN' ? listRequiredChecks(pr) : [],
      ...(clean(view.mergeCommit?.oid) ? { mergeSha: clean(view.mergeCommit?.oid) } : {}),
    };
  };

  const runInfo = (runId: number): ReleaseRun => {
    const view = ghJson<{ status?: string; conclusion?: string; url?: string }>([
      'run',
      'view',
      String(runId),
      '--json',
      'status,conclusion,url',
    ]);
    return {
      runId,
      status: clean(view.status),
      conclusion: clean(view.conclusion),
      url: clean(view.url),
    };
  };

  const fetchChannel = async (channel: ReleaseChannel): Promise<ReleaseIdentity | null> => {
    const baseUrl = clean(process.env.CONSUELO_OS_RELEASE_BASE_URL) || DEFAULT_RELEASE_BASE_URL;
    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, '')}/channels/${channel}.json`, {
        cache: 'no-store',
        headers: { accept: 'application/json' },
      });
    } catch {
      return null;
    }
    if (!response.ok) return null;
    const signed = await response.json() as {
      payload?: {
        channel?: string;
        sourceCommit?: string;
        version?: string;
        bundleId?: string;
        platforms?: Array<{
          platform?: string;
          architecture?: string;
          bundleId?: string;
        }>;
      };
    };
    const payload = signed.payload;
    if (!payload) return null;
    const releaseSetBundleId = clean(payload.bundleId);
    const version = clean(payload.version);
    const sourceCommit = clean(payload.sourceCommit);
    if (
      payload.channel !== channel ||
      !/^[0-9a-f]{40}$/i.test(sourceCommit) ||
      !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) ||
      !/^sha256:[a-f0-9]{64}$/.test(releaseSetBundleId)
    ) return null;
    const platformBundleId = selectReleasePlatformBundleId(payload.platforms, {
      platform: process.platform,
      architecture: process.arch,
    });
    return {
      channel,
      sourceCommit,
      version,
      releaseSetBundleId,
      platformBundleId,
    };
  };

  const resolveImmutableRelease = (mergeSha: string): ReleaseIdentity | null => {
    const tagRows = commandOutput(
      ghPath,
      [
        'api',
        '--paginate',
        `repos/${repo}/tags?per_page=100`,
        '--jq',
        '.[] | [.name, .commit.sha] | @tsv',
      ],
      120_000,
    );
    const tags: ImmutableReleaseTag[] = tagRows
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [name = '', sha = ''] = line.split('\t');
        return { name: clean(name), sha: clean(sha) };
      });
    const exactTags = tags.filter(
      (tag) => tag.sha.toLowerCase() === mergeSha.toLowerCase()
        && /^consuelo-os-v\d+\.\d+\.\d+$/.test(tag.name),
    );
    if (exactTags.length === 0) return null;
    if (exactTags.length !== 1) {
      throw new Error(`multiple immutable Consuelo OS releases point at ${mergeSha}`);
    }

    const tempDirectory = mkdtempSync(path.join(tmpdir(), 'consuelo-release-signatures-'));
    try {
      commandOutput(
        ghPath,
        [
          'release',
          'download',
          exactTags[0]!.name,
          '--repo',
          repo,
          '--pattern',
          '*.sig',
          '--dir',
          tempDirectory,
          '--clobber',
        ],
        120_000,
      );
      const expectedVersion = exactTags[0]!.name.slice('consuelo-os-v'.length);
      const trustedKeys = trustedReleasePublicKeys();
      let expectedReleaseFingerprint = '';
      const observedPlatforms = new Set<string>();
      const signaturePayloads = readdirSync(tempDirectory)
        .filter((name) => name.endsWith('.sig'))
        .sort()
        .map((name) => {
          const signature = parseJson<
            Partial<DetachedReleaseSignature> & { payload?: BundleSignaturePayload }
          >(
            readFileSync(path.join(tempDirectory, name), 'utf8'),
            `immutable release signature ${name}`,
          );
          if (
            signature.algorithm !== 'ed25519'
            || !signature.keyId?.trim()
            || !signature.signature?.trim()
            || !signature.payload
          ) {
            throw new Error(`immutable release signature ${name} is incomplete`);
          }
          const publicKeyPem = trustedKeys[signature.keyId];
          if (!publicKeyPem) {
            throw new Error(`immutable release signature key is not trusted: ${signature.keyId}`);
          }
          let publicKey;
          try {
            publicKey = createPublicKey(publicKeyPem);
          } catch {
            throw new Error(`immutable release signing key is not usable: ${signature.keyId}`);
          }
          if (
            publicKey.asymmetricKeyType !== 'ed25519'
            || !verifyBytes(
              null,
              Buffer.from(canonicalBundleSignatureJson(signature.payload)),
              publicKey,
              Buffer.from(signature.signature, 'base64url'),
            )
          ) {
            throw new Error(`immutable release signature verification failed for ${name}`);
          }
          const payload = signature.payload;
          const platformKey = `${payload.platform}-${payload.architecture}`;
          if (observedPlatforms.has(platformKey)) {
            throw new Error(`duplicate immutable release signature platform: ${platformKey}`);
          }
          observedPlatforms.add(platformKey);
          if (payload.sourceCommit.toLowerCase() !== mergeSha.toLowerCase()) {
            throw new Error(`immutable release signature source commit mismatch for ${platformKey}`);
          }
          if (payload.version !== expectedVersion) {
            throw new Error(`immutable release signature version mismatch for ${platformKey}`);
          }
          if (!/^sha256:[a-f0-9]{64}$/.test(payload.bundleId)) {
            throw new Error(`immutable release platform bundle ID is invalid for ${platformKey}`);
          }
          if (!/^sha256:[a-f0-9]{64}$/.test(payload.releaseFingerprint)) {
            throw new Error(`immutable release fingerprint is invalid for ${platformKey}`);
          }
          if (
            expectedReleaseFingerprint
            && payload.releaseFingerprint !== expectedReleaseFingerprint
          ) {
            throw new Error('immutable release signatures disagree on the release fingerprint');
          }
          expectedReleaseFingerprint = payload.releaseFingerprint;
          return payload;
        });
      return resolveImmutableReleaseIdentityFromEvidence({
        mergeSha,
        platform: process.platform === 'win32' ? 'windows' : process.platform,
        architecture: process.arch,
        tags,
        signaturePayloads,
      });
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
  };

  const lifecycleJson = <T>(args: string[], timeout = 120_000): T =>
    parseJson<T>(
      commandOutput(process.execPath, [path.join(PACKAGE_ROOT, 'scripts/lifecycle.ts'), ...args, '--json'], timeout),
      `lifecycle ${args.join(' ')}`,
    );

  return {
    inspectPr,
    async waitForPrChecks(pr) {
      try {
        const deadline = Date.now() + 15 * 60_000;
        while (Date.now() < deadline) {
          const current = await inspectPr(pr);
          if (current.checks.some((check) => check.bucket === 'fail')) return current;
          if (!(current.requiredChecks ?? current.checks).some((check) => check.bucket === 'pending')) {
            return current;
          }
          await sleep(5_000);
        }
        throw new Error(`timed out waiting for PR #${pr} checks`);
      } catch (error: unknown) {
        throw releaseStepError(`wait for PR #${pr} checks`, error);
      }
    },
    async mergePr({ pr, mergeMethod }) {
      try {
        const flag = mergeMethod === 'squash' ? '--squash' : mergeMethod === 'rebase' ? '--rebase' : '--merge';
        commandOutput(ghPath, ['pr', 'merge', String(pr), '--repo', repo, flag], 120_000);
        const deadline = Date.now() + 10 * 60_000;
        while (Date.now() < deadline) {
          const current = await inspectPr(pr);
          if (current.state === 'MERGED' && current.mergeSha) return { mergeSha: current.mergeSha };
          await sleep(3_000);
        }
        throw new Error(`timed out waiting for PR #${pr} to merge`);
      } catch (error: unknown) {
        throw releaseStepError(`merge PR #${pr}`, error);
      }
    },
    async findRuntimePublish(mergeSha, excludedRunIds = []) {
      try {
        const deadline = Date.now() + 10 * 60_000;
        while (Date.now() < deadline) {
          const rows = ghJson<RuntimePublishListRow[]>([
            'run',
            'list',
            '--workflow',
            RUNTIME_PUBLISH_WORKFLOW,
            '--branch',
            'main',
            '--limit',
            '40',
            '--json',
            'databaseId,headSha,status,conclusion,url',
          ]);
          const candidate = selectRuntimePublishCandidate(rows, mergeSha, excludedRunIds);
          if (candidate) return candidate;
          await sleep(3_000);
        }
        throw new Error(`timed out finding viable runtime publication for ${mergeSha}`);
      } catch (error: unknown) {
        throw releaseStepError(`find runtime publication for ${mergeSha}`, error);
      }
    },
    async waitForRun(runId) {
      try {
        const deadline = Date.now() + 25 * 60_000;
        while (Date.now() < deadline) {
          const current = runInfo(runId);
          if (current.status === 'completed') return current;
          await sleep(5_000);
        }
        throw new Error(`timed out waiting for GitHub Actions run ${runId}`);
      } catch (error: unknown) {
        throw releaseStepError(`wait for GitHub Actions run ${runId}`, error);
      }
    },
    async resolveDevRelease(mergeSha) {
      try {
        const deadline = Date.now() + 30_000;
        while (Date.now() < deadline) {
          const release = await fetchChannel('dev');
          if (release?.sourceCommit === mergeSha) return release;
          await sleep(3_000);
        }
        const immutableRelease = resolveImmutableRelease(mergeSha);
        if (immutableRelease) return immutableRelease;
        const runs = ghJson<Array<{ databaseId: number; headSha?: string }>>([
          'run',
          'list',
          '--workflow',
          RUNTIME_PUBLISH_WORKFLOW,
          '--branch',
          'main',
          '--limit',
          '40',
          '--json',
          'databaseId,headSha',
        ]);
        const run = runs.find((candidate) => clean(candidate.headSha) === mergeSha);
        if (!run) throw new Error(`runtime publication evidence disappeared for ${mergeSha}`);
        const view = ghJson<{
          jobs?: Array<{ name?: string; conclusion?: string }>;
        }>([
          'run',
          'view',
          String(run.databaseId),
          '--json',
          'jobs',
        ]);
        const publication = view.jobs?.find(
          (job) => clean(job.name) === 'Publish immutable release and dev pointer',
        );
        if (clean(publication?.conclusion) === 'skipped') return null;
        throw new Error(`runtime publication succeeded but dev channel did not expose ${mergeSha}`);
      } catch (error: unknown) {
        throw releaseStepError(`resolve exact dev release for ${mergeSha}`, error);
      }
    },
    channelRelease: fetchChannel,
    async promote({ from, to, releaseSetBundleId, sourceCommit }) {
      try {
        const queueDeadline = promotionDeadline(Date.now());
        let baseline = 0;
        let dispatched = false;
        const listWorkflowRuns = (workflow: string) => ghJson<PromotionRunRow[]>([
          'run',
          'list',
          '--workflow',
          workflow,
          '--limit',
          '20',
          '--json',
          'databaseId,displayTitle,status,conclusion,url',
        ]);
        const listPromotionRuns = () => listWorkflowRuns(RUNTIME_PROMOTE_WORKFLOW);
        const listReleaseStateRuns = () => [
          ...listWorkflowRuns(RUNTIME_PUBLISH_WORKFLOW),
          ...listPromotionRuns(),
          ...listWorkflowRuns(RUNTIME_ROLLBACK_WORKFLOW),
        ];
        const listReleaseStateRunsWithLease = async (lease: ReleasePromotionLockLease) => {
          await lease.renew();
          const publishRuns = listWorkflowRuns(RUNTIME_PUBLISH_WORKFLOW);
          await lease.renew();
          const promotionRuns = listPromotionRuns();
          await lease.renew();
          const rollbackRuns = listWorkflowRuns(RUNTIME_ROLLBACK_WORKFLOW);
          await lease.renew();
          return {
            all: [...publishRuns, ...promotionRuns, ...rollbackRuns],
            promotionRuns,
          };
        };
        const promotionLockAdapter = createPromotionLockAdapter(sourceCommit, listReleaseStateRuns);
        while (Date.now() < queueDeadline) {
          const decision = await withReleasePromotionDispatchLock({
            operationId: `release:${from}->${to}:${releaseSetBundleId}`,
            waitTimeoutMs: Math.max(1, queueDeadline - Date.now()),
          }, promotionLockAdapter, async (lease) => {
            try {
              const target = await fetchChannel(to);
              if (
                target?.releaseSetBundleId === releaseSetBundleId &&
                target.sourceCommit === sourceCommit
              ) {
                return { kind: 'success' as const };
              }

              const releaseStateBefore = await listReleaseStateRunsWithLease(lease);
              if (selectActiveReleaseStateRun(releaseStateBefore.all)) {
                return { kind: 'wait' as const };
              }

              const nextBaseline = Math.max(
                0,
                ...releaseStateBefore.promotionRuns.map((run) => Number(run.databaseId) || 0),
              );
              await lease.renew();
              commandOutput(ghPath, [
                'workflow',
                'run',
                RUNTIME_PROMOTE_WORKFLOW,
                '--repo',
                repo,
                '--ref',
                'main',
                '-f',
                `from=${from}`,
                '-f',
                `to=${to}`,
                '-f',
                `bundle=${releaseSetBundleId}`,
              ]);
              await lease.renew();

              const visibilityDeadline = Date.now() + 60_000;
              while (Date.now() < visibilityDeadline) {
                const visibleTarget = await fetchChannel(to);
                if (
                  visibleTarget?.releaseSetBundleId === releaseSetBundleId &&
                  visibleTarget.sourceCommit === sourceCommit
                ) {
                  return { kind: 'success' as const };
                }
                await lease.renew();
                const visibleRuns = listPromotionRuns();
                await lease.renew();
                if (visibleRuns.some((run) => Number(run.databaseId) > nextBaseline)) {
                  return { kind: 'dispatched' as const, baseline: nextBaseline };
                }
                await sleep(1_000);
              }
              throw new Error(`promotion dispatch did not become observable for ${from} -> ${to}`);
            } catch (error: unknown) {
              throw releaseStepError(`serialize promotion dispatch ${from} -> ${to}`, error);
            }
          });

          if (decision.kind === 'success') {
            return { runId: 0, status: 'completed', conclusion: 'success', url: '' };
          }
          if (decision.kind === 'wait') {
            await sleep(3_000);
            continue;
          }
          baseline = decision.baseline;
          dispatched = true;
          break;
        }
        if (!dispatched) {
          throw new Error(`timed out waiting for protected promotion queue ${from} -> ${to}`);
        }

        const observationDeadline = promotionDeadline(Date.now());
        while (Date.now() < observationDeadline) {
          const rows = listPromotionRuns();
          const correlation = evaluatePromotionCorrelation({
            baselineRunId: baseline,
            runs: rows,
            targetRelease: await fetchChannel(to),
            expectedBundleId: releaseSetBundleId,
            expectedSourceCommit: sourceCommit,
          });
          if (correlation.kind === 'success') return correlation.run;
          if (correlation.kind === 'failure') {
            throw new Error(correlation.reason);
          }
          await sleep(3_000);
        }
        throw new Error(`timed out waiting for exact promotion ${from} -> ${to}`);
      } catch (error: unknown) {
        throw releaseStepError(`promote ${from} -> ${to}`, error);
      }
    },
    async updateLocal({ channel, version }) {
      try {
        lifecycleJson([
          'update',
          '--channel',
          channel,
          '--version',
          version,
        ], 180_000);
        const deadline = Date.now() + 10 * 60_000;
        while (Date.now() < deadline) {
          const status = lifecycleJson<{
            ok?: boolean;
            result?: { version?: string };
          }>(['status']);
          if (status.ok && clean(status.result?.version) === version) return { accepted: true };
          await sleep(3_000);
        }
        throw new Error(`timed out waiting for local Consuelo OS ${version}`);
      } catch (error: unknown) {
        throw releaseStepError(`update local node to ${channel} ${version}`, error);
      }
    },
    async localStatus() {
      try {
        const status = lifecycleJson<{
          ok?: boolean;
          result?: { version?: string; bundleId?: string };
        }>(['status']);
        if (!status.ok) throw new Error('local lifecycle status failed after update');
        return {
          version: clean(status.result?.version),
          platformBundleId: clean(status.result?.bundleId),
        };
      } catch (error: unknown) {
        throw releaseStepError('read local lifecycle status', error);
      }
    },
  };
}

function releaseOperationManager() {
  return createReleaseOperationManager({
    home: resolveConsueloHomeLayout().home,
    executable: process.execPath,
    scriptPath: RELEASE_SCRIPT_PATH,
  });
}

async function executeRelease(request: ReleaseOperationRequest) {
  const ghPath = resolveGitHubCliPath();
  assertGitHubCliAuthenticated(ghPath);
  return orchestrateRelease(
    {
      pr: request.pr,
      channel: request.channel,
      mergeMethod: request.mergeMethod,
      releaseOnly: request.releaseOnly,
      dryRun: request.dryRun,
    },
    createAdapter(request.repo, ghPath),
  );
}

async function runOperationWorker(operationId: string): Promise<void> {
  if (!/^release-[a-f0-9]{24}$/.test(operationId)) {
    throw new Error('release operation worker received an invalid operation id');
  }
  const manager = releaseOperationManager();
  const state = manager.status(operationId);
  if (!state) throw new Error(`release operation not found: ${operationId}`);
  manager.appendLog(
    operationId,
    `starting release PR #${state.request.pr} -> ${state.request.channel}`,
  );
  try {
    const result = await executeRelease(state.request);
    const current = manager.status(operationId) ?? state;
    manager.writeState({
      ...current,
      phase: 'succeeded',
      workerPid: undefined,
      message: 'release completed',
      result,
      updatedAt: new Date().toISOString(),
    });
    manager.appendLog(
      operationId,
      `release completed${result.version ? ` at ${result.channel} ${result.version}` : ''}`,
    );
  } catch (error: unknown) {
    const message = safeErrorText(error instanceof Error ? error.message : error);
    const current = manager.status(operationId) ?? state;
    manager.writeState({
      ...current,
      phase: 'failed',
      workerPid: undefined,
      message: message || 'release operation failed',
      updatedAt: new Date().toISOString(),
    });
    manager.appendLog(operationId, `release failed: ${message || 'unknown error'}`);
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    const argv = process.argv.slice(2);
    if (argv[0] === '--operation-worker') {
      if (argv.length !== 2 || !argv[1]) {
        throw new Error('release operation worker requires exactly one operation id');
      }
      await runOperationWorker(argv[1]);
      return;
    }

    const args = parseArgs(argv);
    const manager = releaseOperationManager();
    if (args.action === 'start') {
      const request: ReleaseOperationRequest = {
        repo: args.repo,
        pr: Number(args.pr),
        channel: args.channel,
        mergeMethod: args.mergeMethod,
        releaseOnly: args.releaseOnly,
        dryRun: args.dryRun,
      };
      const started = await manager.start(request);
      process.stdout.write(`${JSON.stringify({
        ok: true,
        result: {
          accepted: true,
          operationId: started.operationId,
          reused: started.reused,
          phase: started.state.phase,
        },
      })}\n`);
      return;
    }

    const operationId = args.operationId!;
    if (args.action === 'resume') {
      const resumed = await manager.resume(operationId);
      process.stdout.write(`${JSON.stringify({ ok: true, result: resumed })}\n`);
      return;
    }
    const state = manager.status(operationId);
    if (!state) throw new Error(`release operation not found: ${operationId}`);
    if (args.action === 'logs') {
      process.stdout.write(`${JSON.stringify({
        ok: true,
        result: manager.logs(operationId, args.tailLines),
      })}\n`);
      return;
    }
    if (args.action === 'attach') {
      process.stdout.write(`${JSON.stringify({
        ok: true,
        result: {
          state,
          logs: manager.logs(operationId, args.tailLines).lines,
        },
      })}\n`);
      return;
    }
    process.stdout.write(`${JSON.stringify({ ok: true, result: state })}\n`);
  } catch (error: unknown) {
    throw error;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${safeErrorText(error instanceof Error ? error.message : error)}\n`);
  process.exitCode = 1;
});
