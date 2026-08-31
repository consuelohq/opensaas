import { Effect } from 'effect';

import {
  recordControlPlaneAuditEvent,
  type ControlPlaneAuditActor,
} from './control-plane-audit';
import {
  manifestOverlayPath,
  patchManifestOverlay,
  validateManifestOverlayPatch,
  type ManifestOverlayPatch,
} from './manifest-overlay';
import { nodeResourceLockPath, withNodeResourceLock } from './node-resource-lock';
import { materializeConfigurationSite } from './settings-materialization';
import { buildSettingsSnapshot, type SettingsSnapshot } from './settings-snapshot';

export type SettingsControlPlaneErrorCode =
  | 'InvalidInput'
  | 'UnknownTool'
  | 'UnknownSkill'
  | 'UnknownWorkflow'
  | 'SnapshotFailure'
  | 'PersistenceFailure'
  | 'AuditFailure';

export type SettingsControlPlaneError = {
  readonly _tag: 'SettingsControlPlaneError';
  readonly code: SettingsControlPlaneErrorCode;
  readonly message: string;
  readonly status: number;
};

export type SettingsOverlayPatchInput = {
  home: string;
  patch: ManifestOverlayPatch;
  actor: ControlPlaneAuditActor;
};


function settingsError(
  code: SettingsControlPlaneErrorCode,
  message: string,
  status = 500,
): SettingsControlPlaneError {
  return { _tag: 'SettingsControlPlaneError', code, message, status };
}

function isSettingsControlPlaneError(value: unknown): value is SettingsControlPlaneError {
  return Boolean(
    value
    && typeof value === 'object'
    && '_tag' in value
    && (value as { _tag?: unknown })._tag === 'SettingsControlPlaneError',
  );
}

function issueError(issue: { code: string; message: string }): SettingsControlPlaneError {
  if (issue.code === 'UNKNOWN_TOOL') return settingsError('UnknownTool', issue.message, 400);
  if (issue.code === 'UNKNOWN_SKILL') return settingsError('UnknownSkill', issue.message, 400);
  if (issue.code === 'UNKNOWN_WORKFLOW') return settingsError('UnknownWorkflow', issue.message, 400);
  return settingsError('InvalidInput', issue.message, 400);
}

export function readSettingsSnapshotEffect(input: {
  home: string;
}): Effect.Effect<SettingsSnapshot, SettingsControlPlaneError> {
  return Effect.try({
    try: () => buildSettingsSnapshot(input.home),
    catch: (cause) => settingsError(
      'SnapshotFailure',
      cause instanceof Error ? cause.message.slice(0, 240) : 'Configuration snapshot could not be built.',
    ),
  });
}

export function applySettingsOverlayPatchEffect(
  input: SettingsOverlayPatchInput,
): Effect.Effect<SettingsSnapshot, SettingsControlPlaneError> {
  const validationIssue = validateManifestOverlayPatch(input.patch);
  if (validationIssue) return Effect.fail(issueError(validationIssue));

  return Effect.tryPromise({
    try: () => withNodeResourceLock({
      lockPath: nodeResourceLockPath(manifestOverlayPath(input.home)),
      operationId: `settings:${input.patch.kind}:${input.patch.name}`,
    }, async () => {
      patchManifestOverlay(input.home, input.patch);
      const materialized = materializeConfigurationSite(input.home);
      try {
        recordControlPlaneAuditEvent({
          home: input.home,
          actor: input.actor,
          kind: input.patch.kind,
          name: input.patch.name,
          enabled: input.patch.enabled,
        });
      } catch (cause: unknown) {
        throw settingsError(
          'AuditFailure',
          cause instanceof Error ? cause.message.slice(0, 240) : 'Configuration audit event could not be recorded.',
        );
      }
      return materialized.snapshot;
    }),
    catch: (cause) => {
      if (isSettingsControlPlaneError(cause)) return cause;
      return settingsError(
        'PersistenceFailure',
        cause instanceof Error ? cause.message.slice(0, 240) : 'Configuration overlay could not be persisted.',
      );
    },
  });
}

export type ConfigurationControlPlaneErrorCode = SettingsControlPlaneErrorCode;
export type ConfigurationControlPlaneError = SettingsControlPlaneError;
export type ConfigurationOverlayPatchInput = SettingsOverlayPatchInput;
export const readConfigurationSnapshotEffect = readSettingsSnapshotEffect;
export const applyConfigurationOverlayPatchEffect = applySettingsOverlayPatchEffect;
