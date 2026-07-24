import { createHmac, timingSafeEqual } from 'node:crypto';

import type { DialerIdentity } from '../contracts';

const VERSION = 1;

const encode = (value: string): string =>
  Buffer.from(value, 'utf8').toString('base64url');

const decode = (value: string): string =>
  Buffer.from(value, 'base64url').toString('utf8');

const bearerToken = (request: Request): string | null => {
  const authorization = request.headers.get('authorization') ?? '';
  return authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim() || null
    : null;
};

type EmbedSessionPayload = {
  version: number;
  workspaceId: string;
  userId: string;
  issuedAt: number;
  expiresAt: number;
};

const parsePayload = (value: string): EmbedSessionPayload | null => {
  try {
    const parsed: unknown = JSON.parse(decode(value));
    if (!parsed || typeof parsed !== 'object') return null;
    const payload = parsed as Partial<EmbedSessionPayload>;
    if (
      payload.version !== VERSION ||
      typeof payload.workspaceId !== 'string' ||
      !payload.workspaceId ||
      typeof payload.userId !== 'string' ||
      !payload.userId ||
      typeof payload.issuedAt !== 'number' ||
      typeof payload.expiresAt !== 'number'
    ) {
      return null;
    }
    return payload as EmbedSessionPayload;
  } catch (_error: unknown) {
    return null;
  }
};

export const createEmbedSessionService = (options: {
  secret: string;
  ttlSeconds?: number;
  now?: () => number;
}) => {
  if (options.secret.length < 24) {
    throw new Error('Embed session secret must contain at least 24 characters');
  }
  const now = options.now ?? Date.now;
  const ttlSeconds = options.ttlSeconds ?? 15 * 60;
  const sign = (payload: string): string =>
    createHmac('sha256', options.secret).update(payload).digest('base64url');

  return {
    issue: async (identity: DialerIdentity) => {
      const issuedAt = Math.floor(now() / 1000);
      const expiresAt = issuedAt + ttlSeconds;
      const payload = encode(
        JSON.stringify({
          version: VERSION,
          workspaceId: identity.workspaceId,
          userId: identity.userId,
          issuedAt,
          expiresAt,
        } satisfies EmbedSessionPayload),
      );
      return {
        token: `${payload}.${sign(payload)}`,
        expiresAt: new Date(expiresAt * 1000).toISOString(),
      };
    },
    authenticate: async (request: Request): Promise<DialerIdentity | null> => {
      const token = bearerToken(request);
      if (!token) return null;
      const [encodedPayload, providedSignature, extra] = token.split('.');
      if (!encodedPayload || !providedSignature || extra) return null;
      const expectedSignature = sign(encodedPayload);
      const provided = Buffer.from(providedSignature);
      const expected = Buffer.from(expectedSignature);
      if (
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      ) {
        return null;
      }
      const payload = parsePayload(encodedPayload);
      const current = Math.floor(now() / 1000);
      if (
        !payload ||
        payload.expiresAt <= current ||
        payload.issuedAt > current + 30
      ) {
        return null;
      }
      return {
        workspaceId: payload.workspaceId,
        userId: payload.userId,
      };
    },
  };
};

export type EmbedSessionService = ReturnType<typeof createEmbedSessionService>;
