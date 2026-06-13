import { createPrivateKey, generateKeyPairSync, sign as nodeSign } from 'node:crypto';

import {
  CONSUELO_DEVICE_CODE_URL,
  CONSUELO_DEVICE_VERIFICATION_URL,
  CONSUELO_OAUTH_ACCESS_TOKEN_URL,
  type WorkspaceDeviceAuthorizationPollResult,
  type WorkspaceDeviceAuthorizationSession,
} from './workspace-device-authorization';

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
  | { status: 'unavailable'; message: string };

export type DeviceAccessTokenPollResult =
  | WorkspaceDeviceAuthorizationPollResult
  | { status: 'unavailable'; message: string };

export type RequestWorkspaceDeviceCodeInput = {
  clientId: string;
  scope: string[];
  workspaceName: string;
  workspaceSlug: string;
  workspaceHost: string;
  deviceKeyPair?: WorkspaceDeviceKeyPair;
  fetchImpl?: DeviceLoginFetch;
  now?: string;
};

export type PollWorkspaceDeviceAccessTokenInput = {
  clientId: string;
  deviceCode: string;
  intervalSeconds: number;
  deviceKeyPair?: WorkspaceDeviceKeyPair;
  devicePublicKeyThumbprint?: string;
  fetchImpl?: DeviceLoginFetch;
};

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

function unavailable(message: string): { status: 'unavailable'; message: string } {
  return { status: 'unavailable', message };
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

async function readJson(fetchImpl: DeviceLoginFetch, url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetchImpl(url, init);
  const json = asRecord(await response.json());

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
    workspace_name: input.workspaceName,
    workspace_slug: input.workspaceSlug,
    workspace_host: input.workspaceHost,
    device_public_key_jwk: deviceKeyPair.publicKeyJwk,
    device_key_algorithm: deviceKeyPair.algorithm,
  });

  try {
    const json = await readJson(input.fetchImpl ?? defaultFetch, CONSUELO_DEVICE_CODE_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const error = stringField(json, 'error');
    if (error) {
      return unavailable(error);
    }

    const deviceCode = stringField(json, 'device_code', 'deviceCode');
    const userCode = stringField(json, 'user_code', 'userCode');
    const verificationUri = stringField(json, 'verification_uri', 'verificationUri') ?? CONSUELO_DEVICE_VERIFICATION_URL;
    const verificationUriComplete =
      stringField(json, 'verification_uri_complete', 'verificationUriComplete') ??
      `${verificationUri}?user_code=${encodeURIComponent((userCode ?? '').replaceAll('-', ''))}`;

    if (!deviceCode || !userCode) {
      return unavailable('device code response was missing required fields');
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
    return unavailable(error instanceof Error ? error.message : String(error));
  }
}

export async function pollWorkspaceDeviceAccessToken(
  input: PollWorkspaceDeviceAccessTokenInput,
): Promise<DeviceAccessTokenPollResult> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    device_code: input.deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  });

  if (input.deviceKeyPair) {
    const thumbprint = input.devicePublicKeyThumbprint ?? await devicePublicKeyThumbprint(input.deviceKeyPair.publicKeyJwk);
    const proofPayload = devicePublicKeyProofPayload({
      clientId: input.clientId,
      deviceCode: input.deviceCode,
      devicePublicKeyThumbprint: thumbprint,
    });
    body.set('device_public_key_proof_payload', proofPayload);
    body.set('device_public_key_proof', createDevicePublicKeyProof({
      deviceKeyPair: input.deviceKeyPair,
      payload: proofPayload,
    }));
  }

  try {
    const json = await readJson(input.fetchImpl ?? defaultFetch, CONSUELO_OAUTH_ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
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
    if (error === 'access_denied') {
      return { status: 'denied', errorCode: 'DEVICE_CODE_DENIED' };
    }
    if (error === 'expired_token') {
      return { status: 'expired', errorCode: 'DEVICE_CODE_EXPIRED' };
    }
    if (error) {
      return unavailable(error);
    }

    const workspaceId = stringField(json, 'workspace_id', 'workspaceId');
    const workspaceSlug = stringField(json, 'workspace_slug', 'workspaceSlug');
    const workspaceHost = stringField(json, 'workspace_host', 'workspaceHost');
    const connectorId = stringField(json, 'connector_id', 'connectorId');
    const connectorBootstrapToken = stringField(json, 'connector_bootstrap_token', 'connectorBootstrapToken');
    const connectorBootstrapExpiresAt = stringField(json, 'connector_bootstrap_expires_at', 'connectorBootstrapExpiresAt');

    if (!workspaceId || !workspaceSlug || !workspaceHost || !connectorId || !connectorBootstrapToken || !connectorBootstrapExpiresAt) {
      return unavailable('approved device response was missing workspace bootstrap fields');
    }

    return {
      status: 'approved',
      workspaceId,
      workspaceSlug,
      workspaceHost,
      connectorId,
      connectorBootstrapToken,
      connectorBootstrapExpiresAt,
    };
  } catch (error: unknown) {
    return unavailable(error instanceof Error ? error.message : String(error));
  }
}
