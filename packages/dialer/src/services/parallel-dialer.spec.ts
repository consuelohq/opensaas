import type { ParallelDialProfile } from '../types';

import { ParallelDialerService, InMemoryParallelStore } from './parallel-dialer';

const mockCallsCreate = jest.fn();
const mockCallUpdate = jest.fn();

const mockClient = {
  calls: Object.assign(
    (_sid: string) => ({ update: mockCallUpdate }),
    { create: mockCallsCreate },
  ),
};

jest.mock('twilio', () => ({
  __esModule: true,
  default: () => mockClient,
}));

describe('ParallelDialerService', () => {
  let store: InMemoryParallelStore;
  let service: ParallelDialerService;

  const baseProfile: ParallelDialProfile = {
    id: 'balanced',
    fanout: 3,
    staggerMs: 1,
    amdPolicy: 'human-or-unknown',
    terminationPolicy: 'winner-take-all',
  };

  const baseOpts = {
    customerNumbers: ['+15551111111', '+15552222222', '+15553333333'],
    fromNumbers: ['+15554444444', '+15555555555', '+15556666666'],
    queueId: 'queue-1',
    userId: 'user-1',
    statusCallbackUrl: 'https://example.com/status',
    customerTwimlUrl: 'https://example.com/twiml',
    profile: baseProfile,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    store = new InMemoryParallelStore();
    service = new ParallelDialerService(
      { accountSid: 'AC_test', authToken: 'test_token' },
      store,
    );

    let callCount = 0;
    mockCallsCreate.mockImplementation(() => {
      callCount++;
      return Promise.resolve({ sid: `CA_call_${callCount}` });
    });
  });

  describe('initiateGroup', () => {
    it('should create calls matching fanout count', async () => {
      const result = await service.initiateGroup(baseOpts);
      expect(result.calls).toHaveLength(3);
      expect(result.groupId).toMatch(/^pg_/);
      expect(result.conferenceName).toContain(result.groupId);
      expect(result.profileId).toBe('balanced');
      expect(mockCallsCreate).toHaveBeenCalledTimes(3);
    });

    it('should store group in the store', async () => {
      const result = await service.initiateGroup(baseOpts);
      const group = await service.getGroup(result.groupId);
      expect(group).not.toBeNull();
      expect(group!.status).toBe('dialing');
      expect(group!.calls).toHaveLength(3);
    });

    it('should set call mappings for reverse lookup', async () => {
      const result = await service.initiateGroup(baseOpts);
      for (const call of result.calls) {
        const groupId = await service.getGroupIdForCall(call.callSid);
        expect(groupId).toBe(result.groupId);
      }
    });

    it('should throw when twilio fails', async () => {
      mockCallsCreate.mockRejectedValue(new Error('twilio error'));
      await expect(service.initiateGroup(baseOpts)).rejects.toThrow(
        'twilio error',
      );
    });

    it('should assign sequential positions starting at 1', async () => {
      const result = await service.initiateGroup(baseOpts);
      expect(result.calls.map((c) => c.position)).toEqual([1, 2, 3]);
    });

    it('should pass contactIds to calls when provided', async () => {
      const result = await service.initiateGroup({
        ...baseOpts,
        contactIds: ['c1', 'c2', 'c3'],
      });
      const group = await service.getGroup(result.groupId);
      expect(group!.calls[0].contactId).toBe('c1');
      expect(group!.calls[2].contactId).toBe('c3');
    });
  });

  describe('handleStatusCallback', () => {
    it('should detect winner when human answers', async () => {
      const result = await service.initiateGroup(baseOpts);
      await service.handleStatusCallback(
        result.calls[0].callSid,
        'in-progress',
        'human',
      );

      const group = await service.getGroup(result.groupId);
      expect(group!.winnerSid).toBe(result.calls[0].callSid);
      expect(group!.status).toBe('connected');
    });

    it('should accept unknown answeredBy with human-or-unknown policy', async () => {
      const result = await service.initiateGroup(baseOpts);
      // baseProfile has amdPolicy: 'human-or-unknown'
      await service.handleStatusCallback(
        result.calls[0].callSid,
        'in-progress',
        'unknown',
      );

      const group = await service.getGroup(result.groupId);
      expect(group!.winnerSid).toBe(result.calls[0].callSid);
      expect(group!.status).toBe('connected');
    });

    it('should reject unknown answeredBy with human-only policy', async () => {
      const humanOnlyOpts = {
        ...baseOpts,
        profile: { ...baseProfile, amdPolicy: 'human-only' as const },
      };
      const result = await service.initiateGroup(humanOnlyOpts);
      await service.handleStatusCallback(
        result.calls[0].callSid,
        'in-progress',
        'unknown',
      );

      const group = await service.getGroup(result.groupId);
      // unknown is classified as 'unknown', not 'human', so human-only rejects
      expect(group!.winnerSid).toBeNull();
    });

    it('should terminate machine-detected calls', async () => {
      const result = await service.initiateGroup(baseOpts);
      await service.handleStatusCallback(
        result.calls[0].callSid,
        'in-progress',
        'machine',
      );

      const group = await service.getGroup(result.groupId);
      expect(group!.winnerSid).toBeNull();
      expect(mockCallUpdate).toHaveBeenCalledWith({ status: 'completed' });
    });

    it('should reject second answerer (race condition)', async () => {
      const result = await service.initiateGroup(baseOpts);
      await service.handleStatusCallback(
        result.calls[0].callSid,
        'in-progress',
        'human',
      );
      await service.handleStatusCallback(
        result.calls[1].callSid,
        'in-progress',
        'human',
      );

      const group = await service.getGroup(result.groupId);
      expect(group!.winnerSid).toBe(result.calls[0].callSid);
    });

    it('should terminate losing calls on winner-take-all', async () => {
      const result = await service.initiateGroup(baseOpts);
      await service.handleStatusCallback(
        result.calls[0].callSid,
        'in-progress',
        'human',
      );

      // losing calls should be terminated
      expect(mockCallUpdate).toHaveBeenCalledWith({ status: 'completed' });
    });

    it('should mark group completed when all calls resolve with no winner', async () => {
      const result = await service.initiateGroup(baseOpts);
      for (const call of result.calls) {
        await service.handleStatusCallback(call.callSid, 'no-answer');
      }

      const group = await service.getGroup(result.groupId);
      expect(group!.status).toBe('completed');
      expect(group!.winnerSid).toBeNull();
      expect(group!.completedAt).toBeDefined();
    });

    it('should handle mixed terminal statuses', async () => {
      const result = await service.initiateGroup(baseOpts);
      await service.handleStatusCallback(result.calls[0].callSid, 'busy');
      await service.handleStatusCallback(result.calls[1].callSid, 'failed');
      await service.handleStatusCallback(result.calls[2].callSid, 'no-answer');

      const group = await service.getGroup(result.groupId);
      expect(group!.status).toBe('completed');
      expect(group!.winnerSid).toBeNull();
    });

    it('should silently ignore unknown callSid', async () => {
      await expect(
        service.handleStatusCallback('CA_unknown', 'in-progress', 'human'),
      ).resolves.not.toThrow();
    });

    it('should record answeredAt timestamp on in-progress', async () => {
      const result = await service.initiateGroup(baseOpts);
      await service.handleStatusCallback(
        result.calls[0].callSid,
        'in-progress',
        'human',
      );

      const group = await service.getGroup(result.groupId);
      expect(group!.calls[0].answeredAt).toBeDefined();
    });
  });

  describe('TTL expiry', () => {
    it('should return null for expired group', async () => {
      // manually set a group with past expiry
      await store.setGroup('pg_expired', '{"status":"dialing"}', 0);
      // wait a tick for expiry
      await new Promise((r) => setTimeout(r, 10));
      const group = await store.getGroup('pg_expired');
      expect(group).toBeNull();
    });

    it('should return null for expired call mapping', async () => {
      await store.setCallMapping('CA_expired', 'pg_test', 0);
      await new Promise((r) => setTimeout(r, 10));
      const mapping = await store.getCallMapping('CA_expired');
      expect(mapping).toBeNull();
    });
  });

  describe('terminateGroup', () => {
    it('should terminate all pending calls', async () => {
      const result = await service.initiateGroup(baseOpts);
      await service.terminateGroup(result.groupId);

      const group = await service.getGroup(result.groupId);
      expect(group!.status).toBe('completed');
      expect(group!.calls.every((c) => c.status === 'completed')).toBe(true);
    });

    it('should not re-terminate already completed calls', async () => {
      const result = await service.initiateGroup(baseOpts);
      // complete one call first
      await service.handleStatusCallback(result.calls[0].callSid, 'completed');
      mockCallUpdate.mockClear();

      await service.terminateGroup(result.groupId);
      // should only terminate the 2 remaining calls, not the already-completed one
      expect(mockCallUpdate).toHaveBeenCalledTimes(2);
    });

    it('should handle non-existent group gracefully', async () => {
      await expect(
        service.terminateGroup('pg_nonexistent'),
      ).resolves.not.toThrow();
    });
  });

  describe('getReleasableNumbers', () => {
    it('should return non-winner from numbers', async () => {
      const result = await service.initiateGroup(baseOpts);
      await service.handleStatusCallback(
        result.calls[0].callSid,
        'in-progress',
        'human',
      );

      const group = await service.getGroup(result.groupId);
      const releasable = service.getReleasableNumbers(group!);
      expect(releasable).toHaveLength(2);
      expect(releasable).not.toContain(baseOpts.fromNumbers[0]);
    });

    it('should return all numbers when no winner', async () => {
      const result = await service.initiateGroup(baseOpts);
      const group = await service.getGroup(result.groupId);
      const releasable = service.getReleasableNumbers(group!);
      expect(releasable).toHaveLength(3);
    });
  });

  describe('validateRequirements', () => {
    it('should pass with exact number of required numbers', () => {
      expect(service.validateRequirements(3, 3).valid).toBe(true);
    });

    it('should pass with more than required', () => {
      expect(service.validateRequirements(5, 3).valid).toBe(true);
    });

    it('should fail with fewer than required', () => {
      const result = service.validateRequirements(2, 4);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('at least 4');
    });

    it('should default fanout to 3', () => {
      expect(service.validateRequirements(3).valid).toBe(true);
      expect(service.validateRequirements(2).valid).toBe(false);
    });
  });

  describe('computeTelemetry', () => {
    it('should compute metrics with a winner', async () => {
      const result = await service.initiateGroup(baseOpts);
      await service.handleStatusCallback(
        result.calls[0].callSid,
        'in-progress',
        'human',
      );
      const group = await service.getGroup(result.groupId);

      const telemetry = service.computeTelemetry(group!);
      expect(telemetry.winnerRate).toBe(1);
      expect(telemetry.wastedLegs).toBe(2);
      expect(telemetry.connectLatencyMs).not.toBeNull();
      expect(telemetry.connectLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should compute metrics with no winner', async () => {
      const result = await service.initiateGroup(baseOpts);
      for (const call of result.calls) {
        await service.handleStatusCallback(call.callSid, 'no-answer');
      }
      const group = await service.getGroup(result.groupId);

      const telemetry = service.computeTelemetry(group!);
      expect(telemetry.winnerRate).toBe(0);
      expect(telemetry.wastedLegs).toBe(3);
      expect(telemetry.connectLatencyMs).toBeNull();
    });
  });

  describe('markTelemetryEmitted', () => {
    it('should set telemetryEmittedAt on the group', async () => {
      const result = await service.initiateGroup(baseOpts);
      await service.markTelemetryEmitted(result.groupId);

      const group = await service.getGroup(result.groupId);
      expect(group!.telemetryEmittedAt).toBeDefined();
    });

    it('should not throw for non-existent group', async () => {
      await expect(
        service.markTelemetryEmitted('pg_nonexistent'),
      ).resolves.not.toThrow();
    });
  });

  describe('generateCustomerTwiml', () => {
    it('should return TwiML for a known call', async () => {
      const result = await service.initiateGroup(baseOpts);
      const twiml = await service.generateCustomerTwiml(
        result.calls[0].callSid,
      );
      expect(twiml).toContain('<Conference');
      expect(twiml).toContain(result.conferenceName);
      expect(twiml).toContain('<?xml');
    });

    it('should return null for unknown call', async () => {
      const twiml = await service.generateCustomerTwiml('CA_unknown');
      expect(twiml).toBeNull();
    });
  });

  describe('InMemoryParallelStore', () => {
    it('should support setWinnerIfAbsent atomicity', async () => {
      const won1 = await store.setWinnerIfAbsent('g1', 'CA_1', 60);
      const won2 = await store.setWinnerIfAbsent('g1', 'CA_2', 60);
      expect(won1).toBe(true);
      expect(won2).toBe(false);

      const winner = await store.getWinner('g1');
      expect(winner).toBe('CA_1');
    });

    it('should delete group and winner together', async () => {
      await store.setGroup('g1', '{}', 60);
      await store.setWinnerIfAbsent('g1', 'CA_1', 60);
      await store.deleteGroup('g1');

      expect(await store.getGroup('g1')).toBeNull();
      expect(await store.getWinner('g1')).toBeNull();
    });
  });
});
