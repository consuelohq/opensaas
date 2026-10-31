import { it, expect } from 'bun:test';
import { scriptSteps, renderLiveScript } from './script-presentation';
import type { CallingWorkspace } from './calling-workspace';
it('presents short literal script cues and keeps model instructions as escaped text', () => {
  const content =
    '# Opening\nHello, thanks for calling. What would help you?\n- <script>alert(1)</script>';
  expect(scriptSteps(content).slice(0, 2)).toEqual([
    'Opening',
    'Hello, thanks for calling.',
  ]);
  const workspace: CallingWorkspace = {
    screen: 'calling',
    mode: 'inbound',
    compact: false,
    coachingMode: 'script',
    activeScriptId: 's',
    scriptStep: 3,
    coachingLibrary: {
      scripts: [
        {
          id: 's',
          title: 'Script',
          content,
          revision: 1,
          updatedAt: '2026-10-31T00:00:00Z',
          canEdit: true,
        },
      ],
    },
  };
  expect(renderLiveScript(workspace)).toContain('&lt;script&gt;');
  expect(renderLiveScript({ ...workspace, coachingMode: 'off' })).toBe('');
  expect(
    scriptSteps('Long sentence ' + Array(80).fill('discovery').join(' ')).every(
      (s) => s.length <= 200,
    ),
  ).toBe(true);
});

it('never exceeds 200 UTF-16 units for long words or the joining space', () => {
  const oversized = 'z'.repeat(451);
  const pieces = scriptSteps(oversized);
  expect(pieces.every((cue) => cue.length <= 200)).toBe(true);
  expect(pieces.join('')).toBe(oversized);
  const withSpace = scriptSteps('x'.repeat(199) + ' y');
  expect(withSpace.every((cue) => cue.length <= 200)).toBe(true);
  expect(withSpace).toEqual(['x'.repeat(199), 'y']);
});
