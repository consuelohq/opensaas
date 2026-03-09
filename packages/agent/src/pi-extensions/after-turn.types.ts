// shared types for after-turn pi extensions (preference inference, turn grading, usage tracking)

import type { AgentMessage } from '../types.js';

export type ToolCallSummary = {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
};

export type AfterTurnEvent = {
  messages: AgentMessage[];
  userMessage: string;
  assistantMessage: string;
  toolCalls: ToolCallSummary[];
  injectedMemoryIds: string[];
  usage?: { inputTokens: number; outputTokens: number };
  metadata: {
    userId: string;
    workspaceId: string;
    conversationId: string;
    messageId?: string;
  };
};

export type AfterTurnExtension = {
  name: string;
  afterTurn: (event: AfterTurnEvent) => Promise<void>;
};
