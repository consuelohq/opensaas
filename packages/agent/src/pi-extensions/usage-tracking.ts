// usage tracking extension for pi-agent-core
// records token usage and converts to credits per turn
// inspired by Twenty's ai-billing.service.ts — accepts a UsageStore callback

import { Logger } from '@consuelo/logger';
import type { AfterTurnExtension, AfterTurnEvent } from './after-turn.types.js';

const logger = new Logger('agent:usage-tracking');

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

    // fire-and-forget — don't block the response on usage tracking
    usageStore
      .record({
        userId: metadata.userId,
        workspaceId: metadata.workspaceId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'unknown error';
        logger.error(`usage tracking failed: ${message}`, {
          err,
          userId: metadata.userId,
          workspaceId: metadata.workspaceId,
        });
      });
  },
});
