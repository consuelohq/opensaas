import { describe, expect, it } from 'bun:test';

import type { CallableTarget } from '@consuelo/dialer';
import type { LeadConnectorDatabase } from '@consuelo/lead-connector';

import { rankPredictiveLeadConnectorTargets } from './predictive-target-ranking';

describe('predictive target ranking persistence boundary', () => {
  it('uses only standalone Consuelo learning and workspace settings tables', async () => {
    const sql: string[] = [];
    const database: LeadConnectorDatabase = {
      query: async <T>(text: string) => {
        sql.push(text);
        if (text.includes('core.')) {
          throw new Error(`legacy Twenty schema query: ${text}`);
        }
        if (text.includes('FROM contact_attempt_ledger')) {
          return {
            rows: [
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
            ] as T[],
          };
        }
        if (text.includes('FROM consuelo_lead_connector_call_outcomes')) {
          return {
            rows: [
              { attempt_number: 1, answer_rate: 0.8, sample_size: 20 },
              { attempt_number: 2, answer_rate: 0.2, sample_size: 20 },
            ] as T[],
          };
        }
        if (text.includes('FROM dialer_workspace_settings')) {
          return {
            rows: [
              {
                value_per_connection: 150,
                cost_per_attempt: 0.04,
              },
            ] as T[],
          };
        }
        return { rows: [] as T[] };
      },
    };
    const targets: CallableTarget[] = [
      { contactId: 'contact-a', phone: '+15550100001' },
      { contactId: 'contact-b', phone: '+15550100002' },
    ];

    const ranked = await rankPredictiveLeadConnectorTargets({
      database,
      workspaceId: 'workspace-1',
      targets,
      timezone: 'America/New_York',
      callableWindowEndHour: 20,
      now: new Date('2026-08-09T16:00:00.000Z'),
    });

    expect(ranked).toHaveLength(2);
    expect(sql.some((statement) => statement.includes('core.'))).toBe(false);
    expect(
      sql.some((statement) =>
        statement.includes('FROM consuelo_lead_connector_call_outcomes'),
      ),
    ).toBe(true);
    expect(
      sql.some((statement) => statement.includes('FROM dialer_workspace_settings')),
    ).toBe(true);
  });
});
