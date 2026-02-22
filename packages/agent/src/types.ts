import type { CoreMessage } from 'ai';

import type { MemoryType, MemorySource, AgentMemoryFull } from './context/memory.types.js';
import type { SalesMethodology } from './context/methodology.types.js';

// re-export memory types
export type { MemoryType, MemorySource, AgentMemoryFull };

// re-export AI SDK message type as our canonical format
export type AgentMessage = CoreMessage;

export type SandboxLanguage = 'python' | 'javascript';

export type ActiveCallState = {
  callSid: string;
  contactId: string;
  contactName: string;
  direction: 'inbound' | 'outbound';
  startedAt: Date;
};

export type CrmActivity = {
  type: 'call' | 'email' | 'note' | 'meeting';
  contactId: string;
  summary: string;
  timestamp: Date;
};

// legacy alias — use AgentMemoryFull for new code
export type AgentMemory = AgentMemoryFull;

export type AgentContext = {
  userId: string;
  workspaceId: string;
  activeCall?: ActiveCallState;
  recentActivity: CrmActivity[];
  connectedIntegrations: string[];
  memories: AgentMemoryFull[];
  activeMethodology?: SalesMethodology;
};

export type SandboxArtifact = {
  path: string;
  mimeType: string;
  data: Buffer;
};

export type SandboxResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  artifacts: SandboxArtifact[];
};

export type SandboxExecuteOptions = {
  code: string;
  language: SandboxLanguage;
  envVars?: Record<string, string>;
  contextData?: Record<string, unknown>;
  timeoutMs?: number;
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
};

export type TokenUsageEntry = {
  input: number;
  cached: number;
  output: number;
  provider: string;
};

export type ConversationState = {
  id: string;
  userId: string;
  workspaceId: string;
  messages: AgentMessage[];
  compactedSummary?: string;
  compactedAt?: Date;
  activeSkillId?: string;
  context: AgentContext;
  tokenUsage: TokenUsageEntry[];
  createdAt: Date;
  updatedAt: Date;
};

export type AgentConfig = {
  model: string;
  provider: string;
  systemPrompt: string;
  maxSteps?: number;
  temperature?: number;
  maxTokens?: number;
  onMemoriesInjected?: (memoryIds: string[]) => Promise<void>;
  onTurnComplete?: (messages: AgentMessage[], injectedMemoryIds: string[]) => void;
};

// --- chat endpoint types (DEV-944) ---

export type ChatRequest = {
  message: string;
  conversationId?: string;
  skillId?: string;
  attachments?: ChatAttachment[];
};

export type ChatAttachment = {
  filename: string;
  mimeType: string;
  url: string;
};

export type ConversationStore = {
  load: (conversationId: string) => Promise<ConversationState | null>;
  create: (userId: string, workspaceId: string) => Promise<ConversationState>;
  save: (state: ConversationState) => Promise<void>;
};

// --- execution history types (DEV-1019) ---

export type ExecutionType = 'tool_call' | 'llm_response' | 'sandbox_run' | 'integration_call';
export type ExecutionStatus = 'running' | 'completed' | 'failed';

export type AgentExecution = {
  id: string;
  conversationId: string;
  type: ExecutionType;
  status: ExecutionStatus;
  toolName?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
  createdAt: Date;
  completedAt?: Date;
};

export type CreateExecutionInput = Omit<AgentExecution, 'id' | 'createdAt' | 'completedAt'>;

export type ExecutionStore = {
  create: (input: CreateExecutionInput) => Promise<AgentExecution>;
  complete: (id: string, result: { output?: Record<string, unknown>; error?: string; durationMs: number }) => Promise<void>;
  list: (conversationId: string) => Promise<AgentExecution[]>;
  get: (id: string) => Promise<AgentExecution | null>;
};

// --- artifact types (DEV-1020) ---

export type ArtifactType = 'chart' | 'table' | 'report' | 'csv' | 'image' | 'code' | 'file';

export type AgentArtifact = {
  id: string;
  conversationId: string;
  executionId: string;
  type: ArtifactType;
  title: string;
  description?: string;
  content?: Record<string, unknown>;
  fileUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  workspaceId: string;
  userId: string;
  createdAt: Date;
};

export type CreateArtifactInput = Omit<AgentArtifact, 'id' | 'createdAt'>;

export type ArtifactStore = {
  create: (input: CreateArtifactInput) => Promise<AgentArtifact>;
  list: (userId: string, options?: { conversationId?: string; type?: ArtifactType; limit?: number; offset?: number }) => Promise<AgentArtifact[]>;
  get: (id: string) => Promise<AgentArtifact | null>;
  getDownloadUrl: (id: string) => Promise<string | null>;
};
