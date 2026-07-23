# unify lifecycle engine

branch: `task/os-distribution/unify-lifecycle-engine`
stream: `stream/os-distribution`
PR: https://github.com/consuelohq/opensaas/pull/1578
task session: `tsk_2858e239d32a`
started: 2026-07-23

## acceptance criteria

- [x] One typed lifecycle engine owns status, first install, restart, update, channel preferences, update-notification preferences, and repair.
- [x] Configuration, state detection, signed acquisition/verification, lock/staging, migrations, service control, activation, health, diagnostics, and presentation are separate boundaries.
- [x] Signed manifest, archive digest, runtime inventory, and release identity fail closed before activation.
- [x] Downloads stage below `$CONSUELO_HOME/runtime/staging`; stale locks recover deterministically; activation is atomic.
- [x] Update and repair preserve onboarding state, workspace/node identity, skills, secrets, databases, logs, and user-owned content.
- [x] Only release channel and update-notification preferences persist in `consuelo.yaml`.
- [x] `consuelo-reload.js`/watchdog semantics are canonical; `scripts/server.js` no longer duplicates restart process control.
- [x] Stable typed progress, diagnostics, terminal output, and JSON envelopes are implemented with secret redaction.
- [x] Deterministic tests cover fresh install, update without onboarding, check-only update, interrupted download, signature/digest/inventory rejection, stale locks, same-ID release corruption, restart parity, preferences, repair ordering, JSON, and protected state.
- [x] Required installer, server, port, distribution, config, script-parity, and install-state regression contracts pass.
- [x] PR CI completed green on the initial implementation head.
- [x] CodeRabbit was requested manually and completed with no findings because repository path filters excluded this task.
- [x] Grok structured review, inline findings, and summary are durable on GitHub; both valid findings were fixed with test-first regressions.
- [ ] Push the review fixes, post dispositions, re-check CI/reviews, merge only into `stream/os-distribution`, and finish the task session.

## implementation

- Added `packages/os/scripts/lib/lifecycle/` contracts, typed errors, state inspection, preferences, paths, stale-safe locking, signed release verification, managed staging, migrations, activation, service/health adapters, diagnostics, presentation, and orchestration.
- Added `packages/os/scripts/lifecycle.ts` commands: `status`, `install`, `restart`, `update`, `channel`, `updates notifications`, and `repair`, with `--json`, `--quiet`, `--check`, `--yes`, and channel selection.
- Kept the existing interactive installer as the first-install onboarding adapter. Update and repair never invoke onboarding.
- Replaced duplicate restart implementation in `scripts/server.js` with lifecycle/reload delegation.
- Extended strict global YAML typing only for release channel and notification preference.
- Documented command usage and release trust configuration in `SCRIPTS.md`.

## TDD and validation evidence

- Initial RED: new lifecycle suites failed because lifecycle modules did not exist (`trc_91743e6a3bab`).
- Initial GREEN: lifecycle/restart 23/23; scoped regression matrix 90 passed with 10 pre-existing todo placeholders (`trc_96c56d206ac9`).
- Grok-fix RED: corrupt same-ID release remained corrupt and repair selected `1.9.0` instead of `1.10.0` (`trc_2267c54ebb50`).
- Grok-fix GREEN: lifecycle/restart 25/25 (`trc_3e34b4101466`).
- Final scoped matrix after fixes: 92 passed, 10 pre-existing todo placeholders (`trc_3ccf49adf8c3`).
- Strict repository review after fixes: zero findings (`trc_6bc066a438bb`).
- Typed verification after fixes: publish-valid; static rules, ESLint, typecheck, package-test selection, and database guard passed (`trc_81370c3bf0d1`).
- Initial PR CI: 44 checks, zero failed or pending (`trc_202ae8f761a7`). Review-fix head CI is pending push.

## Grok review

The committed Grok template was rendered and the mandated wrapper was invoked with Grok 4.5, core bundle, read policy, task session, 900-second bound, JSON output, and workspace-only preferred.

The existing wrapper truncates provider stdout while streaming at 8,000 characters and does not preserve the discarded tail. Full-template runs completed but were rejected as incomplete. Recovery remained read-only and used bounded passes through the same wrapper:

- Pass A: completed, untruncated, schema-valid, high confidence (`trc_e3da2ccaaf4d`).
- Pass B: completed, untruncated, schema-valid, high confidence (`trc_2ea78477b785`).

Durable GitHub records:

- Structured review: https://github.com/consuelohq/opensaas/pull/1578#issuecomment-5053773779
- CR-001 inline: https://github.com/consuelohq/opensaas/pull/1578#discussion_r3635236805
- CR-002 inline: https://github.com/consuelohq/opensaas/pull/1578#discussion_r3635236886
- Top-level summary: https://github.com/consuelohq/opensaas/pull/1578#issuecomment-5053775456

Findings and fixes:

- CR-001, high correctness: an existing `releases/<bundleId>` directory was reused without re-verification. Fixed by verifying an exact match or rollback-safely replacing it with the verified staged release. Added a corrupt same-ID regression.
- CR-002, high correctness: retained releases used lexical version sorting. Fixed with SemVer ordering, including prerelease rules. Added a `1.9.0` versus `1.10.0` repair regression.

Temporary review files and local subagent logs were removed after the review became durable on GitHub.

## CodeRabbit and other review services

- Automatic CodeRabbit review skipped because the task targets a non-default stream/path-filtered files.
- Posted `@coderabbitai review`; CodeRabbit confirmed the action completed but produced no findings due the same filters.
- Codex review quota was unavailable and Qodo was paused; neither produced findings.
- Danger warned that `package.json` changed without `yarn.lock`; the change adds only a script command and no dependency, so no lockfile update is required.

## full-suite diagnostic

The broad repository test command was diagnosed but is not the assigned authoritative lane in this environment. It produced 1,574 passes and 62 unrelated baseline/environment failures across 15 files, primarily Node-side `bun:sqlite` imports, facade timeout snapshots, trace branch assumptions, and task-hook fixtures (`trc_3acdf4805471`). An unrelated generated snapshot was restored. The scoped matrix and typed verification are green.

The attempted long-running `task.call` route mapped to a missing `task:exec` script (`trc_39f1932f5ad7`); validation recovered through task-scoped `code.call` with its supported long timeout.

## failures and recovery

- Primary authenticated `os.call` repeatedly returned HTTP 502. Ko explicitly approved the typed workspace OS fallback. No native Git, unscoped shell, another computer, provider substitution, or legacy silent bypass was used.
- `packages/os/STEERING.md` is absent; root `AGENTS.md`, `CODING-STANDARDS.md`, `packages/os/SCRIPTS.md`, and OS task/senior-engineer skills were used.
- Initial discovery used the unavailable `memory` alias and failed with `NOT_FOUND` (`trc_608b82ad3219`); retried through `context`.
- A combined delete/add patch for `scripts/server.js` failed closed and was recovered with separate scoped writes.
- Initial strict review reported eight async error-boundary findings; all were fixed and review reran clean.
- First GitHub body-file post used a worktree-relative path from the repository-root GitHub facade and failed (`trc_0cbf1f96361e`); retried with the absolute task-worktree path.

## safety

No real Consuelo install, update, repair, restart, launchctl mutation, daemon mutation, or machine-global write was run on Ko's Mac Mini or MacBook Air. Lifecycle tests use temporary homes and injected release, service, and health adapters.

## remaining workflow

1. Push the two Grok fixes and refreshed verification stamp.
2. Reply to both inline findings and post a consolidated disposition with the fix commit and validation evidence.
3. Refresh the task PR, wait for final CI, and inspect all current reviews.
4. Merge PR #1578 only into `stream/os-distribution`; do not promote the stream to `main`.
5. Finish the task session.

- 2026-07-23 02:54:56 write: `.task/os-distribution/unify-lifecycle-engine/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-23 02:54:56 fs.write: `.task/os-distribution/unify-lifecycle-engine/workpad.md`

## workspace-owned: validation evidence

- 2026-07-23 02:55:01 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os-distribution/unify-lifecycle-engine/current.json`, `.task/os-distribution/unify-lifecycle-engine/evidence-log.json`, `.task/os-distribution/unify-lifecycle-engine/read-log.json`, `.task/os-distribution/unify-lifecycle-engine/session.json`, `.task/os-distribution/unify-lifecycle-engine/verify.json`, `.task/os-distribution/unify-lifecycle-engine/workpad.md`, `.task/tasks/os-distribution/unify-lifecycle-engine.json`, `packages/os/SCRIPTS.md`, `packages/os/package.json`, `packages/os/scripts/lib/consuelo-home.ts`, `packages/os/scripts/lib/lifecycle/config.ts`, `packages/os/scripts/lib/lifecycle/diagnostics.ts`, `packages/os/scripts/lib/lifecycle/engine.ts`, `packages/os/scripts/lib/lifecycle/errors.ts`, `packages/os/scripts/lib/lifecycle/index.ts`, `packages/os/scripts/lib/lifecycle/lock.ts`, `packages/os/scripts/lib/lifecycle/migrations.ts`, `packages/os/scripts/lib/lifecycle/paths.ts`, `packages/os/scripts/lib/lifecycle/presentation.ts`, `packages/os/scripts/lib/lifecycle/release.ts`, `packages/os/scripts/lib/lifecycle/service.ts`, `packages/os/scripts/lib/lifecycle/state.ts`, `packages/os/scripts/lib/lifecycle/types.ts`, `packages/os/scripts/lifecycle.ts`, `packages/os/scripts/server.js`, `packages/os/tests/audit/fixtures/script-parity-classifications.json`, `packages/os/tests/bun-product-server-contract.test.ts`, `packages/os/tests/consuelo-home-config.test.ts`, `packages/os/tests/lifecycle-engine.test.ts`, `packages/os/tests/lifecycle-restart-contract.test.ts`, `packages/os/tests/local-os-port-cutover.test.ts`, `packages/os/tests/local-os-server-hono-architecture.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none

## workspace-owned: files read

- `packages/workspace/scripts/task-push.js`
