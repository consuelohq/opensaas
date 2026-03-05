import { Queues } from './queues';
import { MemoryProvider } from './providers/memory';

describe('Queues', () => {
  let queues: Queues;

  beforeEach(() => {
    queues = new Queues(new MemoryProvider());
  });

  describe('create', () => {
    it('should create a queue with contact list', async () => {
      const queue = await queues.create('Test Queue', ['c1', 'c2', 'c3']);
      expect(queue.name).toBe('Test Queue');
      expect(queue.contactIds).toEqual(['c1', 'c2', 'c3']);
      expect(queue.status).toBe('idle');
      expect(queue.currentIndex).toBe(0);
    });

    it('should default to sequential ordering', async () => {
      const queue = await queues.create('Q', ['c1']);
      expect(queue.ordering).toBe('sequential');
    });

    it('should accept round-robin ordering', async () => {
      const queue = await queues.create('Q', ['c1'], 'round-robin');
      expect(queue.ordering).toBe('round-robin');
    });
  });

  describe('getNext', () => {
    it('should return contacts in order', async () => {
      const queue = await queues.create('Q', ['c1', 'c2', 'c3']);
      expect(await queues.getNext(queue.id)).toBe('c1');
      expect(await queues.getNext(queue.id)).toBe('c2');
      expect(await queues.getNext(queue.id)).toBe('c3');
    });

    it('should return null when sequential queue exhausted', async () => {
      const queue = await queues.create('Q', ['c1']);
      await queues.getNext(queue.id);
      expect(await queues.getNext(queue.id)).toBeNull();
    });

    it('should mark queue completed when exhausted', async () => {
      const queue = await queues.create('Q', ['c1']);
      await queues.getNext(queue.id);
      const updated = await queues.get(queue.id);
      expect(updated!.status).toBe('completed');
    });

    it('should wrap around for round-robin ordering', async () => {
      const queue = await queues.create('Q', ['c1', 'c2'], 'round-robin');
      expect(await queues.getNext(queue.id)).toBe('c1');
      expect(await queues.getNext(queue.id)).toBe('c2');
      expect(await queues.getNext(queue.id)).toBe('c1');
    });

    it('should return null for paused queue', async () => {
      const queue = await queues.create('Q', ['c1', 'c2']);
      await queues.pause(queue.id);
      expect(await queues.getNext(queue.id)).toBeNull();
    });

    it('should return null for non-existent queue', async () => {
      expect(await queues.getNext('nonexistent')).toBeNull();
    });
  });

  describe('pause and resume', () => {
    it('should pause an active queue', async () => {
      const queue = await queues.create('Q', ['c1', 'c2']);
      await queues.getNext(queue.id);
      await queues.pause(queue.id);
      const updated = await queues.get(queue.id);
      expect(updated!.status).toBe('paused');
    });

    it('should resume a paused queue', async () => {
      const queue = await queues.create('Q', ['c1', 'c2']);
      await queues.pause(queue.id);
      await queues.resume(queue.id);
      const result = await queues.getNext(queue.id);
      expect(result).toBe('c1');
    });
  });

  describe('recordResult', () => {
    it('should record a call result', async () => {
      const queue = await queues.create('Q', ['c1', 'c2']);
      await queues.recordResult(queue.id, {
        contactId: 'c1',
        callSid: 'CA_123',
        outcome: 'answered',
        attemptedAt: new Date().toISOString(),
      });

      const updated = await queues.get(queue.id);
      expect(updated!.results).toHaveLength(1);
      expect(updated!.results[0].outcome).toBe('answered');
    });

    it('should accumulate multiple results', async () => {
      const queue = await queues.create('Q', ['c1', 'c2']);
      const now = new Date().toISOString();
      await queues.recordResult(queue.id, { contactId: 'c1', outcome: 'answered', attemptedAt: now });
      await queues.recordResult(queue.id, { contactId: 'c2', outcome: 'no-answer', attemptedAt: now });

      const updated = await queues.get(queue.id);
      expect(updated!.results).toHaveLength(2);
    });

    it('should silently handle non-existent queue', async () => {
      await queues.recordResult('nonexistent', {
        contactId: 'c1',
        outcome: 'failed',
        attemptedAt: new Date().toISOString(),
      });
    });
  });

  describe('get', () => {
    it('should return queue by id', async () => {
      const queue = await queues.create('Q', ['c1']);
      const found = await queues.get(queue.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('Q');
    });

    it('should return null for non-existent queue', async () => {
      expect(await queues.get('nonexistent')).toBeNull();
    });
  });
});
