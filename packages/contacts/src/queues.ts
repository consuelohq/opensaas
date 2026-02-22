import type { Queue, QueueResult, StorageProvider } from './types.js';
import { MemoryProvider } from './providers/memory.js';

/**
 * Queues — call queue management with ordering and attempt tracking.
 */
export class Queues {
  readonly store: StorageProvider;
  private locks = new Map<string, Promise<void>>();

  constructor(store?: StorageProvider) {
    this.store = store ?? new MemoryProvider();
  }

  async create(name: string, contactIds: string[], ordering: Queue['ordering'] = 'sequential'): Promise<Queue> {
    return this.store.createQueue({ name, contactIds, ordering, currentIndex: 0, status: 'idle', results: [] });
  }

  /** Get the next contact ID in the queue, advancing the pointer (serialized per queue) */
  async getNext(queueId: string): Promise<string | null> {
    // serialize concurrent calls per queue
    while (this.locks.has(queueId)) await this.locks.get(queueId);
    let unlock: () => void;
    this.locks.set(queueId, new Promise<void>((r) => { unlock = r; }));

    try {
      const queue = await this.store.getQueue(queueId);
      if (!queue || queue.status === 'completed' || queue.status === 'paused') return null;
      if (queue.currentIndex >= queue.contactIds.length) {
        if (queue.ordering === 'round-robin') {
          await this.store.updateQueue(queueId, { currentIndex: 0, status: 'active' });
          const q2 = await this.store.getQueue(queueId);
          if (!q2 || q2.contactIds.length === 0) return null;
          await this.store.updateQueue(queueId, { currentIndex: 1 });
          return q2.contactIds[0];
        }
        return null;
      }

      const contactId = queue.contactIds[queue.currentIndex];
      const nextIndex = queue.currentIndex + 1;
      const done = nextIndex >= queue.contactIds.length && queue.ordering !== 'round-robin';
      await this.store.updateQueue(queueId, {
        currentIndex: nextIndex,
        status: done ? 'completed' : 'active',
      });
      return contactId;
    } finally {
      this.locks.delete(queueId);
      unlock!();
    }
  }

  /** Record a call attempt result */
  async recordResult(queueId: string, result: QueueResult): Promise<void> {
    const queue = await this.store.getQueue(queueId);
    if (!queue) return;
    await this.store.updateQueue(queueId, { results: [...queue.results, result] });
  }

  async get(queueId: string): Promise<Queue | null> {
    return this.store.getQueue(queueId);
  }

  async pause(queueId: string): Promise<void> {
    await this.store.updateQueue(queueId, { status: 'paused' });
  }

  async resume(queueId: string): Promise<void> {
    await this.store.updateQueue(queueId, { status: 'active' });
  }
}
