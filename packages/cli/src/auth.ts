import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import open from 'open';
import { createLogger } from '@consuelo/logger';
import type { CliConfig, CliOsAuth } from './config.js';

const logger = createLogger('CLI:Auth');

export const OS_AUTHORITY_ORIGIN = 'https://os.consuelohq.com';
export const OS_OPERATOR_CLIENT_ID = 'consuelo-os-operator-cli';
const OS_RESOURCE = `${OS_AUTHORITY_ORIGIN}/mcp`;
const OS_SCOPES = ['workspace:read', 'workspace:nodes:manage'] as const;
const TIMEOUT_MS = 5 * 60 * 1000;

export interface AuthResult {
  email: string;
  workspaceId: string;
  workspaceHost: string;
  osAuth: CliOsAuth;
}

export interface AuthOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  openImpl?: (url: string) => Promise<unknown>;
}

interface TokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope: string[];
}

export interface LoopbackCapture {
  redirectUri: string;
  waitForCode: () => Promise<string>;
  close: () => void;
}

const base64Url = (input: Buffer): string =>
  input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function buildOsAuthorizeUrl(input: {
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const url = new URL('/oauth/authorize', OS_AUTHORITY_ORIGIN);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', OS_OPERATOR_CLIENT_ID);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('code_challenge', input.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', input.state);
  url.searchParams.set('resource', OS_RESOURCE);
  url.searchParams.set('scope', OS_SCOPES.join(' '));
  return url.toString();
}

export async function startLoopbackCapture(input: {
  state: string;
  timeoutMs?: number;
}): Promise<LoopbackCapture> {
  let resolveCode!: (code: string) => void;
  let rejectCode!: (error: Error) => void;
  let settled = false;

  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.pathname !== '/callback') {
      response.writeHead(404);
      response.end();
      return;
    }

    const respond = (status: number, message: string): void => {
      response.writeHead(status, {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end(message);
    };

    if (settled) {
      respond(409, 'This authorization callback has already been used.');
      return;
    }

    const providerError = url.searchParams.get('error');
    if (providerError) {
      settled = true;
      respond(400, 'Authorization was denied. You can close this tab.');
      rejectCode(new Error(`authorization was denied: ${providerError}`));
      return;
    }

    if (url.searchParams.get('state') !== input.state) {
      settled = true;
      respond(400, 'State mismatch. You can close this tab.');
      rejectCode(new Error('authorization state did not match the request'));
      return;
    }

    const code = url.searchParams.get('code');
    if (!code) {
      settled = true;
      respond(400, 'No authorization code. You can close this tab.');
      rejectCode(new Error('authorization response carried no code'));
      return;
    }

    settled = true;
    respond(200, 'Consuelo OS is signed in. You can close this tab.');
    resolveCode(code);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', (error: Error) => {
      reject(new Error(`failed to start auth callback listener: ${error.message}`));
    });
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address() as AddressInfo | null;
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('auth callback listener did not report a port');
  }

  const timeout = setTimeout(() => {
    if (settled) return;
    settled = true;
    rejectCode(new Error('authentication timed out after 5 minutes'));
  }, input.timeoutMs ?? TIMEOUT_MS);
  timeout.unref?.();

  const close = (): void => {
    clearTimeout(timeout);
    server.close();
  };

  return {
    redirectUri: `http://127.0.0.1:${address.port}/callback`,
    waitForCode: () => codePromise.finally(close),
    close,
  };
}

const readJsonObject = async (
  response: Response,
): Promise<Record<string, unknown>> => {
  try {
    const value: unknown = await response.json();
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch (_error: unknown) {
    // Handled by the caller as a malformed OS response.
  }
  throw new Error(
    `Consuelo OS returned an invalid response (HTTP ${response.status})`,
  );
};

export async function exchangeOsAuthorizationCode(input: {
  code: string;
  verifier: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<TokenResult> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    client_id: OS_OPERATOR_CLIENT_ID,
    code_verifier: input.verifier,
    redirect_uri: input.redirectUri,
    resource: OS_RESOURCE,
  });

  let response: Response;
  try {
    response = await (input.fetchImpl ?? globalThis.fetch)(
      `${OS_AUTHORITY_ORIGIN}/oauth/token`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body,
      },
    );
  } catch (error: unknown) {
    throw new Error(
      `Consuelo OS token endpoint is unreachable: ${
        error instanceof Error ? error.message : 'network error'
      }`,
    );
  }

  const payload = await readJsonObject(response);
  if (!response.ok) {
    const description =
      typeof payload.error_description === 'string'
        ? payload.error_description
        : typeof payload.error === 'string'
          ? payload.error
          : `HTTP ${response.status}`;
    throw new Error(`Consuelo OS authentication failed: ${description}`);
  }

  const accessToken = payload.access_token;
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('Consuelo OS token endpoint returned no access token');
  }

  return {
    accessToken,
    ...(typeof payload.refresh_token === 'string'
      ? { refreshToken: payload.refresh_token }
      : {}),
    ...(typeof payload.expires_in === 'number'
      ? { expiresAt: Date.now() + payload.expires_in * 1000 }
      : {}),
    scope:
      typeof payload.scope === 'string' && payload.scope.trim()
        ? payload.scope.trim().split(/\s+/)
        : [],
  };
}

export async function resolveOsIdentity(input: {
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<{ email: string; workspaceId: string; workspaceHost: string }> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  let introspectionResponse: Response;
  try {
    introspectionResponse = await fetchImpl(
      `${OS_AUTHORITY_ORIGIN}/oauth/introspect`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: new URLSearchParams({
          token: input.accessToken,
          resource: OS_RESOURCE,
        }),
      },
    );
  } catch (error: unknown) {
    throw new Error(
      `Consuelo OS token introspection is unreachable: ${
        error instanceof Error ? error.message : 'network error'
      }`,
    );
  }
  const introspection = await readJsonObject(introspectionResponse);
  if (
    !introspectionResponse.ok ||
    introspection.active !== true ||
    typeof introspection.username !== 'string' ||
    typeof introspection.workspace_host !== 'string'
  ) {
    throw new Error('Consuelo OS returned an inactive or incomplete login');
  }

  let workspaceResponse: Response;
  try {
    workspaceResponse = await fetchImpl(
      `${OS_AUTHORITY_ORIGIN}/workspace/nodes`,
      {
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          accept: 'application/json',
        },
      },
    );
  } catch (error: unknown) {
    throw new Error(
      `Consuelo OS workspace lookup is unreachable: ${
        error instanceof Error ? error.message : 'network error'
      }`,
    );
  }
  const workspace = await readJsonObject(workspaceResponse);
  if (
    !workspaceResponse.ok ||
    typeof workspace.workspaceId !== 'string' ||
    typeof workspace.workspaceHost !== 'string'
  ) {
    throw new Error('Consuelo OS workspace identity is unavailable');
  }
  if (workspace.workspaceHost !== introspection.workspace_host) {
    throw new Error(
      'Consuelo OS workspace identity did not match the OAuth grant',
    );
  }

  return {
    email: introspection.username,
    workspaceId: workspace.workspaceId,
    workspaceHost: workspace.workspaceHost,
  };
}

export function applyHostedAuthResult(
  config: CliConfig,
  result: AuthResult,
  options: { managed?: boolean } = {},
): CliConfig {
  return {
    ...config,
    ...options,
    workspaceId: result.workspaceId,
    osAuth: result.osAuth,
  };
}

/** Authenticate the CLI through Consuelo OS using authorization code + PKCE. */
export async function authenticateHosted(
  opts: AuthOptions = {},
): Promise<AuthResult> {
  const { verifier, challenge } = createPkcePair();
  const state = base64Url(randomBytes(24));
  const capture = await startLoopbackCapture({
    state,
    ...(opts.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}),
  });
  const authUrl = buildOsAuthorizeUrl({
    redirectUri: capture.redirectUri,
    state,
    challenge,
  });

  logger.info('Opening browser for Consuelo OS authentication...');
  logger.info(`If the browser does not open, visit: ${authUrl}`);

  const openImpl = opts.openImpl ?? ((url: string) => open(url));
  openImpl(authUrl).catch(() => {
    logger.warn(
      'Could not open browser automatically. Please visit the URL above.',
    );
  });

  try {
    const code = await capture.waitForCode();
    const tokens = await exchangeOsAuthorizationCode({
      code,
      verifier,
      redirectUri: capture.redirectUri,
      fetchImpl: opts.fetchImpl,
    });
    const identity = await resolveOsIdentity({
      accessToken: tokens.accessToken,
      fetchImpl: opts.fetchImpl,
    });

    return {
      ...identity,
      osAuth: {
        authorityOrigin: OS_AUTHORITY_ORIGIN,
        accessToken: tokens.accessToken,
        ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
        ...(tokens.expiresAt ? { expiresAt: tokens.expiresAt } : {}),
        scope: tokens.scope,
        email: identity.email,
        workspaceHost: identity.workspaceHost,
      },
    };
  } catch (error: unknown) {
    capture.close();
    throw error;
  }
}
