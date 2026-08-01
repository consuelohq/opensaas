import { describe, expect, it } from 'bun:test';
import type { LeadConnectorDatabase } from '@consuelo/lead-connector';
import { initializeLeadConnectorDialerLearning } from './lead-connector-learning';

describe('LeadConnector learning initialization', () => {
  it('creates the outcomes table before creating its index', async () => {
    const calls: string[] = [];
    let resolveTable: (() => void) | undefined;
    const tableCreated = new Promise<void>((resolve) => {
      resolveTable = resolve;
    });
    const database: LeadConnectorDatabase = {
      query: async <T>(text: string) => {
        calls.push(text);
        if (text.includes('CREATE TABLE')) {
          await tableCreated;
        }
        return { rows: [] as T[] };
      },
    };

    const initialization = initializeLeadConnectorDialerLearning(database);
    await Promise.resolve();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('CREATE TABLE');

    resolveTable?.();
    await initialization;

    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain('CREATE INDEX');
  });
});
