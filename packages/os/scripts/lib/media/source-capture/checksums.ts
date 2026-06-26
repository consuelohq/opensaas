import { createHash } from 'node:crypto';

export function sha256Text(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}
