# unify lifecycle engine

branch: `task/os-distribution/unify-lifecycle-engine`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1578/unify-lifecycle-engine
github pr: https://github.com/consuelohq/opensaas/pull/1578
started: 2026-07-23
task session: `tsk_2858e239d32a`

## acceptance criteria

- [x] Add one typed lifecycle engine under `packages/os/scripts/lib/lifecycle/` for status, first install, restart, update, channel preferences, update-notification preferences, and repair.
- [x] Separate configuration, install-state detection, acquisition/verification, lock/staging, migrations, service control, activation, health, diagnostics, and presentation boundaries.
- [x] Use the signed runtime-bundle contract and fail closed on manifest signature, archive digest, or runtime inventory mismatch.
- [x] Stage downloads under the Consuelo home, recover stale locks deterministically, and activate only a fully verified release.
- [x] Preserve existing onboarding, workspace/node identity, selected skills, secrets, databases, logs, and user-owned content during update and repair.
- [x] Persist only channel and update-notification preferences in `consuelo.yaml`; keep runtime state and secrets out of YAML.
- [x] Adopt the proven `consuelo-reload.js`/watchdog service semantics behind one adapter; retire `scripts/server.js` restart orchestration after parity characterization.
- [x] Emit stable typed progress/diagnostic events with redaction-safe details for CLI, native shell, tests, and future diagnostics.
- [x] Cover fresh install, update without onboarding, interrupted download, digest/signature/inventory rejection, stale-lock recovery, restart parity, preferences, repair, JSON output, and protected-state preservation with deterministic tests.
- [x] Preserve existing installer, server, port, distribution, config, script-parity, and install-state regression contracts in the assigned validation lane.
- [ ] Complete PR CI, CodeRabbit, Grok review/dispositions, and merge only into `stream/os-distribution`.

## implementation summary

- Added typed lifecycle contracts, errors, state inspection, preferences, path containment, exclusive stale-safe locks, release acquisition and Ed25519 verification, staged runtime extraction, atomic activation, migration seam, service adapter, bounded health acceptance, redacted diagnostics, progress events, and presentation envelopes.
- Added `scripts/lifecycle.ts` with `status`, `install`, `restart`, `update`, `channel`, `updates notifications`, and `repair`, including `--json`, `--quiet`, `--check`, `--yes`, and channel selection.
- Kept the existing interactive installer as first-install onboarding; update and repair never invoke onboarding.
- Replaced duplicate process management in `scripts/server.js` with delegation to the lifecycle command and canonical `consuelo-reload.js` adapter.
- Extended strict `consuelo.yaml` typing only for release channel and update-notification preferences.
- Documented release trust and command usage in `SCRIPTS.md`.

## test-first evidence

- RED: `tests/lifecycle-engine.test.ts` and `tests/lifecycle-restart-contract.test.ts` failed because the lifecycle modules did not exist (`trc_91743e6a3bab`).
- GREEN focused lifecycle: 23/23 tests passed after implementation.
- GREEN authoritative regression matrix: 90 passed, 10 pre-existing todo placeholders (`trc_96c56d206ac9`). Covered lifecycle, restart parity, installer state, port cutover, Bun server contract, Hono architecture, native lifecycle client, distribution fixture harness, YAML config, and script parity.
- `bun run typecheck`: passed.
- Strict workspace review: zero findings after fixing eight explicit async error-boundary findings (`trc_450c841b8c35`).

## full-suite diagnostic

The repository-wide `packages/os` test command is not a valid green lane in this environment independent of this task. It produced 1,574 passes and 62 unrelated failures across 15 files, primarily unavailable `bun:sqlite` imports under Vitest's Node runtime, facade timeout snapshot drift, trace branch assumptions, and task-hook fixtures (`trc_3acdf4805471`). The run also rewrote an unrelated facade snapshot; that mutation was restored from clean local `main` and is not part of this task.

The attempted long-running `task.call` route failed because the current fallback facade maps it to a missing `task:exec` script (`trc_39f1932f5ad7`). Validation was recovered through scoped `code.call` with its supported long timeout.

## files changed

- `packages/os/package.json`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/lifecycle/`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/server.js`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/bun-product-server-contract.test.ts`
- `packages/os/tests/consuelo-home-config.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`
- `packages/os/tests/local-os-port-cutover.test.ts`
- `packages/os/tests/local-os-server-hono-architecture.test.ts`

## key decisions

- Reuse the existing runtime-bundle archive/inventory contract rather than introducing a second bundle format.
- Treat `consuelo-reload.js` and watchdog semantics as canonical; other restart surfaces delegate instead of duplicating process control.
- Keep first-install onboarding outside repeat lifecycle operations.
- Verify signed release identity, archive digest, and internal inventory before activation; keep the current release untouched on acquisition, verification, or staging failure.
- Persist runtime state in managed filesystem paths and diagnostics logs, never in `consuelo.yaml`.

## issues and recovery

- Primary authenticated `os.call` returned repeated HTTP 502 responses. After Ko explicitly approved the workspace fallback, work resumed through the typed workspace OS facade without native git, unscoped shell, another computer, or provider substitution.
- `packages/os/STEERING.md` is absent; root `AGENTS.md`, `CODING-STANDARDS.md`, `packages/os/SCRIPTS.md`, and OS task/senior-engineer skills were used.
- Initial discovery attempted unavailable `memory` and failed with `NOT_FOUND` (`trc_608b82ad3219`); retried through supported `context`.
- A combined patch attempted delete-and-add of `scripts/server.js` in one transaction and failed closed; it was recovered with separate anchored edits and a whole-file scoped write.
- Initial review reported eight structural async error-handling findings; all were fixed and strict review reran clean.

## safety

No real Consuelo installation, update, repair, restart, launchctl mutation, or machine-global write was run on Ko's Mac Mini or MacBook Air. All lifecycle behavior used temp homes and injected fetch/service/health adapters.

## remaining workflow

1. Push the independently reviewable task commit and refresh PR #1578 against `stream/os-distribution`.
2. Wait for CI and request CodeRabbit; collect and dispose every finding.
3. Render and run the committed Grok review template, post structured review/inline findings/summary, fix valid findings, and remove the temporary prompt directory.
4. Merge PR #1578 into `stream/os-distribution`, not `main`, then finish the task session.

- 2026-07-23 02:11:40 write: `.task/os-distribution/unify-lifecycle-engine/workpad.md`

## workspace-owned: files changed

- `packages/os/package.json`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/lifecycle/`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/server.js`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/bun-product-server-contract.test.ts`
- `packages/os/tests/consuelo-home-config.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/lifecycle-restart-contract.test.ts`
- `packages/os/tests/local-os-port-cutover.test.ts`
- `packages/os/tests/local-os-server-hono-architecture.test.ts`

## workspace-owned: activity log

- 2026-07-23 02:11:40 fs.write: `.task/os-distribution/unify-lifecycle-engine/workpad.md`

## workspace-owned: validation evidence

- 2026-07-23 02:12:11 `review.run`: passed — OK
- 2026-07-23 02:12:29 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os-distribution/unify-lifecycle-engine/current.json`, `.task/os-distribution/unify-lifecycle-engine/evidence-log.json`, `.task/os-distribution/unify-lifecycle-engine/read-log.json`, `.task/os-distribution/unify-lifecycle-engine/session.json`, `.task/os-distribution/unify-lifecycle-engine/workpad.md`, `.task/tasks/os-distribution/unify-lifecycle-engine.json`, `packages/os/SCRIPTS.md`, `packages/os/package.json`, `packages/os/scripts/lib/consuelo-home.ts`, `packages/os/scripts/lib/lifecycle/config.ts`, `packages/os/scripts/lib/lifecycle/diagnostics.ts`, `packages/os/scripts/lib/lifecycle/engine.ts`, `packages/os/scripts/lib/lifecycle/errors.ts`, `packages/os/scripts/lib/lifecycle/index.ts`, `packages/os/scripts/lib/lifecycle/lock.ts`, `packages/os/scripts/lib/lifecycle/migrations.ts`, `packages/os/scripts/lib/lifecycle/paths.ts`, `packages/os/scripts/lib/lifecycle/presentation.ts`, `packages/os/scripts/lib/lifecycle/release.ts`, `packages/os/scripts/lib/lifecycle/service.ts`, `packages/os/scripts/lib/lifecycle/state.ts`, `packages/os/scripts/lib/lifecycle/types.ts`, `packages/os/scripts/lifecycle.ts`, `packages/os/scripts/server.js`, `packages/os/tests/audit/fixtures/script-parity-classifications.json`, `packages/os/tests/bun-product-server-contract.test.ts`, `packages/os/tests/consuelo-home-config.test.ts`, `packages/os/tests/lifecycle-engine.test.ts`, `packages/os/tests/lifecycle-restart-contract.test.ts`, `packages/os/tests/local-os-port-cutover.test.ts`, `packages/os/tests/local-os-server-hono-architecture.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
