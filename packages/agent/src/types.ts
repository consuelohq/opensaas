import type { CoreMessage, LanguageModelUsage } from 'ai';

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
  compactedAt?: number;
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
