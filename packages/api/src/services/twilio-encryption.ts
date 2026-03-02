import * as crypto from 'node:crypto';

// derive per-workspace encryption key from APP_SECRET + workspaceId
const deriveKey = (workspaceId: string): Buffer => {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error('APP_SECRET required for credential encryption');
  return crypto
    .createHash('sha256')
    .update(`twilio-creds:${secret}:${workspaceId}`)
    .digest();
};

export const encryptCredential = (
  plaintext: string,
  workspaceId: string,
): string => {
  const key = deriveKey(workspaceId);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decryptCredential = (
  ciphertext: string,
  workspaceId: string,
): string => {
  const key = deriveKey(workspaceId);
  const [ivHex, encHex] = ciphertext.split(':');
  if (!ivHex || !encHex) throw new Error('invalid encrypted credential format');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    key,
    Buffer.from(ivHex, 'hex'),
  );
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
};
