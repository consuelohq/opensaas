# DEV-1700 timely speaker-aware Groq transcript ingestion

branch: `task/dialer/dev-1700-timely-speaker-aware-groq-transcript-ingestion`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2797
started: 2026-11-13

## acceptance criteria

- [x] Accept and serialize documented Twilio connected/start/media/stop with account/call/tenant/consent checks.
- [x] Bound utterance/provider concurrency, buffers, queue and cancellation independently from telephony.
- [x] Preserve detailed provider timing, conservative role provenance, source gaps and existing history.
- [x] Prove real loopback WebSocket plus isolated PostgreSQL persistence, outbox and shared reducer.
- [x] Publish a recoverable scoped PR; product integration/release gates remain explicitly open below.

## plan

1. Reproduce protocol failure before production edits.
2. Implement provider/media boundaries and bounded scheduling with focused regressions.
3. Extend existing persistence and consume the frozen shared core.
4. Run strict review/full verify, publish task-only PR and hand off integration gates.

## files changed

- `packages/dialer-server/src/call-operations/audio.test.ts`
- `packages/dialer-server/src/call-operations/audio.ts`
- `packages/dialer-server/src/call-operations/limiter.test.ts`
- `packages/dialer-server/src/call-operations/limiter.ts`
- `packages/dialer-server/src/call-operations/media.postgres.integration.test.ts`
- `packages/dialer-server/src/call-operations/normalization.test.ts`
- `packages/dialer-server/src/call-operations/normalization.ts`
- `packages/dialer-server/src/call-operations/outbox.test.ts`
- `packages/dialer-server/src/call-operations/outbox.ts`
- `packages/dialer-server/src/call-operations/transcript-schema.ts`
- `packages/dialer-server/src/call-operations/transcription-benchmark.test.ts`
- `packages/dialer-server/src/call-operations/transcription.ts`

## key decisions

- Authenticated provider-leg ownership and calibrated timing are required; ambiguous speaker/origin abstains.
- Keep reference outbox over existing transcripts; preserve source and normalized cursor distinction.

## notes for ko

- Scoped source checkpoint for root integration; DEV-1700 remains In Progress until host binding/policy/reconnect/quality/release gates are met. No paid inference or live carrier actions.

## improvements noticed

- task.push API parent handling requires a normal owned dependency-merge push before publication; evidence below for DEV-1668.

## errors i ran into

- Initial documented protocol regression, impossible coarse-duration oracle, queue-counter and stop-error cancellation defects were captured red and fixed. See evidence below.
- OS batch adds unsupported parentTraceId to session.start: retried session.start directly. Large inline transformation rejected by transport: used typed fs.write/module separation. No native facade bypass.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr -- --task-only
# Root coordinates integration/release and safe worktree archive.
```

## Scope and authority
DEV-1700, parent DEV-1645 LIFE INSURANCE brief. Started current main 1d31f05f in isolated task; preserve other owners. No deployment, carrier calls, paid inference, credential provisioning or wholesale stream merge. Root owns integration/release. Shared packages/conversation owner will send frozen packet.

## Test-first contract
Behavior: documented connected→start→media→stop accepted and serialized; malformed format/account/stream rejected; no STT capture on opt-out. Bounded utterances, duplicate/reorder/gap safety and timeout/cancel cannot disrupt telephony. Detailed Groq timings retained; transport tracks never guessed as human roles.
Existing pattern: transcription-boundary.test.ts, call-operations/application.test.ts, groq.test.ts, persistence.test.ts.
New tests: complete handshake, concurrency/order, detailed word/segment parsing, source timestamp/clamp, wrong account/stream, replay dedupe, silence/capacity/cancellation.
Focused red: bun test packages/dialer-server/src/transcription-boundary.test.ts packages/dialer-server/src/call-operations/groq.test.ts packages/dialer-server/src/call-operations/application.test.ts
Expected red: connected preamble rejected; verbose response details lost; media with foreign stream accepted; track falsely persisted as speaker.
No-test waiver: none.

## Current findings
Valid connected has no sequenceNumber/streamSid. Existing handler runs concurrent async messages and can race start lookup vs media/stop. Start parser drops accountSid/tracks/mediaFormat. Existing source end equals final frame start, missing payload duration; Groq duration mistaken for speech. Global FIFO limiter can oversubscribe due slot handoff race; no request abort signal; failed session queued operations may still call provider. Current 160000-byte default =20 seconds per track. Existing persisted provider_account_id offers authoritative account binding. Groq docs confirm file API, verbose_json detailed timing and 10-second request billing floor.

- 2026-11-13 20:18:13 append: `.task/dialer/dev-1700-timely-speaker-aware-groq-transcript-ingestion/workpad.md`

## workspace-owned: files changed

- `packages/dialer-server/src/call-operations/audio.test.ts`
- `packages/dialer-server/src/call-operations/audio.ts`
- `packages/dialer-server/src/call-operations/limiter.test.ts`
- `packages/dialer-server/src/call-operations/limiter.ts`
- `packages/dialer-server/src/call-operations/media.postgres.integration.test.ts`
- `packages/dialer-server/src/call-operations/normalization.test.ts`
- `packages/dialer-server/src/call-operations/normalization.ts`
- `packages/dialer-server/src/call-operations/outbox.test.ts`
- `packages/dialer-server/src/call-operations/outbox.ts`
- `packages/dialer-server/src/call-operations/transcript-schema.ts`
- `packages/dialer-server/src/call-operations/transcription-benchmark.test.ts`
- `packages/dialer-server/src/call-operations/transcription.ts`

## workspace-owned: activity log

- 2026-11-13 20:18:13 fs.write: `.task/dialer/dev-1700-timely-speaker-aware-groq-transcript-ingestion/workpad.md`
- 2026-11-13 20:18:44 apply-patch: `packages/dialer-server/src/transcription-boundary.test.ts`
- 2026-11-13 20:18:44 apply-patch: `packages/dialer-server/src/call-operations/groq.test.ts`
- 2026-11-13 20:19:24 apply-patch: `packages/dialer-server/src/call-operations/contracts.ts`
- 2026-11-13 20:19:24 apply-patch: `packages/dialer-server/src/routes/twilio-media.ts`
- 2026-11-13 20:19:51 apply-patch: `packages/dialer-server/src/call-operations/ports.ts`
- 2026-11-13 20:19:51 apply-patch: `packages/dialer-server/src/call-operations/groq.ts`
- 2026-11-13 20:19:51 apply-patch: `packages/dialer-server/src/call-operations/groq.test.ts`
- 2026-11-13 20:21:01 write: `packages/dialer-server/src/call-operations/audio.test.ts`
- 2026-11-13 20:21:01 fs.write: `packages/dialer-server/src/call-operations/audio.test.ts`
- 2026-11-13 20:21:37 write: `packages/dialer-server/src/call-operations/audio.ts`
- 2026-11-13 20:21:37 fs.write: `packages/dialer-server/src/call-operations/audio.ts`
- 2026-11-13 20:21:59 write: `packages/dialer-server/src/call-operations/limiter.test.ts`
- 2026-11-13 20:21:59 fs.write: `packages/dialer-server/src/call-operations/limiter.test.ts`
- 2026-11-13 20:22:15 write: `packages/dialer-server/src/call-operations/limiter.ts`
- 2026-11-13 20:22:15 fs.write: `packages/dialer-server/src/call-operations/limiter.ts`
- 2026-11-13 20:25:20 write: `packages/dialer-server/src/call-operations/transcription.ts`
- 2026-11-13 20:25:20 fs.write: `packages/dialer-server/src/call-operations/transcription.ts`
- 2026-11-13 20:25:39 apply-patch: `packages/dialer-server/src/call-operations/contracts.ts`
- 2026-11-13 20:27:05 apply-patch: `packages/dialer-server/src/call-operations/application.test.ts`
- 2026-11-13 20:27:26 apply-patch: `packages/dialer-server/src/call-operations/application.test.ts`
- 2026-11-13 20:27:26 apply-patch: `packages/dialer-server/src/call-operations/persistence.test.ts`
- 2026-11-13 20:29:15 apply-patch: `packages/dialer-server/src/routes/twilio-media.ts`
- 2026-11-13 20:29:15 apply-patch: `packages/dialer-server/src/call-operations/transcription.ts`
- 2026-11-13 20:29:15 apply-patch: `packages/dialer-server/src/runtime/railway.ts`
- 2026-11-13 20:29:52 write: `packages/dialer-server/src/call-operations/media.postgres.integration.test.ts`
- 2026-11-13 20:29:52 fs.write: `packages/dialer-server/src/call-operations/media.postgres.integration.test.ts`
- 2026-11-13 20:30:41 apply-patch: `packages/dialer-server/src/routes/twilio-media.ts`
- 2026-11-13 20:30:41 apply-patch: `packages/dialer-server/src/call-operations/media.postgres.integration.test.ts`
- 2026-11-13 20:31:24 apply-patch: `packages/dialer-server/src/call-operations/media.postgres.integration.test.ts`
- 2026-11-13 20:31:54 apply-patch: `packages/dialer-server/src/call-operations/application.test.ts`
- 2026-11-13 20:32:43 write: `packages/dialer-server/src/call-operations/transcription-benchmark.test.ts`
- 2026-11-13 20:32:43 fs.write: `packages/dialer-server/src/call-operations/transcription-benchmark.test.ts`
- 2026-11-13 20:33:43 apply-patch: `packages/dialer-server/src/call-operations/media.postgres.integration.test.ts`
- 2026-11-13 20:34:14 apply-patch: `packages/dialer-server/src/database/migrations.test.ts`
- 2026-11-13 20:34:48 write: `packages/dialer-server/src/call-operations/transcript-schema.ts`
- 2026-11-13 20:34:48 fs.write: `packages/dialer-server/src/call-operations/transcript-schema.ts`
- 2026-11-13 20:36:01 apply-patch: `packages/dialer-server/src/call-operations/transcription.ts`
- 2026-11-13 20:36:01 apply-patch: `packages/dialer-server/src/call-operations/media.postgres.integration.test.ts`
- 2026-11-13 20:36:43 apply-patch: `packages/dialer-server/src/call-operations/media.postgres.integration.test.ts`
- 2026-11-13 20:42:45 fs.write: `packages/dialer-server/src/call-operations/normalization.test.ts`
- 2026-11-13 20:43:18 fs.write: `packages/dialer-server/src/call-operations/normalization.ts`
- 2026-11-13 20:44:46 fs.write: `packages/dialer-server/src/call-operations/outbox.test.ts`
- 2026-11-13 20:45:16 fs.write: `packages/dialer-server/src/call-operations/outbox.ts`
- 2026-11-13 20:52:35 fs.write: `.task/dialer/dev-1700-timely-speaker-aware-groq-transcript-ingestion/workpad.md`

## workspace-owned: validation evidence

- 2026-11-13 20:37:30 `review.run`: passed — OK
- 2026-11-13 20:39:01 apply-patch: `packages/dialer-server/src/call-operations/transcription.ts`
- 2026-11-13 20:39:09 `review.run`: passed — OK
- 2026-11-13 20:42:02 apply-patch: `packages/dialer-server/src/call-operations/transcription.ts`
- 2026-11-13 20:42:02 apply-patch: `packages/dialer-server/Dockerfile`
- 2026-11-13 20:42:45 write: `packages/dialer-server/src/call-operations/normalization.test.ts`
- 2026-11-13 20:43:18 write: `packages/dialer-server/src/call-operations/normalization.ts`
- 2026-11-13 20:44:46 write: `packages/dialer-server/src/call-operations/outbox.test.ts`
- 2026-11-13 20:45:16 write: `packages/dialer-server/src/call-operations/outbox.ts`
- 2026-11-13 20:45:49 apply-patch: `packages/dialer-server/src/call-operations/media.postgres.integration.test.ts`
- 2026-11-13 20:46:42 apply-patch: `.github/workflows/consuelo-ci.yaml`
- 2026-11-13 20:47:53 apply-patch: `packages/dialer-server/src/transcription-boundary.test.ts`
- 2026-11-13 20:48:06 apply-patch: `packages/dialer-server/src/routes/twilio-media.ts`
- 2026-11-13 20:52:34 apply-patch: `packages/dialer-server/src/call-operations/limiter.ts`
- 2026-11-13 20:53:00 `review.run`: passed — OK

## Implementation and evidence
- Own task PR2797, based on fresh remote main1d31f05f. Exact core44722b64e0f21255b72ef2eebb06fc71b76027a9 merged preserving ancestry; only that verified dependency merge fast-forwarded to own remote branch6009d6439f before managed publication. task.push uses remoteBranchHead as sole API commit parent (packages/workspace/scripts/task-push.js:521; inspection trc_53c817c489fa), so normal non-force dependency-head push was necessary to preserve core ancestry. Root explicitly authorized. No shared stream/main modification.
- Twilio parser accepts documented connected preamble, validates account/tracks/8kHz mono mu-law declaration and start stream identity. Serialized, bounded text-frame ingestion prevents asynchronous start/media/stop races. Error cancellation bypasses a pending stop flush; terminal failure remains latched. More than256 lifetime frames remain valid; only pending frames count toward the queue ceiling.
- Separate transcription lifecycle, mu-law energy/silence gate, bounded2s chunks/200ms overlap, source-frame overlap trimming, duplicate/reordered frame rejection, gap-before metadata, per-track isolation. Source samples establish chunk end; coarse provider duration is never speech duration. Detailed provider word/segment timing/quality retained only within captured interval. Unknown transport mixes stay unknown; inbound customer role only from persisted contact-owned provider leg; supplied parameters never grant identity.
- Groq whisper-large-v3-turbo remains file API, verbose_json requests word+segment timing. AbortSignal, total queued/provider deadline, fair bounded scheduling with reserved slots, bounded buffers and cancellation. Consent/scope checked before queued provider work, after inference and atomically in persistence. Telephony services are never called by transcription failure.
- Existing transcript table extended with metadata. Forward-only20261113_020_transcript_timing_outbox upgrades installed ledgers; no destructive rollback. Atomic consent-guarded segment insert+reference outbox, contiguous source cursor, no duplicate transcript text in outbox, deletion cascading/late insert guard. Existing history remains readable. Coverage distinguishes complete/partial/unavailable/disabled; failure preserves existing segments. Known source gaps finish with partial coverage.
- Frozen exports normalization.ts: normalizeTranscriptSegment({segment,scope,cursor,binding,audioOffsetMs}) and normalizeTranscriptGap({segment,scope,cursor,audioOffsetMs,participantId?}), typed against actual @consuelo/conversation validators/reducer. Null/unknown call-relative origin, mismatched role/scope/provenance, or missing precise timing abstain.
- Frozen exports outbox.ts: readTranscriptOutbox(database,{workspaceId,sessionId,afterCursor,limit,signal}) returns{outboxId,cursor,segment}[] bounded1..100; acknowledgeTranscriptOutbox(database,{workspaceId,sessionId,outboxId,signal}). SOURCE reference cursor differs from normalized core cursor; gap+segment fanout needs host allocation. DEV1701/1702 owner has API packet and owns actual coaching/runtime delivery integration. No invented default live grant or reconnect origin.
- Bun workspace dependency added using bun add @consuelo/conversation@workspace:* --lockfile-only --ignore-scripts. Task-local frozen install replaced only task's root node_modules symlink, preserving shared primary dependencies. Docker and CI build shared conversation before server imports; CI explicitly runs isolated transcription WS/Postgres fixture.

## Red and green proof
- Original protocol/format/Groq detail red trc_526bf82b55fa (5 failures); green trc_89b47417e103 (25passes). New audio/limiter red missingmodules trc_57632a4c9286/trc_a15b196a8797; green included above. Persistence consent/metadata red trc_5459c677b6c8; migration outbox-upgrade red trc_29ef7ec2a534; green trc_96d8889d27c5.
- Existing oracle expected500ms of speech from4bytes=0.5ms of8kHz mu-law. That oracle was physically impossible. Replaced with source-window[2,3]ms assertion and unavailable speech timing; provider-word source timestamps are separately proven by real WS+PG[1010,1090]ms inside captured[1000,1100]ms.
- Normalization/outbox missingmodule reds trc_3b4a20e0f221/trc_f90a45119b27; green5tests trc_25479989b688. Actual WebSocket→Effect→fixtureGroq→Postgres→reference reader→shared reducer is proven by isolated integration (now tests scope/signatures/account/reconnect/tenant/optout/latewrites/partialcoverage/coreadmission).
- Follow-up boundary red trc_8955dd577ee0 caught lifetime queue-counter and stop-error cancellation defects; green trc_8b2ee2e52b9f7tests. Fixed terminal latch and start-lookup cancellation recheck.
- Final focused45 tests, server typecheck and compiled Bun server build. Shared logger/contacts/conversation/dialer/leadconnector builds pass. Full conversation+server suites366pass/119skip/0fail (485tests/84files), with CONSUELO_RUN_TRANSCRIPTION_POSTGRES=1 and CONSUELO_RUN_LEAD_CONNECTOR_UPGRADE_POSTGRES=1, trc_56a1bb9335f4. Skips are unrelated opt-in carrier/QA/inbound/commercial suites; no skipped transcription or migration upgrade fixture claimed as run.
- Strict review previously0findings against origin/main; rerunning after final changes. Full verify final stamp pending. No paid Groq calls, carrier calls, production DB, credentials, deployment or release performed.

## Benchmark and limits
See benchmark.json. Deterministic1/5/20-call fixture, both tracks, globalproviderconcurrency≤4,1ms fakeprovider;10s call with2×2s utterances pertrack creates4requests and40billedseconds. Continuous both-track60s at2s/200ms overlap creates68requests,133.2submittedseconds,680billedseconds=5.667×original120audioseconds. Compare1s:150requests/1500billedsec;4s:32/320;20s:8/140. Thus2s is a bounded urgency/cost tradeoff, not a paid-quality or p95 audio-to-cue claim. RMS silence detection is a heuristic needing real-speech calibration. Metadata measures queue/provider timing separately from source buffering; real capture/network/browser delivery latency remains unmeasured.
Remaining release gates: host supplies authenticated participant bindings and calibrated call-relative stream offsets/reconnect epochs; live capability/retention admission and coaching feed integration by coordinator/1702; public cursor/revision/tombstone lifecycle delivery; provider-quality/429/cost load evaluation (paid calls separately authorized), final container/exact-SHA CI, production release by root. Current adapters do not claim a fully shipped Script/AI feature. DEV1700 stays In Progress pending integration/release acceptance.

## Cleanup/handoff
Disposable PostgreSQL and loopback WebSocket server stop in finally; no task-owned test service/process remains after checks. No tmp audio/realkeys/phone data. Root may archive task worktree only after verifying pushed source/PR/recovery; task branch and PR remain recoverable. Task-local node_modules/dist are ignored build resources, not product changes.

- 2026-11-13 20:52:35 append: `.task/dialer/dev-1700-timely-speaker-aware-groq-transcript-ingestion/workpad.md`

- 2026-11-13 20:56:04 apply-patch: `packages/dialer-server/src/database/migrations.ts`
Final verify recovery: detached workers completed but failed a related pre-existing native-billing migration error-boundary finding at migrations.ts:469. Added a mechanical contextual catch (no schema/behavior change); source trc_56caacd4911a. Failed replay TTL30s explained repeated launches; no killed workers or bypassed stamp.
