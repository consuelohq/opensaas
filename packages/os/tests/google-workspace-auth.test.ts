import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ensureGoogleWorkspaceOAuthCredentials,
  fetchGoogleWorkspaceOAuthCredentials,
  googleWorkspaceAccount,
} from '../scripts/lib/google-workspace-auth';
import { resolveConsueloHomeLayout } from '../scripts/lib/consuelo-home';
import { generateWorkspaceDeviceKeyPair } from '../scripts/lib/workspace-device-login-client';
import type { ProviderProcess, ProviderProcessRequest } from '../tools/deployment-provider/types';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixtureHome(options: { accountEmail?: string | null } = {}): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-google-auth-'));
  roots.push(home);
  const layout = resolveConsueloHomeLayout(home);
  const pair = generateWorkspaceDeviceKeyPair();
  const accountEmail = options.accountEmail === undefined ? 'person@example.com' : options.accountEmail;
  const configPath = path.join(layout.nodeDir, 'security', 'generated', 'workspace-node-heartbeat.json');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({
    authorityOrigin: 'https://os.consuelohq.com',
    workspaceId: 'ws_123',
    nodeId: 'node_123',
    ...(accountEmail ? { accountEmail } : {}),
    publicKeyJwk: pair.publicKeyJwk,
    signingKeyJwk: pair.signingKeyJwk,
  }));
  return home;
}

const credentials = {
  installed: {
    client_id: 'client.apps.googleusercontent.com',
    client_secret: 'client-secret',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    redirect_uris: ['http://localhost'],
  },
};

describe('Google Workspace OAuth bootstrap', () => {
  it('reuses the verified install account without asking again', () => {
    expect(googleWorkspaceAccount(fixtureHome())).toBe('person@example.com');
  });

  it('fetches OAuth client credentials with the enrolled node signature', async () => {
    const home = fixtureHome();
    let captured: Request | undefined;
    const result = await fetchGoogleWorkspaceOAuthCredentials({
      home,
      fetchImpl: async (request) => {
        captured = request instanceof Request ? request : new Request(request);
        return new Response(JSON.stringify({ credentials }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    expect(result).toEqual(credentials);
    expect(captured?.url).toBe('https://os.consuelohq.com/workspace/google/oauth-client');
    expect(captured?.headers.get('x-consuelo-node-signature')).toMatch(/\S+/);
    const body = JSON.parse(await captured!.clone().text()) as Record<string, unknown>;
    expect(body).toMatchObject({ workspaceId: 'ws_123', nodeId: 'node_123' });
    expect(typeof body.timestamp).toBe('number');
    expect(typeof body.nonce).toBe('string');
  });

  it('backfills the verified account for an upgraded node before first use', async () => {
    const home = fixtureHome({ accountEmail: null });
    let fetchCount = 0;
    const processRunner: ProviderProcess = {
      execPath: process.execPath,
      run: () => Effect.succeed({
        stdout: JSON.stringify({ account: { credentials_exists: true } }),
        stderr: '',
        exitCode: 0,
        timedOut: false,
        cancelled: false,
        runtimeMissing: false,
        stdoutTruncated: false,
        stderrTruncated: false,
      }),
    };

    const result = await ensureGoogleWorkspaceOAuthCredentials({
      home,
      executable: '/managed/gog',
      process: processRunner,
      fetchImpl: async () => {
        fetchCount += 1;
        return Response.json({ credentials, accountEmail: 'verified@example.com' });
      },
    });

    expect(result.changed).toBe(false);
    expect(fetchCount).toBe(1);
    expect(googleWorkspaceAccount(home)).toBe('verified@example.com');
  });

  it('pipes the client secret over stdin instead of argv and stores it once', async () => {
    const home = fixtureHome();
    const calls: ProviderProcessRequest[] = [];
    const processRunner: ProviderProcess = {
      execPath: process.execPath,
      run: (request) => {
        calls.push(request);
        const isStatus = request.args.includes('status');
        return Effect.succeed({
          stdout: isStatus ? JSON.stringify({ account: { credentials_exists: false } }) : JSON.stringify({ stored: true }),
          stderr: '',
          exitCode: 0,
          timedOut: false,
          cancelled: false,
          runtimeMissing: false,
          stdoutTruncated: false,
          stderrTruncated: false,
        });
      },
    };
    const result = await ensureGoogleWorkspaceOAuthCredentials({
      home,
      executable: '/managed/gog',
      process: processRunner,
      fetchImpl: async () => new Response(JSON.stringify({ credentials }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    });
    expect(result.changed).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.args).toEqual(['--json', '--no-input', 'auth', 'credentials', 'set', '-']);
    expect(calls[1]?.args.join(' ')).not.toContain('client-secret');
    expect(calls[1]?.stdin).toContain('client-secret');
  });
});
