import {
  GOOGLE_AUTH_URL,
  GOOGLE_SCOPE,
  MCP_OAUTH_CODE_TTL_MS,
  MCP_OAUTH_SCOPES,
  MCP_OAUTH_TTL_MS,
  TTL_MS,
} from '../constants';
import { json } from '../http';
import type { Store } from '../types';
import {
  hasGrantedScope,
  hash,
  hashChallenge,
  host,
  normalizeScopes,
  params,
  rand,
  validChatGptClientId,
  validChatGptRedirectUri,
  workspaceHostFromMcpResource,
} from '../utils';
import {
  googleApprovalErrorMessage,
  googleIdentity,
  redirectUri,
} from './google-oauth';

export function authorizationServerMetadata(
  origin: string,
): Record<string, unknown> {
  return {
    issuer: origin,
    authorization_endpoint: new URL('/oauth/authorize', origin).toString(),
    token_endpoint: new URL('/oauth/token', origin).toString(),
    introspection_endpoint: new URL('/oauth/introspect', origin).toString(),
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
    scopes_supported: MCP_OAUTH_SCOPES,
  };
}

export function mcpOAuthGoogleRedirect(input: {
  clientId: string;
  state: string;
  googleRedirectUri: string;
}): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.googleRedirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPE);
  url.searchParams.set('state', input.state);
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export function redirectWithParams(
  base: string,
  params: Record<string, string>,
): Response {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);
  return Response.redirect(url.toString(), 302);
}

export function invalidOauthRequest(
  error: string,
  description: string,
  status = 400,
): Response {
  return json({ error, error_description: description }, { status });
}

export function mcpResourceUrl(origin: string): string {
  return new URL('/mcp', origin).toString();
}

export function oauthProtectedResourceMetadata(
  origin: string,
): Record<string, unknown> {
  return {
    resource: mcpResourceUrl(origin),
    authorization_servers: [origin],
    scopes_supported: MCP_OAUTH_SCOPES,
    bearer_methods_supported: ['header'],
  };
}

export function isCentralMcpResource(
  resource: string,
  origin: string,
): boolean {
  try {
    const resourceUrl = new URL(resource);
    const originUrl = new URL(origin);
    return (
      resourceUrl.protocol === 'https:' &&
      resourceUrl.pathname === '/mcp' &&
      host(resourceUrl.hostname) === host(originUrl.hostname)
    );
  } catch {
    return false;
  }
}

export function isProtectedResourceMetadataPath(pathname: string): boolean {
  return (
    pathname === '/.well-known/oauth-protected-resource' ||
    pathname === '/.well-known/oauth-protected-resource/mcp'
  );
}

export function isMcpRequestPath(pathname: string): boolean {
  return pathname === '/mcp' || pathname.startsWith('/mcp/');
}

export type McpOAuthWorkspaceResolution =
  | { ok: true; workspaceHost: string }
  | { ok: false; error: string; description: string; status: number };

export async function resolveMcpOAuthWorkspaceHost(input: {
  store: Store;
  accountId: string;
  resource: string;
  requestedWorkspaceHost: string;
  origin: string;
}): Promise<McpOAuthWorkspaceResolution> {
  try {
    const accountWorkspace = await input.store.byAccountWorkspace(
      input.accountId,
    );
    if (!accountWorkspace) {
      return {
        ok: false,
        error: 'access_denied',
        description:
          'No Consuelo OS workspace is connected for this Google account.',
        status: 403,
      };
    }

    if (isCentralMcpResource(input.resource, input.origin)) {
      return { ok: true, workspaceHost: accountWorkspace.workspaceHost };
    }

    if (
      host(accountWorkspace.workspaceHost) !==
      host(input.requestedWorkspaceHost)
    ) {
      return {
        ok: false,
        error: 'access_denied',
        description:
          'This Google account is not connected to the requested Consuelo OS workspace.',
        status: 403,
      };
    }

    return { ok: true, workspaceHost: input.requestedWorkspaceHost };
  } catch {
    return {
      ok: false,
      error: 'server_error',
      description: 'Workspace membership lookup failed.',
      status: 500,
    };
  }
}

export async function startMcpOAuthAuthorization(input: {
  request: Request;
  store: Store;
  origin: string;
  googleClientId: string;
  nowMs: number;
}): Promise<Response> {
  const url = new URL(input.request.url);
  const responseType = url.searchParams.get('response_type') ?? '';
  const clientId = url.searchParams.get('client_id') ?? '';
  const redirectUriValue = url.searchParams.get('redirect_uri') ?? '';
  const resource = url.searchParams.get('resource') ?? '';
  const codeChallenge = url.searchParams.get('code_challenge') ?? '';
  const codeChallengeMethod =
    url.searchParams.get('code_challenge_method') ?? '';
  if (responseType !== 'code')
    return invalidOauthRequest(
      'unsupported_response_type',
      'Only authorization code is supported.',
    );
  if (!validChatGptClientId(clientId))
    return invalidOauthRequest(
      'unauthorized_client',
      'OAuth client is not allowed.',
    );
  if (!validChatGptRedirectUri(redirectUriValue))
    return invalidOauthRequest(
      'invalid_request',
      'redirect_uri is not allowed.',
    );
  if (!codeChallenge || codeChallengeMethod !== 'S256')
    return invalidOauthRequest('invalid_request', 'PKCE S256 is required.');
  let workspaceHost: string;
  try {
    workspaceHost = workspaceHostFromMcpResource(resource);
  } catch {
    return invalidOauthRequest(
      'invalid_target',
      'resource must be a workspace MCP URL.',
    );
  }
  const state = rand('mcp_oauth_state', 24);
  const scopes = normalizeScopes(url.searchParams.get('scope') ?? '');
  await input.store.putMcpOAuthState({
    state,
    clientId,
    redirectUri: redirectUriValue,
    requestedState: url.searchParams.get('state') ?? '',
    scope: scopes.join(' '),
    scopes,
    resource,
    workspaceHost,
    codeChallenge,
    expiresAt: input.nowMs + TTL_MS,
  });
  return Response.redirect(
    mcpOAuthGoogleRedirect({
      clientId: input.googleClientId,
      state,
      googleRedirectUri: redirectUri(input.origin),
    }),
    302,
  );
}

export async function finishMcpOAuthGoogleCallback(input: {
  request: Request;
  store: Store;
  origin: string;
  googleClientId: string;
  googleClientSecret: string;
  fetchImpl: typeof fetch;
  googleRedirectUri: string;
  nowMs: number;
}): Promise<Response> {
  const url = new URL(input.request.url);
  const stateValue = url.searchParams.get('state') ?? '';
  const authCode = url.searchParams.get('code') ?? '';
  const oauthState = await input.store.byMcpOAuthState(stateValue);
  if (!stateValue || !authCode || !oauthState)
    return invalidOauthRequest(
      'invalid_request',
      'OAuth session was not found.',
    );
  if (input.nowMs >= oauthState.expiresAt)
    return invalidOauthRequest(
      'invalid_request',
      'OAuth session expired.',
      410,
    );
  let identity: { sub: string; email: string; emailVerified: boolean };
  try {
    identity = await googleIdentity({
      code: authCode,
      origin: input.origin,
      clientId: input.googleClientId,
      clientSecret: input.googleClientSecret,
      fetchImpl: input.fetchImpl,
      redirectUri: input.googleRedirectUri,
    });
  } catch (error: unknown) {
    return invalidOauthRequest(
      'access_denied',
      googleApprovalErrorMessage(error),
      502,
    );
  }
  const accountId = 'google:' + identity.sub;
  const workspaceResolution = await resolveMcpOAuthWorkspaceHost({
    store: input.store,
    accountId,
    resource: oauthState.resource,
    requestedWorkspaceHost: oauthState.workspaceHost,
    origin: input.origin,
  });
  if (workspaceResolution.ok === false) {
    await input.store.delMcpOAuthState(stateValue);
    return invalidOauthRequest(
      workspaceResolution.error,
      workspaceResolution.description,
      workspaceResolution.status,
    );
  }
  const code = rand('coa_code', 24);
  await input.store.putMcpOAuthCode({
    codeHash: await hash(code),
    clientId: oauthState.clientId,
    redirectUri: oauthState.redirectUri,
    scope: oauthState.scope,
    scopes: oauthState.scopes,
    resource: oauthState.resource,
    workspaceHost: workspaceResolution.workspaceHost,
    accountId,
    email: identity.email,
    codeChallenge: oauthState.codeChallenge,
    expiresAt: input.nowMs + MCP_OAUTH_CODE_TTL_MS,
  });
  await input.store.delMcpOAuthState(stateValue);
  return redirectWithParams(oauthState.redirectUri, {
    code,
    ...(oauthState.requestedState ? { state: oauthState.requestedState } : {}),
  });
}

export async function exchangeMcpOAuthToken(input: {
  request: Request;
  store: Store;
  nowMs: number;
}): Promise<Response> {
  try {
    const p = await params(input.request);
    if (p.get('grant_type') !== 'authorization_code')
      return invalidOauthRequest(
        'unsupported_grant_type',
        'Only authorization_code is supported.',
      );
    const clientId = p.get('client_id') ?? '';
    const redirectUriValue = p.get('redirect_uri') ?? '';
    const code = p.get('code') ?? '';
    const verifier = p.get('code_verifier') ?? '';
    const resource = p.get('resource') ?? '';
    const authCode = await input.store.byMcpOAuthCode(await hash(code));
    if (!authCode)
      return invalidOauthRequest(
        'invalid_grant',
        'Authorization code was not found.',
      );
    if (input.nowMs >= authCode.expiresAt)
      return invalidOauthRequest(
        'invalid_grant',
        'Authorization code expired.',
      );
    if (
      authCode.clientId !== clientId ||
      authCode.redirectUri !== redirectUriValue
    )
      return invalidOauthRequest(
        'invalid_grant',
        'Authorization code binding mismatch.',
      );
    if (resource && resource !== authCode.resource)
      return invalidOauthRequest('invalid_grant', 'Resource binding mismatch.');
    if (!verifier || (await hashChallenge(verifier)) !== authCode.codeChallenge)
      return invalidOauthRequest('invalid_grant', 'PKCE verification failed.');
    const accessToken = rand('coa', 32);
    await input.store.putMcpOAuthAccessToken({
      tokenHash: await hash(accessToken),
      clientId: authCode.clientId,
      scope: authCode.scope,
      scopes: authCode.scopes,
      resource: authCode.resource,
      workspaceHost: authCode.workspaceHost,
      accountId: authCode.accountId,
      email: authCode.email,
      issuedAt: input.nowMs,
      expiresAt: input.nowMs + MCP_OAUTH_TTL_MS,
    });
    await input.store.delMcpOAuthCode(authCode.codeHash);
    return json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: Math.floor(MCP_OAUTH_TTL_MS / 1000),
      scope: authCode.scope,
    });
  } catch (error: unknown) {
    return invalidOauthRequest(
      'server_error',
      error instanceof Error ? error.message : 'OAuth token exchange failed.',
      500,
    );
  }
}

export async function introspectMcpOAuthToken(input: {
  request: Request;
  store: Store;
  nowMs: number;
}): Promise<Response> {
  try {
    const p = await params(input.request);
    const token = p.get('token') ?? '';
    const resource = p.get('resource') ?? '';
    const requiredScope = p.get('scope') ?? '';
    const stored = token
      ? await input.store.byMcpOAuthAccessToken(await hash(token))
      : undefined;
    if (
      !stored ||
      input.nowMs >= stored.expiresAt ||
      (resource && resource !== stored.resource) ||
      !hasGrantedScope(stored.scopes, requiredScope)
    ) {
      return json({ active: false });
    }
    return json({
      active: true,
      client_id: stored.clientId,
      sub: stored.accountId,
      username: stored.email,
      workspace_host: stored.workspaceHost,
      resource: stored.resource,
      scope: stored.scope,
      scopes: stored.scopes,
      exp: Math.floor(stored.expiresAt / 1000),
      iat: Math.floor(stored.issuedAt / 1000),
    });
  } catch {
    return json({ active: false });
  }
}
