# sync os dev tooling substrate

branch: `task/os/sync-os-dev-tooling-substrate`
stream: `stream/os`
taskSession: `tsk_bc6d01770803`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/658/sync-os-dev-tooling-substrate
github pr: https://github.com/consuelohq/opensaas/pull/658
started: 2026-05-31
## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.
- [ ] OS dev manifest matches current `origin/main:packages/workspace/tooling/tool-manifest.json` except intentional OS-specific differences.
- [ ] OS product manifest `packages/os/tooling/tool-manifest.json` is preserved.
- [ ] OS package scripts expose current workspace dev commands plus existing OS product commands.
- [ ] OS facade schemas/executor/types route newly added dev tools.
- [ ] OS generated docs/types are regenerated with OS scripts.
- [ ] Focused OS product and facade validations pass or have exact documented failures.
- [ ] Representative newly synced tools smoke through the OS facade/CLI.
- [ ] Work is pushed into existing `stream/os` flow.

## test-first contract

Behavior under test: OS developer facade exposes the current workspace dev substrate while preserving OS product tools and package commands.

Existing pattern to follow: `packages/workspace` dev tooling on `origin/main`, overlaid into `packages/os` with OS-local paths and `@consuelo/os` package identity preserved.

Focused red command:

```bash
node -e "const fs=require('fs'); const required=['code.run','github','git.diff','git.status','task.call','mac.call','context.trace','worker.call','research.ingest','browser.wait','browser.download','design.publish','design.refresh']; const manifest=JSON.parse(fs.readFileSync('packages/os/tooling/dev-tool-manifest.json','utf8')); const names=new Set(manifest.map(t=>t.name)); const missing=required.filter(name=>!names.has(name)); if(missing.length){ console.error('missing required OS dev tools: '+missing.join(', ')); process.exit(1); } console.log('all required tools present');"
```

Expected red failure: OS dev manifest reports missing required tools: `code.run`, `github`, `git.diff`, `git.status`, `task.call`, `mac.call`, `context.trace`, `worker.call`, `research.ingest`, `browser.wait`, `browser.download`, `design.publish`, `design.refresh`.

Red evidence: 2026-05-31 `task.exec` trace `trc_b022b6be964e` failed exactly as expected.

Intended tests:

```bash
bun --cwd packages/os run get-dev-steering
bun --cwd packages/os run get-steering
bun --cwd packages/os run generate:types
bun --cwd packages/os run generate:docs
bun --cwd packages/os test tests/facade/facade.test.ts
bun --cwd packages/os test tests/skills-registry.test.ts
bun --cwd packages/os test tests/doctor-logs.test.ts tests/doctor-redaction.test.ts
```

Additional smoke coverage: verify representative dev tools in `packages/os/tooling/dev-tool-manifest.json` and invoke feasible read-only/dry-run tools through the OS facade.

## plan

Current source of truth discovered during inspection:

- `origin/main:packages/workspace/tooling/tool-manifest.json` has 128 tools and includes current dev tools.
- `origin/stream/os:packages/workspace/tooling/tool-manifest.json` and this task worktree currently have 107 tools.
- `packages/os/tooling/dev-tool-manifest.json` has 107 tools and is missing 22 tools from current workspace.
- `packages/os/tooling/tool-manifest.json` has 4 OS product tools and must be preserved.

Sync classification:

```text
copy exact
- packages/workspace/scripts/code-run.ts -> packages/os/scripts/code-run.ts
- packages/workspace/scripts/github.js -> packages/os/scripts/github.js
- packages/workspace/scripts/git-diff.js -> packages/os/scripts/git-diff.js
- packages/workspace/scripts/research-ingest.js -> packages/os/scripts/research-ingest.js
- packages/workspace/scripts/worker.ts -> packages/os/scripts/worker.ts
- packages/workspace/scripts/consuelo-reload.js -> packages/os/scripts/consuelo-reload.js
- packages/workspace/scripts/lib/pr-links.js -> packages/os/scripts/lib/pr-links.js
- packages/workspace/scripts/lib/review-run-state.js -> packages/os/scripts/lib/review-run-state.js
- packages/workspace/scripts/lib/task-workpad.js -> packages/os/scripts/lib/task-workpad.js
- packages/workspace/scripts/test-selection.js -> packages/os/scripts/test-selection.js

copy with OS path/name rewrite
- packages/workspace/tooling/tool-manifest.json -> packages/os/tooling/dev-tool-manifest.json, preserving OS-safe command scripts and any intentional OS-local script names
- packages/workspace/src/generated/workspace.d.ts -> packages/os/src/generated/workspace.d.ts, then regenerate with OS scripts
- package scripts from packages/workspace/package.json -> packages/os/package.json while preserving `@consuelo/os` identity and OS product scripts

manual merge
- packages/os/scripts/lib/facade/executor.ts
- packages/os/scripts/lib/facade/schemas.ts
- packages/os/scripts/lib/facade/client.ts
- packages/os/scripts/lib/facade/types.ts
- packages/os/scripts/generate-docs.ts
- packages/os/scripts/generate-types.ts
- packages/os/TOOLS.md
- packages/os/SCRIPTS.md

preserve OS
- packages/os/scripts/os.ts
- packages/os/scripts/install.ts
- packages/os/scripts/doctor*.ts
- packages/os/scripts/server.ts and server smoke surfaces
- packages/os/scripts/generate-skills-registry.ts
- packages/os/scripts/lib/app-files-client.ts and product runtime/client libs
- packages/os/scripts/revenue/**
- packages/os/scripts/workspace/**
- packages/os/skills/**
- packages/os/tooling/tool-manifest.json
- packages/os/docs/**
- packages/os/README.md
- packages/os/STEERING.md
- packages/os/dev-steering.md

skip
- Blind package clone from `packages/workspace` to `packages/os`
- Public Stream OS spec/wiki updates unless a real roadmap decision appears
- Any change to `packages/twenty-server/patches/@graphql-yoga+nestjs+2.1.0.patch`
```

## current status

- Read steering, worker instructions, and `CODING-STANDARDS.md`.
- Identified source drift: task worktree workspace package is stale relative to `origin/main` workspace dev substrate.
- Red manifest check failed as expected.

## files changed

- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/tests/facade/facade.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/tests/facade/facade.test.ts`

## workspace-owned: activity log

- 2026-05-31 09:45:50 fs.write: `.task/os/sync-os-dev-tooling-substrate/worker-instructions.md`
- 2026-05-31 09:45:57 fs.write: `.task/os/sync-os-dev-tooling-substrate/worker-wrapper.md`
- 2026-05-31 09:51:58 fs.patch: `.task/os/sync-os-dev-tooling-substrate/workpad.md`
- 2026-05-31 09:52:50 fs.patch: `packages/os/scripts/lib/facade/executor.ts`
- 2026-05-31 11:29:45 fs.trash: `.task/worker-runs/trc_15d542cfeed0-cdx/summary.json`
- 2026-05-31 11:29:46 fs.trash: `.task/worker-runs/trc_2793498f2ea2-cdx/summary.json`
- 2026-05-31 11:29:46 fs.trash: `.task/worker-runs/trc_47b243babd26-cdx/summary.json`
- 2026-05-31 11:29:46 fs.trash: `.task/worker-runs/trc_51d89b6916c3-cdx/summary.json`
- 2026-05-31 11:29:46 fs.trash: `.task/os/sync-os-dev-tooling-substrate/worker-instructions.md`
- 2026-05-31 11:29:46 fs.trash: `.task/os/sync-os-dev-tooling-substrate/worker-wrapper.md`
- 2026-05-31 11:32:13 fs.patch: `packages/os/tests/facade/facade.test.ts`
- 2026-05-31 11:32:24 fs.patch: `packages/os/tests/facade/facade.test.ts`
- 2026-05-31 11:32:44 fs.write: `.task/os/sync-os-dev-tooling-substrate/blank.txt`
- 2026-05-31 11:32:49 fs.patch: `packages/os/tests/facade/facade.test.ts`
- 2026-05-31 11:33:06 fs.patch: `packages/os/tests/facade/facade.test.ts`
- 2026-05-31 11:34:11 fs.write: `.task/os/sync-os-dev-tooling-substrate/branch-test-block.txt`
- 2026-05-31 11:34:30 fs.patch: `packages/os/tests/facade/facade.test.ts`
- 2026-05-31 11:34:56 fs.write: `.task/os/sync-os-dev-tooling-substrate/branch-test-and-next-start.txt`
- 2026-05-31 11:35:03 fs.patch: `packages/os/tests/facade/facade.test.ts`
- 2026-05-31 11:35:17 fs.patch: `packages/os/tests/facade/facade.test.ts`
- 2026-05-31 11:35:29 fs.write: `.task/os/sync-os-dev-tooling-substrate/ambiguous-and-notfound-block.txt`
- 2026-05-31 11:35:39 fs.patch: `packages/os/tests/facade/facade.test.ts`
- 2026-05-31 11:36:03 fs.patch: `packages/os/tests/facade/facade.test.ts`
- 2026-05-31 11:36:41 fs.patch: `packages/os/tests/facade/facade.test.ts`
- 2026-05-31 11:37:07 fs.trash: `.task/os/sync-os-dev-tooling-substrate/blank.txt`
- 2026-05-31 11:37:07 fs.trash: `.task/os/sync-os-dev-tooling-substrate/branch-test-block.txt`
- 2026-05-31 11:37:07 fs.trash: `.task/os/sync-os-dev-tooling-substrate/branch-test-and-next-start.txt`
- 2026-05-31 11:37:07 fs.trash: `.task/os/sync-os-dev-tooling-substrate/ambiguous-and-notfound-block.txt`

## workspace-owned: validation evidence

- 2026-05-31 red check: `task.exec` trace `trc_b022b6be964e` failed with missing required OS dev tools.
- 2026-05-31 11:30:07 `review.run`: passed — OK
- 2026-05-31 11:30:14 `verify`: failed — COMMAND_FAILED
- 2026-05-31 11:37:20 `review.run`: passed — OK

## key decisions

- Use `origin/main:packages/workspace` as the current workspace substrate because local `origin/main` has 128 tools and includes the required current dev tools; this task branch and `origin/stream/os` have the stale 107-tool workspace package.
- Preserve `packages/os/tooling/tool-manifest.json` as the OS product manifest.

## notes for ko

- none yet

## improvements noticed

- `code.run` currently routes through missing `code-run`, so this task temporarily cannot use `code.run` as the typed composer until the sync lands.

## issues and recovery

- `code.run` failed with `Script not found "code-run"`; recovered by using direct typed `fs.*` calls and `task.exec` for focused repo commands through the workspace facade.

---

## publish checklist

```bash
bun run task:push -- --message "feat(os): sync workspace dev tooling substrate" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.task/os/sync-os-dev-tooling-substrate/worker-instructions.md`
- `.task/os/sync-os-dev-tooling-substrate/workpad.md`
- `CODING-STANDARDS.md`
- `packages/os/SCRIPTS.md`
- `packages/os/TOOLS.md`
- `packages/os/package.json`
- `packages/os/scripts/generate-docs.ts`
- `packages/os/scripts/generate-types.ts`
- `packages/os/scripts/lib/facade/branch-resolver.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/worker/runtime.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/test-selection.js`
- `packages/os/scripts/tools-search.ts`
- `packages/os/scripts/workspace.ts`
- `packages/os/skills/**`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/tooling/tool-manifest.json`
- `packages/twenty-server/patches/@graphql-yoga+nestjs+2.1.0.patch`
- `packages/workspace/package.json`
- `packages/workspace/tooling/tool-manifest.json`

## current status

- Steering and coding standards read.
- Task instructions read.
- Red parity smoke failed as expected.
- Sync source selected: `origin/stream/workspace-agents`.

## files changed

- `.task/os/sync-os-dev-tooling-substrate/worker-instructions.md`
- `.task/os/sync-os-dev-tooling-substrate/worker-wrapper.md`
- `.task/os/sync-os-dev-tooling-substrate/workpad.md`

## workspace-owned: files changed

- `.task/os/sync-os-dev-tooling-substrate/worker-instructions.md`
- `.task/os/sync-os-dev-tooling-substrate/worker-wrapper.md`
- `.task/os/sync-os-dev-tooling-substrate/workpad.md`

## workspace-owned: activity log

- 2026-05-31 09:45:50 fs.write: `.task/os/sync-os-dev-tooling-substrate/worker-instructions.md`
- 2026-05-31 09:45:57 fs.write: `.task/os/sync-os-dev-tooling-substrate/worker-wrapper.md`
- 2026-05-31 09:49:25 fs.read: `CODING-STANDARDS.md`
- 2026-05-31 09:49:26 fs.read: `.task/os/sync-os-dev-tooling-substrate/worker-instructions.md`
- 2026-05-31 09:50:50 task.call: focused red parity smoke failed as expected
- 2026-05-31 09:51:43 fs.write: `.task/os/sync-os-dev-tooling-substrate/workpad.md`

## workspace-owned: validation evidence

- Red parity smoke failed: missing all representative dev tools and scripts listed in the test-first contract.

## key decisions

- Use `origin/stream/workspace-agents` as overlay source because it contains the current worker/tooling provider surface missing from `origin/stream/workspace`.
- Preserve `packages/os/tooling/tool-manifest.json` as product manifest.

## notes for ko

- none yet

## improvements noticed

- `code.run` is unavailable before this task because the OS/workspace package script does not exist in this branch; workspace facade typed calls are being used directly until the sync lands.

## issues and recovery

- `code.run` attempt failed with `Script not found "code-run"`; recovered by using supported typed `fs.*` and `task.call` workspace tools.

---

## publish checklist

```bash
bun run task:push -- --message "feat(os): sync workspace dev tooling substrate" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `CODING-STANDARDS.md`
- `.task/os/sync-os-dev-tooling-substrate/worker-instructions.md`
- `.task/os/sync-os-dev-tooling-substrate/workpad.md`
- `packages/os/package.json`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/tooling/tool-manifest.json`
- `packages/workspace/package.json`
- `packages/workspace/tooling/tool-manifest.json`

- 2026-05-31 09:51:43 write: `.task/os/sync-os-dev-tooling-substrate/workpad.md`

- 2026-05-31 09:51:58 patch lines 9-76: `.task/os/sync-os-dev-tooling-substrate/workpad.md`

- 2026-05-31 09:52:50 patch lines 7-7: `packages/os/scripts/lib/facade/executor.ts`

## workspace-owned: test selection

- changed files: none
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none

- 2026-05-31 11:32:13 patch lines 136-136: `packages/os/tests/facade/facade.test.ts`

- 2026-05-31 11:32:24 patch lines 86-86: `packages/os/tests/facade/facade.test.ts`

- 2026-05-31 11:32:44 write: `.task/os/sync-os-dev-tooling-substrate/blank.txt`

- 2026-05-31 11:32:49 patch lines 86-86: `packages/os/tests/facade/facade.test.ts`

- 2026-05-31 11:33:06 patch lines 391-391: `packages/os/tests/facade/facade.test.ts`

- 2026-05-31 11:34:11 write: `.task/os/sync-os-dev-tooling-substrate/branch-test-block.txt`

- 2026-05-31 11:34:30 patch lines 387-399: `packages/os/tests/facade/facade.test.ts`

- 2026-05-31 11:34:56 write: `.task/os/sync-os-dev-tooling-substrate/branch-test-and-next-start.txt`

- 2026-05-31 11:35:03 patch lines 387-405: `packages/os/tests/facade/facade.test.ts`

- 2026-05-31 11:35:17 patch lines 438-438: `packages/os/tests/facade/facade.test.ts`

- 2026-05-31 11:35:29 write: `.task/os/sync-os-dev-tooling-substrate/ambiguous-and-notfound-block.txt`

- 2026-05-31 11:35:39 patch lines 425-441: `packages/os/tests/facade/facade.test.ts`

- 2026-05-31 11:36:03 patch lines 449-455: `packages/os/tests/facade/facade.test.ts`

- 2026-05-31 11:36:41 patch lines 449-451: `packages/os/tests/facade/facade.test.ts`
