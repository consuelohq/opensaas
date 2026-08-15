import fs from 'node:fs';
import path from 'node:path';
import { randomUUID as nodeRandomUUID } from 'node:crypto';

import {
  loadNodeYamlConfig,
  resolveConsueloHomeLayout,
} from './consuelo-home';

const WORK_SESSION_PREFIX = 'wrk_';
const WORK_SESSION_VERSION = 1 as const;

export type WorkSessionMetadata = {
  version: typeof WORK_SESSION_VERSION;
  sessionKind: 'work';
  workSession: string;
  ownerNodeId: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  metadataPath: string;
};

type StoredWorkSessionMetadata = Omit<WorkSessionMetadata, 'metadataPath'>;

function workSessionDirectory(home?: string): string {
  return path.join(resolveConsueloHomeLayout(home).nodeDir, 'sessions', 'work');
}

function validateWorkSessionId(value: string): string {
  const normalized = value.trim();
  if (!/^wrk_[A-Za-z0-9_-]{8,80}$/u.test(normalized)) {
    throw new Error('workSession must be a valid wrk_ session identifier.');
  }
  return normalized;
}

function metadataPathFor(home: string | undefined, workSession: string): string {
  return path.join(workSessionDirectory(home), `${validateWorkSessionId(workSession)}.json`);
}

function atomicWriteJson(filePath: string, value: StoredWorkSessionMetadata): void {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${nodeRandomUUID()}.tmp`);
  try {
    const descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    try {
      fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(temporaryPath, filePath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function storedMetadata(value: WorkSessionMetadata): StoredWorkSessionMetadata {
  const { metadataPath: _metadataPath, ...stored } = value;
  return stored;
}

export function createWorkSession(input: {
  home?: string;
  path: string;
  now?: () => Date;
  randomUUID?: () => string;
}): WorkSessionMetadata {
  const layout = resolveConsueloHomeLayout(input.home);
  const requestedPath = path.resolve(input.path);
  let canonicalPath: string;
  try {
    canonicalPath = fs.realpathSync(requestedPath);
  } catch {
    throw new Error(`work session path does not exist: ${requestedPath}`);
  }
  if (!fs.statSync(canonicalPath).isDirectory()) {
    throw new Error(`work session path must be a directory: ${canonicalPath}`);
  }

  const node = loadNodeYamlConfig(layout.nodeConfigPath);
  const uuid = (input.randomUUID ?? nodeRandomUUID)().replace(/-/gu, '');
  const workSession = `${WORK_SESSION_PREFIX}${uuid.slice(0, 16)}`;
  const timestamp = (input.now ?? (() => new Date()))().toISOString();
  const metadataPath = metadataPathFor(input.home, workSession);
  const metadata: WorkSessionMetadata = {
    version: WORK_SESSION_VERSION,
    sessionKind: 'work',
    workSession,
    ownerNodeId: node.node.id,
    path: canonicalPath,
    createdAt: timestamp,
    updatedAt: timestamp,
    metadataPath,
  };
  atomicWriteJson(metadataPath, storedMetadata(metadata));
  return metadata;
}

export function readWorkSession(input: {
  home?: string;
  workSession: string;
}): WorkSessionMetadata | undefined {
  const metadataPath = metadataPathFor(input.home, input.workSession);
  if (!fs.existsSync(metadataPath)) return undefined;
  const parsed = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as Partial<StoredWorkSessionMetadata>;
  if (
    parsed.version !== WORK_SESSION_VERSION
    || parsed.sessionKind !== 'work'
    || parsed.workSession !== validateWorkSessionId(input.workSession)
    || typeof parsed.ownerNodeId !== 'string'
    || typeof parsed.path !== 'string'
    || typeof parsed.createdAt !== 'string'
    || typeof parsed.updatedAt !== 'string'
  ) {
    throw new Error(`invalid work session metadata: ${metadataPath}`);
  }
  return {
    version: WORK_SESSION_VERSION,
    sessionKind: 'work',
    workSession: parsed.workSession,
    ownerNodeId: parsed.ownerNodeId,
    path: parsed.path,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
    metadataPath,
  };
}
