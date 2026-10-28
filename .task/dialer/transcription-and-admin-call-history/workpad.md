# transcription and admin call history

branch: `task/dialer/transcription-and-admin-call-history`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1764/transcription-and-admin-call-history
github pr: https://github.com/consuelohq/opensaas/pull/1764
started: 2026-08-04

## acceptance criteria

- [x] Add a Twilio-signed Hono Media Stream boundary with Effect-owned lifecycle, separate tracks, bounded buffering, backpressure, timeouts, idempotency, and terminal flush.
- [x] Use Groq `whisper-large-v3-turbo` by default with `GROQ_API_KEY` and `GROQ_TRANSCRIPTION_MODEL`, while keeping ordinary tests provider-free.
- [x] Keep transcription explicitly workspace opt-in and persist retention metadata without storing audio, recordings, or raw provider frames.
- [x] Persist canonical call sessions, provider legs, transcript segments, and a transfer-compatible event seam with restart recovery and atomic session/leg projection.
- [x] Expose workspace-scoped active, cursor-paginated history, detail, and transcript read APIs without cross-workspace disclosure.
- [x] Add Active calls, date-grouped call history, per-session detail, attempts, transcript, disposition, opportunity snapshots, CRM sync, transfer events, and collapsed diagnostics to Admin.
- [x] Keep transcript, coaching, and transfer controls out of the compact operator overlay.
- [x] Persist dispositions locally before LeadConnector synchronization and surface sync state.
- [x] Supply focused red/green tests, package typechecks, Nx builds, security scans, and deterministic browser evidence without a carrier call or live Groq request.

## plan

1. Map the Hono, Effect, Twilio, persistence, LeadConnector, and admin boundaries.
2. Establish focused failing contracts for transcription, call-history APIs, tenant isolation, and admin rendering.
3. Implement durable call operations, bounded transcription, signed WebSocket handling, and recovery.
4. Wire the dialer lifecycle, workspace-scoped read APIs, local-first disposition, and admin UI.
5. Add the explicitly gated local Groq validation seam and operator documentation.
6. Run focused and full verification, inspect browser evidence, review the diff, and publish the task branch.

## current status

- Implementation and direct review are complete. Final source tests, typechecks, Nx builds, formatting, static safety scans, and browser evidence are green; ready to publish PR 1764.

## files changed

- `packages/dialer-server`: call-operations contracts, Effect application, PostgreSQL persistence, Groq adapter, signed Media Stream route, workspace-scoped call APIs, lifecycle integration, runtime composition, tests, docs, and explicit integration script.
- `packages/dialer`: durable session ID propagation through start commands and predictive parallel-group options.
- `packages/lead-connector`: call APIs, state/controller flow, cursor pagination, local-first disposition integration, Admin call operations UI, responsive styles, and interaction contracts.
- `.task/dialer/transcription-and-admin-call-history`: task workpad and task metadata.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-04 17:19:22 fs.write: `.task/dialer/transcription-and-admin-call-history/workpad.md`

## workspace-owned: validation evidence

- 2026-08-04 19:02:22 `review.run`: passed — OK
- 2026-08-04 19:07:00 `verify`: passed — OK

## key decisions

- The server generates and durably pre-registers the canonical session ID before carrier initiation; carrier results enrich that same session and all legs atomically.
- Twilio stream timestamps establish call-relative transcript timing; provider duration is metadata, not the source of the call offset.
- Inbound and outbound tracks remain separate. Each track claims whole buffered frames, counts in-flight bytes against its bound, and never retains audio after provider processing.
- Workspace transcription defaults off. The Media Stream is attached only after resolving explicit session/workspace settings.
- The transfer seam is read-only event history in this task; no initiation controls were added.
- Disposition writes are local first. LeadConnector synchronization then updates the durable `crmSyncStatus`.

## notes for ko

- The Groq integration command is intentionally refused unless `DIALER_RUN_GROQ_TRANSCRIPTION_INTEGRATION=1` and `GROQ_API_KEY` are both present. It uses a deterministic, non-sensitive synthetic fixture and does not place a call.
- No live Groq request and no real carrier call were made during this task.

## improvements noticed

- The browser pass exposed underscored transfer-event labels; the renderer now humanizes both hyphenated and underscored lifecycle values, with a red/green contract covering the change.

## issues and recovery

- Root-level `bun test --cwd <package>` collects compiled `dist` tests and breaks repository-root fixture paths. The authoritative source-only form is `bun test packages/<package>/src`; all source suites pass with that cwd-sensitive invocation.
- Playwright was installed without its bundled Chromium cache. Browser evidence used the installed local Google Chrome executable through Playwright; no network installation was needed.

## final validation evidence

- `bun test packages/dialer/src` — 168 pass, 0 fail, 357 expectations across 16 files.
- `bun test packages/dialer-server/src` — 66 pass, 0 fail, 351 expectations across 18 files.
- `bun test packages/lead-connector/src` — 81 pass, 0 fail, 721 expectations across 17 files; the focused transfer-label view suite is 12 pass, 0 fail, 72 expectations.
- `bun run --cwd packages/dialer typecheck` — pass.
- `bun run --cwd packages/dialer-server typecheck` — pass.
- `bun run --cwd packages/lead-connector typecheck` — pass.
- `yarn nx run @consuelo/dialer-server:build` — pass, including its dialer and LeadConnector dependencies.
- `yarn nx run @consuelo/lead-connector:build` — pass.
- `git diff --check` — pass.
- Static review — no transfer action, no retained audio/raw persistence column, and no embedded Groq or Twilio secret assignment.
- Integration guard — without explicit opt-in, the Groq validation script exits non-zero before any provider request.
- Playwright + local Chrome — desktop and mobile Admin render passed order, one-card-per-session, detail, transcript, opportunity, CRM sync, transfer-event privacy, pagination, and no-overflow checks; connected overlay passed absence checks for transcript, coaching, transfer events, and transfer controls.
- Browser screenshots: `/tmp/consuelo-call-history-admin-desktop.png`, `/tmp/consuelo-call-history-admin-mobile.png`, and `/tmp/consuelo-call-history-overlay.png`.
- Direct diff review corrected call-relative transcript timing, atomic session-plus-leg persistence, session pre-registration races, bounded in-flight memory accounting, frame size validation, pagination dedupe, and transfer-event presentation before publication.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract (2026-08-04)

Before production changes, establish focused failing tests for:

- Hono delegation, provider authentication, frame validation, and tenant isolation.
- Separate bounded track buffers, once-only segment processing, close flush, retry/idempotency, and failure transitions.
- Durable active/history/detail/transcript contracts with cursor ordering.
- Admin active/history/detail hierarchy, predictive child attempts, and absence of overlay transcript/coaching and transfer controls.

Constraints:

- Mock SpeechToTextProvider in ordinary tests; no Groq network call.
- No real carrier call; no retained raw audio or recordings.
- Record the focused red command and failure before implementation.

## workspace-owned: files read

- `packages/api/src/routes/coaching.ts`
- `packages/dialer-server/src/main.ts`
- `packages/dialer-server/src/runtime/environment.ts`
- `packages/dialer-server/src/runtime/railway.ts`
- `packages/dialer-server/src/twilio-boundary.test.ts`
- `packages/dialer/src/application/start-parallel-session.ts`
- `packages/dialer/src/dialer.ts`
- `packages/dialer/src/services/conference.ts`
- `packages/dialer/src/services/parallel-dialer.ts`
- `packages/dialer/src/types.ts`
- `packages/lead-connector/src/embed/api-client.test.ts`
- `packages/lead-connector/src/embed/api-client.ts`
- `packages/lead-connector/src/embed/architecture.contract.test.ts`
- `packages/lead-connector/src/embed/controller.ts`
- `packages/lead-connector/src/embed/state-machine.ts`
- `packages/lead-connector/src/embed/view.test.ts`
- `packages/lead-connector/src/embed/view.ts`

- 2026-08-04 17:17:51 apply-patch: `packages/dialer-server/src/call-operations/application.test.ts`
- 2026-08-04 17:17:51 apply-patch: `packages/dialer-server/src/calls.contract.test.ts`
- 2026-08-04 17:17:51 apply-patch: `packages/lead-connector/src/embed/view.test.ts`
- 2026-08-04 17:17:51 apply-patch: `packages/lead-connector/src/embed/api-client.test.ts`

## focused red evidence

- `bun test packages/dialer-server/src/call-operations/application.test.ts packages/dialer-server/src/calls.contract.test.ts` — expected red: missing Effect call-operations application and `/v1/calls*` routes return 404 (1 pass, 3 fail, 1 module error).
- `bun test packages/lead-connector/src/embed/api-client.test.ts packages/lead-connector/src/embed/view.test.ts` — expected red: call-history client methods are absent and admin has no Active calls / Call history hierarchy (11 pass, 2 fail).
- Nx project manifests confirm inferred `test`, `build`, and `typecheck` targets for `@consuelo/dialer-server` and `@consuelo/lead-connector`.
- No real carrier call was placed and no provider request was made.

- 2026-08-04 17:19:22 append: `.task/dialer/transcription-and-admin-call-history/workpad.md`

- 2026-08-04 17:22:18 apply-patch: `packages/dialer-server/src/call-operations/contracts.ts`
- 2026-08-04 17:22:18 apply-patch: `packages/dialer-server/src/call-operations/ports.ts`
- 2026-08-04 17:22:18 apply-patch: `packages/dialer-server/src/call-operations/application.ts`
- 2026-08-04 17:23:23 apply-patch: `packages/dialer-server/src/call-operations/persistence.test.ts`
- 2026-08-04 17:23:23 apply-patch: `packages/dialer-server/src/transcription-boundary.test.ts`
- 2026-08-04 17:23:23 apply-patch: `packages/dialer-server/src/twilio-boundary.test.ts`
- 2026-08-04 17:26:09 apply-patch: `packages/dialer-server/src/call-operations/persistence.ts`
- 2026-08-04 17:29:18 apply-patch: `packages/dialer-server/src/contracts.ts`
- 2026-08-04 17:29:18 apply-patch: `packages/dialer-server/src/app.ts`
- 2026-08-04 17:29:18 apply-patch: `packages/dialer-server/src/main.ts`
- 2026-08-04 17:29:18 apply-patch: `packages/dialer-server/src/routes/twilio-media.ts`
- 2026-08-04 17:30:14 apply-patch: `packages/dialer-server/src/app.ts`
- 2026-08-04 17:30:14 apply-patch: `packages/dialer-server/src/routes/calls.ts`
- 2026-08-04 17:30:20 apply-patch: `packages/dialer-server/src/routes/calls.ts`
- 2026-08-04 17:30:51 apply-patch: `packages/dialer-server/src/call-operations/persistence.test.ts`
- 2026-08-04 17:30:51 apply-patch: `packages/dialer-server/src/transcription-boundary.test.ts`
- 2026-08-04 17:32:31 apply-patch: `packages/dialer-server/src/call-operations/groq.test.ts`
- 2026-08-04 17:32:31 apply-patch: `packages/dialer-server/src/call-operations/groq.ts`
- 2026-08-04 17:32:52 apply-patch: `packages/dialer-server/src/call-operations/groq.ts`
- 2026-08-04 17:33:45 apply-patch: `packages/dialer-server/src/runtime/railway.ts`
- 2026-08-04 17:34:20 apply-patch: `packages/dialer-server/src/application.ts`
- 2026-08-04 17:34:20 apply-patch: `packages/dialer-server/src/runtime/environment.ts`
- 2026-08-04 17:34:34 apply-patch: `packages/dialer-server/src/application.ts`
- 2026-08-04 17:35:49 apply-patch: `packages/dialer-server/src/routes/calls.ts`
- 2026-08-04 17:35:50 apply-patch: `packages/dialer-server/src/routes/lead-connector.ts`
- 2026-08-04 17:36:11 apply-patch: `packages/dialer-server/src/routes/lead-connector.ts`
- 2026-08-04 17:36:39 apply-patch: `packages/lead-connector/src/embed/state-machine.ts`
- 2026-08-04 17:36:39 apply-patch: `packages/lead-connector/src/embed/api-client.ts`
- 2026-08-04 17:37:30 apply-patch: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-08-04 17:37:30 apply-patch: `packages/lead-connector/src/embed/controller.ts`
- 2026-08-04 17:37:30 apply-patch: `packages/lead-connector/src/embed/main.ts`
- 2026-08-04 17:38:10 apply-patch: `packages/lead-connector/src/embed/state-machine.ts`
- 2026-08-04 17:38:10 apply-patch: `packages/lead-connector/src/embed/view.ts`
- 2026-08-04 17:38:55 apply-patch: `packages/lead-connector/src/embed/styles.css`
- 2026-08-04 17:40:51 apply-patch: `packages/dialer-server/src/call-operations/application.ts`
- 2026-08-04 17:40:52 apply-patch: `packages/dialer-server/src/call-operations/application.test.ts`
- 2026-08-04 17:40:52 apply-patch: `packages/dialer-server/src/runtime/railway.ts`
- 2026-08-04 17:40:52 apply-patch: `packages/dialer-server/package.json`
- 2026-08-04 17:40:52 apply-patch: `packages/dialer-server/scripts/validate-groq-transcription.ts`
- 2026-08-04 17:41:00 apply-patch: `packages/dialer-server/package.json`
- 2026-08-04 17:41:38 apply-patch: `packages/dialer-server/README.md`
- 2026-08-04 17:42:30 apply-patch: `packages/dialer-server/src/contracts.ts`
- 2026-08-04 17:42:30 apply-patch: `packages/dialer-server/src/routes/call-sessions.ts`
- 2026-08-04 17:42:30 apply-patch: `packages/dialer-server/src/call-operations/contracts.ts`
- 2026-08-04 17:42:30 apply-patch: `packages/dialer-server/src/application.ts`
- 2026-08-04 17:42:41 apply-patch: `packages/lead-connector/src/embed/controller.ts`
- 2026-08-04 17:43:03 apply-patch: `packages/dialer-server/src/call-operations/persistence.ts`
- 2026-08-04 17:43:58 apply-patch: `packages/lead-connector/src/embed/state-machine.ts`
- 2026-08-04 17:43:58 apply-patch: `packages/lead-connector/src/embed/view.ts`
- 2026-08-04 17:43:58 apply-patch: `packages/lead-connector/src/embed/styles.css`
- 2026-08-04 17:44:11 apply-patch: `packages/dialer-server/src/routes/calls.ts`
- 2026-08-04 17:44:37 apply-patch: `packages/dialer-server/src/routes/calls.ts`
- 2026-08-04 17:46:01 apply-patch: `packages/dialer-server/src/call-operations/contracts.ts`
- 2026-08-04 17:46:01 apply-patch: `packages/dialer-server/src/call-operations/persistence.ts`
- 2026-08-04 17:46:01 apply-patch: `packages/lead-connector/src/embed/view.ts`
- 2026-08-04 17:46:01 apply-patch: `packages/dialer-server/src/call-operations/application.ts`
- 2026-08-04 17:46:01 apply-patch: `packages/dialer-server/src/routes/twilio-media.ts`
- 2026-08-04 17:46:01 apply-patch: `packages/dialer-server/src/runtime/railway.ts`
- 2026-08-04 17:46:47 apply-patch: `packages/dialer-server/src/routes/twilio-media.ts`
- 2026-08-04 17:46:47 apply-patch: `packages/dialer-server/src/call-operations/application.test.ts`
- 2026-08-04 17:46:47 apply-patch: `packages/lead-connector/src/embed/view.test.ts`
- 2026-08-04 17:47:11 apply-patch: `packages/dialer-server/src/lead-connector-boundary.test.ts`
- 2026-08-04 17:47:25 apply-patch: `packages/lead-connector/src/embed/view.ts`
- 2026-08-04 17:47:50 apply-patch: `packages/dialer-server/src/call-operations/contracts.ts`
- 2026-08-04 17:48:09 apply-patch: `packages/lead-connector/src/embed/view.test.ts`
- 2026-08-04 17:51:23 apply-patch: `packages/dialer/src/application/start-dialer-call.ts`
- 2026-08-04 17:51:23 apply-patch: `packages/dialer/src/types.ts`
- 2026-08-04 17:51:23 apply-patch: `packages/dialer/src/domain/parallel-group.ts`
- 2026-08-04 17:51:23 apply-patch: `packages/dialer-server/src/runtime/twilio-provider-mode.ts`
- 2026-08-04 17:51:23 apply-patch: `packages/dialer-server/src/contracts.ts`
- 2026-08-04 17:51:23 apply-patch: `packages/dialer-server/src/call-operations/ports.ts`
- 2026-08-04 17:53:57 apply-patch: `packages/dialer-server/src/call-operations/persistence.ts`
- 2026-08-04 17:54:53 apply-patch: `packages/dialer-server/src/call-operations/application.ts`
- 2026-08-04 17:55:30 apply-patch: `packages/dialer-server/src/call-operations/application.test.ts`
- 2026-08-04 17:56:26 apply-patch: `packages/dialer-server/src/application.ts`
- 2026-08-04 17:57:03 apply-patch: `packages/dialer-server/src/application.ts`
- 2026-08-04 17:57:14 apply-patch: `packages/dialer-server/src/runtime/twilio-provider-mode.test.ts`
- 2026-08-04 17:58:04 apply-patch: `packages/dialer-server/src/embed-boundary.test.ts`
- 2026-08-04 17:58:27 apply-patch: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-08-04 17:59:33 apply-patch: `packages/dialer-server/src/call-history-application.test.ts`

- 2026-08-04 18:00:38 apply-patch: `packages/dialer-server/src/main.ts`
- 2026-08-04 18:01:44 apply-patch: `packages/dialer-server/src/call-operations/application.ts`
- 2026-08-04 18:01:44 apply-patch: `packages/dialer-server/src/application.ts`
- 2026-08-04 18:03:24 apply-patch: `packages/dialer-server/src/call-operations/application.ts`
- 2026-08-04 18:03:35 apply-patch: `packages/dialer-server/src/routes/twilio-media.ts`
- 2026-08-04 18:03:52 apply-patch: `packages/dialer-server/src/transcription-boundary.test.ts`
- 2026-08-04 18:03:52 apply-patch: `packages/dialer-server/src/call-operations/application.test.ts`
- 2026-08-04 18:03:59 apply-patch: `packages/dialer-server/src/transcription-boundary.test.ts`
- 2026-08-04 18:04:10 apply-patch: `packages/dialer-server/src/routes/twilio-media.ts`
- 2026-08-04 18:05:59 apply-patch: `packages/lead-connector/src/embed/state-machine.ts`
- 2026-08-04 18:05:59 apply-patch: `packages/lead-connector/src/embed/view.ts`
- 2026-08-04 18:05:59 apply-patch: `packages/lead-connector/src/embed/styles.css`
- 2026-08-04 18:06:10 apply-patch: `packages/lead-connector/src/embed/view.ts`
- 2026-08-04 18:07:35 apply-patch: `packages/dialer-server/src/call-operations/persistence.ts`
- 2026-08-04 18:08:01 apply-patch: `packages/dialer-server/src/call-operations/persistence.test.ts`
- 2026-08-04 18:08:10 apply-patch: `packages/dialer-server/src/call-operations/persistence.test.ts`
- 2026-08-04 18:08:33 apply-patch: `packages/dialer-server/src/call-operations/application.ts`
- 2026-08-04 18:08:40 apply-patch: `packages/dialer-server/src/call-operations/application.test.ts`
- 2026-08-04 18:09:04 apply-patch: `packages/lead-connector/src/embed/state-machine.ts`
- 2026-08-04 18:09:04 apply-patch: `packages/lead-connector/src/embed/controller.ts`
- 2026-08-04 18:09:04 apply-patch: `packages/lead-connector/src/embed/main.ts`
- 2026-08-04 18:09:04 apply-patch: `packages/lead-connector/src/embed/view.ts`
- 2026-08-04 18:09:22 apply-patch: `packages/lead-connector/src/embed/state-machine.test.ts`
- 2026-08-04 18:16:23 apply-patch: `packages/lead-connector/src/embed/view.test.ts`
- 2026-08-04 18:16:40 apply-patch: `packages/lead-connector/src/embed/view.ts`

- 2026-08-04 18:18:20 apply-patch: `.task/dialer/transcription-and-admin-call-history/workpad.md`

- 2026-08-04 18:20:49 apply-patch: `.task/dialer/transcription-and-admin-call-history/workpad.md`

- 2026-08-04 18:58:38 apply-patch: `packages/dialer-server/src/call-operations/application.ts`
- 2026-08-04 18:59:16 apply-patch: `packages/dialer-server/src/call-operations/groq.ts`
- 2026-08-04 18:59:16 apply-patch: `packages/dialer-server/src/call-operations/persistence.ts`
- 2026-08-04 18:59:16 apply-patch: `packages/dialer-server/src/routes/twilio-media.ts`
- 2026-08-04 18:59:16 apply-patch: `packages/dialer-server/src/routes/calls.ts`
- 2026-08-04 19:01:06 apply-patch: `packages/dialer-server/src/routes/calls.ts`
- 2026-08-04 19:01:39 apply-patch: `packages/dialer-server/src/call-operations/application.ts`
