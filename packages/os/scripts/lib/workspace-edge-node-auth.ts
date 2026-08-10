import {
  createHash,
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

export const WORKSPACE_EDGE_NODE_AUTH_VERSION = 'consuelo-edge-node-v1';
export const WORKSPACE_EDGE_NODE_SIGNATURE_MAX_AGE_MS = 5 * 60_000;

export const WORKSPACE_EDGE_NODE_HEADERS = {
  workspaceId: 'x-consuelo-workspace-id',
  nodeId: 'x-consuelo-node-id',
  deviceId: 'x-consuelo-device-id',
  connectorId: 'x-consuelo-connector-id',
  surface: 'x-consuelo-surface',
  timestamp: 'x-consuelo-edge-timestamp',
  nonce: 'x-consuelo-edge-nonce',
  bodyDigest: 'x-consuelo-edge-body-digest',
  signature: 'x-consuelo-edge-signature',
  version: 'x-consuelo-edge-auth-version',
} as const;

export type WorkspaceEdgeNodeIdentity = {
  workspaceId: string;
  nodeId: string;
  connectorId: string;
};

export type WorkspaceEdgeNodeVerification =
  | { ok: true; timestampMs: number; nonce: string }
  | { ok: false; status: 401 | 403; code: string; message: string };

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`workspace edge node ${label} is required`);
  return normalized;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function workspaceEdgeNodeBodyDigest(body: string | Uint8Array): string {
  return `sha256=${createHash('sha256').update(body).digest('hex')}`;
}

export function deriveWorkspaceEdgeNodeSecret(input: WorkspaceEdgeNodeIdentity & {
  masterSecret: string;
}): string {
  const canonical = [
    WORKSPACE_EDGE_NODE_AUTH_VERSION,
    required(input.workspaceId, 'workspace ID'),
    required(input.nodeId, 'node ID'),
    required(input.connectorId, 'connector ID'),
  ].join('\n');
  return `wen_${createHmac('sha256', required(input.masterSecret, 'master secret'))
    .update(canonical)
    .digest('base64url')}`;
}

function canonicalWorkspaceEdgeNodeRequest(input: WorkspaceEdgeNodeIdentity & {
  surface: string;
  method: string;
  pathWithSearch: string;
  bodyDigest: string;
  timestamp: string;
  nonce: string;
}): string {
  return [
    WORKSPACE_EDGE_NODE_AUTH_VERSION,
    input.method.toUpperCase(),
    required(input.pathWithSearch, 'path'),
    required(input.workspaceId, 'workspace ID'),
    required(input.nodeId, 'node ID'),
    required(input.connectorId, 'connector ID'),
    required(input.surface, 'surface'),
    required(input.bodyDigest, 'body digest'),
    required(input.timestamp, 'timestamp'),
    required(input.nonce, 'nonce'),
  ].join('\n');
}

export function signWorkspaceEdgeNodeRequest(input: WorkspaceEdgeNodeIdentity & {
  signingSecret: string;
  surface: string;
  method: string;
  pathWithSearch: string;
  bodyDigest: string;
  timestamp: string;
  nonce: string;
}): string {
  return `sha256=${createHmac('sha256', required(input.signingSecret, 'signing secret'))
    .update(canonicalWorkspaceEdgeNodeRequest(input))
    .digest('hex')}`;
}

export function createWorkspaceEdgeNodeHeaders(input: WorkspaceEdgeNodeIdentity & {
  signingSecret: string;
  surface: string;
  method: string;
  pathWithSearch: string;
  body: string | Uint8Array;
  timestamp: string;
  nonce: string;
}): Record<string, string> {
  const bodyDigest = workspaceEdgeNodeBodyDigest(input.body);
  return {
    [WORKSPACE_EDGE_NODE_HEADERS.version]: WORKSPACE_EDGE_NODE_AUTH_VERSION,
    [WORKSPACE_EDGE_NODE_HEADERS.workspaceId]: input.workspaceId,
    [WORKSPACE_EDGE_NODE_HEADERS.nodeId]: input.nodeId,
    [WORKSPACE_EDGE_NODE_HEADERS.deviceId]: input.nodeId,
    [WORKSPACE_EDGE_NODE_HEADERS.connectorId]: input.connectorId,
    [WORKSPACE_EDGE_NODE_HEADERS.surface]: input.surface,
    [WORKSPACE_EDGE_NODE_HEADERS.timestamp]: input.timestamp,
    [WORKSPACE_EDGE_NODE_HEADERS.nonce]: input.nonce,
    [WORKSPACE_EDGE_NODE_HEADERS.bodyDigest]: bodyDigest,
    [WORKSPACE_EDGE_NODE_HEADERS.signature]: signWorkspaceEdgeNodeRequest({
      ...input,
      bodyDigest,
    }),
  };
}

export function hasAnyWorkspaceEdgeNodeHeaders(headers: Record<string, string>): boolean {
  // The legacy edge proxy also uses x-consuelo-edge-signature. Only the explicit
  // version marker selects the node-scoped protocol, avoiding cross-protocol confusion.
  return Boolean(headers[WORKSPACE_EDGE_NODE_HEADERS.version]);
}

export function verifyWorkspaceEdgeNodeRequest(input: WorkspaceEdgeNodeIdentity & {
  signingSecret: string;
  surface: string;
  method: string;
  pathWithSearch: string;
  body: string | Uint8Array;
  headers: Record<string, string>;
  nowMs: number;
  nonceSeen?: (nonce: string) => boolean;
}): WorkspaceEdgeNodeVerification {
  const value = (name: string) => input.headers[name]?.trim() ?? '';
  const version = value(WORKSPACE_EDGE_NODE_HEADERS.version);
  const workspaceId = value(WORKSPACE_EDGE_NODE_HEADERS.workspaceId);
  const nodeId = value(WORKSPACE_EDGE_NODE_HEADERS.nodeId);
  const deviceId = value(WORKSPACE_EDGE_NODE_HEADERS.deviceId);
  const connectorId = value(WORKSPACE_EDGE_NODE_HEADERS.connectorId);
  const surface = value(WORKSPACE_EDGE_NODE_HEADERS.surface);
  const timestamp = value(WORKSPACE_EDGE_NODE_HEADERS.timestamp);
  const nonce = value(WORKSPACE_EDGE_NODE_HEADERS.nonce);
  const bodyDigest = value(WORKSPACE_EDGE_NODE_HEADERS.bodyDigest);
  const signature = value(WORKSPACE_EDGE_NODE_HEADERS.signature);

  if (!version || !workspaceId || !nodeId || !deviceId || !connectorId || !surface || !timestamp || !nonce || !bodyDigest || !signature) {
    return { ok: false, status: 401, code: 'MISSING_EDGE_SIGNATURE', message: 'Signed workspace edge headers are required.' };
  }
  if (version !== WORKSPACE_EDGE_NODE_AUTH_VERSION) {
    return { ok: false, status: 401, code: 'EDGE_AUTH_VERSION_UNSUPPORTED', message: 'Workspace edge authentication version is not supported.' };
  }
  if (workspaceId !== input.workspaceId) {
    return { ok: false, status: 403, code: 'WORKSPACE_MISMATCH', message: 'Workspace identity does not match this node.' };
  }
  if (nodeId !== input.nodeId || deviceId !== nodeId) {
    return { ok: false, status: 403, code: 'NODE_MISMATCH', message: 'Node identity does not match this gateway.' };
  }
  if (connectorId !== input.connectorId) {
    return { ok: false, status: 403, code: 'CONNECTOR_MISMATCH', message: 'Connector identity does not match this gateway.' };
  }
  if (surface !== input.surface) {
    return { ok: false, status: 403, code: 'SURFACE_MISMATCH', message: 'Surface identity does not match the signed request.' };
  }
  if (nonce.length < 8 || nonce.length > 128) {
    return { ok: false, status: 401, code: 'EDGE_NONCE_INVALID', message: 'Workspace edge nonce is invalid.' };
  }
  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(input.nowMs - timestampMs) > WORKSPACE_EDGE_NODE_SIGNATURE_MAX_AGE_MS) {
    return { ok: false, status: 401, code: 'EDGE_SIGNATURE_EXPIRED', message: 'Workspace edge signature is expired.' };
  }
  const actualBodyDigest = workspaceEdgeNodeBodyDigest(input.body);
  if (!safeEqual(bodyDigest, actualBodyDigest)) {
    return { ok: false, status: 401, code: 'EDGE_BODY_MISMATCH', message: 'Workspace edge request body does not match its signature.' };
  }
  const expected = signWorkspaceEdgeNodeRequest({
    signingSecret: input.signingSecret,
    workspaceId,
    nodeId,
    connectorId,
    surface,
    method: input.method,
    pathWithSearch: input.pathWithSearch,
    bodyDigest,
    timestamp,
    nonce,
  });
  if (!safeEqual(signature, expected)) {
    return { ok: false, status: 401, code: 'EDGE_SIGNATURE_INVALID', message: 'Workspace edge signature is invalid.' };
  }
  if (input.nonceSeen?.(nonce)) {
    return { ok: false, status: 401, code: 'EDGE_NONCE_REPLAY', message: 'Workspace edge nonce has already been used.' };
  }
  return { ok: true, timestampMs, nonce };
}
