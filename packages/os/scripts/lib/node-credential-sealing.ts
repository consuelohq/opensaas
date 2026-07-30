import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Sealed credential delivery for self-hosted nodes.
 *
 * `workspace-control-plane-contract.md` ("Remote setup for a self-hosted node") requires a node
 * encryption key that is distinct from the Ed25519 signing key, plus a sealed-delivery protocol so
 * the control plane relays an envelope it cannot open. This module implements that primitive.
 *
 * Ed25519 signing keys are deliberately NOT reused here. Signing and encryption keys have different
 * compromise blast radii and different rotation cadence, and Ed25519 -> X25519 conversion would tie
 * the two together permanently.
 *
 * Envelope construction is ephemeral-static X25519 ECDH -> HKDF-SHA256 -> AES-256-GCM. The recipient
 * binding (workspace, node, credential binding id) is authenticated as GCM additional data, so an
 * envelope captured in transit cannot be replayed against a different node or a different binding.
 */

const KEY_ALGORITHM = 'X25519';
const ENVELOPE_VERSION = 1;
const AES_KEY_BYTES = 32;
const IV_BYTES = 12;
const HKDF_INFO = 'consuelo-os/sealed-credential/v1';

export type NodeEncryptionKeyPair = {
  algorithm: typeof KEY_ALGORITHM;
  publicKeyJwk: string;
  privateKeyJwk: string;
};

/**
 * Identifies exactly which node and binding an envelope may be opened for. Every field is
 * authenticated, none is confidential.
 */
export type SealedCredentialRecipient = {
  workspaceId: string;
  nodeId: string;
  bindingId: string;
};

export type SealedCredentialEnvelope = {
  version: typeof ENVELOPE_VERSION;
  algorithm: typeof KEY_ALGORITHM;
  recipient: SealedCredentialRecipient;
  ephemeralPublicKeyJwk: string;
  iv: string;
  ciphertext: string;
  authTag: string;
};

export type NodeCredentialSealingErrorCode =
  | 'InvalidInput'
  | 'InvalidKey'
  | 'InvalidEnvelope'
  | 'RecipientMismatch'
  | 'DecryptionFailure';

export type NodeCredentialSealingError = {
  readonly _tag: 'NodeCredentialSealingError';
  readonly code: NodeCredentialSealingErrorCode;
  readonly message: string;
};

/**
 * Errors never carry plaintext, key material, or envelope bytes. A caller that logs the error must
 * not be able to leak the credential through the log.
 */
export class NodeCredentialSealingFailure
  extends Error
  implements NodeCredentialSealingError
{
  readonly _tag = 'NodeCredentialSealingError' as const;
  readonly code: NodeCredentialSealingErrorCode;

  constructor(code: NodeCredentialSealingErrorCode, message: string) {
    super(message);
    this.name = 'NodeCredentialSealingFailure';
    this.code = code;
  }
}

const fail = (
  code: NodeCredentialSealingErrorCode,
  message: string,
): never => {
  throw new NodeCredentialSealingFailure(code, message);
};

const requiredIdentifier = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    fail('InvalidInput', `sealed credential ${label} is required`);
  }
  const trimmed = (value as string).trim();
  if (trimmed.length > 256) {
    fail('InvalidInput', `sealed credential ${label} is too long`);
  }
  return trimmed;
};

const normalizeRecipient = (
  recipient: SealedCredentialRecipient,
): SealedCredentialRecipient => {
  if (!recipient || typeof recipient !== 'object') {
    fail('InvalidInput', 'sealed credential recipient is required');
  }
  return {
    workspaceId: requiredIdentifier(recipient.workspaceId, 'workspace ID'),
    nodeId: requiredIdentifier(recipient.nodeId, 'node ID'),
    bindingId: requiredIdentifier(recipient.bindingId, 'binding ID'),
  };
};

/**
 * Recipient fields are joined with a separator that cannot appear in a validated identifier, so
 * distinct recipients can never produce the same additional-data string.
 */
const recipientAssociatedData = (
  recipient: SealedCredentialRecipient,
): Buffer =>
  Buffer.from(
    JSON.stringify([
      ENVELOPE_VERSION,
      recipient.workspaceId,
      recipient.nodeId,
      recipient.bindingId,
    ]),
    'utf8',
  );

const parseJwk = (value: string, label: string): Record<string, unknown> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return fail('InvalidKey', `${label} is not valid JSON`) as never;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('InvalidKey', `${label} is not a JWK object`);
  }
  const jwk = parsed as Record<string, unknown>;
  if (jwk.kty !== 'OKP' || jwk.crv !== 'X25519') {
    fail('InvalidKey', `${label} must be an X25519 OKP JWK`);
  }
  return jwk;
};

const publicKeyFromJwk = (value: string, label: string) => {
  const jwk = parseJwk(value, label);
  if (typeof jwk.x !== 'string' || jwk.x === '') {
    fail('InvalidKey', `${label} is missing its public component`);
  }
  if ('d' in jwk) {
    fail('InvalidKey', `${label} must not contain a private component`);
  }
  try {
    return createPublicKey({ key: jwk as never, format: 'jwk' });
  } catch {
    return fail('InvalidKey', `${label} is not a usable X25519 public key`) as never;
  }
};

const privateKeyFromJwk = (value: string, label: string) => {
  const jwk = parseJwk(value, label);
  if (typeof jwk.d !== 'string' || jwk.d === '') {
    fail('InvalidKey', `${label} is missing its private component`);
  }
  try {
    return createPrivateKey({ key: jwk as never, format: 'jwk' });
  } catch {
    return fail('InvalidKey', `${label} is not a usable X25519 private key`) as never;
  }
};

/**
 * HKDF salt is the ephemeral public key. It is unique per envelope and already public, which is
 * exactly what a salt needs to be.
 */
const deriveEnvelopeKey = (input: {
  sharedSecret: Buffer;
  ephemeralPublicKeyJwk: string;
  recipient: SealedCredentialRecipient;
}): Buffer =>
  Buffer.from(
    hkdfSync(
      'sha256',
      input.sharedSecret,
      Buffer.from(input.ephemeralPublicKeyJwk, 'utf8'),
      Buffer.concat([
        Buffer.from(HKDF_INFO, 'utf8'),
        recipientAssociatedData(input.recipient),
      ]),
      AES_KEY_BYTES,
    ),
  );

/**
 * Mints the node's long-lived encryption keypair. Callers persist the private JWK with 0600
 * permissions on the node and publish only the public JWK.
 */
export function generateNodeEncryptionKeyPair(): NodeEncryptionKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('x25519');
  return {
    algorithm: KEY_ALGORITHM,
    publicKeyJwk: JSON.stringify(publicKey.export({ format: 'jwk' })),
    privateKeyJwk: JSON.stringify(privateKey.export({ format: 'jwk' })),
  };
}

/**
 * Derives the public JWK from a private JWK so a node can republish its public key without storing
 * it separately and risking the two drifting apart.
 */
export function nodeEncryptionPublicKeyFromPrivate(
  privateKeyJwk: string,
): string {
  const privateKey = privateKeyFromJwk(privateKeyJwk, 'node encryption private key');
  return JSON.stringify(
    createPublicKey(privateKey).export({ format: 'jwk' }),
  );
}

/**
 * Encrypts a credential value to a single node. Runs on the setup surface; the control plane only
 * ever relays the returned envelope.
 */
export function sealCredential(input: {
  recipientPublicKeyJwk: string;
  recipient: SealedCredentialRecipient;
  plaintext: string;
}): SealedCredentialEnvelope {
  if (typeof input.plaintext !== 'string' || input.plaintext === '') {
    fail('InvalidInput', 'sealed credential plaintext is required');
  }
  const recipient = normalizeRecipient(input.recipient);
  const recipientPublicKey = publicKeyFromJwk(
    input.recipientPublicKeyJwk,
    'node encryption public key',
  );

  const ephemeral = generateKeyPairSync('x25519');
  const ephemeralPublicKeyJwk = JSON.stringify(
    ephemeral.publicKey.export({ format: 'jwk' }),
  );
  const sharedSecret = diffieHellman({
    privateKey: ephemeral.privateKey,
    publicKey: recipientPublicKey,
  });
  const envelopeKey = deriveEnvelopeKey({
    sharedSecret,
    ephemeralPublicKeyJwk,
    recipient,
  });

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', envelopeKey, iv);
  cipher.setAAD(recipientAssociatedData(recipient));
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(input.plaintext, 'utf8')),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  sharedSecret.fill(0);
  envelopeKey.fill(0);

  return {
    version: ENVELOPE_VERSION,
    algorithm: KEY_ALGORITHM,
    recipient,
    ephemeralPublicKeyJwk,
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

const decodeBase64 = (
  value: unknown,
  label: string,
  expectedBytes?: number,
): Buffer => {
  if (typeof value !== 'string' || value === '') {
    fail('InvalidEnvelope', `sealed credential ${label} is required`);
  }
  const decoded = Buffer.from(value as string, 'base64');
  if (decoded.length === 0) {
    fail('InvalidEnvelope', `sealed credential ${label} is not valid base64`);
  }
  if (expectedBytes !== undefined && decoded.length !== expectedBytes) {
    fail('InvalidEnvelope', `sealed credential ${label} has an unexpected length`);
  }
  return decoded;
};

/**
 * Compares expected and actual recipients without early exit. These values are not secret, but
 * constant-time comparison keeps the check uniform with the rest of the envelope handling.
 */
const recipientMatches = (
  expected: SealedCredentialRecipient,
  actual: SealedCredentialRecipient,
): boolean => {
  const a = recipientAssociatedData(expected);
  const b = recipientAssociatedData(actual);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Opens an envelope on the node that owns the private key. Fails closed on any binding mismatch so a
 * node cannot be tricked into installing another node's credential.
 */
export function openSealedCredential(input: {
  recipientPrivateKeyJwk: string;
  expectedRecipient: SealedCredentialRecipient;
  envelope: SealedCredentialEnvelope;
}): string {
  const envelope = input.envelope;
  if (!envelope || typeof envelope !== 'object') {
    fail('InvalidEnvelope', 'sealed credential envelope is required');
  }
  if (envelope.version !== ENVELOPE_VERSION) {
    fail('InvalidEnvelope', 'sealed credential envelope version is unsupported');
  }
  if (envelope.algorithm !== KEY_ALGORITHM) {
    fail('InvalidEnvelope', 'sealed credential envelope algorithm is unsupported');
  }

  const expectedRecipient = normalizeRecipient(input.expectedRecipient);
  const envelopeRecipient = normalizeRecipient(envelope.recipient);
  if (!recipientMatches(expectedRecipient, envelopeRecipient)) {
    fail(
      'RecipientMismatch',
      'sealed credential envelope was not issued for this node and binding',
    );
  }

  const iv = decodeBase64(envelope.iv, 'iv', IV_BYTES);
  const authTag = decodeBase64(envelope.authTag, 'auth tag', 16);
  const ciphertext = decodeBase64(envelope.ciphertext, 'ciphertext');

  const privateKey = privateKeyFromJwk(
    input.recipientPrivateKeyJwk,
    'node encryption private key',
  );
  const ephemeralPublicKey = publicKeyFromJwk(
    envelope.ephemeralPublicKeyJwk,
    'sealed credential ephemeral public key',
  );

  const sharedSecret = diffieHellman({
    privateKey,
    publicKey: ephemeralPublicKey,
  });
  const envelopeKey = deriveEnvelopeKey({
    sharedSecret,
    ephemeralPublicKeyJwk: envelope.ephemeralPublicKeyJwk,
    recipient: envelopeRecipient,
  });

  try {
    const decipher = createDecipheriv('aes-256-gcm', envelopeKey, iv);
    decipher.setAAD(recipientAssociatedData(envelopeRecipient));
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch {
    // The underlying error can distinguish tag failure from padding shape. Collapse to one code so
    // callers cannot use failure detail as a decryption oracle.
    return fail(
      'DecryptionFailure',
      'sealed credential envelope could not be opened',
    ) as never;
  } finally {
    sharedSecret.fill(0);
    envelopeKey.fill(0);
  }
}
