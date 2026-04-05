import type { RouteDefinition } from '../index';
import type { ApiRequest } from '../../types';
import {
  createAuthenticatedRequest,
  executeHandler,
} from '../../testing/routeTestHelper';

/* eslint-disable no-var */
var mockQuery: jest.Mock;
var mockClientQuery: jest.Mock;
var mockConnect: jest.Mock;
var mockRelease: jest.Mock;
/* eslint-enable no-var */

jest.mock('../../shared/db', () => {
  mockQuery = jest.fn();
  mockClientQuery = jest.fn();
  mockRelease = jest.fn();
  mockConnect = jest.fn().mockResolvedValue({
    query: mockClientQuery,
    release: mockRelease,
  });
  return {
    getSharedPool: jest.fn().mockResolvedValue({
      query: mockQuery,
      connect: mockConnect,
    }),
  };
});

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

jest.mock('@consuelo/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { queueRoutes } from '../queues';

type Route = RouteDefinition;
let routes: Route[];

const findRoute = (method: string, path: string): Route => {
  const route = routes.find(
    (entry) => entry.method === method && entry.path === path,
  );
  if (route === undefined) {
    throw new Error(`Route not found: ${method} ${path}`);
  }
  return route;
};

const exec = (route: Route, request?: Partial<ApiRequest>) =>
  executeHandler(route.handler, request);

beforeAll(() => {
  routes = queueRoutes();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// --- POST /v1/queues (create) ---

describe('POST /v1/queues', () => {
  const route = () => findRoute('POST', '/v1/queues');

  it('should create a queue with contacts', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'q1', name: 'Test Queue', status: 'idle' }],
      })
      .mockResolvedValueOnce({ rows: [] }); // batch insert items

    const response = await exec(
      route(),
      createAuthenticatedRequest({
        method: 'POST',
        body: { name: 'Test Queue', contactIds: ['c1', 'c2'] },
      }),
    );

    expect(response.statusCode).toBe(201);
    expect(response.body).toMatchObject({ id: 'q1', name: 'Test Queue' });
  });

  it('should reject missing name', async () => {
    const response = await exec(
      route(),
      createAuthenticatedRequest({
        method: 'POST',
        body: { contactIds: ['c1'] },
      }),
    );
    expect(response.statusCode).toBe(400);
  });

  it('should reject missing contactIds', async () => {
    const response = await exec(
      route(),
      createAuthenticatedRequest({
        method: 'POST',
        body: { name: 'Test' },
      }),
    );
    expect(response.statusCode).toBe(400);
  });

  it('should reject empty contactIds array', async () => {
    const response = await exec(
      route(),
      createAuthenticatedRequest({
        method: 'POST',
        body: { name: 'Test', contactIds: [] },
      }),
    );
    expect(response.statusCode).toBe(400);
  });
});

// --- GET /v1/queues (list) ---

describe('GET /v1/queues', () => {
  const route = () => findRoute('GET', '/v1/queues');

  it('should return all queues for workspace', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'q1', name: 'Queue 1' },
        { id: 'q2', name: 'Queue 2' },
      ],
    });

    const response = await exec(route(), createAuthenticatedRequest());
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(2);
  });

  it('should return empty array when no queues', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const response = await exec(route(), createAuthenticatedRequest());
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([]);
  });
});

// --- GET /v1/queues/:id ---

describe('GET /v1/queues/:id', () => {
  const route = () => findRoute('GET', '/v1/queues/:id');

  it('should return queue with items', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'q1', name: 'Queue 1' }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'item1', position: 1, status: 'pending' }],
      });

    const response = await exec(
      route(),
      createAuthenticatedRequest({ params: { id: 'q1' } }),
    );
    expect(response.statusCode).toBe(200);
    expect((response.body as Record<string, unknown>).items).toHaveLength(1);
  });

  it('should return 404 for non-existent queue', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const response = await exec(
      route(),
      createAuthenticatedRequest({ params: { id: 'missing' } }),
    );
    expect(response.statusCode).toBe(404);
  });
});

// --- POST /v1/queues/:id/start ---

describe('POST /v1/queues/:id/start', () => {
  const route = () => findRoute('POST', '/v1/queues/:id/start');

  it('should start queue and return first item', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: 'q1', status: 'active' }],
      }) // UPDATE status
      .mockResolvedValueOnce({ rows: [] }) // check existing calling
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'item1',
            contact_id: 'c1',
            suppression_reason: null,
            position: 1,
          },
        ],
      }) // cadence candidate
      .mockResolvedValueOnce({
        rows: [{ queue_item_id: 'item1' }],
      }) // update + ledger
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const response = await exec(
      route(),
      createAuthenticatedRequest({ params: { id: 'q1' } }),
    );
    expect(response.statusCode).toBe(200);
    expect(
      (response.body as Record<string, unknown>).currentItem,
    ).not.toBeNull();
  });

  it('should return 404 for non-existent queue', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // UPDATE returns nothing
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const response = await exec(
      route(),
      createAuthenticatedRequest({ params: { id: 'missing' } }),
    );
    expect(response.statusCode).toBe(404);
  });
});

// --- POST /v1/queues/:id/pause ---

describe('POST /v1/queues/:id/pause', () => {
  const route = () => findRoute('POST', '/v1/queues/:id/pause');

  it('should pause an active queue', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'q1', status: 'paused' }],
    });

    const response = await exec(
      route(),
      createAuthenticatedRequest({ params: { id: 'q1' } }),
    );
    expect(response.statusCode).toBe(200);
    expect((response.body as Record<string, unknown>).status).toBe('paused');
  });

  it('should return 404 for non-existent queue', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const response = await exec(
      route(),
      createAuthenticatedRequest({ params: { id: 'missing' } }),
    );
    expect(response.statusCode).toBe(404);
  });
});

// --- POST /v1/queues/:id/skip ---

describe('POST /v1/queues/:id/skip', () => {
  const route = () => findRoute('POST', '/v1/queues/:id/skip');

  it('should skip current item and return next', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: 'q1', workspace_id: 'ws-test-001' }],
      }) // check queue
      .mockResolvedValueOnce({
        rows: [{ id: 'item1', status: 'calling' }],
      }) // current calling item
      .mockResolvedValueOnce({ rows: [{ id: 'item1' }] }) // update to skipped
      .mockResolvedValueOnce({ rows: [] }) // increment skipped
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'item2',
            contact_id: 'c2',
            suppression_reason: null,
            position: 2,
          },
        ],
      }) // next cadence candidate
      .mockResolvedValueOnce({
        rows: [{ queue_item_id: 'item2' }],
      }) // update + ledger
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const response = await exec(
      route(),
      createAuthenticatedRequest({
        params: { id: 'q1' },
        body: { reason: 'not interested' },
      }),
    );
    expect(response.statusCode).toBe(200);
    expect((response.body as Record<string, unknown>).skipped).toBe(true);
  });
});

// --- POST /v1/queues/:id/next ---

describe('POST /v1/queues/:id/next', () => {
  const route = () => findRoute('POST', '/v1/queues/:id/next');

  it('should complete current item and return next', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'q1',
            workspace_id: 'ws-test-001',
            settings: {},
          },
        ],
      }) // check queue
      .mockResolvedValueOnce({
        rows: [{ id: 'item1', attempts: 1 }],
      }) // current calling item
      .mockResolvedValueOnce({ rows: [{ id: 'item1' }] }) // update completed
      .mockResolvedValueOnce({ rows: [] }) // increment completed
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'item2',
            contact_id: 'c2',
            suppression_reason: null,
            position: 2,
          },
        ],
      }) // next cadence candidate
      .mockResolvedValueOnce({
        rows: [{ queue_item_id: 'item2' }],
      }) // update + ledger
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const response = await exec(
      route(),
      createAuthenticatedRequest({
        params: { id: 'q1' },
        body: { outcome: 'connected' },
      }),
    );
    expect(response.statusCode).toBe(200);
    expect(
      (response.body as Record<string, unknown>).nextItem,
    ).not.toBeNull();
  });

  it('should mark queue completed when no more items', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: 'q1', workspace_id: 'ws-test-001', settings: {} }],
      })
      .mockResolvedValueOnce({ rows: [] }) // no calling item
      .mockResolvedValueOnce({ rows: [] }) // no cadence candidate
      .mockResolvedValueOnce({ rows: [] }) // update queue completed
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const response = await exec(
      route(),
      createAuthenticatedRequest({ params: { id: 'q1' } }),
    );
    expect(response.statusCode).toBe(200);
    expect((response.body as Record<string, unknown>).queueCompleted).toBe(
      true,
    );
  });

  it('should suppress when cadence rules block contact', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: 'q1', workspace_id: 'ws-test-001', settings: {} }],
      })
      .mockResolvedValueOnce({ rows: [] }) // no calling item
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'item1',
            contact_id: 'c1',
            suppression_reason: 'MAX_ATTEMPTS_PER_DAY',
            position: 1,
          },
        ],
      }) // suppressed candidate
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const response = await exec(
      route(),
      createAuthenticatedRequest({ params: { id: 'q1' } }),
    );
    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.nextItem).toBeNull();
    expect(body.suppression).toMatchObject({
      contactId: 'c1',
      reason: 'MAX_ATTEMPTS_PER_DAY',
    });
  });
});

// --- POST /v1/queues/:id/restart ---

describe('POST /v1/queues/:id/restart', () => {
  const route = () => findRoute('POST', '/v1/queues/:id/restart');

  it('should restart queue and reset items', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'q1' }] }) // check queue
      .mockResolvedValueOnce({ rows: [] }) // reset items
      .mockResolvedValueOnce({ rows: [] }); // reset queue

    const response = await exec(
      route(),
      createAuthenticatedRequest({ params: { id: 'q1' } }),
    );
    expect(response.statusCode).toBe(200);
    expect((response.body as Record<string, unknown>).restarted).toBe(true);
  });

  it('should return 404 for non-existent queue', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const response = await exec(
      route(),
      createAuthenticatedRequest({ params: { id: 'missing' } }),
    );
    expect(response.statusCode).toBe(404);
  });
});

// --- POST /v1/queues/:id/assign ---

describe('POST /v1/queues/:id/assign', () => {
  const route = () => findRoute('POST', '/v1/queues/:id/assign');

  it('should assign user to queue', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'q1', user_id: 'new-user' }],
    });

    const response = await exec(
      route(),
      createAuthenticatedRequest({
        params: { id: 'q1' },
        body: { userId: 'new-user' },
      }),
    );
    expect(response.statusCode).toBe(200);
  });

  it('should reject missing userId', async () => {
    const response = await exec(
      route(),
      createAuthenticatedRequest({
        params: { id: 'q1' },
        body: {},
      }),
    );
    expect(response.statusCode).toBe(400);
  });
});

// --- GET /v1/queues/:id/analytics ---

describe('GET /v1/queues/:id/analytics', () => {
  const route = () => findRoute('GET', '/v1/queues/:id/analytics');

  it('should return analytics for a queue', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'q1',
            started_at: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            status: 'completed',
            call_outcome: 'connected',
            call_duration_seconds: 120,
          },
          {
            status: 'completed',
            call_outcome: 'no-answer',
            call_duration_seconds: 0,
          },
          {
            status: 'skipped',
            call_outcome: null,
            call_duration_seconds: null,
          },
        ],
      });

    const response = await exec(
      route(),
      createAuthenticatedRequest({ params: { id: 'q1' } }),
    );
    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.totalCalls).toBe(3);
    expect(body.answeredCount).toBe(1);
    expect(body.answerRatePercentage).toBe(33);
    expect(body.avgCallDurationSeconds).toBe(40);
    expect(body.outcomeBreakdown).toMatchObject({
      connected: 1,
      'no-answer': 1,
    });
  });

  it('should handle empty queue analytics', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'q1', started_at: null }] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await exec(
      route(),
      createAuthenticatedRequest({ params: { id: 'q1' } }),
    );
    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.totalCalls).toBe(0);
    expect(body.answerRatePercentage).toBe(0);
  });
});

// --- GET /v1/queues/:id/export ---

describe('GET /v1/queues/:id/export', () => {
  const route = () => findRoute('GET', '/v1/queues/:id/export');

  it('should return CSV export', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'q1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            position: 1,
            contact_id: 'c1',
            status: 'completed',
            call_outcome: 'connected',
            call_duration_seconds: 60,
            skip_reason: null,
            last_attempt_at: '2026-03-29T15:00:00Z',
          },
        ],
      });

    const response = await exec(
      route(),
      createAuthenticatedRequest({ params: { id: 'q1' } }),
    );
    expect(response.statusCode).toBe(200);
    expect(response.contentType).toBe('text/csv');
    expect(response.rawBody).toContain('position,contact_id');
    expect(response.rawBody).toContain('1,c1,completed,connected');
  });

  it('should return 404 for non-existent queue', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const response = await exec(
      route(),
      createAuthenticatedRequest({ params: { id: 'missing' } }),
    );
    expect(response.statusCode).toBe(404);
  });
});
