import { randomUUID } from 'node:crypto';

import { applySettingsGatewayOverlayPatch } from './settings-gateway';
import {
  manifestOverlayPath,
  readManifestOverlay,
  type ManifestOverlayPatch,
} from './manifest-overlay';
import { ensureRuntimePaths } from './runtime-state';

export type SettingsOverlayCommandResult = {
  ok: boolean;
  command: string;
  home: string;
  overlayPath: string;
  overlay: ReturnType<typeof readManifestOverlay>;
  message: string;
};

async function patchFromCommand(
  home: string,
  patch: ManifestOverlayPatch,
): Promise<SettingsOverlayCommandResult> {
  try {
    const result = await applySettingsGatewayOverlayPatch(
      home,
      JSON.stringify(patch),
      {
        actorType: 'user',
        actorId: 'local-cli',
        workspaceId: 'workspace-local',
        correlationId: `settings_cli_${randomUUID()}`,
      },
    );
    if (!result.ok) throw new Error(result.error.message);
    return {
      ok: true,
      command: 'settings',
      home,
      overlayPath: manifestOverlayPath(home),
      overlay: readManifestOverlay(home),
      message: `${patch.enabled ? 'Enabled' : 'Disabled'} ${patch.kind} ${patch.name}.`,
    };
  } catch (cause: unknown) {
    throw new Error(
      cause instanceof Error ? cause.message.slice(0, 240) : 'Settings overlay command failed.',
    );
  }
}

export async function runSettingsOverlayCommand(args: string[]): Promise<SettingsOverlayCommandResult> {
  const runtimePaths = ensureRuntimePaths();
  const home = runtimePaths.home;
  const [action, name] = args;

  if (action === 'status') {
    const overlay = readManifestOverlay(home);
    return {
      ok: true,
      command: 'settings status',
      home,
      overlayPath: manifestOverlayPath(home),
      overlay,
      message: 'Settings overlay status loaded.',
    };
  }

  const enabled = action === 'enable-tool' || action === 'enable-skill' || action === 'enable-workflow';
  const disabled = action === 'disable-tool' || action === 'disable-skill' || action === 'disable-workflow';
  if (!enabled && !disabled) {
    throw new Error('settings requires enable-tool|disable-tool|enable-skill|disable-skill|enable-workflow|disable-workflow|status');
  }

  const patchKind = action.endsWith('-tool')
    ? 'tool'
    : action.endsWith('-skill')
      ? 'skill'
      : 'workflow';

  if (!name || name.trim().length === 0) {
    throw new Error(`settings ${action} requires a name`);
  }

  return patchFromCommand(home, {
    kind: patchKind,
    name: name.trim(),
    enabled,
  });
}
