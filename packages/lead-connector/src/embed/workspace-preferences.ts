import type { CallingWorkspace } from './calling-workspace.js';
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const lifetime = 8 * 60 * 60 * 1000;
const screens = [
  'calling',
  'settings',
  'history',
  'team',
  'numbers',
  'billing',
  'appearance',
  'mercury',
  'queue-details',
  'call-options',
] as const;
export type WorkspacePreferences = {
  screen: CallingWorkspace['screen'];
  mode: CallingWorkspace['mode'];
  setupMode: 'single' | 'queue';
  coachingMode: 'off' | 'script';
  scriptId?: string;
};
const key = (scope: string) =>
  'consuelo-calling-view:v1:' + encodeURIComponent(scope);
export const readWorkspacePreferences = (
  storage: Store,
  scope: string,
  now = Date.now(),
): WorkspacePreferences | null => {
  try {
    const raw = storage.getItem(key(scope));
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (
      v.version !== 1 ||
      !Number.isFinite(v.savedAt) ||
      v.savedAt > now + 60000 ||
      now - v.savedAt > lifetime ||
      !screens.includes(v.screen) ||
      !['inbound', 'outbound'].includes(v.mode) ||
      !['queue', 'single'].includes(v.setupMode)
    )
      return null;
    return {
      screen: v.screen,
      mode: v.mode,
      setupMode: v.setupMode,
      coachingMode: v.coachingMode === 'script' ? 'script' : 'off',
      ...(typeof v.scriptId === 'string' && /^[0-9a-f-]{36}$/i.test(v.scriptId)
        ? { scriptId: v.scriptId }
        : {}),
    };
  } catch {
    return null;
  }
};
export const writeWorkspacePreferences = (
  storage: Store,
  scope: string,
  workspace: CallingWorkspace,
  setupMode: 'single' | 'queue',
  now = Date.now(),
): void => {
  try {
    storage.setItem(
      key(scope),
      JSON.stringify({
        version: 1,
        savedAt: now,
        screen:
          workspace.screen === 'call-detail'
            ? 'history'
            : screens.includes(workspace.screen)
              ? workspace.screen
              : 'calling',
        mode: workspace.mode,
        setupMode,
        coachingMode: workspace.coachingMode === 'script' ? 'script' : 'off',
        ...(workspace.activeScriptId
          ? { scriptId: workspace.activeScriptId }
          : {}),
      }),
    );
  } catch {
    /* Storage can be blocked in an embed. */
  }
};
