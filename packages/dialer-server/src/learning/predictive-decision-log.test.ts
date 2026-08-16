import { describe, expect, it } from 'bun:test';

import type { LeadConnectorDatabase } from '@consuelo/lead-connector';
import {
  finalizePredictiveDecision,
  recordPredictiveDecision,
} from './predictive-decision-log';

const createDatabaseHarness = () => {
  const calls: Array<{ text: string; values: readonly unknown[] }> = [];
  const database: LeadConnectorDatabase = {
    query: async <T>(text: string, values: readonly unknown[] = []) => {
      calls.push({ text, values });
      return { rows: [] as T[] };
    },
  };
  return { database, calls };
};

describe('predictive decision logging', () => {
  it('records deterministic D3 decisions with nullable propensities instead of fabricating support', async () => {
    const harness = createDatabaseHarness();

    await recordPredictiveDecision(harness.database, {
      decisionId: 'decision-1',
      workspaceId: 'workspace-1',
      segmentId: 'segment-1',
      evaluatedAt: '2026-08-15T12:00:00.000Z',
      policyVersion: 'd3-canonical-v1',
      modelVersion: 'd3-canonical-v1',
      featureSchemaVersion: 2,
      policyMode: 'deterministic',
      eligible: [
        {
          contactId: 'contact-1',
          position: 0,
          nextAttemptNumber: 1,
        },
      ],
      ranked: [
        {
          contactId: 'contact-1',
          position: 0,
          nextAttemptNumber: 1,
          score: 42,
          answerProbability: 0.4,
          answerProbabilityUpperBound: 0.6,
          hazardSource: 'exact_local_slot',
        },
      ],
      suppressed: [],
      selectionProbabilities: null,
    });

    expect(harness.calls).toHaveLength(1);
    const insert = harness.calls[0]!;
    expect(insert.text).toContain('INSERT INTO dialer_predictive_decisions');
    expect(insert.text).toContain('selection_probabilities');
    expect(insert.values).toContain('deterministic');
    expect(insert.values).toContain(null);
    expect(insert.values).not.toContain(1);
  });

  it('finalizes the action separately from the ranking decision and remains workspace-scoped', async () => {
    const harness = createDatabaseHarness();

    await finalizePredictiveDecision(harness.database, {
      workspaceId: 'workspace-1',
      decisionId: 'decision-1',
      selectedContactIds: ['contact-2', 'contact-1'],
      selectedAt: '2026-08-15T12:00:01.000Z',
    });

    expect(harness.calls).toHaveLength(1);
    const update = harness.calls[0]!;
    expect(update.text).toContain('UPDATE dialer_predictive_decisions');
    expect(update.text).toContain('WHERE decision_id = $1 AND workspace_id = $2');
    expect(update.text).not.toContain('selection_probabilities =');
    expect(update.values[0]).toBe('decision-1');
    expect(update.values[1]).toBe('workspace-1');
    expect(update.values[2]).toBe(JSON.stringify(['contact-2', 'contact-1']));
    expect(update.values[3]).toBe('2026-08-15T12:00:01.000Z');
  });
});
