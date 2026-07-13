# refactor-os-office-surface-into-sites

branch: `task/os/refactor-os-office-surface-into-sites`
stream: `stream/os`
task session: `tsk_ea253c2e57db`
source: `stream/os`
started: 2026-06-09

## acceptance criteria

- [x] Fresh provision creates `OS_HOME/sites/index.html`.
- [x] Fresh provision creates `OS_HOME/sites/office/index.html` and `OS_HOME/sites/office/data/artifacts.json`.
- [x] Fresh provision creates reserved `OS_HOME/sites/traces/index.html` and `OS_HOME/sites/diffs/index.html`.
- [x] Fresh provision does not create `OS_HOME/sites/github/index.html`.
- [x] Fresh provision does not use `OS_HOME/pages/office` as the canonical layout.
- [x] Artifact creation refreshes the Office site category under `sites/office`.
- [x] Canonical CLI command is `sites path|status|refresh|open`, with `--json` support.
- [x] Bundled OS skill is `sites`, with Office described as a site/category under Sites.
- [x] Existing OS tool/skill materialization behavior remains intact.
- [x] No hosted/public URL security work is introduced.

## implementation summary

- Added `packages/os/scripts/lib/sites.ts` as the canonical local Sites materializer.
- Replaced the old Office page implementation with an `office-pages.ts` compatibility shim that delegates to Sites.
- Updated install provisioning and artifact creation to refresh `sites/office` via `materializeSites`.
- Added the canonical `sites path|status|refresh|open` CLI and kept `office` as a deprecated compatibility alias.
- Replaced bundled `office` skill metadata with bundled `sites` skill metadata and regenerated `skills/skills.json`.
- Renamed CLI coverage from Office to Sites and updated install/artifact/registry tests for the new layout.

## files changed

- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/office-pages.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/os.ts`
- `packages/os/skills/office/*`
- `packages/os/skills/sites/SKILL.md`
- `packages/os/skills/skills.json`
- `packages/os/tests/artifacts.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/sites-cli.test.ts`
- `packages/os/tests/skills-registry.test.ts`

## validation

Focused red:

- `bun --cwd packages/os test tests/sites-cli.test.ts` failed before implementation with `TypeError: runSitesCommand is not a function`.

Focused green:

- `bun --cwd packages/os test tests/sites-cli.test.ts` — pass.
- `bun --cwd packages/os test tests/install-state.test.ts` — pass, 10 tests.
- `bun --cwd packages/os test tests/artifacts.test.ts` — pass.
- `bun --cwd packages/os test tests/skills-registry.test.ts` — pass, 8 tests.
- Fresh install + direct CLI smoke — pass (`sites smoke ok`).
- `node packages/os/scripts/check-syntax.js` — pass.
- `git diff --check` — pass.

Broader suite note:

- `bun --cwd packages/os test` still reports existing zero-test-file failures from unrelated harness files (`doctor-redaction`, `install-tty`, `compact-daemon-output`, `onboarding-flow`, `docs-agent-tdd`). In that same run, the actual test cases reported 620 passing tests, including the new Sites coverage.

## cleanup / search checks

- `office path` and `office status` references removed from OS docs/code search results.
- No `pages/github` references remain.
- `pages/office` appears only as a guardrail in the new Sites skill.
- `sites/github` appears only as a guardrail in the new Sites skill.
- `runOfficeCommand` remains only as the deprecated CLI compatibility alias.

## notes / blockers

- `code.run` is currently unusable in this worktree because it fails resolving `./lib/codemode/tools/index`; all changes were made with task-scoped `fs.*` and `task.exec` instead.

- 2026-06-09 03:28:27 write: `.task/os/refactor-os-office-surface-into-sites/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/office-pages.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/os.ts`
- `packages/os/skills/office/*`
- `packages/os/skills/sites/SKILL.md`
- `packages/os/skills/skills.json`
- `packages/os/tests/artifacts.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/sites-cli.test.ts`
- `packages/os/tests/skills-registry.test.ts`

## workspace-owned: activity log

- 2026-06-09 03:28:27 fs.write: `.task/os/refactor-os-office-surface-into-sites/workpad.md`

## workspace-owned: TDD post evidence

- 2026-06-09 03:29:24 `bun run verify`: passed exit 0 trace: `trc_8730e3042d82`
  - output: → tmux: opensaas-os-refactor-os-office-surface-into-sites-ea253c2e
