# AUTH.md — Consuelo Authentication System

Single auth system: **Twenty's built-in JWT auth**. No Clerk, no separate auth provider.

## Architecture

```
Browser → Twenty Frontend → Twenty Server (issues JWTs)
                                ↓
                          opensaas API (validates same JWTs)
```

Both the CRM server and the opensaas API share `APP_SECRET`. The CRM server issues tokens; the opensaas API validates them.

## Token Types

| Type | Enum | Expiry | Purpose |
|------|------|--------|---------|
| Access | `ACCESS` | 30m | Main auth token, workspace-scoped |
| Refresh | `REFRESH` | 60d | Stored in DB, used to get new access tokens |
| Login | `LOGIN` | 15m | Short-lived, used during login flow |
| Workspace Agnostic | `WORKSPACE_AGNOSTIC` | — | For users not yet in a workspace |

## Secret Derivation

Twenty does **not** use separate secret env vars per token type. There is one secret:

```
APP_SECRET=<random string>
```

Per-token signing secrets are derived at runtime:

```
secret = sha256(APP_SECRET + workspaceId + tokenType)
```

For example, an ACCESS token for workspace `abc-123`:
```
secret = sha256("my_app_secret" + "abc-123" + "ACCESS")
```

Source: `packages/twenty-server/src/engine/core-modules/jwt/services/jwt-wrapper.service.ts`

## Access Token Payload

```typescript
{
  sub: string;          // userId
  type: "ACCESS";
  userId: string;
  workspaceId: string;
  workspaceMemberId?: string;
  userWorkspaceId: string;
  authProvider: string; // "google", "password", etc.
  isImpersonating?: boolean;
}
```

Signed with HS256 via `jsonwebtoken`.

## Frontend Token Storage

- **Storage:** Cookies via `cookieStorage` (not localStorage)
- **Cookie key:** `tokenPair`
- **Format:** JSON `{ accessOrWorkspaceAgnosticToken: { token, expiresAt }, refreshToken: { token, expiresAt } }`
- **State:** Recoil `tokenPairState` with `cookieStorageEffect`

Source: `packages/twenty-front/src/modules/auth/states/tokenPairState.ts`

## Token Extraction

The server accepts tokens from two sources (in order):
1. `Authorization: Bearer <token>` header
2. `?token=<token>` query parameter (fallback for REST API playground)

Source: `JwtWrapperService.extractJwtFromRequest()`

## Refresh Flow

1. Frontend sends refresh token to get new access + refresh tokens
2. Old refresh token is revoked (set `revokedAt`)
3. New token pair returned
4. **Reuse grace period:** If a revoked token is reused within the grace window (concurrent requests), it's allowed
5. **Suspicious reuse:** If a revoked token is reused after the grace period, ALL user refresh tokens are revoked

Refresh tokens are stored in the `app_token` table as `AppToken` entities.

Source: `packages/twenty-server/src/engine/core-modules/auth/token/services/refresh-token.service.ts`

## opensaas API Middleware

The opensaas API validates Twenty's JWTs using the same derived-secret scheme:

```typescript
// packages/api/src/middleware/auth.ts
// 1. Extract Bearer token
// 2. Decode (without verify) to get workspaceId + type
// 3. Derive secret: sha256(APP_SECRET + workspaceId + "ACCESS")
// 4. Verify token with derived secret
// 5. Populate req.auth with { userId, workspaceId, workspaceMemberId, userWorkspaceId }
```

Requires `APP_SECRET` env var (same value as the CRM server).

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_SECRET` | Yes | — | Single signing key for all token types |
| `ACCESS_TOKEN_EXPIRES_IN` | No | `30m` | Access token TTL |
| `REFRESH_TOKEN_EXPIRES_IN` | No | `60d` | Refresh token TTL |
| `LOGIN_TOKEN_EXPIRES_IN` | No | `15m` | Login token TTL |
| `AUTH_GOOGLE_CLIENT_ID` | No | — | Google OAuth client ID |
| `AUTH_GOOGLE_CLIENT_SECRET` | No | — | Google OAuth client secret |
| `AUTH_GOOGLE_CALLBACK_URL` | No | — | Google OAuth callback URL |

## Key Source Files

| File | What |
|------|------|
| `packages/twenty-server/src/engine/core-modules/jwt/services/jwt-wrapper.service.ts` | Secret derivation, sign/verify |
| `packages/twenty-server/src/engine/core-modules/auth/token/services/access-token.service.ts` | Access token generation + validation |
| `packages/twenty-server/src/engine/core-modules/auth/token/services/refresh-token.service.ts` | Refresh token generation + reuse detection |
| `packages/twenty-server/src/engine/core-modules/auth/token/services/renew-token.service.ts` | Token renewal flow |
| `packages/twenty-server/src/engine/core-modules/auth/types/auth-context.type.ts` | All JWT payload types |
| `packages/twenty-front/src/modules/auth/states/tokenPairState.ts` | Frontend token state |
| `packages/api/src/middleware/auth.ts` | opensaas API JWT validation middleware |
