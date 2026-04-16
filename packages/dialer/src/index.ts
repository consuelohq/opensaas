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
