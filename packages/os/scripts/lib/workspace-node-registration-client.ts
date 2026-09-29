import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { resolveConsueloHomeLayout } from './consuelo-home';
import {
  createDevicePublicKeyProof,
  type WorkspaceDeviceKeyPair,
} from './workspace-device-login-client';

type WorkspaceNodeRegistrationConfig = {
  authorityOrigin: string;
  workspaceId: string;
  nodeId: string;
  publicKeyJwk: string;
  signingKeyJwk: string;
};

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Consuelo node registration ${label} is required.`);
  }
  return value.trim();
}

function readRegistrationConfig(home: string): WorkspaceNodeRegistrationConfig | undefined {
  const layout = resolveConsueloHomeLayout(home);
  const configPath = path.join(
    layout.nodeDir,
    'security',
    'generated',
    'workspace-node-heartbeat.json',
  );
  if (!fs.existsSync(configPath)) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as unknown;
  } catch {
    throw new Error('Consuelo node registration metadata is invalid.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Consuelo node registration metadata is invalid.');
  }

  const record = parsed as Record<string, unknown>;
  const authorityOrigin = requiredString(record.authorityOrigin, 'authority origin');
  const authority = new URL(authorityOrigin);
  if (authority.protocol !== 'https:' && authority.hostname !== 'localhost') {
    throw new Error('Consuelo node registration authority must use HTTPS.');
  }

  const publicKeyJwk = requiredString(record.publicKeyJwk, 'public key');
  const signingKeyJwk = requiredString(record.signingKeyJwk, 'signing key');
  try {
    JSON.parse(publicKeyJwk);
    JSON.parse(signingKeyJwk);
  } catch {
    throw new Error('Consuelo node registration key material is invalid.');
  }

  return {
    authorityOrigin: authority.origin,
    workspaceId: requiredString(record.workspaceId, 'workspace ID'),
    nodeId: requiredString(record.nodeId, 'node ID'),
    publicKeyJwk,
    signingKeyJwk,
  };
}

export async function revokeCurrentWorkspaceNode(input: {
  home: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  createNonce?: () => string;
}): Promise<'revoked' | 'not-enrolled'> {
  const config = readRegistrationConfig(input.home);
  if (!config) return 'not-enrolled';

  const payload = JSON.stringify({
    workspaceId: config.workspaceId,
    nodeId: config.nodeId,
    timestamp: (input.now ?? Date.now)(),
    nonce: (input.createNonce ?? randomUUID)(),
  });
  const deviceKeyPair: WorkspaceDeviceKeyPair = {
    algorithm: 'Ed25519',
    publicKeyJwk: config.publicKeyJwk,
    signingKeyJwk: config.signingKeyJwk,
  };
  const signature = createDevicePublicKeyProof({ deviceKeyPair, payload });
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;

  let response: Response;
  try {
    response = await fetchImpl(
      new Request(new URL('/workspace/nodes/self/revoke', config.authorityOrigin), {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-consuelo-node-signature': signature,
        },
        body: payload,
        signal: AbortSignal.timeout(10_000),
      }),
    );
  } catch (error: unknown) {
    throw new Error('Consuelo could not reach the workspace authority to remove this node.', {
      cause: error,
    });
  }

  if (!response.ok) {
    throw new Error(`Consuelo workspace node removal failed with HTTP ${response.status}.`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error: unknown) {
    throw new Error('Consuelo workspace node removal returned an invalid response.', {
      cause: error,
    });
  }

  const node =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).node
      : undefined;
  const nodeRecord =
    node && typeof node === 'object' && !Array.isArray(node)
      ? (node as Record<string, unknown>)
      : undefined;
  if (nodeRecord?.nodeId !== config.nodeId || nodeRecord.state !== 'revoked') {
    throw new Error('Consuelo workspace node removal was not confirmed.');
  }

  return 'revoked';
}
