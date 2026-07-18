import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { Effect } from 'effect';

import type { ControlPlaneAuditActor } from './control-plane-audit';
import {
  deleteEnvironmentEffect,
  listEnvironmentSnapshotEffect,
  upsertEnvironmentEffect,
  type EnvironmentControlPlaneError,
  type EnvironmentRecord,
  type EnvironmentSnapshot,
  type EnvironmentUpsertInput,
} from './environment-control-plane';

export type EnvironmentGatewayResult =
  | { ok: true; snapshot: EnvironmentSnapshot; environment?: EnvironmentRecord; created?: boolean; deletedEnvironmentId?: string }
  | { ok: false; status: number; error: { code: string; message: string } };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function gatewayCode(error: EnvironmentControlPlaneError): string {
  const codes: Record<EnvironmentControlPlaneError['code'], string> = {
    InvalidInput: 'INVALID_ENVIRONMENT',
    SensitiveDataRejected: 'SENSITIVE_DATA_REJECTED',
    WorkspaceMismatch: 'WORKSPACE_MISMATCH',
    EnvironmentNotFound: 'ENVIRONMENT_NOT_FOUND',
    PersistenceFailure: 'ENVIRONMENT_PERSISTENCE_FAILED',
    AuditFailure: 'ENVIRONMENT_AUDIT_FAILED',
  };
  return codes[error.code];
}

function failure(error: EnvironmentControlPlaneError): EnvironmentGatewayResult {
  return {
    ok: false,
    status: error.status,
    error: { code: gatewayCode(error), message: error.message },
  };
}

function fallbackError(code: EnvironmentControlPlaneError['code'], message: string, status = 500): EnvironmentGatewayResult {
  return failure({ _tag: 'EnvironmentControlPlaneError', code, message, status });
}

type ParsedJsonObject =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; result: EnvironmentGatewayResult };

function parseJsonObject(body: string, message: string): ParsedJsonObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return { ok: false, result: {
      ok: false,
      status: 400,
      error: { code: 'INVALID_JSON', message },
    } };
  }
  if (!isObject(parsed)) {
    return { ok: false, result: {
      ok: false,
      status: 400,
      error: { code: 'INVALID_ENVIRONMENT', message: 'Environment request must be a JSON object.' },
    } };
  }
  return { ok: true, value: parsed };
}

export function parseEnvironmentUpsert(body: string): EnvironmentUpsertInput | EnvironmentGatewayResult {
  const parsedResult = parseJsonObject(body, 'Environment upsert requires JSON.');
  if (!parsedResult.ok) return parsedResult.result;
  const parsed = parsedResult.value;
  return {
    ...(typeof parsed.environmentId === 'string' ? { environmentId: parsed.environmentId } : {}),
    name: parsed.name as string,
    ...(parsed.label === undefined ? {} : { label: parsed.label as string }),
    ...(parsed.labels === undefined ? {} : { labels: parsed.labels as string[] }),
    scope: parsed.scope as EnvironmentUpsertInput['scope'],
    ...(parsed.status === undefined ? {} : { status: parsed.status as EnvironmentUpsertInput['status'] }),
    ...(parsed.metadata === undefined ? {} : { metadata: parsed.metadata as EnvironmentUpsertInput['metadata'] }),
  };
}

export function parseEnvironmentDelete(body: string): { environmentId: string } | EnvironmentGatewayResult {
  const parsedResult = parseJsonObject(body, 'Environment delete requires JSON.');
  if (!parsedResult.ok) return parsedResult.result;
  const parsed = parsedResult.value;
  if (typeof parsed.environmentId !== 'string' || parsed.environmentId.trim().length === 0) {
    return {
      ok: false,
      status: 400,
      error: { code: 'INVALID_ENVIRONMENT_ID', message: 'Environment delete requires an environment ID.' },
    };
  }
  return { environmentId: parsed.environmentId.trim() };
}

function defaultActor(workspaceId: string): ControlPlaneAuditActor {
  return {
    actorType: 'system',
    actorId: 'environment-gateway',
    workspaceId,
    correlationId: `environment_${randomUUID()}`,
  };
}

export async function readEnvironmentGatewaySnapshot(
  home: string,
  workspaceId: string,
): Promise<EnvironmentGatewayResult> {
  try {
    const result = await Effect.runPromise(Effect.either(listEnvironmentSnapshotEffect({ home, workspaceId })));
    return result._tag === 'Left' ? failure(result.left) : { ok: true, snapshot: result.right };
  } catch {
    return fallbackError('PersistenceFailure', 'Environment registry could not be read.');
  }
}

export async function applyEnvironmentGatewayUpsert(
  home: string,
  workspaceId: string,
  body: string,
  actor: ControlPlaneAuditActor = defaultActor(workspaceId),
): Promise<EnvironmentGatewayResult> {
  const parsed = parseEnvironmentUpsert(body);
  if ('ok' in parsed) return parsed;
  try {
    const result = await Effect.runPromise(Effect.either(upsertEnvironmentEffect({
      home,
      workspaceId,
      actor,
      input: parsed,
    })));
    return result._tag === 'Left'
      ? failure(result.left)
      : {
          ok: true,
          created: result.right.created,
          environment: result.right.environment,
          snapshot: result.right.snapshot,
        };
  } catch {
    return fallbackError('PersistenceFailure', 'Environment record could not be persisted.');
  }
}

export async function applyEnvironmentGatewayDelete(
  home: string,
  workspaceId: string,
  body: string,
  actor: ControlPlaneAuditActor = defaultActor(workspaceId),
): Promise<EnvironmentGatewayResult> {
  const parsed = parseEnvironmentDelete(body);
  if ('ok' in parsed) return parsed;
  try {
    const result = await Effect.runPromise(Effect.either(deleteEnvironmentEffect({
      home,
      workspaceId,
      actor,
      environmentId: parsed.environmentId,
    })));
    return result._tag === 'Left'
      ? failure(result.left)
      : {
          ok: true,
          deletedEnvironmentId: result.right.deletedEnvironmentId,
          snapshot: result.right.snapshot,
        };
  } catch {
    return fallbackError('PersistenceFailure', 'Environment record could not be deleted.');
  }
}

export function resolveEnvironmentGatewayHome(): string {
  const home = process.env.CONSUELO_OS_HOME ?? process.env.CONSUELO_HOME ?? '';
  return home ? path.resolve(home) : '';
}

export function isEnvironmentGatewayRoute(pathname: string): boolean {
  return pathname === '/gateway/environments/snapshot'
    || pathname === '/gateway/environments/upsert'
    || pathname === '/gateway/environments/delete';
}
