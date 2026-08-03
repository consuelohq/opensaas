import { describe, expect, it } from 'bun:test';
import type { LeadConnectorDatabase } from '@consuelo/lead-connector';
import { initializeLeadConnectorDialerLearning } from './lead-connector-learning';

describe('LeadConnector learning initialization', () => {
  it('creates the attempt ledger before the outcome model tables', async () => {
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
});
