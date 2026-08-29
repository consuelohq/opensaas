import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { resolveConsueloHomeLayout } from './consuelo-home';
import {
  createDevicePublicKeyProof,
  type WorkspaceDeviceKeyPair,
} from './workspace-device-login-client';
import type { WorkspaceNodeHeartbeatConfig } from './workspace-node-heartbeat-client';

export const GITHUB_INSTALLATION_CONNECTION_PREFIX = 'github-installation:';

export type GitHubSourceControlClaim = {
  connectionId: string;
  accountLogin: string;
  repositorySelection: 'all' | 'selected';
  returnPath: string;
  repositories: Array<{
    id: number;
    nameWithOwner: string;
    defaultBranch: string;
  }>;
};

export type GitHubSourceControlToken = {
  token: string;
  expiresAt: string;
};

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`GitHub source control ${label} is required.`);
  }
  return value.trim();
}

function heartbeatConfig(home: string): WorkspaceNodeHeartbeatConfig {
  const layout = resolveConsueloHomeLayout(home);
  const configPath = path.join(
    layout.nodeDir,
    'security',
    'generated',
    'workspace-node-heartbeat.json',
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as unknown;
  } catch {
    throw new Error('This Consuelo node is not ready to connect GitHub.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('This Consuelo node is not ready to connect GitHub.');
  }
  const record = parsed as Record<string, unknown>;
  const authorityOrigin = requiredString(record.authorityOrigin, 'authority origin');
  const workspaceId = requiredString(record.workspaceId, 'workspace ID');
  const nodeId = requiredString(record.nodeId, 'node ID');
  const publicKeyJwk = requiredString(record.publicKeyJwk, 'public key');
  const signingKeyJwk = requiredString(record.signingKeyJwk, 'signing key');
  const authority = new URL(authorityOrigin);
  if (authority.protocol !== 'https:' && authority.hostname !== 'localhost') {
    throw new Error('GitHub source-control authority must use HTTPS.');
  }
  JSON.parse(publicKeyJwk);
  JSON.parse(signingKeyJwk);
  return {
    authorityOrigin: authority.origin,
    workspaceId,
    nodeId,
    connectorStatus: record.connectorStatus === 'disconnected' ? 'disconnected' : 'connected',
    capabilities: Array.isArray(record.capabilities)
      ? record.capabilities.filter((value): value is string => typeof value === 'string')
      : [],
    publicKeyJwk,
    signingKeyJwk,
  };
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

async function signedAuthorityPost(
  home: string,
  endpoint: string,
  fields: Record<string, unknown>,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<unknown> {
  const config = heartbeatConfig(home);
  const payload = JSON.stringify({
    workspaceId: config.workspaceId,
    nodeId: config.nodeId,
    timestamp: Date.now(),
    nonce: randomUUID(),
    ...fields,
  });
  const deviceKeyPair: WorkspaceDeviceKeyPair = {
    algorithm: 'Ed25519',
    publicKeyJwk: config.publicKeyJwk,
    signingKeyJwk: config.signingKeyJwk,
  };
  const signature = createDevicePublicKeyProof({ deviceKeyPair, payload });
  let response: Response;
  try {
    response = await fetchImpl(new Request(new URL(endpoint, config.authorityOrigin), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-consuelo-node-signature': signature,
      },
      body: payload,
    }));
  } catch {
    throw new Error('Consuelo could not reach the GitHub connection service.');
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error('The GitHub connection service returned an invalid response.');
  }
  if (!response.ok) {
    throw new Error(errorMessage(body, `GitHub connection failed with HTTP ${response.status}.`));
  }
  return body;
}

export function githubInstallationConnectionRef(connectionId: string): string {
  return `${GITHUB_INSTALLATION_CONNECTION_PREFIX}${requiredString(connectionId, 'connection ID')}`;
}

export function githubInstallationConnectionId(connectionRef: string): string | undefined {
  const value = connectionRef.trim();
  if (!value.startsWith(GITHUB_INSTALLATION_CONNECTION_PREFIX)) return undefined;
  const connectionId = value.slice(GITHUB_INSTALLATION_CONNECTION_PREFIX.length).trim();
  return connectionId || undefined;
}

export async function startGitHubSourceControlInstall(input: {
  home: string;
  returnPath: string;
  fetchImpl?: typeof fetch;
}): Promise<{ installUrl: string }> {
  try {
    const body = await signedAuthorityPost(
      input.home,
      '/workspace/source-control/github/install/start',
      { returnPath: input.returnPath },
      input.fetchImpl,
    );
    const installUrl = requiredString(
      body && typeof body === 'object' ? (body as Record<string, unknown>).installUrl : undefined,
      'installation URL',
    );
    const url = new URL(installUrl);
    if (url.origin !== 'https://github.com' || !url.pathname.startsWith('/apps/')) {
      throw new Error('The GitHub connection service returned an invalid installation URL.');
    }
    return { installUrl: url.toString() };
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('GitHub connection could not be started.');
  }
}

export async function claimGitHubSourceControlInstall(input: {
  home: string;
  handoff: string;
  fetchImpl?: typeof fetch;
}): Promise<GitHubSourceControlClaim> {
  try {
    const body = await signedAuthorityPost(
      input.home,
      '/workspace/source-control/github/install/claim',
      { handoff: requiredString(input.handoff, 'handoff') },
      input.fetchImpl,
    );
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('The GitHub connection service returned invalid repository metadata.');
    }
    const record = body as Record<string, unknown>;
    const rawRepositories = Array.isArray(record.repositories) ? record.repositories : [];
    const repositories = rawRepositories.map((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('The GitHub connection service returned invalid repository metadata.');
      }
      const repository = value as Record<string, unknown>;
      const id = typeof repository.id === 'number' ? repository.id : Number.NaN;
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error('The GitHub connection service returned invalid repository metadata.');
      }
      return {
        id,
        nameWithOwner: requiredString(repository.nameWithOwner, 'repository name'),
        defaultBranch: requiredString(repository.defaultBranch, 'default branch'),
      };
    });
    return {
      connectionId: requiredString(record.connectionId, 'connection ID'),
      accountLogin: requiredString(record.accountLogin, 'GitHub account'),
      repositorySelection: record.repositorySelection === 'all' ? 'all' : 'selected',
      returnPath: requiredString(record.returnPath, 'return path'),
      repositories,
    };
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('GitHub connection could not be completed.');
  }
}

export async function getGitHubSourceControlToken(input: {
  home: string;
  connectionId: string;
  fetchImpl?: typeof fetch;
}): Promise<GitHubSourceControlToken> {
  try {
    const body = await signedAuthorityPost(
      input.home,
      '/workspace/source-control/github/token',
      { connectionId: requiredString(input.connectionId, 'connection ID') },
      input.fetchImpl,
    );
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('The GitHub connection service returned an invalid credential.');
    }
    const record = body as Record<string, unknown>;
    const expiresAt = requiredString(record.expiresAt, 'credential expiry');
    if (!Number.isFinite(Date.parse(expiresAt))) {
      throw new Error('The GitHub connection service returned an invalid credential expiry.');
    }
    return {
      token: requiredString(record.token, 'credential'),
      expiresAt,
    };
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('GitHub source-control credential could not be loaded.');
  }
}
