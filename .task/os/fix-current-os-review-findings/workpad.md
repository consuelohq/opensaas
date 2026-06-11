# fix current OS review findings

branch: `task/os/fix-current-os-review-findings`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/967

## Objective

Verify each supplied inline/nitpick finding against current `stream/os`, fix only findings still valid, skip stale findings with a brief reason, keep the patch minimal, and validate.

## Exploration

- Read stream context for `stream/os`; recent stream commits include hosted embedding gateway default and semantic index repo scoping.
- Read repo standards: `AGENTS.md`, `CODING-STANDARDS.md`, and `packages/workspace/SCRIPTS.md` before code edits.
- Read target files before editing: workflow hook, artifact renderer, embedder/config/gateway/store, install-state, and semantic-index test.

## Test-first contract

Behavior under test:
- `workflow.js` forwards `state.noTests` intent into `validation.review` instead of always forcing `noTests: true`.
- `artifact-render.ts` sanitizes map hrefs before rendering/querying, reports CLI render errors with deterministic context, fixes stale usage text, and avoids per-frame query/storage work in scroll sync.
- `embedder.js` rejects unknown embedding providers instead of silently routing to the gateway.
- `embedding-config.js` honors boolean `truncate: false`; gateway request model and config id use the resolved `apiModel` consistently.
- `store.js` runtime asset metadata does not persist raw `remoteUrl`.
- `install-state.ts` reports `exists` for security files/directories already present.
- `semantic-index-storage.test.ts` uses exported helpers/behavior rather than source-string assertions, only if feasible without importing native SQLite side effects.

Focused validation plan:
- Existing package syntax/typecheck: `cd packages/os && bun run typecheck`.
- Focused tests where available: semantic embedding gateway test and semantic index storage test.
- Add focused tests only when a current issue has a reasonable existing test surface. For comments that touch generated inline browser script in `artifact-render.ts`, validate with syntax/typecheck and readback/diff unless an existing renderer fixture test exists.

Expected red failures before implementation:
- Source inspections should show which findings are still live; no new production code changes before verification.

- 2026-06-11 17:35:48 write: `.task/os/fix-current-os-review-findings/workpad.md`

## files changed

- `packages/os/hooks/task/workflow.js`
- `packages/os/scripts/artifact-render.ts`
- `packages/os/scripts/lib/index/embedder.js`
- `packages/os/scripts/lib/index/embedding-config.js`
- `packages/os/scripts/lib/index/embedding-gateway.js`
- `packages/os/scripts/lib/index/store.js`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/artifact-render.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/semantic-embedding-gateway.test.ts`
- `packages/os/tests/semantic-index-storage.test.ts`

## workspace-owned: files changed

- `packages/os/hooks/task/workflow.js`
- `packages/os/scripts/artifact-render.ts`
- `packages/os/scripts/lib/index/embedder.js`
- `packages/os/scripts/lib/index/embedding-config.js`
- `packages/os/scripts/lib/index/embedding-gateway.js`
- `packages/os/scripts/lib/index/store.js`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/artifact-render.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/semantic-embedding-gateway.test.ts`
- `packages/os/tests/semantic-index-storage.test.ts`

## workspace-owned: activity log

- 2026-06-11 17:35:48 fs.write: `.task/os/fix-current-os-review-findings/workpad.md`
- 2026-06-11 17:41:09 fs.patch: `packages/os/hooks/task/workflow.js`
- 2026-06-11 17:41:19 fs.patch: `packages/os/hooks/task/workflow.js`
- 2026-06-11 17:41:48 fs.patch: `packages/os/hooks/task/workflow.js`
- 2026-06-11 17:42:43 fs.patch: `packages/os/hooks/task/workflow.js`
- 2026-06-11 17:45:02 fs.write: `packages/os/tests/semantic-embedding-gateway.test.ts`
- 2026-06-11 17:45:36 fs.patch: `packages/os/hooks/task/workflow.js`
- 2026-06-11 17:46:21 fs.patch: `packages/os/hooks/task/workflow.js`
- 2026-06-11 17:47:07 fs.patch: `packages/os/hooks/task/workflow.js`
- 2026-06-11 17:47:55 fs.write: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 17:48:07 fs.write: `packages/os/tests/artifact-render.test.ts`
- 2026-06-11 17:48:25 fs.patch: `packages/os/tests/install-state.test.ts`
- 2026-06-11 17:49:54 fs.patch: `packages/os/scripts/lib/index/embedding-config.js`
- 2026-06-11 17:50:33 fs.patch: `packages/os/scripts/lib/index/embedding-config.js`
- 2026-06-11 17:50:56 fs.patch: `packages/os/scripts/lib/index/embedding-gateway.js`
- 2026-06-11 17:51:29 fs.patch: `packages/os/scripts/lib/index/embedding-gateway.js`
- 2026-06-11 17:51:37 fs.patch: `packages/os/scripts/lib/index/embedding-gateway.js`
- 2026-06-11 17:52:11 fs.patch: `packages/os/scripts/lib/index/embedding-gateway.js`
- 2026-06-11 17:52:35 fs.patch: `packages/os/scripts/lib/index/embedding-gateway.js`
- 2026-06-11 17:52:50 fs.patch: `packages/os/scripts/lib/index/embedding-gateway.js`
- 2026-06-11 17:52:58 fs.patch: `packages/os/scripts/lib/index/embedder.js`
- 2026-06-11 17:53:44 fs.patch: `packages/os/scripts/lib/index/embedder.js`
- 2026-06-11 17:54:46 fs.patch: `packages/os/scripts/lib/index/embedder.js`
- 2026-06-11 17:55:33 fs.patch: `packages/os/scripts/lib/index/embedder.js`
- 2026-06-11 17:56:39 fs.patch: `packages/os/scripts/lib/index/embedder.js`
- 2026-06-11 17:58:02 fs.patch: `packages/os/scripts/artifact-render.ts`
- 2026-06-11 17:58:52 fs.patch: `packages/os/scripts/artifact-render.ts`
- 2026-06-11 17:59:25 fs.patch: `packages/os/scripts/artifact-render.ts`
- 2026-06-11 17:59:57 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:00:47 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:01:31 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:02:20 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:02:48 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:03:18 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:03:25 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:03:51 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:04:38 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:05:14 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:06:28 fs.patch: `packages/os/scripts/lib/install-state.ts`
- 2026-06-11 18:07:25 fs.write: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:09:03 fs.patch: `packages/os/scripts/lib/index/store.js`
- 2026-06-11 18:13:27 fs.patch: `packages/os/scripts/lib/index/embedder.js`
- 2026-06-11 18:19:00 fs.patch: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:22:17 fs.write: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:23:32 fs.patch: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:25:23 fs.patch: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:27:26 fs.write: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:30:05 fs.patch: `packages/os/scripts/artifact-render.ts`
- 2026-06-11 18:31:42 fs.patch: `packages/os/scripts/artifact-render.ts`
- 2026-06-11 18:42:17 fs.write: `.task/os/fix-current-os-review-findings/workpad.md`

## workspace-owned: files read

- `packages/os/hooks/task/workflow.js`
- `packages/os/scripts/artifact-render.ts`
- `packages/os/scripts/lib/index/embedder.js`
- `packages/os/scripts/lib/index/embedding-config.js`
- `packages/os/scripts/lib/index/embedding-gateway.js`
- `packages/os/scripts/lib/index/store.js`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/semantic-embedding-gateway.test.ts`
- `packages/os/tests/semantic-index-storage.test.ts`

## workspace-owned: validation evidence

- 2026-06-11 18:11:37 `checkFiles`: failed — COMMAND_FAILED
- 2026-06-11 18:13:27 patch lines 184-187: `packages/os/scripts/lib/index/embedder.js`
- 2026-06-11 18:13:38 `checkFiles`: passed — OK
- 2026-06-11 18:19:00 patch lines 1-16: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:22:17 write: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:23:32 patch lines 22-28: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:25:23 patch lines 20-24: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:27:26 write: `packages/os/tests/semantic-index-storage.test.ts`
- 2026-06-11 18:30:05 patch lines 382-382: `packages/os/scripts/artifact-render.ts`
- 2026-06-11 18:31:42 patch lines 378-390: `packages/os/scripts/artifact-render.ts`
- 2026-06-11 18:35:07 `checkFiles`: passed — OK
- 2026-06-11 18:38:46 `review.run`: passed — OK
- 2026-06-11 18:40:01 `verify`: passed — OK
- 2026-06-11 18:43:18 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/fix-current-os-review-findings/current.json`, `.task/os/fix-current-os-review-findings/evidence-log.json`, `.task/os/fix-current-os-review-findings/read-log.json`, `.task/os/fix-current-os-review-findings/session.json`, `.task/os/fix-current-os-review-findings/verify.json`, `.task/os/fix-current-os-review-findings/workpad.md`, `.task/tasks/os/fix-current-os-review-findings.json`, `packages/os/hooks/task/workflow.js`, `packages/os/scripts/artifact-render.ts`, `packages/os/scripts/lib/index/embedder.js`, `packages/os/scripts/lib/index/embedding-config.js`, `packages/os/scripts/lib/index/embedding-gateway.js`, `packages/os/scripts/lib/index/store.js`, `packages/os/scripts/lib/install-state.ts`, `packages/os/tests/artifact-render.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/semantic-embedding-gateway.test.ts`, `packages/os/tests/semantic-index-storage.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## findings disposition

- `hooks/task/workflow.js`: valid. `validation.review` now uses `Boolean(state.noTests)` instead of forcing `noTests: true`.
- `artifact-render.ts` map hrefs: valid. Map links are normalized to safe hash fragments before rendering and before generated browser selectors are used.
- `artifact-render.ts` CLI usage: valid. Usage now points at `packages/os/scripts/artifact-render.ts`.
- `artifact-render.ts` CLI error handling: valid. Render/validate/write flow now uses a deterministic `try/catch` with contextual stderr and non-zero exit.
- `artifact-render.ts` scroll loop: valid. The generated reader script now caches rail/top DOM lookups and writes scroll position through a throttled idle/debounced path.
- `embedder.js`: valid. Unknown providers now fail closed instead of routing to the gateway.
- `embedding-config.js`/`embedding-gateway.js`: valid. Boolean `truncate: false` is honored, and gateway model/body/header use resolved `config.apiModel`.
- `store.js`: valid. Runtime asset metadata no longer persists raw `remoteUrl`, and repo identity strips embedded HTTPS credentials before hashing/metadata.
- `install-state.ts`: valid. Security generated/override dir and generated auth/Caddyfile actions now report `exists` when present before the run.
- `semantic-index-storage.test.ts` nitpick: valid. Replaced source-string assertions with behavior tests over exported helper outputs and a stubbed registry DB call.

Skipped fixes:

- The existing full `tests/install-state.test.ts` suite still has an unrelated stale expectation: it expects `Traces`, while the current rendered sites index says `Tracing`. I did not change that because it is outside the supplied security-action finding. The new targeted security-action test passes.

## validation

- `checkFiles` passed for all changed JS/TS/test files.
- `bun --cwd packages/os test tests/semantic-embedding-gateway.test.ts tests/semantic-index-storage.test.ts tests/artifact-render.test.ts` passed: 3 files, 15 tests.
- `bun --cwd packages/os test tests/install-state.test.ts -t "reports existing generated security assets as existing on reprovision"` passed.
- `cd packages/os && bun run typecheck` passed.
- `review.run` passed with zero must-fix issues.
- `verify` passed and wrote a publish-valid stamp.

Tooling gap: I used scoped `task.call` Python restores after line-range patches corrupted files; a typed single-file restore/apply helper would reduce recovery risk.

- 2026-06-11 18:42:17 append: `.task/os/fix-current-os-review-findings/workpad.md`
