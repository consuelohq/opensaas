// pi-agent-core extensions — tools, context injection, session management

export { DatabaseSessionManager } from './database-session-manager.js';
export type {
  AgentSessionData,
  DatabaseConnection,
  SessionManager,
} from './database-session-manager.js';

export { createPiCrmTools } from './crm-tools.js';
export { createContextInjection } from './context-injection.js';
export type { ContextInjection } from './context-injection.js';
export { createPipelineIntelligence } from './pipeline-intelligence.js';
export type { PipelineIntelligence } from './pipeline-intelligence.js';
export { createDialerTools } from './dialer-tools.js';
export type { DialerService } from './dialer-tools.js';
export { createKbTools } from './kb-tools.js';
export type { KbService } from './kb-tools.js';

// coaching
export { createCoachingDetector } from './coaching-extension.js';
export type { CoachingDetector } from './coaching-extension.js';

// coaching lifecycle (post-call analysis)
export { createCoachingLifecycle } from './coaching-lifecycle.js';
export type { CoachingLifecycle, RecentlyEndedCall } from './coaching-lifecycle.js';

// after-turn extensions
export type { AfterTurnEvent, AfterTurnExtension, ToolCallSummary } from './after-turn.types.js';
export { createPreferenceInference } from './preference-inference.js';
export { createTurnGrading } from './turn-grading.js';
export type { TurnEvaluation } from './turn-grading.js';
export { createUsageTracking } from './usage-tracking.js';
export type { UsageStore, UsageRecord } from './usage-tracking.js';
