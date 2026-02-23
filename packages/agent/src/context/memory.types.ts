export type MemoryType = 'preference' | 'fact' | 'pattern';
export type MemorySource = 'explicit' | 'inferred';

export type AgentMemoryFull = {
  id: string;
  userId: string;
  workspaceId: string;
  type: MemoryType;
  key: string;
  value: string;
  confidence: number;
  source: MemorySource;
  lastUsedAt: Date | null;
  useCount: number;
  createdAt: Date;
  updatedAt: Date;
};
