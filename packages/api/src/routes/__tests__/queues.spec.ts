import type { RouteDefinition } from '../index';
import type { ApiRequest } from '../../types';
import {
  createAuthenticatedRequest,
  executeHandler,
} from '../../testing/routeTestHelper';

/* eslint-disable no-var */
var mockQuery: jest.Mock;
/* eslint-enable no-var */

jest.mock('../../shared/db', () => {
  mockQuery = jest.fn();
  return {
    getSharedPool: jest.fn().mockResolvedValue({ query: mockQuery }),
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
  const route = routes.find((entry) => {
    return entry.method === method && entry.path === path;
  });
  if (route === undefined) {
    throw new Error(`Route not found: ${method} ${path}`);
  }
  return route;
};

const exec = (route: Route, request?: Partial<ApiRequest>) => {
  return executeHandler(route.handler, request);
};

beforeAll(() => {
  routes = queueRoutes();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /v1/queues/:id/next cadence suppression', () => {
  const route = () => findRoute('POST', '/v1/queues/:id/next');

  it('should suppress when cadence rules block all pending contacts', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'queue-1', workspace_id: 'ws-test-001' }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'item-1',
            queue_id: 'queue-1',
            contact_id: 'contact-1',
            suppression_reason: 'MAX_ATTEMPTS_PER_DAY',
            position: 1,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const response = await exec(
      route(),
      createAuthenticatedRequest({ params: { id: 'queue-1' } }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      nextItem: null,
      queueCompleted: true,
      suppression: {
        contactId: 'contact-1',
        reason: 'MAX_ATTEMPTS_PER_DAY',
      },
    });
  });
});

describe('GET /v1/contacts/:id/dialer suppression reason', () => {
  const route = () => findRoute('GET', '/v1/contacts/:id/dialer');

  it('should include suppressionReason in dialer response', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'qi-1',
            call_outcome: 'no-answer',
            created_at: '2026-03-29T11:00:00.000Z',
            call_duration_seconds: 0,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            settings: {
              minRetrySpacingMinutes: 30,
              maxAttemptsPerDay: 3,
              maxAttemptsPerWeek: 10,
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            last_attempt_at: '2099-01-01T00:00:00.000Z',
            attempts_today: 1,
            attempts_this_week: 1,
          },
        ],
      });

    const response = await exec(
      route(),
      createAuthenticatedRequest({
        params: { id: 'contact-123' },
        query: { queueId: 'queue-1' },
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      contactId: 'contact-123',
      suppressionReason: 'MIN_RETRY_SPACING',
    });
  });
});
