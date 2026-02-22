export type { ContextLoader } from './types.js';
export type { MemoryType, MemorySource, AgentMemoryFull } from './memory.types.js';
export type { MemoryStore } from './memory.store.js';
export type { QualificationCriterion, SalesMethodology, WorkspaceMethodologyConfig } from './methodology.types.js';
export { inferPreferences, persistSignals } from './preference-inference.service.js';
export type { PreferenceSignalType, PreferenceSignal, InferenceInput } from './preference-inference.service.js';
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
} from './pipeline.types.js';
export {
  scoreDeal,
  scorePipeline,
  computeHealth,
  generateInsights,
  buildPipelineContext,
} from './pipeline-intelligence.service.js';
