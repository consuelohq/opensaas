// Core
export { Dialer } from './dialer.js';

// Providers
export { TwilioProvider } from './providers/twilio.js';
export type { DialerProvider } from './providers/base.js';

// Services
export {
  LocalPresenceService,
  extractAreaCode,
} from './services/local-presence.js';
export {
  CallerIdLockService,
  InMemoryLockStore,
  RedisLockStore,
} from './services/caller-id.js';
export { ConferenceService } from './services/conference.js';
export {
  ParallelDialerService,
  InMemoryParallelStore,
} from './services/parallel-dialer.js';
export { ParallelStrategyResolver } from './services/parallel-strategy-resolver.js';
export { StoppingModelService } from './services/stopping-model.js';
export { CallTimingModel } from './services/call-timing-model.service.js';
export { WhittleIndexService } from './services/whittle-index.service.js';
export { CadenceOptimizerService } from './services/cadence-optimizer.service.js';
export type { LockStore } from './services/caller-id.js';
export type { NumberPool } from './services/local-presence.js';

// Transport-independent application core
export { startParallelSession } from './application/start-parallel-session.js';
export type { StartParallelSessionOptions } from './application/start-parallel-session.js';
export { processProviderCallback } from './application/process-provider-callback.js';
export {
  generateParallelCustomerTwiml,
  getParallelGroupStatus,
  initiateParallelDial,
  terminateParallelGroup,
  validateParallelDial,
} from './application/parallel-compatibility-application.js';
export {
  startDialerCall,
  computeDialerCallCapacity,
} from './application/start-dialer-call.js';
export type { StartDialerCallCommand } from './application/start-dialer-call.js';
export {
  processParallelCallback,
  isSuccessfulParallelCompletion,
} from './application/process-parallel-callback.js';
export type { ProcessProviderCallbackInput } from './application/process-provider-callback.js';
export {
  terminateCallSession,
  terminateCallSessionForWorkspace,
} from './application/terminate-call-session.js';
export { retryPendingCleanup } from './application/retry-pending-cleanup.js';
export {
  getCallSession,
  getCallSessionForWorkspace,
} from './application/get-call-session.js';

// Pure domain behavior
export {
  applyProviderCallStatus,
  isTerminalCallStatus,
  normalizeAmdResult,
  TERMINAL_CALL_STATUSES,
} from './domain/parallel-call.js';
export {
  cloneParallelGroup,
  completeGroupIfResolved,
  createParallelGroup,
  hydrateParallelGroup,
  isStaleDialingGroup,
} from './domain/parallel-group.js';
export { isHumanLikeAnswer } from './domain/parallel-profile.js';
export {
  planProviderCallbackTransition,
  resolveWinnerClaim,
} from './domain/parallel-transition.js';
export type {
  ParallelTransitionAction,
  ParallelTransitionPlan,
  ProviderCallbackEvent,
  WinnerClaimResolution,
} from './domain/parallel-transition.js';
export { computeParallelTelemetry } from './domain/telemetry.js';

// Effect capabilities and typed failures
export { CallProvider } from './ports/call-provider.js';
export type {
  CallProviderService,
  CreateProviderCallInput,
} from './ports/call-provider.js';
export { ParallelStateStore } from './ports/parallel-state-store.js';
export type { ParallelStateStoreService } from './ports/parallel-state-store.js';
export { CallerIdLockStore } from './ports/caller-id-lock-store.js';
export {
  DialerCallRepository,
  DialerCallRuntime,
  DialerTargetRepository,
} from './ports/dialer-call-start.js';
export type {
  CallableTarget,
  DialerCallContext,
  DialerCallRepositoryService,
  DialerCallRuntimeService,
  DialerCallSelectionStrategy,
  DialerCallSource,
  DialerCallStartCall,
  DialerCallStartCapacity,
  DialerCallStartResult,
  DialerCallStartStatus,
  DialerScenarioCallMode,
  DialerTargetRepositoryService,
  StartDialerCallInput,
} from './ports/dialer-call-start.js';
export { ParallelCompatibilityRuntime } from './ports/parallel-compatibility.js';
export type {
  ParallelCallbackInput,
  ParallelCallbackResult,
  ParallelCompatibilityRuntimeService,
  ParallelDialBody,
  ParallelDialCommand,
  ParallelGroupStatusResult,
  ParallelStrategyInput,
  ParallelTelemetryRecord,
  ParallelTwimlInput,
  TerminateParallelGroupCommand,
  ValidateParallelDialCommand,
} from './ports/parallel-compatibility.js';
export type { CallerIdLockStoreService } from './ports/caller-id-lock-store.js';
export { DialerClock } from './ports/clock.js';
export type { DialerClockService } from './ports/clock.js';
export { DialerIdGenerator } from './ports/id-generator.js';
export type { DialerIdGeneratorService } from './ports/id-generator.js';
export { DialerTelemetry } from './ports/telemetry.js';
export type { DialerTelemetryService } from './ports/telemetry.js';
export {
  DialerCleanupError,
  DialerConflictError,
  DialerInfrastructureError,
  DialerNotFoundError,
  DialerRequestError,
  DialerInterruptedError,
  DialerProviderError,
  DialerStateError,
  DialerTimeoutError,
  DialerTransitionError,
  isRetryableDialerError,
} from './errors/dialer-errors.js';
export type {
  DialerApplicationError,
  DialerProviderOperation,
} from './errors/dialer-errors.js';

// Infrastructure adapters
export { createTwilioCallProviderLayer } from './infrastructure/twilio/call-provider.js';
export { createParallelStateStoreLayer } from './infrastructure/memory/parallel-state-store.js';
export {
  liveDialerClockLayer,
  liveDialerIdGeneratorLayer,
} from './infrastructure/memory/runtime.js';

// Types
export type {
  TwilioCredentials,
  DialerConfig,
  DialOptions,
  DialResult,
  HangupResult,
  VoiceToken,
  ProvisionNumberOptions,
  ProvisionResult,
  PhoneNumber,
  AvailableNumber,
  SearchAvailableNumbersOptions,
  ReleaseResult,
  NumberSelection,
  ResolveCallerIdResult,
  CallerIdLock,
  ConferenceParticipant,
  ConferenceInfo,
  TransferType,
  TransferStatus,
  TransferOptions,
  TransferResult,
  TwimlParams,
  RingTimeMetrics,
  DialStatusPayload,
  ParallelGroupStatus,
  AmdResult,
  ParallelAmdPolicy,
  ParallelTerminationPolicy,
  ParallelDialProfile,
  ProfileKey,
  ProfilePosterior,
  PosteriorStore,
  BetaSampler,
  ParallelStrategyContext,
  ParallelStrategyResolution,
  ParallelTelemetry,
  ParallelCall,
  ParallelCleanupAction,
  ParallelCleanupFailure,
  ParallelGroup,
  ParallelDialOptions,
  ParallelDialResult,
  ParallelStore,
  StoppingThreshold,
  StoppingModelStore,
  HazardEstimate,
  TimingModelStore,
  WhittleIndexInput,
  WhittleIndexResult,
  CadencePolicy,
  AgeBucket,
} from './types.js';
