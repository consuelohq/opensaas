import type { AgentContext } from '../types.js';

export type ContextLoader = {
  load: (userId: string, workspaceId: string) => Promise<AgentContext>;
};
