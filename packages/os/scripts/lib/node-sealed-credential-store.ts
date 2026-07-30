import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  openSealedCredential,
  type SealedCredentialEnvelope,
  type SealedCredentialRecipient,
} from './node-credential-sealing';

/**
 * Per-node sealed credential store.
 *
 * This is the "node sealed store" custody source: the resting place for credential bytes on a node
 * that must resolve them while no human is online. It is what makes an always-on self-hosted node
 * usable without turning the home node into a raw-secret relay
 * (`workspace-control-plane-contract.md`, "The home node is not a permanent raw-secret relay").
 *
 * Two separate encryption layers, deliberately:
 *   - in transit, the setup surface seals to the node's X25519 public key (node-credential-sealing);
 *   - at rest, material is re-encrypted under a key derived from the node's own private key.
 *
 * The transit envelope is not simply written to disk, because a stored transit envelope stays
 * replayable to whoever can read the file and it carries its own recipient block. Re-encrypting at
 * rest binds each record to this store and this binding id.
 *
 * There is intentionally no bulk export and no agent-facing read. `credentialStatus` is the only
 * surface an agent may reach; `resolveCredentialForBroker` is named to make an accidental call from
 * agent-facing code obvious in review.
 */

const STORE_DIR = path.join('node', 'security', 'credentials');
const RECORD_VERSION = 1;
const AES_KEY_BYTES = 32;
const IV_BYTES = 12;
const AT_REST_HKDF_INFO = 'consuelo-os/node-sealed-credential-store/v1';
const FILE_MODE = 0o600;
const DIR_MODE = 0o700;

export type SealedCredentialStatus = 'set' | 'missing';

export type SealedCredentialRecord = {
  version: typeof RECORD_VERSION;
  workspaceId: string;
  nodeId: string;
  bindingId: string;
  iv: string;
  ciphertext: string;
  authTag: string;
  createdAt: string;
  updatedAt: string;
};

/** Metadata only. Never carries the value, and never a length or fingerprint of it. */
export type SealedCredentialDescriptor = {
  workspaceId: string;
  nodeId: string;
  bindingId: string;
  status: SealedCredentialStatus;
  createdAt: string;
  updatedAt: string;
};

export type NodeSealedCredentialStoreErrorCode =
  | 'InvalidInput'
  | 'CredentialNotFound'
  | 'RecordCorrupt'
  | 'PersistenceFailure';

export class NodeSealedCredentialStoreFailure extends Error {
  readonly _tag = 'NodeSealedCredentialStoreError' as const;
  readonly code: NodeSealedCredentialStoreErrorCode;

  constructor(code: NodeSealedCredentialStoreErrorCode, message: string) {
    super(message);
    this.name = 'NodeSealedCredentialStoreFailure';
    this.code = code;
  }
}

const fail = (
  code: NodeSealedCredentialStoreErrorCode,
  message: string,
): never => {
  throw new NodeSealedCredentialStoreFailure(code, message);
};

/**
 * Binding ids become filenames, so the charset is restricted rather than escaped. Anything outside
 * it is rejected instead of sanitized, so a traversal attempt fails loudly rather than silently
 * resolving to a neighbouring record.
 */
const BINDING_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

const requiredIdentifier = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    fail('InvalidInput', `sealed credential ${label} is required`);
  }
  return (value as string).trim();
};

const validBindingId = (value: unknown): string => {
  const bindingId = requiredIdentifier(value, 'binding ID');
  if (!BINDING_ID_PATTERN.test(bindingId)) {
    fail(
      'InvalidInput',
      'sealed credential binding ID may contain only letters, numbers, dot, underscore, and hyphen',
    );
  }
  return bindingId;
};

export function nodeSealedCredentialStorePath(home: string): string {
  return path.join(requiredIdentifier(home, 'home path'), STORE_DIR);
}

const recordPath = (home: string, bindingId: string): string =>
  path.join(nodeSealedCredentialStorePath(home), `${bindingId}.json`);

/**
 * Derives the at-rest key from the node's private key plus the binding id, so one record's key is
 * useless against another and no separate at-rest key needs its own lifecycle.
 */
const deriveAtRestKey = (input: {
  nodePrivateKeyJwk: string;
  workspaceId: string;
  nodeId: string;
  bindingId: string;
}): Buffer =>
  Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(input.nodePrivateKeyJwk, 'utf8'),
      Buffer.from(`${input.workspaceId}:${input.nodeId}`, 'utf8'),
      Buffer.from(`${AT_REST_HKDF_INFO}:${input.bindingId}`, 'utf8'),
      AES_KEY_BYTES,
    ),
  );

const ensureStoreDir = (home: string): string => {
  const dir = nodeSealedCredentialStorePath(home);
  try {
    fs.mkdirSync(dir, { recursive: true, mode: DIR_MODE });
    // mkdir honours umask, so tighten explicitly rather than trusting the create mode.
    fs.chmodSync(dir, DIR_MODE);
  } catch (error: unknown) {
    fail(
      'PersistenceFailure',
      `sealed credential store directory could not be created: ${(error as Error).message}`,
    );
  }
  return dir;
};

const writeRecord = (file: string, record: SealedCredentialRecord): void => {
  // Write to a sibling temp file then rename, so a crash mid-write cannot leave a truncated record
  // that would read as corrupt on the next resolve.
  const temp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify(record, null, 2)}\n`, {
      mode: FILE_MODE,
    });
    fs.chmodSync(temp, FILE_MODE);
    fs.renameSync(temp, file);
  } catch (error: unknown) {
    try {
      fs.rmSync(temp, { force: true });
    } catch (_error: unknown) {
      // The rename already failed; a failed cleanup must not mask the original error.
    }
    fail(
      'PersistenceFailure',
      `sealed credential record could not be written: ${(error as Error).message}`,
    );
  }
};

const readRecord = (file: string): SealedCredentialRecord | undefined => {
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (_error: unknown) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (_error: unknown) {
    return fail(
      'RecordCorrupt',
      'sealed credential record is not valid JSON',
    ) as never;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('RecordCorrupt', 'sealed credential record is malformed');
  }
  const record = parsed as SealedCredentialRecord;
  if (record.version !== RECORD_VERSION) {
    fail('RecordCorrupt', 'sealed credential record version is unsupported');
  }
  for (const field of ['iv', 'ciphertext', 'authTag', 'bindingId'] as const) {
    if (typeof record[field] !== 'string' || record[field] === '') {
      fail('RecordCorrupt', `sealed credential record is missing ${field}`);
    }
  }
  return record;
};

/**
 * Opens a delivered envelope and stores the value encrypted at rest. This is the landing step of the
 * remote setup ceremony. The plaintext exists only for the duration of this call.
 */
export function installSealedCredential(input: {
  home: string;
  nodePrivateKeyJwk: string;
  recipient: SealedCredentialRecipient;
  envelope: SealedCredentialEnvelope;
  now?: () => Date;
}): SealedCredentialDescriptor {
  const bindingId = validBindingId(input.recipient?.bindingId);
  const workspaceId = requiredIdentifier(
    input.recipient?.workspaceId,
    'workspace ID',
  );
  const nodeId = requiredIdentifier(input.recipient?.nodeId, 'node ID');

  // Throws on any recipient mismatch or tampering before anything touches disk.
  const plaintext = openSealedCredential({
    recipientPrivateKeyJwk: input.nodePrivateKeyJwk,
    expectedRecipient: { workspaceId, nodeId, bindingId },
    envelope: input.envelope,
  });

  const atRestKey = deriveAtRestKey({
    nodePrivateKeyJwk: input.nodePrivateKeyJwk,
    workspaceId,
    nodeId,
    bindingId,
  });
  const iv = randomBytes(IV_BYTES);
  let record: SealedCredentialRecord;
  try {
    const cipher = createCipheriv('aes-256-gcm', atRestKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(plaintext, 'utf8')),
      cipher.final(),
    ]);
    const timestamp = (input.now?.() ?? new Date()).toISOString();
    const existing = readRecord(recordPath(input.home, bindingId));
    record = {
      version: RECORD_VERSION,
      workspaceId,
      nodeId,
      bindingId,
      iv: iv.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
  } finally {
    atRestKey.fill(0);
  }

  ensureStoreDir(input.home);
  writeRecord(recordPath(input.home, bindingId), record);

  return {
    workspaceId: record.workspaceId,
    nodeId: record.nodeId,
    bindingId: record.bindingId,
    status: 'set',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Resolves a credential value for the broker to inject into a child process.
 *
 * Never expose this through an agent-facing tool, an MCP result, or a log line. Agents get
 * `credentialStatus` and nothing else.
 */
export function resolveCredentialForBroker(input: {
  home: string;
  nodePrivateKeyJwk: string;
  workspaceId: string;
  nodeId: string;
  bindingId: string;
}): string {
  const bindingId = validBindingId(input.bindingId);
  const workspaceId = requiredIdentifier(input.workspaceId, 'workspace ID');
  const nodeId = requiredIdentifier(input.nodeId, 'node ID');

  const record = readRecord(recordPath(input.home, bindingId));
  if (!record) {
    fail('CredentialNotFound', 'sealed credential is not set on this node');
  }

  // No cross-node fallback: a record written for another node is not resolvable here even though
  // the file is readable, so copying a store between nodes does not silently grant access.
  if (record!.workspaceId !== workspaceId || record!.nodeId !== nodeId) {
    fail(
      'CredentialNotFound',
      'sealed credential is not set for this workspace and node',
    );
  }

  const atRestKey = deriveAtRestKey({
    nodePrivateKeyJwk: input.nodePrivateKeyJwk,
    workspaceId,
    nodeId,
    bindingId,
  });
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      atRestKey,
      Buffer.from(record!.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(record!.authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(record!.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch (_error: unknown) {
    return fail(
      'RecordCorrupt',
      'sealed credential record could not be decrypted on this node',
    ) as never;
  } finally {
    atRestKey.fill(0);
  }
}

/**
 * The only credential read an agent may reach. Reports presence, never the value and never anything
 * derived from it.
 */
export function credentialStatus(input: {
  home: string;
  workspaceId: string;
  nodeId: string;
  bindingId: string;
}): SealedCredentialStatus {
  const record = readRecord(
    recordPath(input.home, validBindingId(input.bindingId)),
  );
  if (!record) return 'missing';
  if (
    record.workspaceId !== requiredIdentifier(input.workspaceId, 'workspace ID') ||
    record.nodeId !== requiredIdentifier(input.nodeId, 'node ID')
  ) {
    return 'missing';
  }
  return 'set';
}

/** Metadata listing for the secrets surface. Contains no values. */
export function listSealedCredentials(input: {
  home: string;
  workspaceId: string;
  nodeId: string;
}): SealedCredentialDescriptor[] {
  const dir = nodeSealedCredentialStorePath(input.home);
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch (_error: unknown) {
    return [];
  }
  const workspaceId = requiredIdentifier(input.workspaceId, 'workspace ID');
  const nodeId = requiredIdentifier(input.nodeId, 'node ID');

  return entries
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => readRecord(path.join(dir, entry)))
    .filter(
      (record): record is SealedCredentialRecord =>
        record !== undefined &&
        record.workspaceId === workspaceId &&
        record.nodeId === nodeId,
    )
    .map((record) => ({
      workspaceId: record.workspaceId,
      nodeId: record.nodeId,
      bindingId: record.bindingId,
      status: 'set' as const,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }))
    .sort((a, b) => a.bindingId.localeCompare(b.bindingId));
}

/** Removal is idempotent so a rotation that retries does not fail on an already-removed record. */
export function removeSealedCredential(input: {
  home: string;
  bindingId: string;
}): { removed: boolean } {
  const file = recordPath(input.home, validBindingId(input.bindingId));
  try {
    fs.rmSync(file, { force: true });
  } catch (error: unknown) {
    fail(
      'PersistenceFailure',
      `sealed credential record could not be removed: ${(error as Error).message}`,
    );
  }
  return { removed: true };
}
