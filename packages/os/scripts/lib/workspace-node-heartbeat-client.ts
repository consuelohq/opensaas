import { randomUUID } from 'node:crypto';

import {
  createDevicePublicKeyProof,
  type WorkspaceDeviceKeyPair,
} from './workspace-device-login-client';

export const WORKSPACE_NODE_HEARTBEAT_INTERVAL_SECONDS = 30;

export type WorkspaceNodeHeartbeatConfig = {
  authorityOrigin: string;
  workspaceId: string;
  nodeId: string;
  connectorStatus: 'connected' | 'disconnected';
  capabilities: string[];
  publicKeyJwk: string;
  signingKeyJwk: string;
};

export type WorkspaceNodeHeartbeatResult = {
  nodeId: string;
  presence: 'online' | 'stale' | 'offline';
};

export type WorkspaceNodeHeartbeatClient = {
  send: () => Promise<WorkspaceNodeHeartbeatResult>;
};

function requiredString(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`workspace node heartbeat ${label} is required`);
  return normalized;
}

function normalizeAuthorityOrigin(value: string): string {
  const origin = new URL(requiredString(value, 'authority origin'));
  if (origin.protocol !== 'https:' && origin.hostname !== 'localhost') {
    throw new Error('workspace node heartbeat authority origin must use HTTPS');
  }
  return origin.origin;
}

function normalizeConfig(
  config: WorkspaceNodeHeartbeatConfig,
): WorkspaceNodeHeartbeatConfig {
  const capabilities = [...new Set(config.capabilities)]
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 32)
    .sort();
  JSON.parse(requiredString(config.publicKeyJwk, 'public key'));
  JSON.parse(requiredString(config.signingKeyJwk, 'signing key'));
  return {
    authorityOrigin: normalizeAuthorityOrigin(config.authorityOrigin),
    workspaceId: requiredString(config.workspaceId, 'workspace ID'),
    nodeId: requiredString(config.nodeId, 'node ID'),
    connectorStatus: config.connectorStatus,
    capabilities,
    publicKeyJwk: config.publicKeyJwk,
    signingKeyJwk: config.signingKeyJwk,
  };
}

function safeHeartbeatResult(payload: unknown): WorkspaceNodeHeartbeatResult {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('workspace node heartbeat returned an invalid JSON response');
  }
  const nodeId = (payload as { nodeId?: unknown }).nodeId;
  const presence = (payload as { presence?: unknown }).presence;
  if (
    typeof nodeId !== 'string' ||
    !['online', 'stale', 'offline'].includes(String(presence))
  ) {
    throw new Error('workspace node heartbeat returned an invalid JSON response');
  }
  return {
    nodeId,
    presence: presence as WorkspaceNodeHeartbeatResult['presence'],
  };
}

export function createWorkspaceNodeHeartbeatClient(input: {
  config: WorkspaceNodeHeartbeatConfig;
  fetchImpl?: typeof fetch;
  now?: () => number;
  createNonce?: () => string;
}): WorkspaceNodeHeartbeatClient {
  const config = normalizeConfig(input.config);
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  const now = input.now ?? Date.now;
  const createNonce = input.createNonce ?? randomUUID;
  const deviceKeyPair: WorkspaceDeviceKeyPair = {
    algorithm: 'Ed25519',
    publicKeyJwk: config.publicKeyJwk,
    signingKeyJwk: config.signingKeyJwk,
  };

  return {
    async send(): Promise<WorkspaceNodeHeartbeatResult> {
      const payload = JSON.stringify({
        workspaceId: config.workspaceId,
        nodeId: config.nodeId,
        timestamp: now(),
        nonce: requiredString(createNonce(), 'nonce'),
        connectorStatus: config.connectorStatus,
        capabilities: config.capabilities,
      });
      const signature = createDevicePublicKeyProof({ deviceKeyPair, payload });
      let response: Response;
      try {
        response = await fetchImpl(
          new Request(
            new URL('/workspace/nodes/heartbeat', config.authorityOrigin),
            {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                accept: 'application/json',
                'x-consuelo-node-signature': signature,
              },
              body: payload,
            },
          ),
        );
      } catch (error: unknown) {
        throw new Error('workspace node heartbeat request failed', {
          cause: error,
        });
      }
      if (!response.ok) {
        throw new Error(
          `workspace node heartbeat failed with HTTP ${response.status}`,
        );
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch (error: unknown) {
        throw new Error('workspace node heartbeat returned invalid JSON', {
          cause: error,
        });
      }
      return safeHeartbeatResult(body);
    },
  };
}
