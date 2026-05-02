import * as Sentry from '@sentry/node';
import type { DataSource } from 'typeorm';

jest.mock(
  '@nestjs/common',
  () => ({
    Injectable: () => () => undefined,
    Logger: class {
      error = jest.fn();
      warn = jest.fn();
    },
  }),
  { virtual: true },
);

jest.mock(
  '@nestjs/typeorm',
  () => ({
    InjectDataSource: () => () => undefined,
  }),
  { virtual: true },
);

jest.mock('typeorm', () => ({}), { virtual: true });

jest.mock(
  'src/engine/core-modules/consuelo-api/services/cadence-store.service',
  () => ({ CadenceStoreService: class {} }),
);

jest.mock(
  'src/engine/core-modules/consuelo-api/services/call-timing-model.service',
  () => ({ CallTimingModelService: class {} }),
);

jest.mock(
  'src/engine/core-modules/consuelo-api/services/stopping-model-store.service',
  () => ({
    DEFAULT_WORKSPACE_ECONOMICS: {
      valuePerConnection: 100,
      costPerAttempt: 1,
    },
    StoppingModelStoreService: class {},
  }),
);

jest.mock(
  'src/engine/core-modules/consuelo-api/services/whittle-index-store.service',
  () => ({ WhittleIndexStoreService: class {} }),
);

import type { CadenceStoreService } from 'src/engine/core-modules/consuelo-api/services/cadence-store.service';
import type { CallTimingModelService } from 'src/engine/core-modules/consuelo-api/services/call-timing-model.service';
import { QueuesService } from 'src/engine/core-modules/consuelo-api/services/queues.service';
import type { StoppingModelStoreService } from 'src/engine/core-modules/consuelo-api/services/stopping-model-store.service';
import type { WhittleIndexStoreService } from 'src/engine/core-modules/consuelo-api/services/whittle-index-store.service';

jest.mock('@consuelo/dialer', () => ({
  StoppingModelService: class {},
}));

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

describe('QueuesService', () => {
  const query = jest.fn<
    Promise<Array<Record<string, unknown>>>,
    [string, unknown[]?]
  >();

  const buildService = () =>
    new QueuesService(
      { query } as unknown as DataSource,
      {} as StoppingModelStoreService,
      {} as CallTimingModelService,
      {} as WhittleIndexStoreService,
      {} as CadenceStoreService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('claims the next queue item with FIFO when contact attempt ledger table is absent', async () => {
    const queue = { id: 'queue-1', workspace_id: 'workspace-1' };
    const pendingItem = {
      id: 'item-1',
      queue_id: 'queue-1',
      contact_id: 'contact-1',
      position: 1,
      status: 'pending',
      attempts: 0,
    };
    const claimedItem = {
      ...pendingItem,
      status: 'calling',
      attempts: 1,
      last_attempt_at: new Date('2026-01-01T00:00:00.000Z'),
    };
    const statements: string[] = [];

    query.mockImplementation(async (statement: string) => {
      statements.push(statement);

      if (statement.includes('completed_at = COALESCE')) {
        return [{ ...queue, status: 'completed' }];
      }

      if (statement.startsWith('UPDATE call_queues SET status')) {
        return [queue];
      }

      if (statement.includes('status = $2 LIMIT 1')) {
        return [];
      }

      if (statement.includes("table_name = 'contact_attempt_ledger'")) {
        return [{ exists: false }];
      }

      if (statement.includes("column_name IN ('retry_strategy'")) {
        return [
          { column_name: 'retry_strategy' },
          { column_name: 'retry_scheduled_at' },
          { column_name: 'retry_reason' },
        ];
      }

      if (
        statement.includes("status = 'pending' ORDER BY position ASC LIMIT 1")
      ) {
        return [pendingItem];
      }

      if (
        statement.includes(
          'attempts = attempts + (CASE WHEN $3 THEN 0 ELSE 1 END)',
        )
      ) {
        return [claimedItem];
      }

      throw new Error(`unexpected query: ${statement}`);
    });

    const result = await buildService().startQueue('workspace-1', 'queue-1');

    expect(result?.currentItem).toEqual(
      expect.objectContaining({
        id: 'item-1',
        status: 'calling',
      }),
    );
    expect(
      statements.some(
        (statement) =>
          statement.includes('LEFT JOIN contact_attempt_ledger') ||
          statement.includes('INSERT INTO contact_attempt_ledger'),
      ),
    ).toBe(false);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('preserves attempts for double-dial FIFO claims without contact attempt ledger', async () => {
    const queue = { id: 'queue-1', workspace_id: 'workspace-1' };
    const pendingItem = {
      id: 'item-1',
      queue_id: 'queue-1',
      contact_id: 'contact-1',
      position: 1,
      status: 'pending',
      attempts: 2,
      retry_reason: 'double_dial',
    };
    const claimedItem = {
      ...pendingItem,
      status: 'calling',
      attempts: 2,
      retry_reason: 'double_dial_attempted',
      last_attempt_at: new Date('2026-01-01T00:00:00.000Z'),
    };
    const statements: string[] = [];

    query.mockImplementation(async (statement: string, params?: unknown[]) => {
      statements.push(statement);

      if (statement.includes('completed_at = COALESCE')) {
        return [{ ...queue, status: 'completed' }];
      }

      if (statement.startsWith('UPDATE call_queues SET status')) {
        return [queue];
      }

      if (statement.includes('status = $2 LIMIT 1')) {
        return [];
      }

      if (statement.includes("table_name = 'contact_attempt_ledger'")) {
        return [{ exists: false }];
      }

      if (statement.includes("column_name IN ('retry_strategy'")) {
        return [
          { column_name: 'retry_strategy' },
          { column_name: 'retry_scheduled_at' },
          { column_name: 'retry_reason' },
        ];
      }

      if (
        statement.includes("status = 'pending' ORDER BY position ASC LIMIT 1")
      ) {
        return [pendingItem];
      }

      if (
        statement.includes(
          'attempts = attempts + (CASE WHEN $3 THEN 0 ELSE 1 END)',
        )
      ) {
        expect(params).toEqual(['calling', 'item-1', true]);
        return [claimedItem];
      }

      throw new Error(`unexpected query: ${statement}`);
    });

    const result = await buildService().startQueue('workspace-1', 'queue-1');

    expect(result?.currentItem).toEqual(
      expect.objectContaining({
        id: 'item-1',
        status: 'calling',
        attempts: 2,
        retry_reason: 'double_dial_attempted',
      }),
    );
    expect(
      statements.some((statement) =>
        statement.includes('INSERT INTO contact_attempt_ledger'),
      ),
    ).toBe(false);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('marks queue completed when no callable item is available at start', async () => {
    const queue = { id: 'queue-1', workspace_id: 'workspace-1' };
    const statements: string[] = [];

    query.mockImplementation(async (statement: string) => {
      statements.push(statement);

      if (statement.includes('completed_at = COALESCE')) {
        return [{ ...queue, status: 'completed' }];
      }

      if (statement.startsWith('UPDATE call_queues SET status')) {
        return [queue];
      }

      if (statement.includes('status = $2 LIMIT 1')) {
        return [];
      }

      if (statement.includes("table_name = 'contact_attempt_ledger'")) {
        return [{ exists: false }];
      }

      if (statement.includes("column_name IN ('retry_strategy'")) {
        return [
          { column_name: 'retry_strategy' },
          { column_name: 'retry_scheduled_at' },
          { column_name: 'retry_reason' },
        ];
      }

      if (
        statement.includes("status = 'pending' ORDER BY position ASC LIMIT 1")
      ) {
        return [];
      }

      throw new Error(`unexpected query: ${statement}`);
    });

    const result = await buildService().startQueue('workspace-1', 'queue-1');

    expect(result?.currentItem).toBeNull();
    expect(result?.nextItem).toBeNull();
    expect(result?.queue).toEqual(
      expect.objectContaining({
        id: 'queue-1',
        status: 'completed',
      }),
    );
  });
});
