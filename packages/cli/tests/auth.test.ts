import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  authenticateHosted,
  applyHostedAuthResult,
  buildOsAuthorizeUrl,
  createPkcePair,
  exchangeOsAuthorizationCode,
  OS_AUTHORITY_ORIGIN,
  OS_OPERATOR_CLIENT_ID,
  resolveOsIdentity,
  startLoopbackCapture,
  type AuthResult,
} from '../src/auth';

const RESOURCE = `${OS_AUTHORITY_ORIGIN}/mcp`;

const base64Url = (input: Buffer): string =>
  input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const authResult = (): AuthResult => ({
  email: 'ko@consuelohq.com',
  workspaceId: 'ws_consuelohq',
  workspaceHost: 'internal.consuelohq.com',
  osAuth: {
    authorityOrigin: OS_AUTHORITY_ORIGIN,
    accessToken: 'coa_access',
    refreshToken: 'cor_refresh',
    expiresAt: 1_800_000_000_000,
    scope: ['workspace:read', 'workspace:nodes:manage'],
    email: 'ko@consuelohq.com',
    workspaceHost: 'internal.consuelohq.com',
  },
});

describe('Consuelo CLI OS authentication', () => {
  it('builds the operator authorization request against Consuelo OS with PKCE', () => {
    const url = new URL(
      buildOsAuthorizeUrl({
        redirectUri: 'http://127.0.0.1:49152/callback',
        state: 'state-1',
        challenge: 'challenge-1',
      }),
    );

    expect(url.origin).toBe(OS_AUTHORITY_ORIGIN);
    expect(url.pathname).toBe('/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe(OS_OPERATOR_CLIENT_ID);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://127.0.0.1:49152/callback',
    );
    expect(url.searchParams.get('resource')).toBe(RESOURCE);
    expect(url.searchParams.get('scope')).toContain('workspace:read');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-1');
    expect(url.searchParams.has('code_verifier')).toBe(false);
    expect(url.toString()).not.toContain('app.consuelohq.com');
  });

  it('derives an S256 PKCE challenge without exposing the verifier', () => {
    const { verifier, challenge } = createPkcePair();
    expect(challenge).toBe(
      base64Url(createHash('sha256').update(verifier).digest()),
    );
    expect(challenge).not.toBe(verifier);
  });

  it('validates callback state before yielding an authorization code', async () => {
    const capture = await startLoopbackCapture({ state: 'expected' });
    const pending = expect(capture.waitForCode()).rejects.toThrow(
      'authorization state did not match the request',
    );

    await fetch(`${capture.redirectUri}?code=code-1&state=forged`);
    await pending;
  });

  it('exchanges the authorization code at the OS token endpoint', async () => {
    let target = '';
    let body: URLSearchParams | undefined;
    const result = await exchangeOsAuthorizationCode({
      code: 'code-1',
      verifier: 'verifier-1',
      redirectUri: 'http://127.0.0.1:49152/callback',
      fetchImpl: async (url, init) => {
        target = String(url);
        body = new URLSearchParams(String(init?.body ?? ''));
        return Response.json({
          access_token: 'coa_access',
          refresh_token: 'cor_refresh',
          expires_in: 3600,
          scope: 'workspace:read workspace:nodes:manage',
        });
      },
    });

    expect(target).toBe(`${OS_AUTHORITY_ORIGIN}/oauth/token`);
    expect(body?.get('grant_type')).toBe('authorization_code');
    expect(body?.get('client_id')).toBe(OS_OPERATOR_CLIENT_ID);
    expect(body?.get('code_verifier')).toBe('verifier-1');
    expect(body?.get('resource')).toBe(RESOURCE);
    expect(result).toMatchObject({
      accessToken: 'coa_access',
      refreshToken: 'cor_refresh',
      scope: ['workspace:read', 'workspace:nodes:manage'],
    });
  });

  it('resolves email and canonical workspace identity from OS', async () => {
    const seen: string[] = [];
    const identity = await resolveOsIdentity({
      accessToken: 'coa_access',
      fetchImpl: async (url, init) => {
        const target = String(url);
        seen.push(target);
        if (target.endsWith('/oauth/introspect')) {
          expect(init?.method).toBe('POST');
          return Response.json({
            active: true,
            username: 'ko@consuelohq.com',
            workspace_host: 'internal.consuelohq.com',
          });
        }
        expect(init?.headers).toMatchObject({
          Authorization: 'Bearer coa_access',
        });
        return Response.json({
          workspaceId: 'ws_consuelohq',
          workspaceHost: 'internal.consuelohq.com',
          nodes: [],
        });
      },
    });

    expect(seen).toEqual([
      `${OS_AUTHORITY_ORIGIN}/oauth/introspect`,
      `${OS_AUTHORITY_ORIGIN}/workspace/nodes`,
    ]);
    expect(identity).toEqual({
      email: 'ko@consuelohq.com',
      workspaceId: 'ws_consuelohq',
      workspaceHost: 'internal.consuelohq.com',
    });
  });

  it('stores OS credentials separately and never substitutes them for a legacy API key', () => {
    const next = applyHostedAuthResult(
      {
        apiKey: 'legacy-twenty-key',
        apiUrl: 'https://legacy.example.test',
      },
      authResult(),
      { managed: true },
    );

    expect(next.apiKey).toBe('legacy-twenty-key');
    expect(next.apiKey).not.toBe('coa_access');
    expect(next.osAuth?.accessToken).toBe('coa_access');
    expect(next.osAuth?.refreshToken).toBe('cor_refresh');
    expect(next.workspaceId).toBe('ws_consuelohq');
    expect(next.managed).toBe(true);
  });

  it('does not invent a legacy API key for a fresh OS-authenticated config', () => {
    const next = applyHostedAuthResult({}, authResult());
    expect(next.apiKey).toBeUndefined();
    expect(next.osAuth?.accessToken).toBe('coa_access');
  });

  it('completes the browser callback, token exchange, and workspace handoff end to end', async () => {
    const result = await authenticateHosted({
      openImpl: async (authUrl) => {
        const authorize = new URL(authUrl);
        expect(authorize.origin).toBe(OS_AUTHORITY_ORIGIN);
        const redirectUri = authorize.searchParams.get('redirect_uri');
        const state = authorize.searchParams.get('state');
        if (!redirectUri || !state) throw new Error('missing callback binding');
        queueMicrotask(() => {
          void fetch(`${redirectUri}?code=code-1&state=${state}`);
        });
      },
      fetchImpl: async (url) => {
        const target = String(url);
        if (target.endsWith('/oauth/token')) {
          return Response.json({
            access_token: 'coa_access',
            refresh_token: 'cor_refresh',
            expires_in: 3600,
            scope: 'workspace:read workspace:nodes:manage',
          });
        }
        if (target.endsWith('/oauth/introspect')) {
          return Response.json({
            active: true,
            username: 'ko@consuelohq.com',
            workspace_host: 'internal.consuelohq.com',
          });
        }
        if (target.endsWith('/workspace/nodes')) {
          return Response.json({
            workspaceId: 'ws_consuelohq',
            workspaceHost: 'internal.consuelohq.com',
            nodes: [],
          });
        }
        throw new Error(`unexpected request: ${target}`);
      },
    });

    expect(result).toMatchObject({
      email: 'ko@consuelohq.com',
      workspaceId: 'ws_consuelohq',
      workspaceHost: 'internal.consuelohq.com',
      osAuth: {
        accessToken: 'coa_access',
        refreshToken: 'cor_refresh',
      },
    });
    expect('apiKey' in result).toBe(false);
  });
});
