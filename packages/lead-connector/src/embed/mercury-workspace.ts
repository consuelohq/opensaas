import type { CallingWorkspace } from './calling-workspace.js';
import type { MercuryCueView } from './mercury-cues.js';
import { scriptSteps } from './script-presentation.js';

// The production transport calls this only after validating the domain card patch.
export const receiveMercuryView = (
  workspace: CallingWorkspace,
  view: MercuryCueView,
): boolean => {
  if (view.scopeKey !== workspace.mercuryScope) return false;
  const history = workspace.mercuryHistory ?? [];
  const latest = history.at(-1);
  if (latest && view.revision <= latest.revision) return false;
  workspace.mercuryHistory = [...history, view].slice(-24);
  if (!workspace.mercuryPinned && workspace.mercuryManualIndex === undefined)
    workspace.mercuryCard = view;
  return true;
};

export const synchronizeMercuryScope = (
  workspace: CallingWorkspace,
  scopeKey: string | null,
): void => {
  if (workspace.mercuryScope === (scopeKey ?? undefined)) return;
  workspace.mercuryScope = scopeKey ?? undefined;
  workspace.mercuryCard = undefined;
  workspace.mercuryHistory = [];
  workspace.mercuryManualIndex = undefined;
  workspace.mercuryPinned = false;
  workspace.confirmedConnection = undefined;
  workspace.scriptStep = 0;
};

export const mercuryAction = (
  workspace: CallingWorkspace,
  action: string,
): boolean => {
  if (action === 'mercury-pin') {
    workspace.mercuryPinned = !workspace.mercuryPinned;
    if (!workspace.mercuryPinned && workspace.mercuryManualIndex === undefined)
      workspace.mercuryCard = workspace.mercuryHistory?.at(-1);
    return true;
  }
  if (action === 'mercury-auto') {
    workspace.mercuryPinned = false;
    workspace.mercuryManualIndex = undefined;
    workspace.mercuryCard = workspace.mercuryHistory?.at(-1);
    return true;
  }
  if (action !== 'script-next' && action !== 'script-previous') return false;
  const direction = action === 'script-next' ? 1 : -1;
  const history = workspace.mercuryHistory ?? [];
  if (workspace.mercuryCard?.kind === 'approved' && history.length) {
    const current = history.findIndex((view) => view === workspace.mercuryCard);
    const next = Math.max(0, Math.min(history.length - 1, current + direction));
    workspace.mercuryManualIndex = next;
    workspace.mercuryCard = history[next];
    workspace.mercuryPinned = false;
  } else {
    const script = workspace.coachingLibrary?.scripts.find(
      (s) => s.id === workspace.activeScriptId,
    );
    const count = script ? scriptSteps(script.content).length : 0;
    workspace.scriptStep = Math.max(
      0,
      Math.min(Math.max(0, count - 4), (workspace.scriptStep ?? 0) + direction),
    );
  }
  return true;
};
