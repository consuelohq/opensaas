import type { CoreMessage } from 'ai';

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

export type AgentMemory = {
  id: string;
  content: string;
  createdAt: Date;
};

export type AgentContext = {
  userId: string;
  workspaceId: string;
  activeCall?: ActiveCallState;
  recentActivity: CrmActivity[];
  connectedIntegrations: string[];
  memories: AgentMemory[];
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

export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; tool: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; result: unknown }
  | { type: 'chart'; data: Record<string, unknown>; chartType: string }
  | { type: 'table'; columns: string[]; rows: unknown[][] }
  | { type: 'action_card'; action: string; params: Record<string, unknown>; label: string }
  | { type: 'file'; url: string; filename: string }
  | { type: 'done' };

export type ConversationStore = {
  load: (conversationId: string) => Promise<ConversationState | null>;
  create: (userId: string, workspaceId: string) => Promise<ConversationState>;
  save: (state: ConversationState) => Promise<void>;
};
