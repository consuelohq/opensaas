import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { Hono } from 'hono';

import type { ControlPlaneAuditActor } from '../../lib/control-plane-audit';
import {
  NodeCredentialSealingFailure,
  type SealedCredentialEnvelope,
} from '../../lib/node-credential-sealing';
import {
  loadNodeEncryptionPrivateKey,
  readNodeEncryptionPublicKey,
} from '../../lib/node-encryption-key-file';
import {
  installSealedCredential,
  listSealedCredentials,
  NodeSealedCredentialStoreFailure,
} from '../../lib/node-sealed-credential-store';
import { resolveConsueloHome } from '../../lib/consuelo-home';
import { authenticateSignedRequest, authorizeSignedRequest } from '../middleware/auth';
import { internalError, jsonResponse } from '../middleware/errors';
import type { AuthenticatedMcpPrincipal } from '../security/authenticated-principal';

const BINDINGS_PATH = '/gateway/secrets/bindings';
const SETUP_PATH = '/gateway/secrets/setup';
const INSTALL_PATH = '/gateway/secrets/install';
const READ_SCOPE = 'route:/gateway/secrets:read';
const WRITE_SCOPE = 'route:/gateway/secrets:write';
const ALLOWED_INSTALL_KEYS = new Set(['bindingId', 'envelope']);

function requiredHeader(
  request: Request,
  names: string[],
  code: string,
  message: string,
): string | Response {
  for (const name of names) {
    const value = request.headers.get(name)?.trim();
    if (value) return value;
  }
  return jsonResponse({ ok: false, error: { code, message } }, 403);
}

function signedIdentity(request: Request): { workspaceId: string; nodeId: string } | Response {
  const workspaceId = requiredHeader(
    request,
    ['x-consuelo-workspace-id'],
    'WORKSPACE_ID_REQUIRED',
    'Signed workspace identity is required.',
  );
  if (workspaceId instanceof Response) return workspaceId;
  const nodeId = requiredHeader(
    request,
    ['x-consuelo-node-id', 'x-consuelo-device-id'],
    'NODE_ID_REQUIRED',
    'Signed node identity is required.',
  );
  if (nodeId instanceof Response) return nodeId;
  return { workspaceId, nodeId };
}

function actorFromPrincipal(
  principal: AuthenticatedMcpPrincipal,
  identity: { workspaceId: string; nodeId: string },
): ControlPlaneAuditActor {
  const applicationId = principal.appId?.trim();
  return {
    actorType: 'user',
    actorId: principal.callerId.trim() || principal.subjectId,
    workspaceId: identity.workspaceId,
    nodeId: identity.nodeId,
    correlationId: randomUUID(),
    ...(applicationId ? { applicationId } : {}),
  };
}

function invalidInstallRequest(): Response {
  return jsonResponse({
    ok: false,
    error: {
      code: 'SEALED_SECRET_REQUIRED',
      message: 'Secret setup accepts only a binding ID and a sealed envelope.',
    },
  }, 400);
}

function parseInstallBody(body: string): { bindingId: string; envelope: SealedCredentialEnvelope } | Response {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return invalidInstallRequest();
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return invalidInstallRequest();
  const record = parsed as Record<string, unknown>;
  if (Object.keys(record).some((key) => !ALLOWED_INSTALL_KEYS.has(key))) return invalidInstallRequest();
  if (typeof record.bindingId !== 'string' || record.bindingId.trim() === '') return invalidInstallRequest();
  if (!record.envelope || typeof record.envelope !== 'object' || Array.isArray(record.envelope)) {
    return invalidInstallRequest();
  }
  return {
    bindingId: record.bindingId.trim(),
    envelope: record.envelope as SealedCredentialEnvelope,
  };
}

function secretMutationError(error: unknown): Response {
  if (error instanceof NodeCredentialSealingFailure) {
    return jsonResponse({
      ok: false,
      error: { code: 'INVALID_SECRET_ENVELOPE', message: 'The sealed secret could not be verified for this node.' },
    }, 400);
  }
  if (error instanceof NodeSealedCredentialStoreFailure && error.code === 'InvalidInput') {
    return jsonResponse({
      ok: false,
      error: { code: 'INVALID_SECRET_BINDING', message: 'The secret binding is not valid for this workspace and node.' },
    }, 400);
  }
  return internalError(error);
}

export function createSecretRoutes(): Hono {
  const app = new Hono();

  app.get(BINDINGS_PATH, async (context) => {
    const request = context.req.raw;
    try {
      const denied = await authorizeSignedRequest({
        request,
        path: BINDINGS_PATH,
        body: '',
        requiredScope: READ_SCOPE,
      });
      if (denied) return denied;
      const identity = signedIdentity(request);
      if (identity instanceof Response) return identity;

      return jsonResponse({
        ok: true,
        bindings: listSealedCredentials({
          home: resolveConsueloHome(),
          workspaceId: identity.workspaceId,
          nodeId: identity.nodeId,
        }),
      });
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  app.get(SETUP_PATH, async (context) => {
    const request = context.req.raw;
    try {
      const denied = await authorizeSignedRequest({
        request,
        path: SETUP_PATH,
        body: '',
        requiredScope: READ_SCOPE,
      });
      if (denied) return denied;
      const identity = signedIdentity(request);
      if (identity instanceof Response) return identity;

      const home = resolveConsueloHome();
      const published = readNodeEncryptionPublicKey({ nodeHome: path.join(home, 'node') });
      if (
        !published ||
        published.workspaceId !== identity.workspaceId ||
        published.nodeId !== identity.nodeId
      ) {
        return jsonResponse({
          ok: false,
          error: {
            code: 'NODE_ENCRYPTION_KEY_UNAVAILABLE',
            message: 'This node is not ready to receive sealed secrets.',
          },
        }, 409);
      }

      return jsonResponse({
        ok: true,
        workspaceId: identity.workspaceId,
        nodeId: identity.nodeId,
        algorithm: published.algorithm,
        publicKeyJwk: published.publicKeyJwk,
      });
    } catch (error: unknown) {
      return internalError(error);
    }
  });

  app.post(INSTALL_PATH, async (context) => {
    const request = context.req.raw;
    const body = await request.clone().text();
    try {
      const authentication = await authenticateSignedRequest({
        request,
        path: INSTALL_PATH,
        body,
        requiredScope: WRITE_SCOPE,
      });
      if (!authentication.ok) return authentication.response;
      const identity = signedIdentity(request);
      if (identity instanceof Response) return identity;
      const parsed = parseInstallBody(body);
      if (parsed instanceof Response) return parsed;

      const home = resolveConsueloHome();
      const binding = installSealedCredential({
        home,
        nodePrivateKeyJwk: loadNodeEncryptionPrivateKey({
          nodeHome: path.join(home, 'node'),
          workspaceId: identity.workspaceId,
          nodeId: identity.nodeId,
        }),
        recipient: {
          workspaceId: identity.workspaceId,
          nodeId: identity.nodeId,
          bindingId: parsed.bindingId,
        },
        envelope: parsed.envelope,
        actor: actorFromPrincipal(authentication.principal, identity),
      });
      return jsonResponse({ ok: true, binding });
    } catch (error: unknown) {
      return secretMutationError(error);
    }
  });

  return app;
}
