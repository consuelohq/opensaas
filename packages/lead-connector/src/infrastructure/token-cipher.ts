import { Effect, Layer } from 'effect';

import { LeadConnectorTokenCipherError, errorMessage } from '../errors.js';
import { LeadConnectorTokenCipher } from '../ports/index.js';

const VERSION = 'v1';
const IV_LENGTH = 12;

const deriveKey = async (secret: string): Promise<CryptoKey> => {
  try {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(secret),
    );
    return await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, [
      'encrypt',
      'decrypt',
    ]);
  } catch (cause: unknown) {
    throw new Error('Failed to derive the token encryption key', { cause });
  }
};

const encryptValue = async (secret: string, value: string): Promise<string> => {
  try {
    const key = await deriveKey(secret);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(value),
    );
    return [
      VERSION,
      Buffer.from(iv).toString('base64url'),
      Buffer.from(ciphertext).toString('base64url'),
    ].join('.');
  } catch (cause: unknown) {
    throw new Error('Failed to encrypt the provider token', { cause });
  }
};

const decryptValue = async (secret: string, value: string): Promise<string> => {
  try {
    const [version, ivValue, ciphertextValue] = value.split('.');
    if (version !== VERSION || !ivValue || !ciphertextValue) {
      throw new Error('Unsupported encrypted token format');
    }
    const key = await deriveKey(secret);
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(Buffer.from(ivValue, 'base64url')),
      },
      key,
      new Uint8Array(Buffer.from(ciphertextValue, 'base64url')),
    );
    return new TextDecoder().decode(plaintext);
  } catch (cause: unknown) {
    throw new Error('Failed to decrypt the provider token', { cause });
  }
};

export const createLeadConnectorTokenCipherLayer = (secret: string) =>
  Layer.succeed(LeadConnectorTokenCipher, {
    encrypt: (value) =>
      Effect.tryPromise({
        try: () => encryptValue(secret, value),
        catch: (cause) =>
          new LeadConnectorTokenCipherError({
            operation: 'encrypt',
            message: errorMessage(cause),
            retryable: false,
            cause,
          }),
      }),
    decrypt: (value) =>
      Effect.tryPromise({
        try: () => decryptValue(secret, value),
        catch: (cause) =>
          new LeadConnectorTokenCipherError({
            operation: 'decrypt',
            message: errorMessage(cause),
            retryable: false,
            cause,
          }),
      }),
  });
