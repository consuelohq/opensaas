import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { Effect } from 'effect';

import type { ControlPlaneAuditActor } from './control-plane-audit';
import {
  applySettingsOverlayPatchEffect,
  readSettingsSnapshotEffect,
  type SettingsControlPlaneError,
} from './settings-control-plane';
import type { ManifestOverlayPatch } from './manifest-overlay';
import type { SettingsSnapshot } from './settings-snapshot';

export type SettingsGatewayResult =
  | { ok: true; snapshot: SettingsSnapshot }
  | { ok: false; status: number; error: { code: string; message: string } };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorCode(error: SettingsControlPlaneError): string {
  const codes: Record<SettingsControlPlaneError['code'], string> = {
    InvalidInput: 'INVALID_PATCH',
    UnknownTool: 'UNKNOWN_TOOL',
    UnknownSkill: 'UNKNOWN_SKILL',
    UnknownWorkflow: 'UNKNOWN_WORKFLOW',
    SnapshotFailure: 'SETTINGS_SNAPSHOT_FAILED',
    PersistenceFailure: 'SETTINGS_PERSISTENCE_FAILED',
    AuditFailure: 'SETTINGS_AUDIT_FAILED',
  };
  return codes[error.code];
}

function gatewayFailure(error: SettingsControlPlaneError): SettingsGatewayResult {
  return {
    ok: false,
    status: error.status,
    error: { code: errorCode(error), message: error.message },
  };
}

function defaultActor(): ControlPlaneAuditActor {
  return {
    actorType: 'system',
    actorId: 'settings-gateway',
    workspaceId: 'workspace-local',
    correlationId: `settings_${randomUUID()}`,
  };
}

export function parseSettingsOverlayPatch(body: string): ManifestOverlayPatch | SettingsGatewayResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return {
      ok: false,
      status: 400,
      error: { code: 'INVALID_JSON', message: 'Settings overlay patch requires JSON.' },
    };
  }

  if (!isObject(parsed)) {
    return {
      ok: false,
      status: 400,
      error: { code: 'INVALID_PATCH', message: 'Settings overlay patch must be a JSON object.' },
    };
  }

  const kind = parsed.kind;
  const name = parsed.name;
  const enabled = parsed.enabled;

  if (kind !== 'tool' && kind !== 'skill' && kind !== 'workflow') {
    return {
      ok: false,
      status: 400,
      error: { code: 'INVALID_PATCH_KIND', message: 'Settings overlay patch kind must be tool, skill, or workflow.' },
    };
  }

  if (typeof name !== 'string' || name.trim().length === 0) {
    return {
      ok: false,
      status: 400,
      error: { code: 'INVALID_PATCH_NAME', message: 'Settings overlay patch requires a non-empty name.' },
    };
  }

  if (typeof enabled !== 'boolean') {
    return {
      ok: false,
      status: 400,
      error: { code: 'INVALID_PATCH_ENABLED', message: 'Settings overlay patch requires enabled: true|false.' },
    };
  }

  return { kind, name: name.trim(), enabled };
}

export async function readSettingsGatewaySnapshot(home: string): Promise<SettingsGatewayResult> {
  try {
    const result = await Effect.runPromise(Effect.either(readSettingsSnapshotEffect({ home })));
    return result._tag === 'Left' ? gatewayFailure(result.left) : { ok: true, snapshot: result.right };
  } catch (cause: unknown) {
    return gatewayFailure({
      _tag: 'SettingsControlPlaneError',
      code: 'SnapshotFailure',
      message: cause instanceof Error ? cause.message.slice(0, 240) : 'Settings snapshot could not be read.',
      status: 500,
    });
  }
}

export async function applySettingsGatewayOverlayPatch(
  home: string,
  body: string,
  actor: ControlPlaneAuditActor = defaultActor(),
): Promise<SettingsGatewayResult> {
  const parsed = parseSettingsOverlayPatch(body);
  if ('ok' in parsed) return parsed;
  try {
    const result = await Effect.runPromise(Effect.either(applySettingsOverlayPatchEffect({
      home,
      patch: parsed,
      actor,
    })));
    return result._tag === 'Left' ? gatewayFailure(result.left) : { ok: true, snapshot: result.right };
  } catch (cause: unknown) {
    return gatewayFailure({
      _tag: 'SettingsControlPlaneError',
      code: 'PersistenceFailure',
      message: cause instanceof Error ? cause.message.slice(0, 240) : 'Settings overlay could not be applied.',
      status: 500,
    });
  }
}

export function resolveSettingsGatewayHome(): string {
  const home = process.env.CONSUELO_OS_HOME ?? process.env.CONSUELO_HOME ?? '';
  return home ? path.resolve(home) : '';
}

export function isSettingsGatewayRoute(pathname: string): boolean {
  return pathname === '/gateway/settings/snapshot' || pathname === '/gateway/settings/overlay';
}
