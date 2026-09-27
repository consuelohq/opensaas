import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

import { resolveConsueloHomeLayout } from '../lib/consuelo-home';

type RecoveryStatus = 'running' | 'completed' | 'failed';

type RecoveryRecord = {
  schema: 'mcp-request-recovery.v1';
  requestId: string;
  toolName: string;
  fingerprint: string;
  status: RecoveryStatus;
  ownerPid: number;
  startedAt: string;
  updatedAt: string;
  result?: unknown;
  resultOmitted?: boolean;
  resultDigest?: string;
  scopeDigest: string;
};

type RecoveryStoreOptions = {
  home?: string;
  now?: () => Date;
  retentionMs?: number;
  maxRecords?: number;
  maxResultBytes?: number;
  processAlive?: (pid: number) => boolean;
};

type ExecuteInput = {
  requestId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  scope?: string;
  context?: unknown;
  execute: () => Promise<unknown>;
};

const DEFAULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_RECORDS = 1_000;
const DEFAULT_MAX_RESULT_BYTES = 2 * 1024 * 1024;
const READ_RETRY_ATTEMPTS = 10;
const READ_RETRY_MS = 5;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .filter((key) => key !== 'requestId')
      .sort()
      .map((key) => [key, canonicalize(record[key])]),
  );
}

function fingerprint(input: Pick<ExecuteInput, 'toolName' | 'toolInput' | 'context' | 'scope'>): string {
  const serialized = JSON.stringify({
    scope: input.scope ?? 'local',
    toolName: input.toolName,
    toolInput: canonicalize(input.toolInput),
    context: canonicalize(input.context),
  });
  return createHash('sha256').update(serialized).digest('hex');
}

function recordFileName(requestId: string, scope = 'local'): string {
  return createHash('sha256').update(`${scope}\n${requestId}`).digest('hex') + '.json';
}

function scopeDigest(scope = 'local'): string {
  return createHash('sha256').update(scope).digest('hex');
}

function defaultProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function recoveryRoot(home?: string): string {
  return path.join(resolveConsueloHomeLayout(home).nodeRunsDir, 'mcp-request-recovery');
}

export function mcpRequestRecoveryRecordPath(
  home: string | undefined,
  requestId: string,
  scope = 'local',
): string {
  return path.join(recoveryRoot(home), recordFileName(requestId, scope));
}

function parseRecord(raw: string): RecoveryRecord | null {
  try {
    const value = JSON.parse(raw) as RecoveryRecord;
    if (
      value?.schema !== 'mcp-request-recovery.v1'
      || typeof value.requestId !== 'string'
      || typeof value.toolName !== 'string'
      || typeof value.fingerprint !== 'string'
      || typeof value.scopeDigest !== 'string'
      || !['running', 'completed', 'failed'].includes(value.status)
    ) return null;
    return value;
  } catch {
    return null;
  }
}

function readRecord(filePath: string): RecoveryRecord | null {
  if (!existsSync(filePath)) return null;
  return parseRecord(readFileSync(filePath, 'utf8'));
}

async function readRecordAfterClaim(filePath: string): Promise<RecoveryRecord | null> {
  for (let attempt = 0; attempt < READ_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const record = readRecord(filePath);
      if (record) return record;
    } catch {
      // The claiming process may still be fsyncing its small running record.
    }
    if (attempt + 1 < READ_RETRY_ATTEMPTS) await sleep(READ_RETRY_MS);
  }
  return null;
}

function atomicWriteRecord(filePath: string, record: RecoveryRecord): void {
  const dir = path.dirname(filePath);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporary, 'wx', 0o600);
    writeFileSync(descriptor, `${JSON.stringify(record)}\n`, 'utf8');
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporary, filePath);
    if (process.platform !== 'win32') {
      const directoryDescriptor = openSync(dir, 'r');
      try {
        fsyncSync(directoryDescriptor);
      } finally {
        closeSync(directoryDescriptor);
      }
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    rmSync(temporary, { force: true });
  }
}

function tryClaim(filePath: string, record: RecoveryRecord): boolean {
  mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  let descriptor: number | undefined;
  try {
    descriptor = openSync(filePath, 'wx', 0o600);
    writeFileSync(descriptor, `${JSON.stringify(record)}\n`, 'utf8');
    fsyncSync(descriptor);
    return true;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function terminalReplay(record: RecoveryRecord): unknown {
  if (record.status === 'completed' && !record.resultOmitted && Object.hasOwn(record, 'result')) {
    return record.result;
  }
  if (record.status === 'completed') {
    return {
      ok: false,
      code: 'REQUEST_RESULT_NOT_REPLAYABLE',
      message: 'This request already completed, but its result exceeded the bounded recovery cache.',
      data: { requestId: record.requestId },
      autoRetry: false,
    };
  }
  if (record.status === 'failed') {
    return {
      ok: false,
      code: 'REQUEST_PREVIOUSLY_FAILED',
      message: 'This request already reached a terminal execution failure. Use a new requestId to intentionally retry it.',
      data: { requestId: record.requestId },
      autoRetry: false,
    };
  }
  return {
    ok: false,
    code: 'REQUEST_IN_PROGRESS',
    message: 'This requestId is already executing. Poll with the same requestId instead of starting a second mutation.',
    data: { requestId: record.requestId, retryAfterSeconds: 1 },
    autoRetry: false,
  };
}

function pruneRecords(
  root: string,
  nowMs: number,
  retentionMs: number,
  maxRecords: number,
  processAlive: (pid: number) => boolean,
): void {
  if (!existsSync(root)) return;
  const records = readdirSync(root)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const filePath = path.join(root, name);
      try {
        const stat = statSync(filePath);
        const record = readRecord(filePath);
        const updatedAtMs = record ? Date.parse(record.updatedAt) : Number.NaN;
        return {
          filePath,
          mtimeMs: stat.mtimeMs,
          updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : stat.mtimeMs,
          record,
        };
      } catch {
        return null;
      }
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  for (const item of records) {
    if (!item.record) continue;
    if (item.record.status === 'running') {
      if (!processAlive(item.record.ownerPid)) {
        atomicWriteRecord(item.filePath, {
          ...item.record,
          status: 'failed',
          updatedAt: new Date(nowMs).toISOString(),
        });
      }
      continue;
    }
    if (nowMs - item.updatedAtMs > retentionMs) rmSync(item.filePath, { force: true });
  }

  const terminal = records
    .filter((item) => {
      if (!existsSync(item.filePath)) return false;
      const record = readRecord(item.filePath);
      return record?.status === 'completed' || record?.status === 'failed';
    })
    .sort((left, right) => left.updatedAtMs - right.updatedAtMs);
  for (const item of terminal.slice(0, Math.max(0, terminal.length - maxRecords))) {
    rmSync(item.filePath, { force: true });
  }
}

export function createMcpRequestRecoveryStore(options: RecoveryStoreOptions = {}) {
  const now = options.now ?? (() => new Date());
  const retentionMs = options.retentionMs ?? DEFAULT_RETENTION_MS;
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  const maxResultBytes = options.maxResultBytes ?? DEFAULT_MAX_RESULT_BYTES;
  const processAlive = options.processAlive ?? defaultProcessAlive;
  const root = recoveryRoot(options.home);

  return {
    async execute(input: ExecuteInput): Promise<unknown> {
      const requestFingerprint = fingerprint(input);
      const recoveryScope = input.scope ?? 'local';
      const filePath = mcpRequestRecoveryRecordPath(options.home, input.requestId, recoveryScope);
      const startedAt = now().toISOString();
      try {
        pruneRecords(root, now().getTime(), retentionMs, maxRecords, processAlive);
      } catch {
        // Retention is best-effort. Recovery correctness must not depend on cleanup succeeding.
      }
      const running: RecoveryRecord = {
        schema: 'mcp-request-recovery.v1',
        requestId: input.requestId,
        toolName: input.toolName,
        fingerprint: requestFingerprint,
        scopeDigest: scopeDigest(recoveryScope),
        status: 'running',
        ownerPid: process.pid,
        startedAt,
        updatedAt: startedAt,
      };

      if (!tryClaim(filePath, running)) {
        const existing = await readRecordAfterClaim(filePath);
        if (!existing) {
          return {
            ok: false,
            code: 'REQUEST_RECOVERY_CORRUPT',
            message: 'The recovery record for this requestId could not be read. Execution was not repeated.',
            data: { requestId: input.requestId },
            autoRetry: false,
          };
        }
        if (
          existing.scopeDigest !== scopeDigest(recoveryScope)
          || existing.fingerprint !== requestFingerprint
          || existing.toolName !== input.toolName
        ) {
          return {
            ok: false,
            code: 'REQUEST_ID_CONFLICT',
            message: 'This requestId was already used for a different tool call.',
            data: { requestId: input.requestId },
            autoRetry: false,
          };
        }
        if (existing.status === 'running' && !processAlive(existing.ownerPid)) {
          const failed = {
            ...existing,
            status: 'failed' as const,
            updatedAt: now().toISOString(),
          };
          atomicWriteRecord(filePath, failed);
          return terminalReplay(failed);
        }
        return terminalReplay(existing);
      }

      try {
        const result = await input.execute();
        let resultOmitted = false;
        let resultDigest: string | undefined;
        let storedResult: unknown = result;
        try {
          const serializedResult = JSON.stringify(result ?? null);
          if (Buffer.byteLength(serializedResult, 'utf8') > maxResultBytes) {
            resultOmitted = true;
            resultDigest = createHash('sha256').update(serializedResult).digest('hex');
            storedResult = undefined;
          }
        } catch {
          resultOmitted = true;
          storedResult = undefined;
        }
        const completedAt = now().toISOString();
        atomicWriteRecord(filePath, {
          ...running,
          status: 'completed',
          updatedAt: completedAt,
          ...(resultOmitted ? { resultOmitted: true, ...(resultDigest ? { resultDigest } : {}) } : { result: storedResult }),
        });
        return result;
      } catch (error: unknown) {
        atomicWriteRecord(filePath, {
          ...running,
          status: 'failed',
          updatedAt: now().toISOString(),
        });
        throw error;
      }
    },
  };
}
