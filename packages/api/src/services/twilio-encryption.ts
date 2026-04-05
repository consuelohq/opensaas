import * as crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

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
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
};

const CBC_ALGORITHM = 'aes-256-cbc';
const CBC_IV_LENGTH = 16;

export const decryptCredential = (
  ciphertext: string,
  workspaceId: string,
): string => {
  const key = deriveKey(workspaceId);
  const parts = ciphertext.split(':');
  
  if (parts.length === 3) {
    // GCM format: iv:enc:authTag
    const [ivHex, encHex, authTagHex] = parts;
    if (!ivHex || !encHex || !authTagHex) {
      throw new Error('invalid encrypted credential format');
    }
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
  
  if (parts.length === 2) {
    // Legacy CBC format: iv:enc (backward compatibility during migration)
    const [ivHex, encHex] = parts;
    if (!ivHex || !encHex) {
      throw new Error('invalid encrypted credential format');
    }
    const cbcKey = crypto
      .createHash('sha256')
      .update(`twilio-creds:${process.env.APP_SECRET}:${workspaceId}`)
      .digest();
    const decipher = crypto.createDecipheriv(
      CBC_ALGORITHM,
      cbcKey,
      Buffer.from(ivHex, 'hex'),
    );
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
  
  throw new Error('invalid encrypted credential format');
};
