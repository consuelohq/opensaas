import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const VERSION = 'cb1';
const encode = (value: Buffer) => value.toString('base64url');
const decode = (value: string) => Buffer.from(value, 'base64url');

export type CallbackRecipientCipher = {
  readonly encrypt: (workspaceId: string, recipient: string) => string;
  readonly decrypt: (workspaceId: string, ciphertext: string) => string;
};

export const createCallbackRecipientCipher = (
  secret: string,
): CallbackRecipientCipher => {
  if (secret.trim().length < 16)
    throw new Error('Callback recipient encryption secret is too short');
  const key = createHash('sha256')
    .update('consuelo-callback-recipient-v1:')
    .update(secret)
    .digest();
  return {
    encrypt: (workspaceId, recipient) => {
      if (!workspaceId || !recipient)
        throw new Error('Callback recipient encryption input is missing');
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(workspaceId, 'utf8'));
      const ciphertext = Buffer.concat([
        cipher.update(recipient, 'utf8'),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();
      return [VERSION, encode(iv), encode(tag), encode(ciphertext)].join('.');
    },
    decrypt: (workspaceId, value) => {
      try {
        const [version, ivValue, tagValue, ciphertextValue, extra] =
          value.split('.');
        if (
          version !== VERSION ||
          !ivValue ||
          !tagValue ||
          !ciphertextValue ||
          extra !== undefined
        )
          throw new Error('Invalid callback recipient ciphertext');
        const decipher = createDecipheriv('aes-256-gcm', key, decode(ivValue));
        decipher.setAAD(Buffer.from(workspaceId, 'utf8'));
        decipher.setAuthTag(decode(tagValue));
        return Buffer.concat([
          decipher.update(decode(ciphertextValue)),
          decipher.final(),
        ]).toString('utf8');
      } catch (cause: unknown) {
        throw new Error('Callback recipient ciphertext authentication failed', {
          cause,
        });
      }
    },
  };
};
