# Conversation core

`@consuelo/conversation` is a pure, dependency-free contract package. It owns authenticated conversation scope, immutable transcript facts, deterministic timeline/card reduction, policy admission and replay ports. It does not authenticate requests, store data, run inference, capture audio or control calls.

The boundary audit found that `consuelo-core` owns the OS registry, while `analytics` aggregates older text entries and derives roles from transport tracks. Neither supplies these invariants. Existing analytics can consume normalized finalized segments through an adapter; the old role mapping is not a source of authority. Deprecated `packages/coaching` and the general agent runtime are not dependencies.

## Build and consume

```sh
bun run --cwd packages/conversation build
bun run --cwd packages/conversation typecheck
bun test packages/conversation/tests
```

A consuming workspace adds `@consuelo/conversation` with `bun add @consuelo/conversation` from its package directory after this package is present in the integration tree. Build this package before the consumer: its public exports point at ordinary Node ESM `dist/index.js` and declarations. Do not add TypeScript path aliases. The package is registered in root workspaces and Bun's lockfile. Its Nx project exposes test, typecheck and build. The Consuelo CI dialer lane includes all three.

The current source uses Bun 1.3.14; no package-manager migration is part of this change. Consumer dependency/Docker wiring belongs with the consumer import, not an unused dependency added here.

## Transcript contract

```ts
import {
  createTimeline,
  reduceTimeline,
  type TranscriptSegmentEvent,
} from '@consuelo/conversation';

const scope = {
  workspaceId: 'workspace-a',
  callSessionId: 'call-a',
  callGeneration: 1,
};
const participants = [
  {
    participantId: 'customer-a',
    legId: 'leg-a',
    role: 'customer',
    provenance: 'authenticated-leg',
    bindingRevision: 1,
  },
] as const;
const initial = createTimeline(scope, participants);
const event: TranscriptSegmentEvent = {
  schemaVersion: 1,
  kind: 'segment',
  eventId: 'event-1',
  scope,
  cursor: { sequence: 1, epoch: 0 },
  observedAtMs: 1000,
  source: { adapter: 'fixture', modelVersion: 'frozen-v1' },
  segmentId: 'segment-1',
  segmentRevision: 1,
  participantId: 'customer-a',
  legId: 'leg-a',
  speaker: {
    role: 'customer',
    provenance: 'authenticated-leg',
    bindingRevision: 1,
  },
  audioStartMs: 0,
  audioEndMs: 900,
  text: 'I have existing coverage.',
  finality: 'final',
};
const result = reduceTimeline(initial, event);
```

Scope and bindings MUST come from authenticated server/call facts. Passing an object to this SDK does not authenticate it. A browser, model or STT provider cannot assert tenancy, leg ownership or a human role. Map ambiguous or mixed tracks to role/provenance `unknown`; inbound/outbound does not imply rep/customer. Bindings are pinned for this assistance generation. A later verified binding requires a new explicitly admitted generation, not silently relabelling old facts.

Audio times are finite nonnegative milliseconds relative to the same call audio origin, including across reconnects. Observed time is an absolute clock timestamp. Optional language, quality and roleConfidence retain uncertainty; confidence is in [0,1]. Text and chunk duration do not establish speaking intervals, silence, exact talk metrics or sales outcomes.

Cursor sequence is globally contiguous starting at 1, independent of epoch. Epoch starts at 0. A `reconnected` fact increments epoch by exactly one; subsequent facts use that epoch. Missing cursor facts reject with no mutation: retrieve missing durable facts before resuming. An audio gap is an explicit event:

```ts
const gap = {
  schemaVersion: 1,
  kind: 'gap',
  eventId: 'gap-2',
  scope,
  cursor: { sequence: 2, epoch: 0 },
  observedAtMs: 1200,
  source: { adapter: 'fixture' },
  audioStartMs: 900,
  audioEndMs: 1200,
  reason: 'missing-audio', // reconnect | provider-unavailable | backpressure
};
```

Same eventId/content is idempotent regardless of JSON key ordering; changed content under the same identity rejects. Distinct IDs at old cursors reject. Segment revisions start at 1 and advance exactly one, retaining participant, leg and audio start. A final segment cannot be rewritten or reopened. Adapters own overlap identity and alignment: the reducer does not guess duplicate text or concatenate chunk overlap into truth. Correction of a finalized fact needs a future versioned correction contract, not an undocumented mutation.

`ended`, `revoked` and `deleted` fence late assistance results. A deletion may follow end/revocation, purges transcript/binding payloads and preserves the scope/cursor tombstone. No event revives a deleted generation. Revocation terminates this assistance stream; it has no authority to terminate the telephone call. The host cancels pending provider/selector jobs and removes retained/derived data under policy; an in-memory reducer cannot delete other snapshots or database rows.

Resource caps are protocol safety bounds: 32 participants, 4096 event facts, 2048 segments, 16000 characters per segment, 512 approved cards. Capacity rejects additional data without eviction; terminal/revocation/deletion facts still apply. The host must surface unavailable/backpressure and retain durable authority. This version supplies no automatic history compaction or checkpoint restoration. Never reset a cursor or change generation merely to bypass a limit.

## Approved cards

`validatePlaybook` returns a detached deeply frozen published snapshot with workspace, playbook, published, industry and company-policy versions. Each card has 3–4 approved slots; each slot includes short text and an exact source excerpt/document revision. These examples are synthetic contract fixtures, not an approved insurance pack.

Authoring resolves industry → company-policy → tenant-approved precedence before publication. The SDK pins the resulting immutable snapshot per call. It neither invents statements nor republishes mutable drafts. A patch carries only approved IDs:

```ts
const patch = {
  schemaVersion: 1,
  patchId: 'patch-1',
  scope,
  baseCardRevision: 0,
  transcriptCursor: { sequence: 1, epoch: 0 },
  workerGeneration: 1,
  policyRevision: 1,
  publishedScriptVersion: 'script-v1',
  cardId: 'coverage',
  source: 'rules',
  sourceVersion: 'rules-v1', // manual | rules | selector
  changedSlots: [
    { position: 0, approvedSlotId: 'type' },
    { position: 1, approvedSlotId: 'amount' },
    { position: 2, approvedSlotId: 'family' },
  ],
  evidence: [{ segmentId: 'segment-1', segmentRevision: 1 }],
  issuedAtMs: 1000,
  expiresAtMs: 2000,
};
```

`reduceCard(state, unknownPatch, { timeline, policy, sourceVersions, nowMs, signal })` validates base revision, exact transcript cursor, scope/call generation, worker generation, current policy revision, pinned script version, host-pinned source version (sourceVersions.manual/rules/selector), approved slot layout, finalized evidence, deadline and cancellation. The maximum patch lifetime is a protocol bound of 60 seconds, not a calibrated dwell/cadence recommendation. Automatic results cannot alter a manual pin; manual reference needs its own grant and works without capture consent. A manual patch can set `pin:false` to return control. A new card requires its complete approved layout; same-card changes preserve unaffected slots. `approvedSlotId:null` explicitly clears a removed fourth slot. No visual change returns `unchanged`, with the identical state object and no revision/event.

The host persists validated patches plus selector candidates/reasons/model configuration and feedback in its existing decision/outbox storage. `advanceCardWorker` increments a fenced worker generation and card revision, invalidating all prior work. Generation allocation/leases, budgets, dwell/hysteresis and selection are host/DEV-1702 responsibilities. This package makes no inference-determinism claim.

## Policy and ports

`admitCapability` accepts only a current authenticated call-scoped policy snapshot. Separate grants are manual-reference, live-transcription, live-coaching, retain-transcript, review-upload and ai-generation. Ephemeral STT consent is necessary for live transcription/coaching; AI generation additionally needs explicit generation consent and coaching capability. Retention requires a distinct grant and retention consent. Review/upload does not silently grant capture or retention. Signed billing projection, member authorization and consent verification remain the host admission adapter's responsibility; renew at relevant admission boundaries and cancel/discard on revocation.

Ports in `src/ports.ts` cover AudioSttPort, TranscriptNormalizerPort, TranscriptRepositoryPort, TranscriptOutboxPort, ScriptSelectorPort, StreamDeliveryPort, CapabilityAdmissionPort and Clock. Every asynchronous adapter receives an AbortSignal. Repository append/outbox must be a transaction over the existing durable transcript schema, with expected-cursor conflict handling and deletion tombstones. Delivery is at least once: resume/dedupe by cursor and identity. Outbox acknowledgement does not claim atomic exactly-once delivery across providers/browser.

Production and fixture adapters call the same validators/reducers. `replayTimeline` runs those reducers and offers ReplayObserver; `VirtualClock` supplies monotonic deterministic time to card validation. No network, provider keys or paid inference is needed for tests.

## Version and integration boundary

Schema version 1 rejects unknown versions and unknown event/patch/playbook fields. Persist schemaVersion with raw normalized facts; adapt older existing rows explicitly at the repository boundary. Storage changes are forward-only extensions to current script/transcript storage; this package creates no tables. Future migrations must preserve tenant/call/generation/version/tombstone scope, convert before reduction, and add compatibility fixtures. Cursor holes cannot be disguised as audio gaps.

Tests prove pure contracts and CI classification. They do not prove carrier media, authenticated server admission, transactional outbox, model quality, a live UI, capacity/latency targets, the approved LIFE INSURANCE pack, retention deletion across stores, or a shipped Script/AI release. Those remain DEV-1700 through DEV-1707 integration gates.
