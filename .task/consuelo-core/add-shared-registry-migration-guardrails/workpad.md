# add shared registry migration guardrails

branch: `task/consuelo-core/add-shared-registry-migration-guardrails`
stream: `stream/consuelo-core`
task session: `tsk_2e2592e0b8bf`
task pr: https://github.com/consuelohq/opensaas/pull/714
started: 2026-06-02

## Acceptance criteria

- [x] Create `packages/consuelo-core` as the shared registry package.
- [x] Add typed registry schema/validation for package, script, tool, skill, migration, source-of-truth, and exposure metadata.
- [x] Add script target audit coverage for root, workspace, and OS package scripts.
- [x] Add local import audit coverage for workspace and OS scripts.
- [x] Add ownership guardrail coverage for the recent workspace-to-OS copy break pattern.
- [x] Add registry content for `status`, `code-run`, `research:ingest`, `task.start`, `review.run`, `verify`, and OS installer/release surfaces.
- [x] Add a drift JSON report for duplicate/similar workspace and OS script helper paths.
- [x] Document the migration workflow in `packages/consuelo-core/README.md` and the command surface in `packages/workspace/SCRIPTS.md`.
- [x] Run focused tests, relevant workspace/OS tests, `review.run`, and `verify`.

## Test-first contract

Behavior under test:

- Package scripts in root, `packages/workspace`, and `packages/os` resolve their repo file targets when the command references a repo file.
- Local script imports in `packages/workspace/scripts` and `packages/os/scripts` resolve to existing files, including `./lib/...` helpers and codemode helpers.
- Workspace-owned scripts/helpers can be copied into OS, but their workspace source remains present while root/workspace callers and registry ownership still point at workspace.
- Registry files parse, validate, and include ownership entries for the named workspace, OS, tool/facade, and skill-placeholder surfaces.
- Drift reporting emits deterministic JSON with hashes and ownership hints for duplicate/similar workspace and OS script paths.

Red evidence:

- `bun --cwd packages/consuelo-core test tests/registry.test.ts` failed before implementation with `Cannot find module '../src/registry/index'` from `packages/consuelo-core/tests/registry.test.ts`.

## Git history evidence

Refs inspected through task-scoped commands:

- `origin/main` -> `16b8fb8612` (`Stream/workspace-operator (#710)`)
- `origin/stream/os` -> `7d79c8ad31` (`feat(os): add install release operator (#706)`)
- `origin/stream/workspace-agents` -> `76497dc1a0` (`task(workspace-agents): scope stream context workpads by stream on stream`)
- `origin/stream/workspace-repair` -> `57bdf02cae` (`task(workspace-repair): restore workspace research ingest script`)

Path evidence:

- Workspace script/helper history includes `b933ca9001 Stream/workspace-repair (#713)`, which restored `packages/workspace/scripts/research-ingest.js` and related workspace helper surfaces.
- OS script/helper history includes `b6233b465e Stream/os (#362)`, the current source evidence for copied OS script surfaces.

## Implementation summary

- Added private package `@consuelo/core` under `packages/consuelo-core`.
- Added Zod schemas and typed registry exports for package/script/tool/skill ownership, migration status, exposure, source-of-truth refs, and validation metadata.
- Added registry JSON for `workspace`, `os`, `consuelo-core`, key workspace scripts, OS installer/bootstrap/release surfaces, facade tools, and skill placeholders.
- Added audits for script target resolution, dangling local script imports, workspace-owned source guardrails, and workspace/OS script drift reporting.
- Added CLI commands `audit:registry` and `drift:registry` in `packages/consuelo-core/package.json`.
- Documented the migration guardrail workflow in `packages/consuelo-core/README.md` and `packages/workspace/SCRIPTS.md`.

## Files changed

- `.task/consuelo-core/add-shared-registry-migration-guardrails/*`
- `.task/tasks/consuelo-core/add-shared-registry-migration-guardrails.json`
- `packages/consuelo-core/package.json`
- `packages/consuelo-core/README.md`
- `packages/consuelo-core/registry/packages.json`
- `packages/consuelo-core/registry/scripts.json`
- `packages/consuelo-core/registry/skills.json`
- `packages/consuelo-core/registry/tools.json`
- `packages/consuelo-core/scripts/audit-registry.ts`
- `packages/consuelo-core/src/registry/index.ts`
- `packages/consuelo-core/src/registry/types.ts`
- `packages/consuelo-core/tests/registry.test.ts`
- `packages/consuelo-core/tsconfig.json`
- `packages/workspace/SCRIPTS.md`

## Validation evidence

Focused guardrails:

- PASS `bun --cwd packages/consuelo-core typecheck`
- PASS `bun --cwd packages/consuelo-core test tests/registry.test.ts` (5 tests)
- PASS `bun --cwd packages/consuelo-core audit:registry`
- PASS `bun --cwd packages/consuelo-core drift:registry`

Relevant existing tests:

- PASS `bun --cwd packages/workspace test tests/pr-links.test.js tests/research-ingest.test.js tests/codemode.test.ts` (13 tests)
- PASS `bun --cwd packages/os test tests/install-state.test.ts tests/skills-registry.test.ts` (11 tests)

Task gates:

- PASS `review.run` with `base=origin/main`, `mine=true`, `noTests=true`; no issues in this change. It reported one pre-existing project warning: no Nx projects with a `typecheck` target found.
- PASS `verify` with `base=origin/main`; publish-valid stamp written and selected workspace audit test passed.

## Remaining migration risks

- The drift report is informational in this first version; it surfaces many existing duplicate workspace/OS script paths but does not fail on duplication by itself.
- `packages/consuelo-core` is not wired as a runtime dependency of workspace or OS yet; this task intentionally creates the source-of-truth package and audits without moving runtime code.
- Skill entries are placeholders only. Actual skill migration and runtime ownership changes remain future work.

## Publish plan

After this workpad update, push the task branch and promote it to the `stream/consuelo-core` review PR. Stop at review PR; do not merge to `main`.

- 2026-06-03 00:14:43 write: `.task/consuelo-core/add-shared-registry-migration-guardrails/workpad.md`

## workspace-owned: files changed

- `.task/consuelo-core/add-shared-registry-migration-guardrails/*`
- `.task/tasks/consuelo-core/add-shared-registry-migration-guardrails.json`
- `packages/consuelo-core/package.json`
- `packages/consuelo-core/README.md`
- `packages/consuelo-core/registry/packages.json`
- `packages/consuelo-core/registry/scripts.json`
- `packages/consuelo-core/registry/skills.json`
- `packages/consuelo-core/registry/tools.json`
- `packages/consuelo-core/scripts/audit-registry.ts`
- `packages/consuelo-core/src/registry/index.ts`
- `packages/consuelo-core/src/registry/types.ts`
- `packages/consuelo-core/tests/registry.test.ts`
- `packages/consuelo-core/tsconfig.json`
- `packages/workspace/SCRIPTS.md`

## workspace-owned: activity log

- 2026-06-03 00:14:43 fs.write: `.task/consuelo-core/add-shared-registry-migration-guardrails/workpad.md`

## workspace-owned: validation evidence

Focused guardrails:
- PASS `bun --cwd packages/consuelo-core typecheck`
- PASS `bun --cwd packages/consuelo-core test tests/registry.test.ts` (5 tests)
- PASS `bun --cwd packages/consuelo-core audit:registry`
- PASS `bun --cwd packages/consuelo-core drift:registry`
Relevant existing tests:
- PASS `bun --cwd packages/workspace test tests/pr-links.test.js tests/research-ingest.test.js tests/codemode.test.ts` (13 tests)
- PASS `bun --cwd packages/os test tests/install-state.test.ts tests/skills-registry.test.ts` (11 tests)
Task gates:
- PASS `review.run` with `base=origin/main`, `mine=true`, `noTests=true`; no issues in this change. It reported one pre-existing project warning: no Nx projects with a `typecheck` target found.
- PASS `verify` with `base=origin/main`; publish-valid stamp written and selected workspace audit test passed.
- 2026-06-03 00:14:52 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/consuelo-core/add-shared-registry-migration-guardrails/current.json`, `.task/consuelo-core/add-shared-registry-migration-guardrails/evidence-log.json`, `.task/consuelo-core/add-shared-registry-migration-guardrails/read-log.json`, `.task/consuelo-core/add-shared-registry-migration-guardrails/session.json`, `.task/consuelo-core/add-shared-registry-migration-guardrails/verify.json`, `.task/consuelo-core/add-shared-registry-migration-guardrails/workpad.md`, `.task/tasks/consuelo-core/add-shared-registry-migration-guardrails.json`, `packages/consuelo-core/README.md`, `packages/consuelo-core/package.json`, `packages/consuelo-core/registry/packages.json`, `packages/consuelo-core/registry/scripts.json`, `packages/consuelo-core/registry/skills.json`, `packages/consuelo-core/registry/tools.json`, `packages/consuelo-core/scripts/audit-registry.ts`, `packages/consuelo-core/src/registry/index.ts`, `packages/consuelo-core/src/registry/types.ts`, `packages/consuelo-core/tests/registry.test.ts`, `packages/consuelo-core/tsconfig.json`, `packages/workspace/SCRIPTS.md`
- matched rules: `workspace-audit-docs`
- selected suites: `workspace audit tests`
- run results: `workspace audit tests` passed
- failed suites: none
