import { expect, it } from 'bun:test';
import {
  receiveMercuryView,
  mercuryAction,
  synchronizeMercuryScope,
} from './mercury-workspace';
import type { CallingWorkspace } from './calling-workspace';
import type { MercuryCueView } from './mercury-cues';
const cue = (revision: number): MercuryCueView => ({
  scopeKey: 'outbound:a',
  revision,
  heading: 'Stage ' + revision,
  kind: 'approved',
  status: 'live',
  points: [
    {
      slotId: '1',
      text: 'Ask about family',
      exact: 'Ask about family.',
      source: 'v1',
    },
  ],
});
it('pins, browses previous cards and returns to newest automatic view without telephony authority', () => {
  const workspace: CallingWorkspace = {
    screen: 'calling',
    mode: 'outbound',
    compact: false,
  };
  synchronizeMercuryScope(workspace, 'outbound:a');
  receiveMercuryView(workspace, cue(1));
  mercuryAction(workspace, 'mercury-pin');
  receiveMercuryView(workspace, cue(2));
  expect(workspace.mercuryCard?.revision).toBe(1);
  mercuryAction(workspace, 'mercury-auto');
  expect(workspace.mercuryCard?.revision).toBe(2);
  mercuryAction(workspace, 'script-previous');
  expect(workspace.mercuryCard?.revision).toBe(1);
  receiveMercuryView(workspace, cue(3));
  expect(workspace.mercuryCard?.revision).toBe(1);
  mercuryAction(workspace, 'mercury-auto');
  expect(workspace.mercuryCard?.revision).toBe(3);
  synchronizeMercuryScope(workspace, 'outbound:b');
  expect(workspace.mercuryCard).toBeUndefined();
  expect(workspace.mercuryPinned).toBe(false);
  receiveMercuryView(workspace, cue(9));
  expect(workspace.mercuryCard).toBeUndefined();
});
it('manual scripts keep literal previous and next navigation with a stable last page', () => {
  const workspace: CallingWorkspace = {
    screen: 'calling',
    mode: 'outbound',
    compact: false,
    activeScriptId: 's',
    coachingLibrary: {
      scripts: [
        {
          id: 's',
          title: 'Script',
          content: 'One. Two. Three. Four. Five.',
          revision: 1,
          updatedAt: '',
          canEdit: true,
        },
      ],
    },
  };
  mercuryAction(workspace, 'script-next');
  expect(workspace.scriptStep).toBe(1);
  mercuryAction(workspace, 'script-next');
  expect(workspace.scriptStep).toBe(1);
  mercuryAction(workspace, 'script-previous');
  expect(workspace.scriptStep).toBe(0);
});
