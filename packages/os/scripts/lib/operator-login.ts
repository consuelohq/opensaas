import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';

/**
 * Operator login: the authorization-code + PKCE flow for the CLI.
 *
 * Before this, the authorization server accepted only ChatGPT, so nothing could mint a workspace
 * token and `workspace:nodes` documented a credential no flow could issue. Node management was only
 * possible by editing the route registry by hand.
 *
 * The redirect is a loopback listener bound to 127.0.0.1 on an ephemeral port. The authorization
 * server independently requires a literal loopback host, so a code cannot be delivered off this
 * machine even if the redirect were tampered with.
 */

export const OPERATOR_CLIENT_ID = 'consuelo-os-operator-cli';

/** Long enough that a slow browser consent does not strand the listener, short enough to matter. */
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export type OperatorLoginResult = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope: string[];
};

export type OperatorLoginErrorCode =
  | 'InvalidInput'
  | 'ListenerFailed'
  | 'StateMismatch'
  | 'AuthorizationDenied'
  | 'TokenExchangeFailed'
  | 'TimedOut';

export class OperatorLoginFailure extends Error {
  readonly _tag = 'OperatorLoginError' as const;
  readonly code: OperatorLoginErrorCode;

  constructor(code: OperatorLoginErrorCode, message: string) {
    super(message);
    this.name = 'OperatorLoginFailure';
    this.code = code;
  }
}

const base64Url = (input: Buffer): string =>
  input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** RFC 7636 S256. The verifier never leaves this process; only its hash is sent to authorize. */
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function buildAuthorizeUrl(input: {
  authorityOrigin: string;
  redirectUri: string;
  challenge: string;
  state: string;
  resource: string;
  scope: readonly string[];
}): string {
  const url = new URL('/oauth/authorize', input.authorityOrigin);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', OPERATOR_CLIENT_ID);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('code_challenge', input.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', input.state);
  url.searchParams.set('resource', input.resource);
  url.searchParams.set('scope', input.scope.join(' '));
  return url.toString();
}

export type LoopbackCapture = {
  redirectUri: string;
  /** Resolves with the authorization code once the browser is redirected back. */
  waitForCode: () => Promise<string>;
  close: () => void;
};

/**
 * Binds a one-shot loopback listener. It answers exactly one request and then stops accepting, so a
 * stale listener cannot linger holding a port or accept a second, unrelated code.
 */
export async function startLoopbackCapture(input: {
  state: string;
  timeoutMs?: number;
}): Promise<LoopbackCapture> {
  const state = input.state;
  let resolveCode: (code: string) => void;
  let rejectCode: (error: Error) => void;
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const respond = (status: number, message: string): void => {
      response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(message);
    };

    const error = url.searchParams.get('error');
    if (error) {
      respond(400, 'Authorization was denied. You can close this tab.');
      rejectCode(
        new OperatorLoginFailure(
          'AuthorizationDenied',
          `authorization was denied: ${error}`,
        ),
      );
      return;
    }

    // Compared before the code is read, so a mismatched callback never yields a usable code.
    if (url.searchParams.get('state') !== state) {
      respond(400, 'State mismatch. You can close this tab.');
      rejectCode(
        new OperatorLoginFailure(
          'StateMismatch',
          'authorization state did not match the request',
        ),
      );
      return;
    }

    const code = url.searchParams.get('code');
    if (!code) {
      respond(400, 'No authorization code. You can close this tab.');
      rejectCode(
        new OperatorLoginFailure(
          'AuthorizationDenied',
          'authorization response carried no code',
        ),
      );
      return;
    }

    respond(200, 'Consuelo OS is signed in. You can close this tab.');
    resolveCode(code);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', (error: Error) =>
      reject(new OperatorLoginFailure('ListenerFailed', error.message)),
    );
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address() as AddressInfo | null;
  if (!address || typeof address === 'string') {
    server.close();
    throw new OperatorLoginFailure(
      'ListenerFailed',
      'loopback listener did not report a port',
    );
  }

  const timeout = setTimeout(() => {
    rejectCode(
      new OperatorLoginFailure('TimedOut', 'authorization timed out'),
    );
  }, input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  // Do not hold the process open purely for the timer.
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

export async function exchangeAuthorizationCode(input: {
  authorityOrigin: string;
  code: string;
  verifier: string;
  redirectUri: string;
  resource: string;
  fetchImpl?: typeof fetch;
}): Promise<OperatorLoginResult> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    client_id: OPERATOR_CLIENT_ID,
    code_verifier: input.verifier,
    redirect_uri: input.redirectUri,
    resource: input.resource,
  });

  return exchangeOperatorToken({
    authorityOrigin: input.authorityOrigin,
    body,
    fetchImpl: input.fetchImpl,
  });
}

export async function exchangeRefreshToken(input: {
  authorityOrigin: string;
  refreshToken: string;
  resource: string;
  fetchImpl?: typeof fetch;
}): Promise<OperatorLoginResult> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: OPERATOR_CLIENT_ID,
    refresh_token: input.refreshToken,
    resource: input.resource,
  });

  return exchangeOperatorToken({
    authorityOrigin: input.authorityOrigin,
    body,
    fetchImpl: input.fetchImpl,
  });
}

async function exchangeOperatorToken(input: {
  authorityOrigin: string;
  body: URLSearchParams;
  fetchImpl?: typeof fetch;
}): Promise<OperatorLoginResult> {

  let response: Response;
  try {
    response = await (input.fetchImpl ?? globalThis.fetch)(
      new URL('/oauth/token', input.authorityOrigin),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: input.body,
      },
    );
  } catch (error: unknown) {
    // The body carries the code and verifier, so report only the transport failure.
    throw new OperatorLoginFailure(
      'TokenExchangeFailed',
      `token endpoint is unreachable: ${error instanceof Error ? error.message : 'network error'}`,
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch (_error: unknown) {
    throw new OperatorLoginFailure(
      'TokenExchangeFailed',
      `token endpoint returned a non-JSON response (HTTP ${response.status})`,
    );
  }

  if (!response.ok) {
    const description =
      typeof payload.error_description === 'string'
        ? payload.error_description
        : typeof payload.error === 'string'
          ? payload.error
          : `HTTP ${response.status}`;
    throw new OperatorLoginFailure('TokenExchangeFailed', description);
  }

  const accessToken = payload.access_token;
  if (typeof accessToken !== 'string' || accessToken === '') {
    throw new OperatorLoginFailure(
      'TokenExchangeFailed',
      'token endpoint returned no access token',
    );
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
      typeof payload.scope === 'string' && payload.scope.trim() !== ''
        ? payload.scope.trim().split(/\s+/)
        : [],
  };
}
