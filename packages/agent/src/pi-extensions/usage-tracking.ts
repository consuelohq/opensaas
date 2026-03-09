// usage tracking extension for pi-agent-core
// records token usage and converts to credits per turn
// inspired by Twenty's ai-billing.service.ts — accepts a UsageStore callback

import type { AfterTurnExtension, AfterTurnEvent } from './after-turn.types.js';

export type UsageRecord = {
  userId: string;
  workspaceId: string;
  inputTokens: number;
  outputTokens: number;
  model?: string;
};

export type UsageStore = {
  record: (usage: UsageRecord) => Promise<void>;
};

export const createUsageTracking = (
  usageStore: UsageStore,
): AfterTurnExtension => ({
  name: 'usage-tracking',

  afterTurn: async (event: AfterTurnEvent): Promise<void> => {
    const { usage, metadata } = event;

    if (!usage) return;

    try {
      await usageStore.record({
        userId: metadata.userId,
        workspaceId: metadata.workspaceId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });
    } catch {
      // fire-and-forget — don't block the response on usage tracking failures
    }
  },
});
