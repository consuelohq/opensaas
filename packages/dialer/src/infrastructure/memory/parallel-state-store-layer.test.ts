
import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { InMemoryParallelStore, createParallelStateStoreLayer } from './parallel-state-store';
import { ParallelStateStore } from '../../ports/parallel-state-store';

describe('parallel state store lock completion', () => {
  it('does not report success when ownership fails after operation settles', async () => {
    class LeaseLossStore extends InMemoryParallelStore {
      override async withGroupLock<A>(
        _groupId: string,
        operation: () => Promise<A>,
      ): Promise<A> {
        await operation();
        throw new Error('Lost ownership of parallel group lock');
      }
    }
    const layer = createParallelStateStoreLayer(new LeaseLossStore());
    const action = Effect.gen(function* () {
      const state = yield* ParallelStateStore;
      return yield* state.withGroupLock('group-1', Effect.succeed('ok'));
    }).pipe(Effect.provide(layer));
    await expect(Effect.runPromise(action)).rejects.toThrow(/ownership/i);
  });
});
