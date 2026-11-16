import type {
  ConversationScope,
  TranscriptCursor,
  TranscriptEvent,
  TimelineState,
  CardPatch,
  PublishedPlaybook,
  AssistancePolicy,
  Capability,
  Validation,
} from './types.js';
export interface Clock {
  nowMs(): number;
}
export class VirtualClock implements Clock {
  private current: number;
  constructor(initialMs = 0) {
    if (!Number.isFinite(initialMs) || initialMs < 0)
      throw new Error('invalid clock');
    this.current = initialMs;
  }
  nowMs(): number {
    return this.current;
  }
  advanceTo(nowMs: number): void {
    if (!Number.isFinite(nowMs) || nowMs < this.current)
      throw new Error('clock cannot move backwards');
    this.current = nowMs;
  }
}
export interface AudioChunk {
  readonly scope: ConversationScope;
  readonly participantId: string;
  readonly legId: string;
  readonly epoch: number;
  readonly audioStartMs: number;
  readonly audioEndMs: number;
  readonly encoding: string;
  readonly sampleRateHz: number;
  readonly bytes: Uint8Array;
}
// Provider adapters translate raw transport and STT details; they cannot assign authenticated scope.
export interface AudioSttPort {
  transcribe(
    chunk: AudioChunk,
    signal: AbortSignal,
  ): AsyncIterable<TranscriptEvent>;
}
export interface TranscriptNormalizerPort {
  normalize(
    input: unknown,
    scope: ConversationScope,
  ): Validation<TranscriptEvent>;
}
export interface AppendTranscriptResult {
  readonly status: 'appended' | 'duplicate' | 'conflict' | 'deleted';
  readonly cursor: TranscriptCursor;
  readonly outboxId?: string;
}
// Implement append + outbox atomically against EXISTING transcript storage; deletion tombstones fence all late appends.
export interface TranscriptRepositoryPort {
  append(
    event: TranscriptEvent,
    expectedCursor: TranscriptCursor,
    signal: AbortSignal,
  ): Promise<AppendTranscriptResult>;
  read(
    scope: ConversationScope,
    after: TranscriptCursor,
    limit: number,
    signal: AbortSignal,
  ): Promise<readonly TranscriptEvent[]>;
  tombstone(scope: ConversationScope, signal: AbortSignal): Promise<void>;
}
export interface TranscriptOutboxPort {
  pending(
    scope: ConversationScope,
    limit: number,
    signal: AbortSignal,
  ): Promise<
    readonly { readonly outboxId: string; readonly event: TranscriptEvent }[]
  >;
  acknowledge(
    scope: ConversationScope,
    outboxId: string,
    signal: AbortSignal,
  ): Promise<void>;
}
export interface SelectorInput {
  readonly timeline: TimelineState;
  readonly playbook: PublishedPlaybook;
  readonly policy: AssistancePolicy;
  readonly workerGeneration: number;
  readonly baseCardRevision: number;
  readonly deadlineMs: number;
  readonly candidateCardIds: readonly string[];
}
// Script selectors return closed-set approved IDs, never generated policy statements. Host bounds deltas/budget/concurrency.
export interface ScriptSelectorPort {
  select(input: SelectorInput, signal: AbortSignal): Promise<CardPatch | null>;
}
export interface StreamDeliveryPort {
  publish(
    scope: ConversationScope,
    event: TranscriptEvent | CardPatch,
    signal: AbortSignal,
  ): Promise<void>;
  resume(
    scope: ConversationScope,
    after: TranscriptCursor,
    signal: AbortSignal,
  ): AsyncIterable<TranscriptEvent>;
}
export interface CapabilityAdmissionPort {
  authorize(
    scope: ConversationScope,
    capability: Capability,
    signal: AbortSignal,
  ): Promise<AssistancePolicy>;
}
