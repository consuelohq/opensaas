/** API configuration */
export interface ApiConfig {
  /** Rate limit: max requests per window */
  rateLimit?: { max: number; windowMs: number };
}

/** Standard API error response */
export interface ApiError {
  error: { code: string; message: string };
}

/**
 * Context from a validated Twenty JWT access token.
 * Populated by auth middleware on every authenticated request.
 */
export interface AuthContext {
  userId: string;
  workspaceId: string;
  workspaceMemberId?: string;
  userWorkspaceId: string;
}

/** Generic request abstraction */
export interface ApiRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body?: unknown;
  query?: Record<string, string>;
  params?: Record<string, string>;
  /** Populated by auth middleware */
  auth?: AuthContext;
}

/** Generic response helpers */
export interface ApiResponse {
  status(code: number): ApiResponse;
  json(data: unknown): void;
  type(contentType: string): ApiResponse;
  send(body: string): void;
}
