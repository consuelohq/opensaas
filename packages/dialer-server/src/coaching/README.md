# Published Script runtime checkpoint

This server layer extends the existing100KB TXT/Markdown script library. It does not enable production transcription, paid inference or Mercury entitlements.

## Public routes

All routes sit behind existing authenticated `/v1/*` middleware and no-store coaching middleware. Browser/model workspace/member IDs are ignored.

- Existing `GET /v1/coaching/scripts` and revision-aware `PUT /v1/coaching/scripts/:id` remain. Server projections include `canEdit`/`canPublish` for creator/admin authority.
- `POST /v1/coaching/scripts/:id/preview`: `{expectedRevision,expectedPublishedVersion}` → `{preview:CompiledPlaybook}`.
- `POST .../:id/publish`: same revisions plus `approved:true` → `{version,sourceRevision,createdAt,compiled}`. Optional advanced `rules` must be explicitly author-approved. Preview/save is not publication.
- `GET .../:id/versions` → `{versions:[{version,sourceRevision,createdAt,publishedVersion}]}`.
- `DELETE .../:id` with `{expectedRevision}` archives the script, prevents new pins and preserves immutable publications/current-call pins.
- `GET /v1/coaching/examples/life-insurance` returns a visibly labelled synthetic six-card example and rules. It is not automatically installed or claimed to be approved insurance material.
- `POST /v1/coaching/sessions`: `{scopeKey,scriptId,version?:number}` → `{view,publishedVersion:string,projectionToken:string}`.
- `GET /v1/coaching/sessions/:encodedScopeKey/cue?afterRevision=N` → same envelope, with `view:null` when unchanged.
- `POST .../:encodedScopeKey/control`: `{action:'pin'|'auto'|'next'|'previous'|'off',projectionToken}` → `{view,publishedVersion,projectionToken}`. A stale token returns409 SCRIPT_CONFLICT before mutation.

View is the UI owner's MercuryCueView: `{scopeKey,revision,heading,kind:'approved'|'manual',status:'live'|'manual'|'delayed'|'reconnecting'|'unavailable',points:[{slotId,text,exact,source}]}`. No new Off enum. Projection tokens are protocol data, never a form field. The call's publication pin survives edits, publicationV2, Off/reopen and reconnect; a new worker projection gets a new token/generation. Initial view is first-card MANUAL reference, not an automatic recommendation.

Errors:403 COACHING_ACCESS_DENIED for author/member/call denial,409 SCRIPT_CONFLICT for revision/pin/projection conflicts,400 INVALID_PLAYBOOK for safe compiler validation,503 COACHING_UNAVAILABLE for infrastructure failure. Unopened sessions are denied; retain existing manual fallback. No browser transcript-ingestion route exists.

## Source/compiler boundary

`compilePlaybook` in playbooks.ts is deterministic and provider-neutral. Each heading (or plain text document without headings) needs3–4 approved bullet/numbered points. Cue text comes directly from saved source; the expanded excerpt retains the section's exact wording. Source offsets, document/revision, immutable publication, stage identifiers and validated branch references are retained. There is no model condensation. When rules are omitted, the only default trigger is each exact normalized source heading (or plain-text library title), customer role and priority0. Preview exposes these aliases as Listen for phrases for review before approval; no synonym, paraphrase or industry intelligence is inferred. Explicit rules:[] prepares manual reference only. Long headings beyond the80character trigger bound have no automatic alias.

Ordinary uploads do not ask users to invent industry/company version IDs. Server publication derives `unclassified-tenant-text-v1` and `tenant-source:<scriptId>:<savedRevision>` from authenticated saved source. Client-provided labels cannot establish pack/company approval. These are provenance labels, not evidence of an external industry pack or company policy registry. A future registered-pack adapter must resolve real approved versions and precedence.

The example covers existing coverage, affordability, spouse/family, beneficiaries, employer coverage and application/underwriting questions. Its questions contain no premiums, guarantees, eligibility, tax or insurer policy claims. Tenant authors must review their own source before publication.

Migration021 adds publications and call/worker pins beside existing migration015 scripts; no duplicate script/transcript database. Publication insert checks saved revision, creator/admin authority and expected publication ordinal in one statement; concurrency admits one winner. Archives are forward-only. Hard deletion/retention orchestration across derived artifacts is not implemented by this checkpoint.

## Runtime and actual production composition

`createScriptSession` calls the same core reducers in production and replay. Fast finalized-utterance rules require authenticated role, aliases and required/forbidden context; negated, quoted and historical contexts can abstain. Manual pin/navigation wins; changed slots only; unchanged results emit no event. Core scope/cursor/script/policy/source/worker/base-revision/expiry fences remain exact. `decision()`/`onDecision` expose a detached validated CardPatch with card ID/evidence/cursor for private replay observers, without copying customer text into logs.

`createClosedSetSelector` requires pinned provider/model revisions and structured-output capability. Its injected runner receives approved candidate IDs and at most8 recent finalized turns/8000characters, no call/CRM tools. Model source/pin/scope/free text never enter the trusted patch. Candidate and returned-card speaker/required/forbidden eligibility are checked server-side; core validates all IDs/evidence. One in-flight operation/call, process-global4, default20requests/projection, deadline≤5seconds, default15seconds between fresh-input requests. Silence/duplicate input/Off/unconsented/ended calls make no request. Urgent/manual changes cancel older work; ordinary finals do not blanket-abort it.

**Context-path acceptance remains open:** an operation slower than new finalized events can finish and be discarded by the exact cursor fence during continuous speech. This checkpoint does not silently rebase stale model input onto a new cursor or claim the Pi-assisted path has passed cadence/quality/cost acceptance. There is no paid OpenRouter/Pi transport configured here; only the bounded injectable contract and fixture comparison are proven.

`createCoachingRuntime(database,{liveAuthority?,resolveSessionId?,nowMs?})` is used by Railway's existing script factory. It mounts real routes and binds existing durable transcript outbox → trusted normalization → ScriptSession → authorized cue delivery. Outbox source cursor and core event cursor are distinct; gaps/reconnects may fan out. Acknowledgement follows reduction. Projection stream state is scoped to actual worker generation, bounded and released on Off/disposal; replay cannot compare historical stream1 with another generation's last stream.

Outbound scopeKey may contain providerGroupId. Railway resolves stored Redis group ownership (workspace/member/group) to durable dialerSessionId, then checks durable call ownership. Neither browser IDs nor transport track establish a human role. Inbound admission currently requires a future authoritative assignment/binding adapter; it fails closed.

Default authority grants authenticated manual reference only. Production live authority is deliberately absent. To activate later, DEV-1707 must provide a trusted current policy snapshot with workspace/call/member, revision, expiry, explicit live-transcription + live-coaching capabilities and ephemeral-STT consent, plus authenticated participant/leg/provenance bindings and call-relative origins. Existing per-call transcription opt-in is additionally required. Retention/AI grants remain separate. Unknown timing/origin causes honest delayed/unavailable fallback. Reconnect requires a separately trusted per-stream offset; no origin is guessed.

Worker claims are durable/fenced; concurrent opens serialize per authenticated scope. Projection-token controls serialize with readmission. Failed authority/claim renewal aborts work and releases the projection. Ended calls cannot create a pin. HTTP admission cancellation disposes work before delivery.

## Proof and remaining gates

Run:

```sh
bun test packages/dialer-server/src/coaching
CONSUELO_RUN_COACHING_POSTGRES=1 bun test packages/dialer-server/src/coaching
bun run --cwd packages/dialer-server typecheck
```

Isolated PostgreSQL/Hono proof uses actual existing script APIs, publication races, real transcript repository/outbox, normalizers and route projections with explicit fixture policy. It checks foreign authors/tenants, source fidelity, immutable callV1 after publicationV2, Off/reopen generation/token, stale controls, revocation, archive and terminal controls. Unit tests include the real2049segment cap: cursor stops at2048, view becomes unavailable, no silent cursor reset. No carrier/model calls occur.

Remaining DEV-1701/1702 acceptance includes browser authoring upload/preview/save/reload integration, registered industry/company/tenant precedence and glossary authoring, richer rule-authoring UX beyond transparent approved heading phrases, durable restoration of manual card/pin/control state across server recreation, full retention/deletion lifecycle, per-tenant durable inference budget, contextual cadence/quality acceptance and evaluated Pi/provider transport. DEV-1704/1707 own broader held-out replay, real client/server roundtrip, signed entitlement/consent activation, inbound admission and release. This checkpoint is reviewable source, not a shipped Mercury Script/AI feature.
