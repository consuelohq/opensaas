import { createDecipheriv, createHash } from 'node:crypto';

import { Effect, Layer } from 'effect';

import type { LeadConnectorUserContext } from '../contracts/index.js';
import { LeadConnectorEmbedIdentityError } from '../errors.js';
import { LeadConnectorUserContextDecoder } from '../ports/index.js';

const OPENSSL_PREFIX = Buffer.from('Salted__', 'utf8');
const DERIVED_BYTES = 48;

const deriveOpenSslKeyAndIv = (secret: string, salt: Buffer) => {
  const secretBytes = Buffer.from(secret, 'utf8');
  let derived = Buffer.alloc(0);
  let block = Buffer.alloc(0);
  while (derived.length < DERIVED_BYTES) {
    block = createHash('md5')
      .update(Buffer.concat([block, secretBytes, salt]))
      .digest();
    derived = Buffer.concat([derived, block]);
  }
  return {
    key: derived.subarray(0, 32),
    iv: derived.subarray(32, 48),
  };
};

const readRequiredString = (
  record: Record<string, unknown>,
  key: string,
): string => {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing ${key}`);
  }
  return value.trim();
};

const readOptionalString = (
  record: Record<string, unknown>,
  key: string,
): string | null => {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
};

const decodeUserContext = (
  encryptedData: string,
  sharedSecret: string,
): LeadConnectorUserContext => {
  const bytes = Buffer.from(encryptedData, 'base64');
  if (
    bytes.length <= OPENSSL_PREFIX.length + 8 ||
    !bytes.subarray(0, OPENSSL_PREFIX.length).equals(OPENSSL_PREFIX)
  ) {
    throw new Error('Unsupported encrypted context');
  }
  const salt = bytes.subarray(OPENSSL_PREFIX.length, OPENSSL_PREFIX.length + 8);
  const ciphertext = bytes.subarray(OPENSSL_PREFIX.length + 8);
  const { key, iv } = deriveOpenSslKeyAndIv(sharedSecret, salt);
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
  const parsed: unknown = JSON.parse(plaintext);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid user context');
  }
  const record = parsed as Record<string, unknown>;
  const type = readRequiredString(record, 'type');
  if (type !== 'agency' && type !== 'location') {
    throw new Error('Invalid context type');
  }
  return {
    userId: readRequiredString(record, 'userId'),
    companyId: readRequiredString(record, 'companyId'),
    role: readRequiredString(record, 'role'),
    type,
    activeLocation: readOptionalString(record, 'activeLocation'),
    versionId: readOptionalString(record, 'versionId'),
    appStatus: readOptionalString(record, 'appStatus'),
  };
};

export const createLeadConnectorUserContextDecoderLayer = (
  sharedSecret: string,
) => {
  if (sharedSecret.trim().length < 16) {
    throw new Error(
      'LeadConnector shared secret must contain at least 16 characters',
    );
  }
  return Layer.succeed(LeadConnectorUserContextDecoder, {
    decrypt: (encryptedData) =>
      Effect.try({
        try: () => decodeUserContext(encryptedData, sharedSecret),
        catch: (cause) =>
          new LeadConnectorEmbedIdentityError({
            code: 'INVALID_EMBED_CONTEXT',
            message: 'LeadConnector user context could not be verified',
            retryable: false,
            cause,
          }),
      }),
  });
};
