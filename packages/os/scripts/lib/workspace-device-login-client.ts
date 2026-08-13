import { createPrivateKey, generateKeyPairSync, sign as nodeSign } from 'node:crypto';

import {
  CONSUELO_DEVICE_CODE_URL,
  CONSUELO_DEVICE_VERIFICATION_URL,
  CONSUELO_DEVICE_WORKSPACE_URL,
  CONSUELO_OAUTH_ACCESS_TOKEN_URL,
  CONSUELO_WORKSPACE_AGENT_STATUS_URL,
  type WorkspaceDeviceAuthorizationPollResult,
  type WorkspaceDeviceAuthorizationSession,
} from './workspace-device-authorization';
import {
  INSTALL_ID_HEADER,
  type InstallErrorCode,
  type InstallId,
} from './install-telemetry-contract';
import type { AgentName } from './local-agent-connectivity';

export type DeviceLoginFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export type DeviceLoginFetch = (
  url: string,
  init?: RequestInit,
) => Promise<DeviceLoginFetchResponse>;

export type WorkspaceDeviceKeyPair = {
  algorithm: 'Ed25519';
  publicKeyJwk: string;
  signingKeyJwk: string;
};

export type DeviceCodeRequestResult =
  | { status: 'started'; session: WorkspaceDeviceAuthorizationSession; deviceKeyPair: WorkspaceDeviceKeyPair }
  | { status: 'unavailable'; message: string; telemetryErrorCode: InstallErrorCode };

export type DeviceAccessTokenPollResult =
  | WorkspaceDeviceAuthorizationPollResult
  | { status: 'workspace_required'; intervalSeconds: number; message?: string }
  | { status: 'unavailable'; message: string; telemetryErrorCode: InstallErrorCode };

export type RequestWorkspaceDeviceCodeInput = {
  installId?: InstallId;
  clientId: string;
  scope: string[];
  workspaceId?: string;
  workspaceName?: string;
  workspaceSlug?: string;
  workspaceHost?: string;
  nodeId?: string;
  nodeName?: string;
  /**
   * Declares that this enrolment re-registers an existing node id under a new device key, which is
   * what reinstalling a machine produces. Registration still rejects a thumbprint mismatch without
   * it, so this expresses intent rather than granting anything.
   */
  nodeIdentityReplacement?: boolean;
  deviceKeyPair?: WorkspaceDeviceKeyPair;
  fetchImpl?: DeviceLoginFetch;
  now?: string;
};

export type PollWorkspaceDeviceAccessTokenInput = {
  installId?: InstallId;
  clientId: string;
  deviceCode: string;
  intervalSeconds: number;
  deviceKeyPair?: WorkspaceDeviceKeyPair;
  devicePublicKeyThumbprint?: string;
  fetchImpl?: DeviceLoginFetch;
};

export type SelectWorkspaceForDeviceLoginInput = {
  installId?: InstallId;
  clientId: string;
  deviceCode: string;
  intervalSeconds?: number;
  workspaceName: string;
  workspaceSlug: string;
  workspaceHost: string;
  deviceKeyPair: WorkspaceDeviceKeyPair;
  devicePublicKeyThumbprint?: string;
  fetchImpl?: DeviceLoginFetch;
};

export type SyncWorkspaceAgentStatusInput = {
  installId?: InstallId;
  connectorBootstrapToken: string;
  agentNames: AgentName[];
  fetchImpl?: DeviceLoginFetch;
};

export type SyncWorkspaceAgentStatusResult =
  | { status: 'synced'; connectedAgentCount: number }
  | { status: 'unavailable'; message: string; telemetryErrorCode: InstallErrorCode };

const DEVICE_KEY_ALGORITHM = 'Ed25519';

const defaultFetch: DeviceLoginFetch = async (url, init) => {
  if (typeof fetch !== 'function') {
    throw new Error('fetch is unavailable in this runtime');
  }

  try {
    const response = await fetch(url, init);
    return {
      ok: response.ok,
      status: response.status,
      json: () => response.json() as Promise<unknown>,
    };
  } catch (error: unknown) {
    throw new Error(`device login fetch failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function stringField(record: Record<string, unknown>, snake: string, camel?: string): string | undefined {
  const snakeValue = record[snake];
  if (typeof snakeValue === 'string' && snakeValue.length > 0) return snakeValue;
  if (camel) {
    const camelValue = record[camel];
    if (typeof camelValue === 'string' && camelValue.length > 0) return camelValue;
  }
  return undefined;
}

function numberField(record: Record<string, unknown>, key: string, fallback: number): number {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function unavailable(
  message: string,
  telemetryErrorCode: InstallErrorCode,
): { status: 'unavailable'; message: string; telemetryErrorCode: InstallErrorCode } {
  return { status: 'unavailable', message, telemetryErrorCode };
}

function installCorrelationHeader(installId: InstallId | undefined): Record<string, string> {
  return installId ? { [INSTALL_ID_HEADER]: installId } : {};
}

function errorWithMessage(json: Record<string, unknown>, error: string): string {
  const message = stringField(json, 'message');
  return message ? `${error}: ${message}` : error;
}

function expiresAtFromNow(now: string | undefined, expiresInSeconds: number): string {
  const baseMs = now ? Date.parse(now) : Date.now();
  const safeBaseMs = Number.isFinite(baseMs) ? baseMs : Date.now();
  return new Date(safeBaseMs + expiresInSeconds * 1000).toISOString();
}

function b64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

async function sha256(value: string): Promise<string> {
  try {
    return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
  } catch {
    throw new Error('device key digest failed');
  }
}

export async function devicePublicKeyThumbprint(publicKeyJwk: string): Promise<string> {
  try {
    return `dpk_${(await sha256(publicKeyJwk)).slice(0, 32)}`;
  } catch {
    throw new Error('device key thumbprint failed');
  }
}

export function generateWorkspaceDeviceKeyPair(): WorkspaceDeviceKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    algorithm: DEVICE_KEY_ALGORITHM,
    publicKeyJwk: JSON.stringify(publicKey.export({ format: 'jwk' })),
    signingKeyJwk: JSON.stringify(privateKey.export({ format: 'jwk' })),
  };
}

export function devicePublicKeyProofPayload(input: {
  clientId: string;
  deviceCode: string;
  devicePublicKeyThumbprint: string;
}): string {
  return `${input.clientId}.${input.deviceCode}.${input.devicePublicKeyThumbprint}`;
}

export function createDevicePublicKeyProof(input: {
  deviceKeyPair: WorkspaceDeviceKeyPair;
  payload: string;
}): string {
  const signingKey = createPrivateKey({ key: JSON.parse(input.deviceKeyPair.signingKeyJwk), format: 'jwk' });
  return b64(nodeSign(null, Buffer.from(input.payload), signingKey));
}

async function createDeviceProof(input: {
  clientId: string;
  deviceCode: string;
  deviceKeyPair: WorkspaceDeviceKeyPair;
  devicePublicKeyThumbprint?: string;
}): Promise<{ payload: string; proof: string }> {
  try {
    const thumbprint = input.devicePublicKeyThumbprint ?? await devicePublicKeyThumbprint(input.deviceKeyPair.publicKeyJwk);
    const payload = devicePublicKeyProofPayload({
      clientId: input.clientId,
      deviceCode: input.deviceCode,
      devicePublicKeyThumbprint: thumbprint,
    });

    return {
      payload,
      proof: createDevicePublicKeyProof({
        deviceKeyPair: input.deviceKeyPair,
        payload,
      }),
    };
  } catch (error: unknown) {
    throw new Error(`device proof failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function readJson(fetchImpl: DeviceLoginFetch, url: string, init: RequestInit): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch (error: unknown) {
    // The URL can carry a device code, so report the failure without echoing the request.
    throw new Error(
      `device login endpoint is unreachable: ${error instanceof Error ? error.message : 'network error'}`,
    );
  }

  let json: Record<string, unknown>;
  try {
    json = asRecord(await response.json());
  } catch (_error: unknown) {
    // A non-JSON body is usually an edge error page. Surface the status rather than the body,
    // which is untrusted and may be large.
    throw new Error(
      `device login endpoint returned a non-JSON response (HTTP ${response.status})`,
    );
  }

  if (!response.ok && !json.error) {
    throw new Error(`device login endpoint returned HTTP ${response.status}`);
  }

  return json;
}

export async function requestWorkspaceDeviceCode(
  input: RequestWorkspaceDeviceCodeInput,
): Promise<DeviceCodeRequestResult> {
  const deviceKeyPair = input.deviceKeyPair ?? generateWorkspaceDeviceKeyPair();
  const body = new URLSearchParams({
    client_id: input.clientId,
    scope: input.scope.join(' '),
    device_public_key_jwk: deviceKeyPair.publicKeyJwk,
    device_key_algorithm: deviceKeyPair.algorithm,
  });
  if (input.workspaceId) body.set('workspace_id', input.workspaceId);
  if (input.workspaceName) body.set('workspace_name', input.workspaceName);
  if (input.workspaceSlug) body.set('workspace_slug', input.workspaceSlug);
  if (input.workspaceHost) body.set('workspace_host', input.workspaceHost);
  if (input.nodeId) body.set('node_id', input.nodeId);
  if (input.nodeName) body.set('node_name', input.nodeName);
  // Declared only when re-enrolling an existing node id whose device key changed, which is what a
  // reinstall produces. Registration still fails closed without it.
  if (input.nodeIdentityReplacement) {
    body.set('node_identity_replacement', 'true');
  }

  try {
    const json = await readJson(input.fetchImpl ?? defaultFetch, CONSUELO_DEVICE_CODE_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        ...installCorrelationHeader(input.installId),
      },
      body,
    });

    const error = stringField(json, 'error');
    if (error) {
      return unavailable(errorWithMessage(json, error), 'DEVICE_CODE_REQUEST_FAILED');
    }

    const deviceCode = stringField(json, 'device_code', 'deviceCode');
    const userCode = stringField(json, 'user_code', 'userCode');
    const verificationUri = stringField(json, 'verification_uri', 'verificationUri') ?? CONSUELO_DEVICE_VERIFICATION_URL;
    const verificationUriComplete =
      stringField(json, 'verification_uri_complete', 'verificationUriComplete') ??
      `${verificationUri}?user_code=${encodeURIComponent((userCode ?? '').replaceAll('-', ''))}`;

    if (!deviceCode || !userCode) {
      return unavailable(
        'device code response was missing required fields',
        'DEVICE_CODE_REQUEST_FAILED',
      );
    }

    return {
      status: 'started',
      deviceKeyPair,
      session: {
        deviceCode,
        userCode,
        verificationUri,
        verificationUriComplete,
        expiresAt: expiresAtFromNow(input.now, numberField(json, 'expires_in', 900)),
        intervalSeconds: numberField(json, 'interval', 5),
      },
    };
  } catch (error: unknown) {
    return unavailable(
      error instanceof Error ? error.message : String(error),
      'DEVICE_CODE_REQUEST_FAILED',
    );
  }
}

function approvedDeviceGrantFromJson(json: Record<string, unknown>): WorkspaceDeviceAuthorizationPollResult | undefined {
  const userId = stringField(json, 'user_id', 'userId');
  const workspaceId = stringField(json, 'workspace_id', 'workspaceId');
  const workspaceSlug = stringField(json, 'workspace_slug', 'workspaceSlug');
  const workspaceHost = stringField(json, 'workspace_host', 'workspaceHost');
  const connectorId = stringField(json, 'connector_id', 'connectorId');
  const nodeId = stringField(json, 'node_id', 'nodeId');
  const nodeName = stringField(json, 'node_name', 'nodeName');
  const nodeRole = stringField(json, 'node_role', 'nodeRole');
  const nodeStatus = stringField(json, 'node_status', 'nodeStatus');
  const connectorBootstrapToken = stringField(json, 'connector_bootstrap_token', 'connectorBootstrapToken');
  const edgeRequestSigningSecret = stringField(json, 'edge_request_signing_secret', 'edgeRequestSigningSecret');
  const connectorBootstrapExpiresAt = stringField(json, 'connector_bootstrap_expires_at', 'connectorBootstrapExpiresAt');
  const cloudflareTunnelToken = stringField(json, 'cloudflare_tunnel_token', 'cloudflareTunnelToken');

  if (!workspaceId || !workspaceSlug || !workspaceHost || !connectorId || !connectorBootstrapToken || !connectorBootstrapExpiresAt) {
    return undefined;
  }

  return {
    status: 'approved',
    ...(userId && !userId.startsWith('google:') ? { userId } : {}),
    workspaceId,
    workspaceSlug,
    workspaceHost,
    connectorId,
    ...(edgeRequestSigningSecret ? { edgeRequestSigningSecret } : {}),
    ...(nodeId ? { nodeId } : {}),
    ...(nodeName ? { nodeName } : {}),
    ...(nodeRole === 'home' || nodeRole === 'member' ? { nodeRole } : {}),
    ...(nodeStatus === 'created' || nodeStatus === 'reconnected' ? { nodeStatus } : {}),
    connectorBootstrapToken,
    connectorBootstrapExpiresAt,
    ...(cloudflareTunnelToken ? { cloudflareTunnelToken } : {}),
  };
}
export async function pollWorkspaceDeviceAccessToken(
  input: PollWorkspaceDeviceAccessTokenInput,
): Promise<DeviceAccessTokenPollResult> {
  let body: URLSearchParams;
  try {
    body = new URLSearchParams({
      client_id: input.clientId,
      device_code: input.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });

    if (input.deviceKeyPair) {
      let proof: Awaited<ReturnType<typeof createDeviceProof>>;
      try {
        proof = await createDeviceProof({
          clientId: input.clientId,
          deviceCode: input.deviceCode,
          deviceKeyPair: input.deviceKeyPair,
          devicePublicKeyThumbprint: input.devicePublicKeyThumbprint,
        });
      } catch (error: unknown) {
        return unavailable(
          error instanceof Error ? error.message : String(error),
          'DEVICE_AUTH_PROOF_FAILED',
        );
      }
      body.set('device_public_key_proof_payload', proof.payload);
      body.set('device_public_key_proof', proof.proof);
    }

    const json = await readJson(input.fetchImpl ?? defaultFetch, CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        ...installCorrelationHeader(input.installId),
      },
      body,
    });

    const error = stringField(json, 'error');
    if (error === 'authorization_pending') {
      return { status: 'pending', intervalSeconds: numberField(json, 'interval', input.intervalSeconds) };
    }
    if (error === 'slow_down') {
      return { status: 'slow_down', intervalSeconds: numberField(json, 'interval', input.intervalSeconds) + 5 };
    }
    if (error === 'workspace_required') {
      return {
        status: 'workspace_required',
        intervalSeconds: numberField(json, 'interval', input.intervalSeconds),
        message: stringField(json, 'message'),
      };
    }
    if (error === 'access_denied') {
      return {
        status: 'denied',
        errorCode: 'DEVICE_CODE_DENIED',
        telemetryErrorCode: 'DEVICE_AUTH_DENIED',
      };
    }
    if (error === 'expired_token') {
      return {
        status: 'expired',
        errorCode: 'DEVICE_CODE_EXPIRED',
        telemetryErrorCode: 'DEVICE_AUTH_EXPIRED',
      };
    }
    if (error) {
      return unavailable(errorWithMessage(json, error), 'DEVICE_AUTH_POLL_FAILED');
    }

    return approvedDeviceGrantFromJson(json) ?? unavailable(
      'approved device response was missing workspace bootstrap fields',
      'DEVICE_AUTH_POLL_FAILED',
    );
  } catch (error: unknown) {
    return unavailable(
      error instanceof Error ? error.message : String(error),
      'DEVICE_AUTH_UNAVAILABLE',
    );
  }
}
export async function selectWorkspaceForDeviceLogin(
  input: SelectWorkspaceForDeviceLoginInput,
): Promise<DeviceAccessTokenPollResult> {
  let proof: Awaited<ReturnType<typeof createDeviceProof>>;
  try {
    proof = await createDeviceProof({
      clientId: input.clientId,
      deviceCode: input.deviceCode,
      deviceKeyPair: input.deviceKeyPair,
      devicePublicKeyThumbprint: input.devicePublicKeyThumbprint,
    });
  } catch (error: unknown) {
    return unavailable(
      error instanceof Error ? error.message : String(error),
      'DEVICE_AUTH_PROOF_FAILED',
    );
  }
  try {
    const body = new URLSearchParams({
      client_id: input.clientId,
      device_code: input.deviceCode,
      workspace_name: input.workspaceName,
      workspace_slug: input.workspaceSlug,
      workspace_host: input.workspaceHost,
      device_public_key_proof_payload: proof.payload,
      device_public_key_proof: proof.proof,
    });

    const json = await readJson(input.fetchImpl ?? defaultFetch, CONSUELO_DEVICE_WORKSPACE_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        ...installCorrelationHeader(input.installId),
      },
      body,
    });

    const error = stringField(json, 'error');
    if (error === 'workspace_required') {
      return { status: 'workspace_required', intervalSeconds: numberField(json, 'interval', input.intervalSeconds ?? 5), message: stringField(json, 'message') };
    }
    if (error === 'access_denied') {
      return {
        status: 'denied',
        errorCode: 'DEVICE_CODE_DENIED',
        telemetryErrorCode: 'DEVICE_AUTH_DENIED',
      };
    }
    if (error === 'expired_token') {
      return {
        status: 'expired',
        errorCode: 'DEVICE_CODE_EXPIRED',
        telemetryErrorCode: 'DEVICE_AUTH_EXPIRED',
      };
    }
    if (error) {
      return unavailable(
        errorWithMessage(json, error),
        error === 'workspace_route_setup_failed'
          ? 'WORKSPACE_ROUTE_SETUP_FAILED'
          : 'WORKSPACE_SELECTION_FAILED',
      );
    }

    return approvedDeviceGrantFromJson(json) ?? unavailable(
      'approved workspace selection response was missing workspace bootstrap fields',
      'WORKSPACE_SELECTION_FAILED',
    );
  } catch (error: unknown) {
    return unavailable(
      error instanceof Error ? error.message : String(error),
      'WORKSPACE_SELECTION_FAILED',
    );
  }
}

export async function syncWorkspaceAgentStatus(
  input: SyncWorkspaceAgentStatusInput,
): Promise<SyncWorkspaceAgentStatusResult> {
  const connectorBootstrapToken = input.connectorBootstrapToken.trim();
  if (!connectorBootstrapToken) {
    return unavailable(
      'connector bootstrap credential is required',
      'AGENT_STATUS_SYNC_FAILED',
    );
  }
  const agentNames = [...new Set(input.agentNames)].sort();

  try {
    const response = await (input.fetchImpl ?? defaultFetch)(
      CONSUELO_WORKSPACE_AGENT_STATUS_URL,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connectorBootstrapToken}`,
          'Content-Type': 'application/json',
          ...installCorrelationHeader(input.installId),
        },
        body: JSON.stringify({ agents: agentNames }),
      },
    );
    const body = asRecord(await response.json());
    if (!response.ok) {
      const error = asRecord(body.error);
      const message =
        stringField(error, 'message') ??
        stringField(error, 'code') ??
        stringField(body, 'error') ??
        `HTTP ${response.status}`;
      return unavailable(message, 'AGENT_STATUS_SYNC_FAILED');
    }
    const connectedAgentCount = body.connectedAgentCount;
    if (typeof connectedAgentCount !== 'number' || !Number.isInteger(connectedAgentCount)) {
      return unavailable(
        'agent status response was missing connectedAgentCount',
        'AGENT_STATUS_SYNC_FAILED',
      );
    }
    return { status: 'synced', connectedAgentCount };
  } catch (error: unknown) {
    return unavailable(
      error instanceof Error ? error.message : String(error),
      'AGENT_STATUS_SYNC_FAILED',
    );
  }
}
