import type { ApiRequest, ApiResponse } from '../types.js';

export interface AuthContext {
  userId: string;
  workspaceId: string;
}

export function requireAuth(
  req: ApiRequest,
  res: ApiResponse,
): AuthContext | null {
  const userId = req.auth?.userId;
  const workspaceId = req.auth?.workspaceId;
  if (userId === undefined || workspaceId === undefined) {
    res
      .status(401)
      .json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    return null;
  }
  return { userId, workspaceId };
}
