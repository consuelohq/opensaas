// core
export { AgentService } from './agent.js';
export type { AgentOptions, ChatOptions, PiSession, PiSessionResult, BeforeTurnExtension, ModelCyclingConfig } from './agent.js';
export { DEFAULT_MODEL_CYCLING } from './agent.js';

// chat
export { handleChat } from './chat.js';
export type { ChatHandlerOptions, ChatResult } from './chat.js';

// sandbox
export { SandboxService } from './sandbox.js';

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

// security (DEV-1022)
export { stripHtml, isAllowedFileUrl, truncateOutput, ConcurrencyGuard } from './security/index.js';

// executor (DEV-1026)
export { AgentExecutor } from './executor/index.js';

// context
export type { ContextLoader } from './context/index.js';
export type { MemoryType, MemorySource, AgentMemoryFull } from './context/index.js';
export type { MemoryStore } from './context/index.js';
export type { QualificationCriterion, SalesMethodology, WorkspaceMethodologyConfig } from './context/index.js';
export { inferPreferences, persistSignals } from './context/index.js';
export type { PreferenceSignalType, PreferenceSignal, InferenceInput } from './context/index.js';
export type {
  RiskFactorId,
  RiskFactor,
  DealRiskScore,
  DealVelocity,
  HealthLabel,
  PipelineHealth,
  DealChangeType,
  DealChange,
  PipelineContext,
  DealInput,
  StageAverage,
} from './context/index.js';
export {
  scoreDeal,
  scorePipeline,
  computeHealth,
  generateInsights,
  buildPipelineContext,
} from './context/index.js';
export type { CallParticipant, ActiveDealContext, ExpandedCallContext } from './context/index.js';
export { loadCallContext, buildCallContextBlock, suggestSkills } from './context/index.js';
export type { ContextLayer, ContextBudget, SkillOutput, SkillOutputCacheKey } from './context/index.js';
export { DEFAULT_CONTEXT_BUDGET } from './context/index.js';
export {
  estimateTokens,
  shouldSummarize,
  buildContextLayers,
  renderContextBlock,
  summarizeMessages,
} from './context/index.js';

// automation (DEV-962)
export type {
  Automation,
  CreateAutomationInput,
  TriggerConfig,
  ConditionGroup,
  Condition,
  CrmEventType,
  CrmEvent,
  TriggerEvalResult,
} from './automation/index.js';

export {
  evaluateCondition,
  evaluateConditionGroup,
  matchEventTrigger,
  matchConditionalTrigger,
  findMatchingAutomations,
  buildDebounceKey,
  parseCron,
} from './automation/index.js';


// pi extensions
export { DatabaseSessionManager } from './pi-extensions/index.js';
export type {
  AgentSessionData,
  DatabaseConnection,
  SessionManager,
} from './pi-extensions/index.js';
export { createPiCrmTools } from './pi-extensions/index.js';
export { createContextInjection } from './pi-extensions/index.js';
export type { ContextInjection } from './pi-extensions/index.js';
export { createPipelineIntelligence } from './pi-extensions/index.js';
export type { PipelineIntelligence } from './pi-extensions/index.js';
export { createDialerTools } from './pi-extensions/index.js';
export type { DialerService } from './pi-extensions/index.js';
export { createKbTools } from './pi-extensions/index.js';
export type { KbService } from './pi-extensions/index.js';
// coaching
export { createCoachingDetector } from './pi-extensions/index.js';
export type { CoachingDetector } from './pi-extensions/index.js';
// coaching lifecycle (post-call analysis)
export { createCoachingLifecycle } from './pi-extensions/index.js';
export type { CoachingLifecycle, RecentlyEndedCall } from './pi-extensions/index.js';
// after-turn extensions
export type { AfterTurnEvent, AfterTurnExtension, ToolCallSummary } from './pi-extensions/index.js';
export { createPreferenceInference } from './pi-extensions/index.js';
export { createTurnGrading } from './pi-extensions/index.js';
export type { TurnEvaluation } from './pi-extensions/index.js';

// schemas (moved from @consuelo/coaching — DEV-1262)
export type {
  SalesCoaching,
  KeyMoment,
  SentimentAnalysis,
  PerformanceMetrics,
  CallAnalytics,
  PostCallAnalysisResult,
} from './schemas/coaching.js';
export { createCoachingSchemas } from './schemas/coaching.js';

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
  ConversationStore,
  ExecutionType,
  ExecutionStatus,
  AgentExecution,
  ArtifactType,
  AgentArtifact,
  SkillSuggestion,
} from './types.js';
