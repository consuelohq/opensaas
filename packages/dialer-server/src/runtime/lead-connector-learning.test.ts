import { describe, expect, it } from 'bun:test';
import type { ParallelTelemetryRecord } from '@consuelo/dialer';
import type { LeadConnectorDatabase } from '@consuelo/lead-connector';
import {
  initializeLeadConnectorDialerLearning,
  recordLeadConnectorAttemptTelemetry,
} from './lead-connector-learning';

describe('LeadConnector learning initialization', () => {
  it('creates the compatibility attempt ledger before the compatibility outcome tables', async () => {
    const calls: string[] = [];
    let resolveLedgerTable: (() => void) | undefined;
    const ledgerTableCreated = new Promise<void>((resolve) => {
      resolveLedgerTable = resolve;
    });
    const database: LeadConnectorDatabase = {
      query: async <T>(text: string) => {
        calls.push(text);
        if (text.includes('CREATE TABLE IF NOT EXISTS contact_attempt_ledger')) {
          await ledgerTableCreated;
        }
        return { rows: [] as T[] };
      },
    };

    const initialization = initializeLeadConnectorDialerLearning(database);
    await Promise.resolve();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain(
      'CREATE TABLE IF NOT EXISTS contact_attempt_ledger',
    );

    resolveLedgerTable?.();
    await initialization;

    expect(calls).toHaveLength(4);
    expect(calls[1]).toContain(
      'CREATE INDEX IF NOT EXISTS idx_contact_attempt_ledger_last_attempt',
    );
    expect(calls[2]).toContain(
      'CREATE TABLE IF NOT EXISTS consuelo_lead_connector_call_outcomes',
    );
    expect(calls[3]).toContain(
      'CREATE INDEX IF NOT EXISTS consuelo_lead_connector_call_outcomes_model_idx',
    );
  });

  it('uses the canonical observation insert as the idempotency gate for compatibility writes', async () => {
    const queries: Array<{ text: string; values: readonly unknown[] }> = [];
    const database: LeadConnectorDatabase = {
      query: async <T>(text: string, values: readonly unknown[] = []) => {
        queries.push({ text, values });
        return { rows: [] as T[] };
      },
    };
    const record: ParallelTelemetryRecord = {
      group: {
        groupId: 'group-1',
        conferenceName: 'conference-1',
        status: 'completed',
        winnerSid: 'call-winner',
        calls: [
          {
            callSid: 'call-winner',
            customerNumber: '+15550000001',
            fromNumber: '+15550000011',
            position: 1,
            status: 'completed',
            amdResult: 'human',
            contactId: 'contact-1',
            dialStartedAt: '2026-08-15T12:00:00.000Z',
            answeredAt: '2026-08-15T12:00:05.000Z',
          },
          {
            callSid: 'call-loser',
            customerNumber: '+15550000002',
            fromNumber: '+15550000012',
            position: 2,
            status: 'canceled',
            contactId: 'contact-2',
            dialStartedAt: '2026-08-15T12:00:00.500Z',
            terminatedAt: '2026-08-15T12:00:06.000Z',
          },
        ],
        workspaceId: 'workspace-1',
        queueId: 'queue-1',
        userId: 'user-1',
        createdAt: '2026-08-15T12:00:00.000Z',
        campaignSegment: 'segment-1',
        profile: {
          id: 'balanced',
          fanout: 2,
          staggerMs: 500,
          amdPolicy: 'human-or-unknown',
          terminationPolicy: 'winner-take-all',
        },
        resolverReason: 'test',
        cleanupFailures: [],
        connectedAt: '2026-08-15T12:00:05.000Z',
        completedAt: '2026-08-15T12:00:20.000Z',
      },
      telemetry: {
        winnerRate: 0.5,
        wastedLegs: 1,
        connectLatencyMs: 5_000,
      },
      success: true,
    };

    await expect(
      recordLeadConnectorAttemptTelemetry(database, record, undefined, {
        timezone: 'UTC',
      }),
    ).resolves.toBe(true);

    expect(queries).toHaveLength(2);
    for (const query of queries) {
      expect(query.text).toContain('WITH canonical_insert AS');
      expect(query.text).toContain('INSERT INTO dialer_learning_observations');
      expect(query.text).toContain(
        'ON CONFLICT (workspace_id, group_id, position) DO NOTHING',
      );
      expect(query.text).toContain('FROM canonical_insert');
    }
    expect(queries.some((query) => query.values.includes('response'))).toBe(true);
    expect(queries.some((query) => query.values.includes('censored'))).toBe(true);
    expect(
      queries.some((query) => query.values.includes('competing_winner')),
    ).toBe(true);
    expect(queries.every((query) => query.values.includes(12))).toBe(true);
    expect(queries.every((query) => query.values.includes(6))).toBe(true);
  });
});
