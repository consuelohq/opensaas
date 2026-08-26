import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { Effect } from 'effect';

import { createNodeProviderProcess } from '../../tools/deployment-provider/process';
import type { ProviderProcess } from '../../tools/deployment-provider/types';
import { resolveConsueloHomeLayout } from './consuelo-home';
import {
  createDevicePublicKeyProof,
  type WorkspaceDeviceKeyPair,
} from './workspace-device-login-client';

type GoogleWorkspaceNodeContext = {
  authorityOrigin: string;
  workspaceId: string;
  nodeId: string;
  accountEmail?: string;
  publicKeyJwk: string;
  signingKeyJwk: string;
};

type GoogleWorkspaceOAuthCredentials = {
  installed: {
    client_id: string;
    client_secret: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    redirect_uris: string[];
  };
};

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Google Workspace ${label} is required.`);
  }
  return value.trim();
}

export function readGoogleWorkspaceNodeContext(home: string): GoogleWorkspaceNodeContext {
  const layout = resolveConsueloHomeLayout(home);
  const configPath = path.join(layout.nodeDir, 'security', 'generated', 'workspace-node-heartbeat.json');
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as unknown;
  } catch {
    throw new Error('This Consuelo node is not ready to connect Google.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('This Consuelo node is not ready to connect Google.');
  }
  const record = parsed as Record<string, unknown>;
  const authority = new URL(requiredString(record.authorityOrigin, 'authority origin'));
  if (authority.protocol !== 'https:' && authority.hostname !== 'localhost') {
    throw new Error('Google Workspace authority must use HTTPS.');
  }
  const publicKeyJwk = requiredString(record.publicKeyJwk, 'public key');
  const signingKeyJwk = requiredString(record.signingKeyJwk, 'signing key');
  JSON.parse(publicKeyJwk);
  JSON.parse(signingKeyJwk);
  const accountEmail = typeof record.accountEmail === 'string' && record.accountEmail.trim()
    ? record.accountEmail.trim()
    : undefined;
  return {
    authorityOrigin: authority.origin,
    workspaceId: requiredString(record.workspaceId, 'workspace ID'),
    nodeId: requiredString(record.nodeId, 'node ID'),
    ...(accountEmail ? { accountEmail } : {}),
    publicKeyJwk,
    signingKeyJwk,
  };
}

export function googleWorkspaceAccount(home: string): string | undefined {
  return readGoogleWorkspaceNodeContext(home).accountEmail;
}

function errorMessage(value: unknown, fallback: string): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const error = (value as Record<string, unknown>).error;
  if (error && typeof error === 'object' && !Array.isArray(error)) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  return fallback;
}

export async function fetchGoogleWorkspaceOAuthCredentials(input: {
  home: string;
  fetchImpl?: typeof fetch;
}): Promise<GoogleWorkspaceOAuthCredentials> {
  const config = readGoogleWorkspaceNodeContext(input.home);
  const payload = JSON.stringify({
    workspaceId: config.workspaceId,
    nodeId: config.nodeId,
    timestamp: Date.now(),
    nonce: randomUUID(),
  });
  const deviceKeyPair: WorkspaceDeviceKeyPair = {
    algorithm: 'Ed25519',
    publicKeyJwk: config.publicKeyJwk,
    signingKeyJwk: config.signingKeyJwk,
  };
  const signature = createDevicePublicKeyProof({ deviceKeyPair, payload });
  let response: Response;
  try {
    response = await (input.fetchImpl ?? globalThis.fetch)(new Request(
      new URL('/workspace/google/oauth-client', config.authorityOrigin),
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-consuelo-node-signature': signature,
        },
        body: payload,
      },
    ));
  } catch {
    throw new Error('Consuelo could not reach the Google connection service.');
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error('The Google connection service returned an invalid response.');
  }
  if (!response.ok) {
    throw new Error(errorMessage(body, `Google connection failed with HTTP ${response.status}.`));
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('The Google connection service returned invalid OAuth credentials.');
  }
  const credentials = (body as Record<string, unknown>).credentials;
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
    throw new Error('The Google connection service returned invalid OAuth credentials.');
  }
  const installed = (credentials as Record<string, unknown>).installed;
  if (!installed || typeof installed !== 'object' || Array.isArray(installed)) {
    throw new Error('The Google connection service returned invalid OAuth credentials.');
  }
  const record = installed as Record<string, unknown>;
  return {
    installed: {
      client_id: requiredString(record.client_id, 'OAuth client ID'),
      client_secret: requiredString(record.client_secret, 'OAuth client secret'),
      auth_uri: requiredString(record.auth_uri, 'OAuth authorization URI'),
      token_uri: requiredString(record.token_uri, 'OAuth token URI'),
      auth_provider_x509_cert_url: requiredString(record.auth_provider_x509_cert_url, 'OAuth certificate URI'),
      redirect_uris: Array.isArray(record.redirect_uris)
        ? record.redirect_uris.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
        : [],
    },
  };
}

async function credentialsConfigured(processRunner: ProviderProcess, executable: string): Promise<boolean> {
  const result = await processRunner.run({
    command: executable,
    args: ['--json', '--no-input', 'auth', 'status'],
    cwd: process.cwd(),
    env: process.env,
    timeoutMs: 30_000,
  }).pipe(Effect.runPromise);
  if (result.exitCode !== 0) return false;
  try {
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    const account = parsed.account;
    return Boolean(
      account
      && typeof account === 'object'
      && !Array.isArray(account)
      && (account as Record<string, unknown>).credentials_exists === true,
    );
  } catch {
    return false;
  }
}

export async function ensureGoogleWorkspaceOAuthCredentials(input: {
  home: string;
  executable: string;
  process?: ProviderProcess;
  fetchImpl?: typeof fetch;
}): Promise<{ changed: boolean }> {
  try {
    const processRunner = input.process ?? createNodeProviderProcess();
    if (await credentialsConfigured(processRunner, input.executable)) return { changed: false };
    const credentials = await fetchGoogleWorkspaceOAuthCredentials({
      home: input.home,
      fetchImpl: input.fetchImpl,
    });
    const result = await processRunner.run({
      command: input.executable,
      args: ['--json', '--no-input', 'auth', 'credentials', 'set', '-'],
      cwd: process.cwd(),
      env: process.env,
      stdin: JSON.stringify(credentials),
      timeoutMs: 30_000,
    }).pipe(Effect.runPromise);
    if (result.exitCode !== 0 || result.runtimeMissing || result.timedOut || result.cancelled) {
      throw new Error('Google OAuth client configuration failed.');
    }
    return { changed: true };
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('Google OAuth client configuration failed.');
  }
}
