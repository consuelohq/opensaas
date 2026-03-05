import { CallerIdLockService, InMemoryLockStore } from './caller-id';

describe('CallerIdLockService', () => {
  let store: InMemoryLockStore;
  let service: CallerIdLockService;

  beforeEach(() => {
    store = new InMemoryLockStore();
    service = new CallerIdLockService(store);
  });

  describe('acquireLock', () => {
    it('should acquire a lock on an available number', async () => {
      const result = await service.acquireLock('+15551234567', 'user-1', 'CA_123');
      expect(result).toBe(true);
    });

    it('should prevent concurrent lock on same number by different call', async () => {
      await service.acquireLock('+15551234567', 'user-1', 'CA_123');
      const result = await service.acquireLock('+15551234567', 'user-2', 'CA_456');
      expect(result).toBe(false);
    });

    it('should allow re-acquiring lock with same callSid', async () => {
      await service.acquireLock('+15551234567', 'user-1', 'CA_123');
      const result = await service.acquireLock('+15551234567', 'user-1', 'CA_123');
      expect(result).toBe(true);
    });
  });

  describe('releaseLock', () => {
    it('should release an existing lock by callSid', async () => {
      await service.acquireLock('+15551234567', 'user-1', 'CA_123');
      const released = await service.releaseLock('CA_123');
      expect(released).toBe(true);

      const available = await service.isNumberAvailable('+15551234567');
      expect(available).toBe(true);
    });

    it('should return false when callSid not found', async () => {
      const released = await service.releaseLock('CA_nonexistent');
      expect(released).toBe(false);
    });
  });

  describe('releaseLockByNumber', () => {
    it('should release lock by phone number', async () => {
      await service.acquireLock('+15551234567', 'user-1', 'CA_123');
      const released = await service.releaseLockByNumber('+15551234567');
      expect(released).toBe(true);
    });

    it('should return false when number not locked', async () => {
      const released = await service.releaseLockByNumber('+15559999999');
      expect(released).toBe(false);
    });
  });

  describe('isNumberAvailable', () => {
    it('should return true for unlocked number', async () => {
      expect(await service.isNumberAvailable('+15551234567')).toBe(true);
    });

    it('should return false for locked number', async () => {
      await service.acquireLock('+15551234567', 'user-1', 'CA_123');
      expect(await service.isNumberAvailable('+15551234567')).toBe(false);
    });
  });

  describe('getUserLocks', () => {
    it('should return all locks for a user', async () => {
      await service.acquireLock('+15551111111', 'user-1', 'CA_1');
      await service.acquireLock('+15552222222', 'user-1', 'CA_2');
      await service.acquireLock('+15553333333', 'user-2', 'CA_3');

      const locks = await service.getUserLocks('user-1');
      expect(locks).toHaveLength(2);
      expect(locks.map((l) => l.phoneNumber).sort()).toEqual(['+15551111111', '+15552222222']);
    });

    it('should return empty array when user has no locks', async () => {
      const locks = await service.getUserLocks('user-none');
      expect(locks).toEqual([]);
    });
  });

  describe('TTL expiry', () => {
    it('should allow lock acquisition after TTL expires', async () => {
      // use a very short TTL (1ms)
      const shortService = new CallerIdLockService(store, 1);
      await shortService.acquireLock('+15551234567', 'user-1', 'CA_123');

      // wait for expiry
      await new Promise((r) => setTimeout(r, 10));

      const available = await shortService.isNumberAvailable('+15551234567');
      expect(available).toBe(true);
    });

    it('should clean expired locks from getUserLocks', async () => {
      const shortService = new CallerIdLockService(store, 1);
      await shortService.acquireLock('+15551234567', 'user-1', 'CA_123');

      await new Promise((r) => setTimeout(r, 10));

      const locks = await shortService.getUserLocks('user-1');
      expect(locks).toHaveLength(0);
    });
  });
});
