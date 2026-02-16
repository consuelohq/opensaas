import { createHash } from 'node:crypto';

import type { AuthContext, ApiRequest, ApiResponse } from '../types.js';

/**
 * Twenty JWT access token payload shape.
 * See: packages/twenty-server/src/engine/core-modules/auth/types/auth-context.type.ts
 */
interface AccessTokenPayload {
  sub: string;
  type: string;
  userId: string;
  workspaceId: string;
  workspaceMemberId?: string;
  userWorkspaceId: string;
}

/**
 * Derive the per-token signing secret the same way Twenty does.
 *   secret = sha256(APP_SECRET + workspaceId + tokenType)
 *
 * See: packages/twenty-server/src/engine/core-modules/jwt/services/jwt-wrapper.service.ts
 */
function deriveSecret(appSecret: string, workspaceId: string, tokenType: string): string {
  return createHash('sha256')
    .update(`${appSecret}${workspaceId}${tokenType}`)
    .digest('hex');
}

/**
 * Auth middleware that validates Twenty CRM JWT access tokens.
 *
 * Extracts `Authorization: Bearer <token>`, verifies signature using
 * the same derived-secret scheme as Twenty's server, and populates
 * `req.auth` with the decoded user/workspace context.
 *
 * Requires APP_SECRET env var (shared with the CRM server).
 */
export function authMiddleware() {
  return async (req: ApiRequest, res: ApiResponse, next: () => void) => {
    const appSecret = process.env.APP_SECRET;

    if (!appSecret) {
      res.status(500).json({ error: { code: 'config_error', message: 'APP_SECRET is not configured' } });
      return;
    }

    const header = req.headers['authorization'] ?? req.headers['Authorization'] ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';

    if (!token) {
      res.status(401).json({ error: { code: 'unauthorized', message: 'Missing authentication token' } });
      return;
    }

    try {
      // Lazy import — jsonwebtoken is a peer dependency
      const { default: jwt } = await import('jsonwebtoken');

      // Decode without verification first to extract workspaceId for secret derivation
      const decoded = jwt.decode(token) as AccessTokenPayload | null;

      if (!decoded || decoded.type !== 'ACCESS' || !decoded.workspaceId) {
        res.status(401).json({ error: { code: 'unauthorized', message: 'Invalid token' } });
        return;
      }

      const secret = deriveSecret(appSecret, decoded.workspaceId, decoded.type);

      jwt.verify(token, secret, { algorithms: ['HS256'] });

      const auth: AuthContext = {
        userId: decoded.userId,
        workspaceId: decoded.workspaceId,
        workspaceMemberId: decoded.workspaceMemberId,
        userWorkspaceId: decoded.userWorkspaceId,
      };

      req.auth = auth;
      next();
    } catch (err: unknown) {
      const message = err instanceof Error && err.name === 'TokenExpiredError'
        ? 'Token expired'
        : 'Invalid token';
      res.status(401).json({ error: { code: 'unauthorized', message } });
    }
  };
}
