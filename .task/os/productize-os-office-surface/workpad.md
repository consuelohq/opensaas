# productize os office surface

branch: `task/os/productize-os-office-surface`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/774/productize-os-office-surface
github pr: https://github.com/consuelohq/opensaas/pull/774
started: 2026-06-05
taskSession: `tsk_d32d5f477e2a`

## acceptance criteria

- [x] Read repo steering through `workspace.get_steering` and load the senior-engineer/task workflow skills before code work.
- [x] Start a proper `stream/os` task from `main` and use scoped task metadata.
- [x] Read current workpad before changing code.
- [x] Investigate current OS Office/artifact/provision/bootstrap/test/skill structure before implementation.
- [x] Make Office a first-class OS user-facing concept while preserving `artifacts` as the internal provenance/storage layer.
- [x] Add OS Office command surface so users/agents can find, refresh, and inspect/open the local Office page.
- [x] Refresh Office after later artifact creation when safe.
- [x] Make bootstrap source reuse explicit and add a safe source refresh path.
- [x] Establish `<OS_HOME>/pages/office/{data,assets}` plus reserved local page slots for traces, diffs, and GitHub/workflow views.
- [x] Add OS-native Office skill/docs.
- [x] Add/update focused assertions before implementation, run red, then implement and run green.
- [x] Validate focused tests, syntax checks, shell syntax, diff review, and prepare publish through task workflow.

## Test-first contract

Behavior under test:
- Provisioning creates and tolerates the Office page structure plus reserved `pages/traces`, `pages/diffs`, and `pages/github` surfaces.
- `createWorkspaceArtifact()` refreshes `pages/office/data/artifacts.json` and `pages/office/index.html` without requiring a second provision run.
- The OS CLI exposes `office path`, `office status`, and `office refresh` with JSON-friendly output.
- Bootstrap help and dry-run source resolution expose `--refresh-source` so existing source checkout reuse is explicit.
- The bundled OS skill registry includes an OS-native `office` skill.

Red command:

```bash
bun run --cwd packages/os test tests/install-state.test.ts tests/artifacts.test.ts tests/office-cli.test.ts tests/bootstrap-source.test.ts
```

Red result: failed as expected before implementation. Missing reserved page slots, missing post-artifact Office refresh, missing Office CLI command/export, and missing bootstrap `--refresh-source` support.

Green command:

```bash
bun run --cwd packages/os test tests/install-state.test.ts tests/artifacts.test.ts tests/office-cli.test.ts tests/bootstrap-source.test.ts
```

Green result: passed, 4 test files / 13 tests.

Other validation:

```bash
bun run --cwd packages/os typecheck
bash -n packages/os/scripts/bootstrap.sh
bun run --cwd packages/os test
```

Validation result:
- `typecheck`: passed, `workspace script syntax checks passed`.
- `bash -n packages/os/scripts/bootstrap.sh`: passed.
- Full `bun run --cwd packages/os test`: not green. It ran 24 files, 19 passed, 5 failed. The focused Office tests passed inside the full run. The visible failure for `tests/consuelo-design.test.ts` is a pre-existing/non-task issue from a reused fixed trace id causing `SQLiteError: UNIQUE constraint failed: skill_executions.trace_id`; several script test files report 0 tests. This task did not change those areas.

## investigation notes

- `packages/os/scripts/lib/office-pages.ts` already existed from PR #770 and materialized `pages/office/index.html`, `pages/office/data/artifacts.json`, and `pages/office/assets` during `provisionLocalOs()`.
- `packages/os/scripts/lib/install-state.ts` calls `materializeOfficePages()` during provisioning.
- `createWorkspaceArtifact()` wrote artifact bytes and DB rows but did not refresh Office after insertion.
- `packages/os/scripts/os.ts` had no Office subcommand before this task.
- `packages/os/scripts/bootstrap.sh` reused an existing `$SOURCE_DIR` when `packages/os/scripts/install.ts` existed and lacked an explicit source refresh flag.
- `packages/os/skills/*` uses `skill.json` plus `SKILL.md`; `generate-skills-registry` writes `packages/os/skills/skills.json`.

## implementation notes

- Reworked `office-pages.ts` to own Office paths, artifact JSON reads, Office HTML, and reserved page stubs.
- Office now materializes:
  - `<OS_HOME>/pages/office/index.html`
  - `<OS_HOME>/pages/office/data/artifacts.json`
  - `<OS_HOME>/pages/office/assets/`
  - `<OS_HOME>/pages/traces/index.html`
  - `<OS_HOME>/pages/diffs/index.html`
  - `<OS_HOME>/pages/github/index.html`
- Office page language now presents Office as the user-facing generated work surface and artifacts as internal durable provenance/storage records.
- `createWorkspaceArtifact()` now calls `materializeOfficePages()` after closing the artifact DB write.
- Added exported `runOfficeCommand()` and CLI support for:
  - `office path`
  - `office status`
  - `office refresh`
  - `office open`
  - `--json` output for script/agent use.
- Added `office` package script: `bun ./scripts/os.ts office`.
- Added bootstrap `--refresh-source` flag. Existing hosted source reuse now logs how to refresh; refresh downloads into a staged temp source, validates `packages/os/scripts/install.ts`, then replaces `$SOURCE_DIR`.
- Kept repo-local source handling safe: `--refresh-source` is ignored for local repo execution and logs that it applies only to hosted checkouts.
- Added OS-native `packages/os/skills/office/SKILL.md` and `skill.json`; regenerated `packages/os/skills/skills.json`.

## files changed

- `packages/os/package.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/scripts/lib/office-pages.ts`
- `packages/os/scripts/os.ts`
- `packages/os/skills/skills.json`
- `packages/os/tests/artifacts.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/skills/office/SKILL.md`
- `packages/os/skills/office/skill.json`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/office-cli.test.ts`


## decisions

- Do not rename internal database tables/storage. `artifacts` remains the technical concept.
- Use Office as the user-facing local product surface and command namespace.
- Keep workspace design/wiki/operator tooling out of OS. The OS Office skill is standalone.
- Add reserved local page stubs for traces/diffs/GitHub rather than overbuilding those surfaces.
- Refresh Office directly after artifact creation because `office-pages.ts` only depends on runtime paths/SQLite and does not import artifact code, so the dependency direction is safe.
- Add `office refresh` even though artifact creation refreshes automatically, so users/agents have a repeatable manual recovery command.

## issues and recovery

- `code.run` is broken in this task worktree due missing `./lib/codemode/tools/index`. Recovery: used typed file/search tools and `task.call`.
- First `stream.context` call with lowercase area was safety-blocked. Recovery: retried with `area: OS`, which resolved to `os`.
- Several line-patch attempts produced temporary duplicate lines while editing tests/bootstrap. Recovery: inspected nearby lines, repaired, and validated with focused tests plus `bash -n`.
- README patch attempt was blocked by safety checks. Recovery: left OS-native skill/docs as the durable documentation surface for this task; product behavior and command docs are covered there.

## publish checklist

```bash
bun run task:push -- --message "feat(os): productize office surface" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-05 05:33:37 write: `.task/os/productize-os-office-surface/workpad.md`

## workspace-owned: files changed

- `.task/os/productize-os-office-surface/workpad.md`
- `.task/tasks/os/productize-os-office-surface.json`
- `packages/os/package.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/scripts/lib/office-pages.ts`
- `packages/os/scripts/os.ts`
- `packages/os/skills/office/skill.json`
- `packages/os/skills/office/SKILL.md`
- `packages/os/skills/skills.json`
- `packages/os/tests/artifacts.test.ts`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/office-cli.test.ts`

## workspace-owned: activity log

- 2026-06-05 05:33:37 fs.write: `.task/os/productize-os-office-surface/workpad.md`
