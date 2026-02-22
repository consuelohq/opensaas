// core
export { AgentService, buildToolSet, buildSystemPrompt, resolveModel } from './agent.js';
export type { AgentOptions, ChatOptions } from './agent.js';

// chat
export { handleChat } from './chat.js';
export type { ChatHandlerOptions, ChatResult } from './chat.js';

// sandbox
export { SandboxService } from './sandbox.js';

// tools
export { createToolRegistry } from './tools/index.js';
export type { AgentToolDefinition, ToolRegistry } from './tools/index.js';

// crm
export { CrmClient, createCrmTools } from './crm/index.js';
export type {
  CrmClientOptions,
  SearchFilters,
  PaginationOptions,
  ContactSearchResult,
  DealResult,
  CallRecord,
  IntegrationInfo,
} from './crm/index.js';

// integrations
export { INTEGRATION_REGISTRY, formatIntegrationContext } from './integrations/index.js';
export type {
  IntegrationCategory,
  AuthMethod,
  IntegrationDefinition,
  IntegrationCapability,
  OAuthConfig,
  ApiKeyConfig,
  ConnectionStatus,
  IntegrationConnection,
  ConnectRequest,
  OAuthCallbackRequest,
  IntegrationStore,
  EncryptFn,
  DecryptFn,
  IntegrationServiceOptions,
  SandboxEnvResult,
} from './integrations/index.js';

export { IntegrationConnectionService, buildSandboxEnv } from './integrations/index.js';

// tracing (DEV-1019)
export { TracingService } from './tracing/index.js';
export type { LangfuseConfig, ExecutionStore, CreateExecutionInput } from './tracing/index.js';

// artifacts (DEV-1020)
export { sandboxToArtifacts } from './artifacts/index.js';
export type { ArtifactStore, CreateArtifactInput } from './artifacts/index.js';

// context
export type { ContextLoader } from './context/index.js';

// types
export type {
  AgentMessage,
  AgentConfig,
  AgentContext,
  ActiveCallState,
  CrmActivity,
  AgentMemory,
  SandboxResult,
  SandboxArtifact,
  SandboxExecuteOptions,
  SandboxLanguage,
  ConversationState,
  TokenUsageEntry,
  ChatRequest,
  ChatAttachment,
  StreamChunk,
  ConversationStore,
  ExecutionType,
  ExecutionStatus,
  AgentExecution,
  ArtifactType,
  AgentArtifact,
} from './types.js';
