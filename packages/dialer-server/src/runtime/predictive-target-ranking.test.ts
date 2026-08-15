import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';

import type { CallableTarget } from '@consuelo/dialer';
import type { LeadConnectorDatabase } from '@consuelo/lead-connector';

import { rankPredictiveTargets } from './predictive-target-ranking';

type QueryCall = {
  text: string;
  values: readonly unknown[];
};

const ECONOMICS_ROW = {
  avg_deal_value: '100',
  avg_close_rate: '1',
  cost_per_attempt: '1',
};

const createCanonicalDatabase = (options?: {
  attemptRows?: Array<{
    contact_id: string;
    attempts_total: number;
    last_attempt_at: string | null;
  }>;
  probabilityRows?: Array<{
    attempt_number: number;
    successes: number;
    trials: number;
  }>;
  hazardRows?: Array<{
    attempt_number: number;
    local_hour: number;
    local_day_of_week: number;
    successes: number;
    trials: number;
  }>;
  economicsRow?: typeof ECONOMICS_ROW | null;
  failCanonical?: boolean;
}) => {
  const calls: QueryCall[] = [];
  const database: LeadConnectorDatabase = {
    query: async <T>(text: string, values: readonly unknown[] = []) => {
      calls.push({ text, values });
      if (text.includes('consuelo_lead_connector_call_outcomes')) {
        throw new Error(`legacy compatibility outcome query: ${text}`);
      }
      if (text.includes('WhittleIndexService') || text.includes('core.')) {
        throw new Error(`legacy predictive dependency: ${text}`);
      }
      if (text.includes('FROM contact_attempt_ledger')) {
        return { rows: (options?.attemptRows ?? []) as T[] };
      }
      if (text.includes('FROM dialer_learning_observations')) {
        if (options?.failCanonical) {
          throw new Error('canonical learning unavailable');
        }
        if (
          text.includes('local_hour') &&
          text.includes('GROUP BY attempt_number, local_hour, local_day_of_week')
        ) {
          return { rows: (options?.hazardRows ?? []) as T[] };
        }
        return { rows: (options?.probabilityRows ?? []) as T[] };
      }
      if (text.includes('FROM dialer_workspace_settings')) {
        return {
          rows: (options?.economicsRow === null
            ? []
            : [options?.economicsRow ?? ECONOMICS_ROW]) as T[],
        };
      }
      return { rows: [] as T[] };
    },
  };
  return { database, calls };
};

const targets: CallableTarget[] = [
  { contactId: 'contact-a', phone: '+15550100001' },
  { contactId: 'contact-b', phone: '+15550100002' },
];

describe('canonical predictive target runtime cutover', () => {
  it('keeps the predictive decision adapter provider-neutral and legacy-model free', async () => {
    const source = await readFile(
      new URL('./predictive-target-ranking.ts', import.meta.url),
      'utf8',
    );

    expect(source).not.toContain('WhittleIndexService');
    expect(source).not.toContain('consuelo_lead_connector_call_outcomes');
    expect(source).not.toContain('@consuelo/lead-connector');
  });

  it('ranks from canonical observations and never reads the compatibility outcome model', async () => {
    const harness = createCanonicalDatabase({
      attemptRows: [
        {
          contact_id: 'contact-a',
          attempts_total: 0,
          last_attempt_at: null,
        },
        {
          contact_id: 'contact-b',
          attempts_total: 1,
          last_attempt_at: null,
        },
      ],
      probabilityRows: [
        { attempt_number: 1, successes: 20, trials: 100 },
        { attempt_number: 2, successes: 70, trials: 100 },
      ],
      hazardRows: [
        {
          attempt_number: 1,
          local_hour: 12,
          local_day_of_week: 0,
          successes: 20,
          trials: 100,
        },
        {
          attempt_number: 2,
          local_hour: 12,
          local_day_of_week: 0,
          successes: 70,
          trials: 100,
        },
      ],
    });

    const ranked = await rankPredictiveTargets({
      database: harness.database,
      workspaceId: 'workspace-1',
      segmentId: 'queue-segment-1',
      targets,
      timezone: 'UTC',
      callableWindowEndHour: 20,
      now: new Date('2026-08-09T12:00:00.000Z'),
    });

    expect(ranked.map((target) => target.contactId)).toEqual([
      'contact-b',
      'contact-a',
    ]);
    expect(
      harness.calls.some((call) =>
        call.text.includes('FROM dialer_learning_observations'),
      ),
    ).toBe(true);
    expect(
      harness.calls.some((call) =>
        call.text.includes('consuelo_lead_connector_call_outcomes'),
      ),
    ).toBe(false);
    const canonicalCalls = harness.calls.filter((call) =>
      call.text.includes('FROM dialer_learning_observations'),
    );
    expect(canonicalCalls.length).toBeGreaterThanOrEqual(2);
    expect(
      canonicalCalls.every((call) => call.values[1] === 'queue-segment-1'),
    ).toBe(true);
  });

  it('applies canonical stopping suppression even when only one candidate remains', async () => {
    const harness = createCanonicalDatabase({
      attemptRows: [
        {
          contact_id: 'contact-stop',
          attempts_total: 2,
          last_attempt_at: '2026-08-09T10:00:00.000Z',
        },
      ],
      probabilityRows: [
        { attempt_number: 3, successes: 0, trials: 100 },
      ],
      hazardRows: [
        {
          attempt_number: 3,
          local_hour: 12,
          local_day_of_week: 0,
          successes: 0,
          trials: 100,
        },
      ],
      economicsRow: {
        avg_deal_value: '1',
        avg_close_rate: '1',
        cost_per_attempt: '0.5',
      },
    });

    const ranked = await rankPredictiveTargets({
      database: harness.database,
      workspaceId: 'workspace-1',
      segmentId: 'queue-stop',
      targets: [{ contactId: 'contact-stop', phone: '+15550100003' }],
      timezone: 'UTC',
      callableWindowEndHour: 20,
      now: new Date('2026-08-09T12:00:00.000Z'),
    });

    expect(ranked).toEqual([]);
  });

  it('preserves FIFO when canonical evidence is absent but economics are valid', async () => {
    const harness = createCanonicalDatabase({
      attemptRows: [
        { contact_id: 'contact-a', attempts_total: 0, last_attempt_at: null },
        { contact_id: 'contact-b', attempts_total: 0, last_attempt_at: null },
      ],
    });

    const ranked = await rankPredictiveTargets({
      database: harness.database,
      workspaceId: 'workspace-1',
      segmentId: 'new-queue',
      targets,
      timezone: 'UTC',
      callableWindowEndHour: 20,
      now: new Date('2026-08-09T12:00:00.000Z'),
    });

    expect(ranked).toEqual(targets);
    expect(
      harness.calls.some((call) =>
        call.text.includes('FROM dialer_workspace_settings'),
      ),
    ).toBe(true);
  });

  it('fails open to FIFO and reports one fallback when the canonical store is unavailable', async () => {
    const harness = createCanonicalDatabase({
      attemptRows: [
        { contact_id: 'contact-a', attempts_total: 0, last_attempt_at: null },
        { contact_id: 'contact-b', attempts_total: 1, last_attempt_at: null },
      ],
      failCanonical: true,
    });
    const fallbacks: Array<{ workspaceId: string; error: string }> = [];

    const ranked = await rankPredictiveTargets({
      database: harness.database,
      workspaceId: 'workspace-1',
      segmentId: 'queue-failure',
      targets,
      timezone: 'UTC',
      callableWindowEndHour: 20,
      onFallback: (details) => fallbacks.push(details),
    });

    expect(ranked).toEqual(targets);
    expect(fallbacks).toHaveLength(1);
    expect(fallbacks[0]).toMatchObject({ workspaceId: 'workspace-1' });
    expect(fallbacks[0]?.error).toContain('canonical learning unavailable');
  });
});
