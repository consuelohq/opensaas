export const SCHEMA_VERSION = 1 as const;
export const LIMITS = Object.freeze({
  idLength: 128,
  textLength: 16000,
  events: 4096,
  segments: 2048,
  participants: 32,
  cards: 512,
  patchLifetimeMs: 60000,
});
export interface ConversationScope {
  readonly workspaceId: string;
  readonly callSessionId: string;
  readonly callGeneration: number;
}
export interface TranscriptCursor {
  readonly sequence: number;
  readonly epoch: number;
}
export type SpeakerRole = 'rep' | 'customer' | 'unknown';
export interface SpeakerProvenance {
  readonly role: SpeakerRole;
  readonly provenance: 'authenticated-leg' | 'verified-diarization' | 'unknown';
  readonly bindingRevision: number;
}
export interface ParticipantBinding extends SpeakerProvenance {
  readonly participantId: string;
  readonly legId: string;
}
export interface EventSource {
  readonly adapter: string;
  readonly modelVersion?: string;
}
export interface TranscriptEnvelope {
  readonly schemaVersion: 1;
  readonly eventId: string;
  readonly scope: ConversationScope;
  readonly cursor: TranscriptCursor;
  readonly observedAtMs: number;
  readonly source: EventSource;
}
export interface TranscriptSegmentEvent extends TranscriptEnvelope {
  readonly kind: 'segment';
  readonly segmentId: string;
  readonly segmentRevision: number;
  readonly participantId: string;
  readonly legId: string;
  readonly speaker: SpeakerProvenance;
  readonly audioStartMs: number;
  readonly audioEndMs: number;
  readonly text: string;
  readonly language?: string;
  readonly quality?: number;
  readonly roleConfidence?: number;
  readonly finality: 'interim' | 'final';
}
export interface TranscriptGapEvent extends TranscriptEnvelope {
  readonly kind: 'gap';
  readonly audioStartMs: number;
  readonly audioEndMs: number;
  readonly reason:
    | 'missing-audio'
    | 'reconnect'
    | 'provider-unavailable'
    | 'backpressure';
  readonly participantId?: string;
}
export interface TranscriptLifecycleEvent extends TranscriptEnvelope {
  readonly kind: 'reconnected' | 'ended' | 'revoked' | 'deleted';
}
export type TranscriptEvent =
  | TranscriptSegmentEvent
  | TranscriptGapEvent
  | TranscriptLifecycleEvent;
export interface TimelineState {
  readonly scope: ConversationScope;
  readonly participants: readonly ParticipantBinding[];
  readonly cursor: TranscriptCursor;
  readonly status: 'active' | 'ended' | 'revoked' | 'deleted';
  readonly segments: Readonly<Record<string, TranscriptSegmentEvent>>;
  readonly gaps: readonly TranscriptGapEvent[];
  readonly events: readonly TranscriptEvent[];
}
export type Validation<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string };
export interface Reduction<T> {
  readonly status: 'applied' | 'duplicate' | 'unchanged' | 'rejected';
  readonly state: T;
  readonly reason?: string;
}
export interface ApprovedSource {
  readonly documentId: string;
  readonly revision: string;
  readonly excerpt: string;
}
export interface ApprovedSlot {
  readonly id: string;
  readonly text: string;
  readonly source: ApprovedSource;
}
export interface ApprovedCard {
  readonly id: string;
  readonly title: string;
  readonly stageId?: string;
  readonly slots: readonly ApprovedSlot[];
}
export interface PublishedPlaybook {
  readonly schemaVersion: 1;
  readonly workspaceId: string;
  readonly playbookId: string;
  readonly publishedVersion: string;
  readonly industryPackVersion: string;
  readonly companyPolicyVersion: string;
  readonly cards: readonly ApprovedCard[];
}
export interface EvidenceReference {
  readonly segmentId: string;
  readonly segmentRevision: number;
}
export interface CardPatch {
  readonly schemaVersion: 1;
  readonly patchId: string;
  readonly scope: ConversationScope;
  readonly baseCardRevision: number;
  readonly transcriptCursor: TranscriptCursor;
  readonly workerGeneration: number;
  readonly policyRevision: number;
  readonly publishedScriptVersion: string;
  readonly cardId: string;
  readonly source: 'manual' | 'rules' | 'selector';
  readonly sourceVersion: string;
  readonly changedSlots: readonly {
    readonly position: number;
    readonly approvedSlotId: string | null;
  }[];
  readonly evidence: readonly EvidenceReference[];
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  readonly pin?: boolean;
}
export interface CardState {
  readonly scope: ConversationScope;
  readonly playbook: PublishedPlaybook;
  readonly workerGeneration: number;
  readonly revision: number;
  readonly cardId: string | null;
  readonly slots: readonly string[];
  readonly pinned: boolean;
  readonly lastPatchId: string | null;
}
export type Capability =
  | 'manual-reference'
  | 'live-transcription'
  | 'live-coaching'
  | 'retain-transcript'
  | 'review-upload'
  | 'ai-generation';
export interface AssistancePolicy {
  readonly scope: ConversationScope;
  readonly memberId: string;
  readonly revision: number;
  readonly validUntilMs: number;
  readonly revoked: boolean;
  readonly capabilities: readonly Capability[];
  readonly consent: {
    readonly ephemeralTranscription: boolean;
    readonly retainedTranscript: boolean;
    readonly aiGeneration: boolean;
  };
}
export interface CardContext {
  readonly timeline: TimelineState;
  readonly policy: AssistancePolicy;
  readonly sourceVersions: Readonly<Record<CardPatch['source'], string>>;
  readonly nowMs: number;
  readonly signal?: AbortSignal;
}
