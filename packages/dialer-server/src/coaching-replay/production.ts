import type { CardId } from './fixtures';
import type { ReplaySession } from './runner';
import { fixtureParticipants } from './transcript';
import {
  compilePlaybook,
  SYNTHETIC_LIFE_INSURANCE,
} from '../coaching/playbooks';
import {
  createClosedSetSelector,
  createScriptSession,
} from '../coaching/script-engine';

// These are the same compiler and session used by the server. The selector is a
// local deterministic fixture, not Pi, a paid model, or an accuracy proxy.
export function createProductionReplaySession(lane: 'rules' | 'mock-selector') {
  return ((scope, emit, clock): ReplaySession => {
    const compiled = compilePlaybook({
      workspaceId: scope.workspaceId,
      scriptId: 'synthetic-script',
      sourceRevision: 1,
      version: 1,
      title: 'Synthetic examples',
      content: SYNTHETIC_LIFE_INSURANCE.content,
      industryPackVersion: 'synthetic-industry-v1',
      companyPolicyVersion: 'synthetic-policy-v1',
      // Match the normal UI publication path: no handcrafted trigger rules.
    });
    const selector =
      lane === 'mock-selector'
        ? createClosedSetSelector({
            providerRevision: 'fixture',
            modelRevision: 'fixed-v1',
            structuredOutput: true,
            run: async ({ cards, turns }) => {
              const card = cards[0],
                latest = turns[turns.length - 1];
              if (!card || !latest) return null;
              return {
                cardId: card.cardId,
                slotIds: card.slotIds,
                evidence: [
                  { segmentId: latest.id, segmentRevision: latest.revision },
                ],
              };
            },
          })
        : undefined;
    const allowed = new Set(compiled.playbook.cards.map((card) => card.id));
    return createScriptSession({
      scope,
      participants: fixtureParticipants,
      compiled,
      nowMs: () => clock.nowMs(),
      selector,
      policy: {
        scope,
        memberId: 'fixture-rep',
        revision: 1,
        validUntilMs: 100000,
        revoked: false,
        capabilities: [
          'manual-reference',
          'live-transcription',
          'live-coaching',
        ],
        consent: {
          ephemeralTranscription: true,
          retainedTranscript: false,
          aiGeneration: false,
        },
      },
      onDecision: (patch) => {
        if (patch.source === 'manual') return;
        if (!allowed.has(patch.cardId)) throw new Error('unapproved decision');
        emit(patch.cardId as CardId);
      },
    });
  }) satisfies Parameters<typeof import('./runner').runTextReplay>[0]['create'];
}
