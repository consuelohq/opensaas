import type { AgentMemoryFull, MemoryType } from './memory.types.js';

export type MemoryStore = {
  getTopMemories: (
    userId: string,
    limit?: number,
    minConfidence?: number,
  ) => Promise<AgentMemoryFull[]>;

  upsert: (
    userId: string,
    workspaceId: string,
    memory: Pick<AgentMemoryFull, 'type' | 'key' | 'value' | 'confidence' | 'source'>,
  ) => Promise<AgentMemoryFull>;

  recordUsage: (memoryId: string) => Promise<void>;

  decayUnused: () => Promise<number>;

  delete: (memoryId: string, userId: string) => Promise<void>;

  update: (
    memoryId: string,
    userId: string,
    updates: Partial<Pick<AgentMemoryFull, 'value' | 'confidence' | 'type'>>,
  ) => Promise<AgentMemoryFull>;

  list: (
    userId: string,
    options?: { type?: MemoryType; limit?: number; offset?: number },
  ) => Promise<AgentMemoryFull[]>;
};
