import { timingSafeEqual } from 'node:crypto';

import type { DialerIdentity } from '../contracts';

export type BearerIdentity = DialerIdentity & { token: string };

const equalToken = (left: string, right: string): boolean => {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
};

export const createBearerAuthenticator =
  (identities: BearerIdentity[]) =>
  (request: Request): Promise<DialerIdentity | null> => {
    const authorization = request.headers.get('authorization') ?? '';
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';
    if (!token) return Promise.resolve(null);
    const identity = identities.find((candidate) =>
      equalToken(candidate.token, token),
    );
    return Promise.resolve(
      identity
        ? { workspaceId: identity.workspaceId, userId: identity.userId }
        : null,
    );
  };
