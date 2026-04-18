import { getSharedPool } from '../shared/db.js';
import { redisService } from './redis.js';
import { findRecentCallbackRoute, getCurrentCallbackNumber } from './callback-routing.js';

jest.mock('../shared/db.js', () => ({
  getSharedPool: jest.fn(),
}));

jest.mock('./redis.js', () => ({
  redisService: {
    getRecentCallbackRoutes: jest.fn(),
  },
}));

const mockPool = {
  query: jest.fn(),
};

const mockRedis = redisService as unknown as {
  getRecentCallbackRoutes: jest.Mock;
};

describe('callback-routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSharedPool as jest.Mock).mockResolvedValue(mockPool);
    mockPool.query.mockResolvedValue({ rows: [] });
    mockRedis.getRecentCallbackRoutes.mockResolvedValue([]);
  });

  describe('getCurrentCallbackNumber', () => {
    it('rejects non-dialable callback numbers from preferences', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ callback_number: 'ext 123' }],
      });

      await expect(
        getCurrentCallbackNumber('user-test-001', 'ws-test-001'),
      ).resolves.toBeNull();
    });
  });

  describe('findRecentCallbackRoute', () => {
    it('returns null when multiple workspace-scoped routes match the same numbers', async () => {
      mockRedis.getRecentCallbackRoutes.mockResolvedValueOnce([
        {
          workspaceId: 'ws-test-001',
          userId: 'user-test-001',
          twilioNumber: '+15551234567',
          prospectNumber: '+15559876543',
          callbackNumber: '+15557654321',
        },
        {
          workspaceId: 'ws-test-002',
          userId: 'user-test-002',
          twilioNumber: '+15551234567',
          prospectNumber: '+15559876543',
          callbackNumber: '+15550001111',
        },
      ]);

      await expect(
        findRecentCallbackRoute({
          twilioNumber: '+15551234567',
          prospectNumber: '+15559876543',
        }),
      ).resolves.toBeNull();
    });

    it('returns the route when exactly one workspace-scoped match exists', async () => {
      mockRedis.getRecentCallbackRoutes.mockResolvedValueOnce([
        {
          workspaceId: 'ws-test-001',
          userId: 'user-test-001',
          twilioNumber: '+15551234567',
          prospectNumber: '+15559876543',
          callbackNumber: '+15557654321',
        },
      ]);

      await expect(
        findRecentCallbackRoute({
          twilioNumber: '+15551234567',
          prospectNumber: '+15559876543',
        }),
      ).resolves.toEqual({
        workspaceId: 'ws-test-001',
        userId: 'user-test-001',
        twilioNumber: '+15551234567',
        prospectNumber: '+15559876543',
        callbackNumber: '+15557654321',
      });
    });
  });
});
