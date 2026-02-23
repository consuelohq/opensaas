import type { AgentContext } from '../types.js';

export type ContextLoader = {
  load: (userId: string, workspaceId: string) => Promise<AgentContext>;
};

export type ContextLayer = {
  name: string;
  priority: number;
  content: string;
  tokenEstimate: number;
};

export type ContextBudget = {
  maxTokens: number;
  reserved: Record<string, number>;
};

export const DEFAULT_CONTEXT_BUDGET: ContextBudget = {
  maxTokens: 4000,
  reserved: {
    methodology: 500,
    memories: 800,
    callContext: 600,
    pipeline: 800,
    skillOutputs: 1000,
    buffer: 300,
  },
};

export type SkillOutput = {
  skillId: string;
  skillName: string;
  output: unknown;
  executedAt: Date;
  conversationId?: string;
};

// template: skill:output:{userId}:{workspaceId}:{skillId}
export type SkillOutputCacheKey = `skill:output:${string}:${string}:${string}`;
