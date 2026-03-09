// preference inference extension for pi-agent-core
// runs after each agent turn — detects preferences and persists to memory store
// reuses existing inference logic from preference-inference.service.ts

import { Logger } from '@consuelo/logger';
import type { MemoryStore } from '../context/memory.store.js';
import {
  inferPreferences,
  persistSignals,
} from '../context/preference-inference.service.js';
import type { AfterTurnExtension, AfterTurnEvent } from './after-turn.types.js';

const logger = new Logger('agent:preference-inference');

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

      await persistSignals(
        signals,
        userId,
        workspaceId,
        memoryStore.upsert.bind(memoryStore),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      logger.error(
        { err, userId, workspaceId },
        `preference inference failed: ${message}`,
      );
    }
  },
});
