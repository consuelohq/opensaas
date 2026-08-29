import type { Hono } from 'hono';

import { json } from '../http';
import {
  createGitHubInstallationToken,
  githubInstallationUrl,
  GitHubSourceControlError,
  listGitHubInstallationRepositories,
  readGitHubInstallation,
} from '../services/github-source-control';
import {
  WORKSPACE_NODE_SIGNATURE_MAX_AGE_MS,
  workspaceNodeId,
} from '../services/nodes';
import type { DeviceAuthorityRuntime, WorkspaceNode } from '../types';
import { b64Decode, hash, rand } from '../utils';

const INSTALL_STATE_TTL_MS = 10 * 60_000;
const HANDOFF_TTL_MS = 5 * 60_000;

function errorResponse(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, { status });
}

function sourceControlError(error: unknown): Response {
  if (error instanceof GitHubSourceControlError) {
    return errorResponse(error.status, error.code, error.message);
  }
  return errorResponse(503, 'GITHUB_SOURCE_CONTROL_UNAVAILABLE', 'GitHub source control is temporarily unavailable.');
}

function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string') return '/configuration';
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return '/configuration';
  }
  try {
    const parsed = new URL(trimmed, 'https://workspace.invalid');
    if (parsed.origin !== 'https://workspace.invalid' || parsed.username || parsed.password || parsed.hash) {
      return '/configuration';
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return '/configuration';
  }
}

async function verifyNodeSignature(
  node: WorkspaceNode,
  payload: string,
  signature: string,
): Promise<boolean> {
  try {
    if (!node.devicePublicKeyJwk || !signature) return false;
    const key = await crypto.subtle.importKey(
      'jwk',
      JSON.parse(node.devicePublicKeyJwk),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      b64Decode(signature),
      new TextEncoder().encode(payload),
    );
  } catch {
    return false;
  }
}

type SignedNodeRequest = {
  node: WorkspaceNode;
  body: Record<string, unknown>;
};

export async function authenticateSignedNodeRequest(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<SignedNodeRequest | Response> {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
    return errorResponse(400, 'INVALID_NODE_REQUEST', 'A signed JSON node request is required.');
  }
  const payload = await request.text();
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    body = parsed as Record<string, unknown>;
  } catch {
    return errorResponse(400, 'INVALID_NODE_REQUEST', 'A signed JSON node request is required.');
  }
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : '';
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId.trim() : '';
  const timestamp = typeof body.timestamp === 'number' ? body.timestamp : Number.NaN;
  const nonce = typeof body.nonce === 'string' ? body.nonce.trim() : '';
  const nowMs = runtime.now();
  if (
    !workspaceId
    || !nodeId
    || !Number.isFinite(timestamp)
    || nonce.length < 8
    || nonce.length > 128
    || Math.abs(nowMs - timestamp) > WORKSPACE_NODE_SIGNATURE_MAX_AGE_MS
  ) {
    return errorResponse(400, 'INVALID_NODE_REQUEST', 'Node identity, timestamp, or nonce is invalid.');
  }
  const node = await runtime.store.byWorkspaceNodeId(nodeId);
  if (!node || workspaceNodeId(node) !== workspaceId) {
    return errorResponse(404, 'WORKSPACE_NODE_NOT_FOUND', 'The requested node was not found.');
  }
  if ((node.state ?? 'active') === 'revoked') {
    return errorResponse(403, 'WORKSPACE_NODE_REVOKED', 'The node has been revoked.');
  }
  const signature = request.headers.get('x-consuelo-node-signature')?.trim() ?? '';
  if (!(await verifyNodeSignature(node, payload, signature))) {
    return errorResponse(401, 'INVALID_NODE_SIGNATURE', 'The node request signature is invalid.');
  }
  const claimed = await runtime.store.claimWorkspaceNodeNonce(
    nodeId,
    nonce,
    nowMs + WORKSPACE_NODE_SIGNATURE_MAX_AGE_MS,
    nowMs,
  );
  if (!claimed) {
    return errorResponse(409, 'NODE_REQUEST_REPLAYED', 'The node request nonce was already used.');
  }
  return { node, body };
}

async function handleInstallStart(request: Request, runtime: DeviceAuthorityRuntime): Promise<Response> {
  try {
    const auth = await authenticateSignedNodeRequest(request, runtime);
    if (auth instanceof Response) return auth;
    const workspaceId = workspaceNodeId(auth.node);
    const state = rand('ghs', 24);
    const installUrl = githubInstallationUrl(runtime, state);
    await runtime.store.putGitHubSourceControlInstallState({
      state,
      workspaceId,
      workspaceHost: auth.node.workspaceHost,
      nodeId: auth.node.nodeId,
      returnPath: safeReturnPath(auth.body.returnPath),
      expiresAt: runtime.now() + INSTALL_STATE_TTL_MS,
    });
    return json({ installUrl });
  } catch (error: unknown) {
    return sourceControlError(error);
  }
}

async function handleInstallCallback(request: Request, runtime: DeviceAuthorityRuntime): Promise<Response> {
  const url = new URL(request.url);
  const stateValue = url.searchParams.get('state')?.trim() ?? '';
  const installationId = Number(url.searchParams.get('installation_id'));
  if (!stateValue) {
    return errorResponse(400, 'GITHUB_INSTALL_STATE_REQUIRED', 'GitHub connection state is missing.');
  }
  let state;
  try {
    state = await runtime.store.byGitHubSourceControlInstallState(stateValue);
    if (!state || runtime.now() >= state.expiresAt) {
      if (state) await runtime.store.delGitHubSourceControlInstallState(stateValue);
      return errorResponse(400, 'GITHUB_INSTALL_STATE_INVALID', 'The GitHub connection session expired. Start again from Consuelo.');
    }
    await runtime.store.delGitHubSourceControlInstallState(stateValue);
    const installation = await readGitHubInstallation(runtime, installationId);
    const repositories = await listGitHubInstallationRepositories(runtime, installationId);
    const connectionId = rand('ghc', 18);
    await runtime.store.putGitHubSourceControlConnection({
      connectionId,
      workspaceId: state.workspaceId,
      workspaceHost: state.workspaceHost,
      installationId,
      accountLogin: installation.accountLogin,
      repositorySelection: installation.repositorySelection,
      repositories,
      createdAt: runtime.now(),
      updatedAt: runtime.now(),
    });
    const handoff = rand('ghh', 24);
    await runtime.store.putGitHubSourceControlHandoff({
      tokenHash: await hash(handoff),
      connectionId,
      workspaceId: state.workspaceId,
      workspaceHost: state.workspaceHost,
      nodeId: state.nodeId,
      returnPath: state.returnPath,
      expiresAt: runtime.now() + HANDOFF_TTL_MS,
    });
    const target = new URL('/configuration', `https://${state.workspaceHost}`);
    target.searchParams.set('github_handoff', handoff);
    target.searchParams.set('return_to', state.returnPath);
    return new Response(null, {
      status: 302,
      headers: { location: target.toString(), 'cache-control': 'no-store' },
    });
  } catch (error: unknown) {
    return sourceControlError(error);
  }
}

async function handleInstallClaim(request: Request, runtime: DeviceAuthorityRuntime): Promise<Response> {
  try {
    const auth = await authenticateSignedNodeRequest(request, runtime);
    if (auth instanceof Response) return auth;
    const handoff = typeof auth.body.handoff === 'string' ? auth.body.handoff.trim() : '';
    if (!handoff) {
      return errorResponse(400, 'GITHUB_HANDOFF_REQUIRED', 'A GitHub connection handoff is required.');
    }
    const workspaceId = workspaceNodeId(auth.node);
    const record = await runtime.store.consumeGitHubSourceControlHandoff({
      tokenHash: await hash(handoff),
      workspaceId,
      nodeId: auth.node.nodeId,
      nowMs: runtime.now(),
    });
    if (!record) {
      return errorResponse(410, 'GITHUB_HANDOFF_INVALID', 'The GitHub connection handoff is invalid or expired.');
    }
    const connection = await runtime.store.byGitHubSourceControlConnection(record.connectionId);
    if (!connection || connection.workspaceId !== workspaceId || connection.workspaceHost !== auth.node.workspaceHost) {
      return errorResponse(410, 'GITHUB_CONNECTION_INVALID', 'The GitHub connection is no longer available.');
    }
    return json({
      connectionId: connection.connectionId,
      accountLogin: connection.accountLogin,
      repositorySelection: connection.repositorySelection,
      repositories: connection.repositories,
      returnPath: record.returnPath,
    });
  } catch (error: unknown) {
    return sourceControlError(error);
  }
}

async function handleInstallationToken(request: Request, runtime: DeviceAuthorityRuntime): Promise<Response> {
  try {
    const auth = await authenticateSignedNodeRequest(request, runtime);
    if (auth instanceof Response) return auth;
    const connectionId = typeof auth.body.connectionId === 'string'
      ? auth.body.connectionId.trim()
      : '';
    if (!connectionId) {
      return errorResponse(400, 'GITHUB_CONNECTION_REQUIRED', 'A GitHub source-control connection is required.');
    }
    const workspaceId = workspaceNodeId(auth.node);
    const connection = await runtime.store.byGitHubSourceControlConnection(connectionId);
    if (!connection || connection.workspaceId !== workspaceId || connection.workspaceHost !== auth.node.workspaceHost) {
      return errorResponse(404, 'GITHUB_CONNECTION_NOT_FOUND', 'The GitHub source-control connection was not found.');
    }
    return json(await createGitHubInstallationToken(runtime, connection.installationId));
  } catch (error: unknown) {
    return sourceControlError(error);
  }
}

export function registerGitHubSourceControlRoutes(
  app: Hono,
  runtime: DeviceAuthorityRuntime,
): void {
  app.post('/workspace/source-control/github/install/start', (context) =>
    handleInstallStart(context.req.raw, runtime));
  app.get('/workspace/source-control/github/install/callback', (context) =>
    handleInstallCallback(context.req.raw, runtime));
  app.post('/workspace/source-control/github/install/claim', (context) =>
    handleInstallClaim(context.req.raw, runtime));
  app.post('/workspace/source-control/github/token', (context) =>
    handleInstallationToken(context.req.raw, runtime));
}
