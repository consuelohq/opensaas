// preference inference extension for pi-agent-core
// runs after each agent turn — detects preferences and persists to memory store
// reuses existing inference logic from preference-inference.service.ts

import type { MemoryStore } from '../context/memory.store.js';
import { inferPreferences, persistSignals } from '../context/preference-inference.service.js';
import type { AfterTurnExtension, AfterTurnEvent } from './after-turn.types.js';

export const createPreferenceInference = (
  memoryStore: MemoryStore,
): AfterTurnExtension => ({
  name: 'preference-inference',

  afterTurn: async (event: AfterTurnEvent): Promise<void> => {
    const { messages, injectedMemoryIds, metadata } = event;
    const { userId, workspaceId } = metadata;

    try {
      const existingMemories = await memoryStore.getTopMemories(userId);

      const signals = inferPreferences({
        messages,
        existingMemories,
        injectedMemoryIds,
      });

      if (signals.length === 0) return;

      await persistSignals(signals, userId, workspaceId, memoryStore.upsert.bind(memoryStore));
    } catch {
      // fire-and-forget — don't block the response on inference failures
    }
  },
});
