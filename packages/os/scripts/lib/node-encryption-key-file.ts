import fs from 'node:fs';
import path from 'node:path';

import {
  generateNodeEncryptionKeyPair,
  nodeEncryptionPublicKeyFromPrivate,
} from './node-credential-sealing';
import { isUnenrolledPlaceholderIdentity } from './unenrolled-placeholder-identity';

/**
 * Lifecycle for the node's long-lived X25519 credential-encryption key.
 *
 * The private key is minted on the node and never leaves it. Only the public JWK is published to
 * the control plane, which is what lets a setup surface seal a credential to this node without the
 * control plane ever being able to open it.
 *
 * This is separate from the Ed25519 device signing key, which arrives from workspace bootstrap.
 * Keeping the two apart is a contract requirement, not a preference: they have different compromise
 * blast radii and different rotation cadence, and a node that rotates its encryption key must not
 * thereby invalidate its device identity.
 */

const KEY_FILE = path.join('security', 'generated', 'node-encryption-key.json');
const FILE_VERSION = 1;
const FILE_MODE = 0o600;
const DIR_MODE = 0o700;

export type NodeEncryptionKeyFile = {
  version: typeof FILE_VERSION;
  kind: 'consuelo-node-encryption-key';
  algorithm: 'X25519';
  workspaceId: string;
  nodeId: string;
  publicKeyJwk: string;
  privateKeyJwk: string;
  createdAt: string;
  rotatedAt?: string;
};

/** Public half only. Safe to publish, log, and put in a heartbeat payload. */
export type NodeEncryptionPublicKey = {
  workspaceId: string;
  nodeId: string;
  algorithm: 'X25519';
  publicKeyJwk: string;
  createdAt: string;
  rotatedAt?: string;
};

export type NodeEncryptionKeyErrorCode =
  | 'InvalidInput'
  | 'KeyNotFound'
  | 'KeyCorrupt'
  | 'KeyOwnerMismatch'
  | 'PersistenceFailure';

export class NodeEncryptionKeyFailure extends Error {
  readonly _tag = 'NodeEncryptionKeyError' as const;
  readonly code: NodeEncryptionKeyErrorCode;

  constructor(code: NodeEncryptionKeyErrorCode, message: string) {
    super(message);
    this.name = 'NodeEncryptionKeyFailure';
    this.code = code;
  }
}

const fail = (code: NodeEncryptionKeyErrorCode, message: string): never => {
  throw new NodeEncryptionKeyFailure(code, message);
};

const requiredIdentifier = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    fail('InvalidInput', `node encryption key ${label} is required`);
  }
  return (value as string).trim();
};

export function nodeEncryptionKeyPath(nodeHome: string): string {
  return path.join(requiredIdentifier(nodeHome, 'node home'), KEY_FILE);
}

const publicView = (file: NodeEncryptionKeyFile): NodeEncryptionPublicKey => ({
  workspaceId: file.workspaceId,
  nodeId: file.nodeId,
  algorithm: file.algorithm,
  publicKeyJwk: file.publicKeyJwk,
  createdAt: file.createdAt,
  ...(file.rotatedAt === undefined ? {} : { rotatedAt: file.rotatedAt }),
});

const writeKeyFile = (file: string, contents: NodeEncryptionKeyFile): void => {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: DIR_MODE });
    fs.chmodSync(path.dirname(file), DIR_MODE);
  } catch (error: unknown) {
    fail(
      'PersistenceFailure',
      `node encryption key directory could not be created: ${(error as Error).message}`,
    );
  }
  try {
    fs.writeFileSync(file, `${JSON.stringify(contents, null, 2)}\n`, {
      mode: FILE_MODE,
    });
    // writeFileSync honours umask on create, so tighten explicitly.
    fs.chmodSync(file, FILE_MODE);
  } catch (error: unknown) {
    fail(
      'PersistenceFailure',
      `node encryption key could not be written: ${(error as Error).message}`,
    );
  }
};

const readKeyFile = (file: string): NodeEncryptionKeyFile | undefined => {
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
    return fail('KeyCorrupt', 'node encryption key file is not valid JSON') as never;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('KeyCorrupt', 'node encryption key file is malformed');
  }
  const contents = parsed as NodeEncryptionKeyFile;
  if (contents.version !== FILE_VERSION) {
    fail('KeyCorrupt', 'node encryption key file version is unsupported');
  }
  if (contents.algorithm !== 'X25519') {
    fail('KeyCorrupt', 'node encryption key algorithm is unsupported');
  }
  for (const field of ['publicKeyJwk', 'privateKeyJwk', 'workspaceId', 'nodeId'] as const) {
    if (typeof contents[field] !== 'string' || contents[field] === '') {
      fail('KeyCorrupt', `node encryption key file is missing ${field}`);
    }
  }
  return contents;
};

/**
 * Creates the node's encryption key if absent and returns the public half. Idempotent: an existing
 * key is returned untouched so a re-run of install never silently rotates and orphans every
 * credential already sealed to the node.
 */
export function ensureNodeEncryptionKey(input: {
  nodeHome: string;
  workspaceId: string;
  nodeId: string;
  now?: () => Date;
}): NodeEncryptionPublicKey {
  const workspaceId = requiredIdentifier(input.workspaceId, 'workspace ID');
  const nodeId = requiredIdentifier(input.nodeId, 'node ID');
  const file = nodeEncryptionKeyPath(input.nodeHome);

  const existing = readKeyFile(file);
  const ownerChanged = existing
    ? existing.workspaceId !== workspaceId || existing.nodeId !== nodeId
    : false;
  if (existing) {
    // A key belonging to a different workspace or node means this home was moved or copied. Fail
    // loudly rather than handing back a key whose sealed credentials cannot be opened here.
    // The one safe exception is the placeholder identity install stamps before enrollment knows
    // the real workspace: that node was never reachable, so nothing can have been sealed to it.
    if (ownerChanged && !isUnenrolledPlaceholderIdentity(existing)) {
      fail(
        'KeyOwnerMismatch',
        'node encryption key belongs to a different workspace or node',
      );
    }
    if (!ownerChanged) {
      return publicView(existing);
    }
  }

  const keyPair = generateNodeEncryptionKeyPair();
  const timestamp = (input.now?.() ?? new Date()).toISOString();
  const contents: NodeEncryptionKeyFile = {
    version: FILE_VERSION,
    kind: 'consuelo-node-encryption-key',
    algorithm: 'X25519',
    workspaceId,
    nodeId,
    publicKeyJwk: keyPair.publicKeyJwk,
    privateKeyJwk: keyPair.privateKeyJwk,
    createdAt: timestamp,
    // Adopting a placeholder key replaces material, so record it as a rotation, not a first mint.
    ...(ownerChanged ? { rotatedAt: timestamp } : {}),
  };
  writeKeyFile(file, contents);
  return publicView(contents);
}

/**
 * Loads the private key for opening a delivered envelope. Broker-side only; never expose the return
 * value to an agent, a log, or a tool result.
 */
export function loadNodeEncryptionPrivateKey(input: {
  nodeHome: string;
  workspaceId: string;
  nodeId: string;
}): string {
  const contents = readKeyFile(nodeEncryptionKeyPath(input.nodeHome));
  if (!contents) {
    fail('KeyNotFound', 'node encryption key has not been created on this node');
  }
  if (
    contents!.workspaceId !== requiredIdentifier(input.workspaceId, 'workspace ID') ||
    contents!.nodeId !== requiredIdentifier(input.nodeId, 'node ID')
  ) {
    fail(
      'KeyOwnerMismatch',
      'node encryption key belongs to a different workspace or node',
    );
  }
  // Recompute rather than trusting the stored public half, so a tampered public key cannot be used
  // to make a caller seal to a key this node cannot open.
  const derived = nodeEncryptionPublicKeyFromPrivate(contents!.privateKeyJwk);
  if (derived !== contents!.publicKeyJwk) {
    fail('KeyCorrupt', 'node encryption key public and private halves do not match');
  }
  return contents!.privateKeyJwk;
}

/** Reads the public half for publication. Returns undefined when no key exists yet. */
export function readNodeEncryptionPublicKey(input: {
  nodeHome: string;
}): NodeEncryptionPublicKey | undefined {
  const contents = readKeyFile(nodeEncryptionKeyPath(input.nodeHome));
  return contents ? publicView(contents) : undefined;
}

/**
 * Replaces the node's encryption key.
 *
 * Every credential already sealed to the previous key becomes unopenable, so callers must treat
 * rotation as requiring re-delivery of each binding. Rotation is explicit for exactly that reason
 * and is never performed implicitly by install.
 */
export function rotateNodeEncryptionKey(input: {
  nodeHome: string;
  workspaceId: string;
  nodeId: string;
  now?: () => Date;
}): NodeEncryptionPublicKey {
  const workspaceId = requiredIdentifier(input.workspaceId, 'workspace ID');
  const nodeId = requiredIdentifier(input.nodeId, 'node ID');
  const file = nodeEncryptionKeyPath(input.nodeHome);

  const existing = readKeyFile(file);
  if (
    existing &&
    (existing.workspaceId !== workspaceId || existing.nodeId !== nodeId)
  ) {
    fail(
      'KeyOwnerMismatch',
      'node encryption key belongs to a different workspace or node',
    );
  }

  const keyPair = generateNodeEncryptionKeyPair();
  const timestamp = (input.now?.() ?? new Date()).toISOString();
  const contents: NodeEncryptionKeyFile = {
    version: FILE_VERSION,
    kind: 'consuelo-node-encryption-key',
    algorithm: 'X25519',
    workspaceId,
    nodeId,
    publicKeyJwk: keyPair.publicKeyJwk,
    privateKeyJwk: keyPair.privateKeyJwk,
    createdAt: existing?.createdAt ?? timestamp,
    rotatedAt: timestamp,
  };
  writeKeyFile(file, contents);
  return publicView(contents);
}
