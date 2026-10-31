import type { CallingWorkspace } from './calling-workspace.js';
import { escapeHtml as e } from './workspace-format.js';
export const scriptSteps = (content: string): string[] =>
  content.split(/\n+/u).flatMap((line) => {
    const clean = line.replace(/^\s*(?:#{1,6}|[-*])\s+/u, '').trim();
    return clean
      ? (clean.match(/[^.!?]+[.!?]+|[^.!?]+$/gu) ?? [clean]).flatMap(
          (sentence) => {
            const chunks: string[] = [];
            let part = '';
            for (const word of sentence.trim().split(/\s+/u)) {
              let remaining = word;
              while (remaining.length) {
                const separator = part ? ' ' : '';
                const capacity = 200 - part.length - separator.length;
                if (capacity === 0) {
                  chunks.push(part);
                  part = '';
                  continue;
                }
                if (remaining.length <= capacity) {
                  part += separator + remaining;
                  break;
                }
                if (part) {
                  chunks.push(part);
                  part = '';
                  continue;
                }
                // A single long token can exceed the cue bound.
                chunks.push(remaining.slice(0, 200));
                remaining = remaining.slice(200);
              }
            }
            if (part) chunks.push(part);
            return chunks;
          },
        )
      : [];
  });
export const renderLiveScript = (workspace: CallingWorkspace): string => {
  if (workspace.coachingMode !== 'script') return '';
  const script = workspace.coachingLibrary?.scripts.find(
    (s) => s.id === workspace.activeScriptId,
  );
  if (!script) return '';
  const steps = scriptSteps(script.content);
  if (!steps.length) return '';
  const index = Math.max(
    0,
    Math.min(workspace.scriptStep ?? 0, steps.length - 1),
  );
  return `<section class="live-script" aria-label="Mercury script"><div class="section-heading"><span>${e(script.title)}</span><span>${index + 1} / ${steps.length}</span></div><p class="live-script__cue">${e(steps[index] ?? '')}</p><div class="script-navigation"><button type="button" class="text-button" data-action="script-previous"${index === 0 ? ' disabled' : ''}>Previous</button><button type="button" class="text-button" data-action="script-next"${index >= steps.length - 1 ? ' disabled' : ''}>Next</button></div></section>`;
};
