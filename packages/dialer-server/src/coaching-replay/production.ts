import {
  createContextScheduler,
  type ContextScheduler,
} from '../coaching/context-scheduler';
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
  type ClosedSetSelector,
} from '../coaching/script-engine';

// These are the same compiler and session used by the server. The selector is a
// local deterministic fixture, not Pi, a paid model, or an accuracy proxy.
export function createProductionReplaySession(
  lane: 'rules' | 'reviewed-rules' | 'mock-selector' | 'context-provider',
  contextualSelector?: ClosedSetSelector,
  sharedScheduler?: ContextScheduler,
) {
  if (lane === 'context-provider' && !contextualSelector)
    throw new Error('context selector required');
  const scheduler =
    lane === 'context-provider' || lane === 'mock-selector'
      ? (sharedScheduler ?? createContextScheduler())
      : undefined;
  return ((scope, emit, clock): ReplaySession => {
    const startedAt = performance.now();
    const compiled = compilePlaybook({
      workspaceId: scope.workspaceId,
      scriptId: 'synthetic-script',
      sourceRevision: 1,
      version: 1,
      title: 'Synthetic examples',
      content: SYNTHETIC_LIFE_INSURANCE.content,
      industryPackVersion: 'synthetic-industry-v1',
      companyPolicyVersion: 'synthetic-policy-v1',
      // The original rules lane retains UI-default heading triggers.
      ...(lane === 'reviewed-rules' || lane === 'context-provider'
        ? { rules: SYNTHETIC_LIFE_INSURANCE.rules }
        : {}),
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
        : lane === 'context-provider'
          ? contextualSelector
          : undefined;
    const allowed = new Set(compiled.playbook.cards.map((card) => card.id));
    return createScriptSession({
      scope,
      participants: fixtureParticipants,
      compiled,
      nowMs: () =>
        lane === 'context-provider'
          ? 1000 + performance.now() - startedAt
          : clock.nowMs(),
      selector,
      scheduler,
      ...(lane === 'context-provider' ? { maxSelectorRequests: 1 } : {}),
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
      onChange:
        lane === 'context-provider'
          ? (view) => {
              if (view.kind !== 'approved') {
                emit(null);
                return;
              }
              const matching = compiled.playbook.cards.filter(
                (card) => card.title === view.heading,
              );
              if (matching.length !== 1 || !allowed.has(matching[0]!.id))
                throw new Error('unapproved visible card');
              emit(matching[0]!.id as CardId);
            }
          : undefined,
      onDecision: (patch) => {
        if (lane === 'context-provider' || patch.source === 'manual') return;
        if (!allowed.has(patch.cardId)) throw new Error('unapproved decision');
        emit(patch.cardId as CardId);
      },
    });
  }) satisfies Parameters<typeof import('./runner').runTextReplay>[0]['create'];
}
