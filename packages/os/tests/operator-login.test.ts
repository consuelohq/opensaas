import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  buildAuthorizeUrl,
  createPkcePair,
  exchangeAuthorizationCode,
  OPERATOR_CLIENT_ID,
  startLoopbackCapture,
} from '../scripts/lib/operator-login';

const AUTHORITY = 'https://os.consuelohq.com';
const RESOURCE = 'https://os.consuelohq.com/mcp';

const base64Url = (input: Buffer): string =>
  input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('operator login', () => {
  describe('PKCE', () => {
    it('derives an S256 challenge from the verifier', () => {
      const { verifier, challenge } = createPkcePair();
      expect(challenge).toBe(
        base64Url(createHash('sha256').update(verifier).digest()),
      );
    });

    it('is unpredictable between calls', () => {
      expect(createPkcePair().verifier).not.toBe(createPkcePair().verifier);
    });

    it('produces url-safe values with no padding', () => {
      const { verifier, challenge } = createPkcePair();
      for (const value of [verifier, challenge]) {
        expect(value).toMatch(/^[A-Za-z0-9_-]+$/);
      }
    });
  });

  describe('authorize url', () => {
    const url = new URL(
      buildAuthorizeUrl({
        authorityOrigin: AUTHORITY,
        redirectUri: 'http://127.0.0.1:8765/callback',
        challenge: 'challenge-value',
        state: 'state-value',
        resource: RESOURCE,
        scope: ['mcp:read', 'workspace:nodes:manage'],
      }),
    );

    it('targets the authorization endpoint with the operator client', () => {
      expect(url.pathname).toBe('/oauth/authorize');
      expect(url.searchParams.get('client_id')).toBe(OPERATOR_CLIENT_ID);
      expect(url.searchParams.get('response_type')).toBe('code');
    });

    it('requires S256 and never carries the verifier', () => {
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('code_challenge')).toBe('challenge-value');
      expect(url.searchParams.get('code_verifier')).toBeNull();
    });

    it('names the resource so the workspace resolves from the account', () => {
      expect(url.searchParams.get('resource')).toBe(RESOURCE);
    });
  });

  describe('loopback capture', () => {
    it('binds 127.0.0.1 on an ephemeral port', async () => {
      const capture = await startLoopbackCapture({ state: 's' });
      const url = new URL(capture.redirectUri);
      expect(url.hostname).toBe('127.0.0.1');
      expect(Number(url.port)).toBeGreaterThan(0);
      capture.close();
    });

    it('captures the code from a matching callback', async () => {
      const capture = await startLoopbackCapture({ state: 'good-state' });
      const pending = capture.waitForCode();
      await fetch(`${capture.redirectUri}?code=abc123&state=good-state`);
      await expect(pending).resolves.toBe('abc123');
    });

    it('rejects a callback whose state does not match', async () => {
      const capture = await startLoopbackCapture({ state: 'expected' });
      const pending = expect(capture.waitForCode()).rejects.toMatchObject({
        code: 'StateMismatch',
      });
      await fetch(`${capture.redirectUri}?code=abc123&state=forged`);
      await pending;
    });

    it('rejects a denied authorization', async () => {
      const capture = await startLoopbackCapture({ state: 's' });
      const pending = expect(capture.waitForCode()).rejects.toMatchObject({
        code: 'AuthorizationDenied',
      });
      await fetch(`${capture.redirectUri}?error=access_denied&state=s`);
      await pending;
    });

    it('rejects a callback carrying no code', async () => {
      const capture = await startLoopbackCapture({ state: 's' });
      const pending = expect(capture.waitForCode()).rejects.toMatchObject({
        code: 'AuthorizationDenied',
      });
      await fetch(`${capture.redirectUri}?state=s`);
      await pending;
    });

    it('times out rather than waiting forever', async () => {
      const capture = await startLoopbackCapture({ state: 's', timeoutMs: 20 });
      await expect(capture.waitForCode()).rejects.toMatchObject({
        code: 'TimedOut',
      });
    });
  });

  describe('token exchange', () => {
    const okResponse = () =>
      Response.json({
        access_token: 'tok_operator',
        refresh_token: 'ref_operator',
        expires_in: 3600,
        scope: 'mcp:read workspace:nodes:manage',
      });

    it('sends the verifier and returns the token', async () => {
      let body: URLSearchParams | undefined;
      const result = await exchangeAuthorizationCode({
        authorityOrigin: AUTHORITY,
        code: 'code-1',
        verifier: 'verifier-1',
        redirectUri: 'http://127.0.0.1:8765/callback',
        resource: RESOURCE,
        fetchImpl: async (_url, init) => {
          body = new URLSearchParams((init as RequestInit).body as string);
          return okResponse();
        },
      });

      expect(body?.get('code_verifier')).toBe('verifier-1');
      expect(body?.get('client_id')).toBe(OPERATOR_CLIENT_ID);
      expect(body?.get('grant_type')).toBe('authorization_code');
      expect(result).toMatchObject({
        accessToken: 'tok_operator',
        refreshToken: 'ref_operator',
        scope: ['mcp:read', 'workspace:nodes:manage'],
      });
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it('surfaces an OAuth error description without the request body', async () => {
      await expect(
        exchangeAuthorizationCode({
          authorityOrigin: AUTHORITY,
          code: 'code-1',
          verifier: 'secret-verifier',
          redirectUri: 'http://127.0.0.1:8765/callback',
          resource: RESOURCE,
          fetchImpl: async () =>
            Response.json(
              { error: 'invalid_grant', error_description: 'code expired' },
              { status: 400 },
            ),
        }),
      ).rejects.toMatchObject({
        code: 'TokenExchangeFailed',
        message: 'code expired',
      });
    });

    it('never echoes the verifier when the transport fails', async () => {
      try {
        await exchangeAuthorizationCode({
          authorityOrigin: AUTHORITY,
          code: 'code-1',
          verifier: 'secret-verifier',
          redirectUri: 'http://127.0.0.1:8765/callback',
          resource: RESOURCE,
          fetchImpl: async () => {
            throw new Error('ECONNREFUSED');
          },
        });
        throw new Error('expected failure');
      } catch (error: unknown) {
        expect((error as Error).message).not.toContain('secret-verifier');
        expect((error as Error).message).not.toContain('code-1');
      }
    });

    it('rejects a success response with no access token', async () => {
      await expect(
        exchangeAuthorizationCode({
          authorityOrigin: AUTHORITY,
          code: 'code-1',
          verifier: 'v',
          redirectUri: 'http://127.0.0.1:8765/callback',
          resource: RESOURCE,
          fetchImpl: async () => Response.json({ token_type: 'Bearer' }),
        }),
      ).rejects.toMatchObject({ code: 'TokenExchangeFailed' });
    });

    it('rejects a non-JSON response', async () => {
      await expect(
        exchangeAuthorizationCode({
          authorityOrigin: AUTHORITY,
          code: 'code-1',
          verifier: 'v',
          redirectUri: 'http://127.0.0.1:8765/callback',
          resource: RESOURCE,
          fetchImpl: async () => new Response('<html>edge error</html>'),
        }),
      ).rejects.toMatchObject({ code: 'TokenExchangeFailed' });
    });
  });
});
