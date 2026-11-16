# Release workflow repair and coaching replay foundation

branch: `task/dialer/release-workflow-repair-and-coaching-replay-foundation`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2801
started: 2026-11-13

## acceptance criteria

- [x] Repair full-release Worker command argv and fail-closed manifest capture, with extracted-script regression.
- [x] Classify conversation changes for full release, build it before consumers and include Railway watch pattern.
- [ ] Run replay through published production engine and authenticated Hono/UI adapters; record only measured proof.
- [ ] Strict review, full verification and scoped leaf publication; coordinator owns integration and release.
- [ ] Complete DEV-1704 audio, timing, broader policy and source-fidelity acceptance before marking it done.

## plan

1. Establish red and green release-workflow regressions, preserving deployment boundaries.
2. Prepare synthetic replay cases, observers and actual conversation timeline inputs; integrate published engine/UI checkpoints.
3. Validate, review, publish leaf source and hand off evidence and gaps.

## files changed

- `.github/workflows/consuelo-production-release.yaml`, `packages/dialer-server/railway.json`, and release contract tests.
- New `packages/dialer-server/src/coaching-replay/` synthetic fixtures, observer, scheduler, tests and documentation.

## key decisions

- All fixtures are synthetic with provisional unadjudicated oracles. No paid provider, carrier, credential, production change or old evidence-writer modification.
- Use isolated focused root/server Bun installation and built conversation package; never change shared node_modules.

## notes for ko

- Release test originally rejected literal plus argv (trc_98a69c3c3a1f), fixed and verified Wrangler 4.135.0 help (trc_842afab4d088).
- Conversation classifier/watch tests failed (trc_90cd91b9ae91) then passed; combined focused tests 17 pass/187 assertions (trc_1f56cb55ebfb). Package builds and server typecheck pass (trc_ffd973d3d200).
- Replay foundation is incomplete: audio, production route delivery, controlled provider comparisons, full-path timing and integrated acceptance remain open.
- Published engine dependency `9498e37ea3fb6f0f9c3e5ac769f7de5f2ba9cbe1` merged without autostash. Prior UI preview red evidence remains in traces `trc_a95dab30b748` and `trc_9253b01a3599`. Client API/Hono/isolated PostgreSQL now passes V1, preview, V2, manual open/poll/Off, fixture outbox cue and stale/foreign denial; fixture does not establish live authority. Combined focused suite: 25 pass, 269 assertions (`trc_7f935893368e`); server typecheck `trc_f84feff8867d`.
- Comparison test red `trc_c49313f34685` (missing comparison implementation), green `trc_ef617e963898`; fixed seed output `trc_9687b0a1135b` writes six private reports. UI-default rules: 1/60 hits, 12/12 negative abstentions. Naive first-eligible mock at concurrency 1: 11/60 hits, 49 wrong cards, 12/12 false interruptions. These are synthetic provisional labels, no evaluated provider, carrier, browser latency or real-user concurrency. A slow selector after a newer final abstains under the strict cursor fence. Audio, ASR, real wall-clock delivery and broader closed-loop proof remain open; DEV-1698 old evidence writer is not certified.

## improvements noticed

- Replay observer detects injected wrong card, tracks incorrect transitions and refuses free-form artifact fields.

## errors i ran into

- Initial filtered install omitted root TypeScript types; expanded supported focused install to root plus owned workspace packages (trc_9a806406a6b7), then built prerequisites. No shared dependency changes.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: full release Worker upload, deployment, capture execute with exact argv and produce manifest; production replay reports measured synthetic outcomes without fabricated ASR claims.
existing local pattern: release-workflow contract executes extracted bash with fixture binaries; conversation and transcription packages expose real reducers and adapters.
new or changed tests: executable stubbed provider regression for release; replay observer, synthetic corpus and production service path tests.
focused red command: bun test packages/lead-connector/src/deployment/release-workflow.contract.test.ts
expected red failure: literal plus tokens corrupt provider argv and prevent deployment capture.
no-test waiver: not applicable.

- 2026-11-13 21:02:07 append: `.task/dialer/release-workflow-repair-and-coaching-replay-foundation/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-13 21:02:07 fs.write: `.task/dialer/release-workflow-repair-and-coaching-replay-foundation/workpad.md`

- 2026-11-13 21:02:33 apply-patch: `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- 2026-11-13 21:02:55 apply-patch: `.github/workflows/consuelo-production-release.yaml`
- 2026-11-13 21:05:00 apply-patch: `packages/dialer-server/src/coaching-replay/fixtures.ts`
- 2026-11-13 21:05:25 apply-patch: `packages/dialer-server/src/coaching-replay/observer.test.ts`
- 2026-11-13 21:06:04 apply-patch: `packages/dialer-server/src/coaching-replay/observer.ts`
- 2026-11-13 21:07:30 apply-patch: `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- 2026-11-13 21:07:49 apply-patch: `.github/workflows/consuelo-production-release.yaml`
- 2026-11-13 21:07:49 apply-patch: `packages/dialer-server/railway.json`
- 2026-11-13 21:09:15 apply-patch: `packages/dialer-server/src/coaching-replay/observer.test.ts`
- 2026-11-13 21:09:40 apply-patch: `packages/dialer-server/src/coaching-replay/observer.test.ts`
- 2026-11-13 21:09:40 apply-patch: `packages/dialer-server/src/coaching-replay/observer.ts`
- 2026-11-13 21:10:08 apply-patch: `packages/dialer-server/src/coaching-replay/observer.test.ts`
- 2026-11-13 21:10:08 apply-patch: `packages/dialer-server/src/coaching-replay/observer.ts`
- 2026-11-13 21:10:18 apply-patch: `packages/dialer-server/src/coaching-replay/observer.test.ts`
- 2026-11-13 21:10:18 apply-patch: `packages/dialer-server/src/coaching-replay/observer.ts`
- 2026-11-13 21:10:40 apply-patch: `packages/dialer-server/src/coaching-replay/transcript.test.ts`
- 2026-11-13 21:11:03 apply-patch: `packages/dialer-server/src/coaching-replay/transcript.ts`
- 2026-11-13 21:11:52 apply-patch: `packages/dialer-server/src/coaching-replay/runner.test.ts`
- 2026-11-13 21:12:29 apply-patch: `packages/dialer-server/src/coaching-replay/runner.ts`
- 2026-11-13 21:12:58 apply-patch: `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- 2026-11-13 21:13:08 apply-patch: `packages/dialer-server/src/coaching-replay/runner.test.ts`
- 2026-11-13 21:13:27 apply-patch: `packages/dialer-server/src/coaching-replay/runner.ts`
- 2026-11-13 21:15:16 apply-patch: `packages/dialer-server/src/coaching-replay/README.md`

- 2026-11-13 21:16:14 apply-patch: `.task/dialer/release-workflow-repair-and-coaching-replay-foundation/workpad.md`
- 2026-11-13 21:16:25 apply-patch: `packages/dialer-server/src/coaching-replay/observer.test.ts`
- 2026-11-13 21:16:45 apply-patch: `packages/dialer-server/src/coaching-replay/observer.ts`

## workspace-owned: validation evidence

- 2026-11-13 21:21:10 apply-patch: `packages/dialer-server/src/coaching-replay/artifact.test.ts`
- 2026-11-13 21:21:10 apply-patch: `packages/dialer-server/src/coaching-replay/artifact.ts`
- 2026-11-13 21:21:20 apply-patch: `packages/dialer-server/src/coaching-replay/artifact.test.ts`
- 2026-11-13 21:21:38 apply-patch: `packages/dialer-server/src/coaching-replay/artifact.ts`
- 2026-11-13 21:21:51 apply-patch: `packages/dialer-server/src/coaching-replay/artifact.test.ts`
- 2026-11-13 21:21:51 apply-patch: `packages/dialer-server/src/coaching-replay/artifact.ts`
- 2026-11-13 21:22:10 apply-patch: `packages/dialer-server/src/coaching-replay/artifact.test.ts`
- 2026-11-13 21:22:47 apply-patch: `packages/dialer-server/src/coaching-replay/README.md`
- 2026-11-13 21:24:00 apply-patch: `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- 2026-11-13 21:30:25 apply-patch: `packages/dialer-server/src/coaching-replay/client-roundtrip.postgres.integration.test.ts`
- 2026-11-13 21:30:44 apply-patch: `packages/dialer-server/src/coaching-replay/client-roundtrip.postgres.integration.test.ts`
- 2026-11-13 21:30:58 apply-patch: `packages/dialer-server/src/coaching-replay/client-roundtrip.postgres.integration.test.ts`
- 2026-11-13 21:31:31 apply-patch: `packages/dialer-server/src/coaching-replay/client-roundtrip.postgres.integration.test.ts`
- 2026-11-13 21:32:19 apply-patch: `packages/dialer-server/src/coaching-replay/production.test.ts`
- 2026-11-13 21:32:50 apply-patch: `packages/dialer-server/src/coaching-replay/transcript.ts`
- 2026-11-13 21:32:50 apply-patch: `packages/dialer-server/src/coaching-replay/production.ts`
- 2026-11-13 21:33:12 apply-patch: `packages/dialer-server/src/coaching-replay/client-roundtrip.postgres.integration.test.ts`
- 2026-11-13 21:33:27 apply-patch: `packages/dialer-server/src/coaching-replay/production.test.ts`
- 2026-11-14 02:41:16 apply-patch: `packages/dialer-server/src/coaching-replay/compare.test.ts`
- 2026-11-14 02:41:38 apply-patch: `packages/dialer-server/src/coaching-replay/compare.ts`
- 2026-11-14 02:42:16 apply-patch: `packages/dialer-server/src/coaching-replay/client-roundtrip.postgres.integration.test.ts`
- 2026-11-14 02:42:16 apply-patch: `packages/dialer-server/src/coaching-replay/README.md`
- 2026-11-14 02:42:30 apply-patch: `packages/dialer-server/src/coaching-replay/client-roundtrip.postgres.integration.test.ts`
- 2026-11-14 02:43:00 apply-patch: `.task/dialer/release-workflow-repair-and-coaching-replay-foundation/workpad.md`
- 2026-11-14 02:43:25 `review.run`: passed — OK
- 2026-11-14 02:43:35 apply-patch: `packages/dialer-server/src/coaching-replay/compare.ts`
- 2026-11-14 02:43:54 `review.run`: passed — OK
- 2026-11-14 02:43:58 apply-patch: `packages/dialer-server/src/coaching-replay/compare.ts`
- 2026-11-14 02:44:15 `review.run`: passed — OK
- 2026-11-14 02:45:00 `verify`: passed — OK
