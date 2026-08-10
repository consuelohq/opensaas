import { randomUUID } from 'node:crypto';

import type { AgentName } from './local-agent-connectivity';

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
  /**
   * Public half of the node's credential-encryption key.
   *
   * Published so a setup surface can seal a credential to this node without the control plane
   * being able to open it. Without this the remote ceremony requires hand-carrying the key file
   * between machines, which is not a product. Optional because a node installed before the key
   * existed has none until its next release activation.
   */
  encryptionPublicKeyJwk?: string;
};

export type WorkspaceNodeHeartbeatResult = {
  nodeId: string;
  presence: 'online' | 'stale' | 'offline';
  connectorId?: string;
  edgeRequestSigningSecret?: string;
};

export type WorkspaceNodeHeartbeatClient = {
  send: () => Promise<WorkspaceNodeHeartbeatResult>;
};

const KNOWN_AGENT_NAMES = new Set<AgentName>([
  'claude',
  'codex',
  'cursor',
  'factory',
  'gemini',
  'opencode',
  'pi',
]);

function normalizeAgentNames(
  value: readonly AgentName[] | undefined,
): AgentName[] | undefined {
  if (value === undefined) return undefined;
  const names: AgentName[] = [];
  for (const candidate of value) {
    if (!KNOWN_AGENT_NAMES.has(candidate)) {
      throw new Error(
        'workspace node heartbeat agents must contain only known agent identifiers',
      );
    }
    names.push(candidate);
  }
  return [...new Set(names)].sort();
}

function requiredString(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized)
    throw new Error(`workspace node heartbeat ${label} is required`);
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
  const capabilities = [
    ...new Set(
      config.capabilities.map((value) => value.trim()).filter(Boolean),
    ),
  ].sort();
  if (capabilities.length > 32) {
    throw new Error(
      'workspace node heartbeat capabilities may contain at most 32 unique values',
    );
  }
  JSON.parse(requiredString(config.publicKeyJwk, 'public key'));
  JSON.parse(requiredString(config.signingKeyJwk, 'signing key'));
  if (
    config.connectorStatus !== 'connected' &&
    config.connectorStatus !== 'disconnected'
  ) {
    throw new Error(
      'workspace node heartbeat connector status must be connected or disconnected',
    );
  }
  return {
    authorityOrigin: normalizeAuthorityOrigin(config.authorityOrigin),
    workspaceId: requiredString(config.workspaceId, 'workspace ID'),
    nodeId: requiredString(config.nodeId, 'node ID'),
    connectorStatus: config.connectorStatus,
    capabilities,
    publicKeyJwk: config.publicKeyJwk,
    signingKeyJwk: config.signingKeyJwk,
    ...(typeof config.encryptionPublicKeyJwk === 'string' &&
    config.encryptionPublicKeyJwk.trim() !== ''
      ? { encryptionPublicKeyJwk: config.encryptionPublicKeyJwk.trim() }
      : {}),
  };
}

function safeHeartbeatResult(payload: unknown): WorkspaceNodeHeartbeatResult {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(
      'workspace node heartbeat returned an invalid JSON response',
    );
  }
  const nodeId = (payload as { nodeId?: unknown }).nodeId;
  const presence = (payload as { presence?: unknown }).presence;
  const connectorId = (payload as { connectorId?: unknown }).connectorId;
  const edgeRequestSigningSecret = (
    payload as { edgeRequestSigningSecret?: unknown }
  ).edgeRequestSigningSecret;
  if (
    typeof nodeId !== 'string' ||
    !['online', 'stale', 'offline'].includes(String(presence))
  ) {
    throw new Error(
      'workspace node heartbeat returned an invalid JSON response',
    );
  }
  const hasConnector = typeof connectorId === 'string' && connectorId.trim() !== '';
  const hasSecret =
    typeof edgeRequestSigningSecret === 'string' &&
    edgeRequestSigningSecret.trim() !== '';
  if (hasConnector !== hasSecret) {
    throw new Error('workspace node heartbeat returned incomplete edge authentication metadata');
  }
  return {
    nodeId,
    presence: presence as WorkspaceNodeHeartbeatResult['presence'],
    ...(hasConnector && hasSecret
      ? {
          connectorId: connectorId.trim(),
          edgeRequestSigningSecret: edgeRequestSigningSecret.trim(),
        }
      : {}),
  };
}

export function createWorkspaceNodeHeartbeatClient(input: {
  config: WorkspaceNodeHeartbeatConfig;
  agents?: readonly AgentName[];
  fetchImpl?: typeof fetch;
  now?: () => number;
  createNonce?: () => string;
}): WorkspaceNodeHeartbeatClient {
  const config = normalizeConfig(input.config);
  const agents = normalizeAgentNames(input.agents);
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
        // Inside the signed payload, so the authority can trust the key it is asked to publish.
        ...(config.encryptionPublicKeyJwk
          ? { encryptionPublicKeyJwk: config.encryptionPublicKeyJwk }
          : {}),
        ...(agents === undefined ? {} : { agents }),
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
      const result = safeHeartbeatResult(body);
      if (result.nodeId !== config.nodeId) {
        throw new Error('workspace node heartbeat returned a different node identity');
      }
      return result;
    },
  };
}
