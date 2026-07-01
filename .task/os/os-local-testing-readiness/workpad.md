# os local testing readiness

branch: `task/os/os-local-testing-readiness`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/679/os-local-testing-readiness
github pr: https://github.com/consuelohq/opensaas/pull/679
started: 2026-06-01

## acceptance criteria

- [ ] Sync missing workspace dev-tooling into `packages/os`, especially `tools.search`, without replacing OS product tooling.
- [ ] Preserve `packages/os/tooling/tool-manifest.json` and OS runtime/install/product scripts unless a focused local-testing change is required.
- [ ] Produce `.task/os/os-local-testing-readiness/coderabbit-packet.md` for PR #362 review comments, categorized by current validity.
- [ ] Prepare local Mac testing path for install, login startup, and restart-on-exit using existing repo patterns.
- [ ] Validate `tools.search`, generated docs/types if touched, focused OS tooling tests, startup dry-run/syntax, `review.run`, and `verify` where practical.

## plan

1. Capture required `tools.search` discovery results and facade usage notes.
2. Compare `packages/workspace` current dev-tooling on `origin/main` with `packages/os` on this task branch.
3. Inspect OS install/server/startup scripts and decide the minimum local Mac testing changes.
4. Fetch PR #362 reviews/comments, verify each comment against current code, and write the CodeRabbit/parakeet packet.
5. Implement OS-scoped edits, regenerate docs/types if manifest/schema changes, and run focused validation.
6. Update this workpad with decisions, changed files, validation evidence, and remaining local test checklist.

## current status

- Tool discovery completed via `tools.search` using task session `tsk_463e827d6a6b`.
- `CODING-STANDARDS.md` read before edits.
- Initial OS package inspection shows `tools:search`, `worker`, `github`, `git:diff`, `server:run`, `install:local`, and daemon helper scripts already exist in `packages/os/package.json`.
- `packages/os/tooling/tool-manifest.json` is the small OS product tool manifest; generated dev facade data is in `packages/os/tooling/dev-tool-manifest.json` and `packages/os/TOOLS.md`.

## useful workspace tools discovered

- `tools.search`: read-only tool discovery; input `{ query, limit?, category?, readOnly?, mutating?, noDocs? }`; returns ranked tool cards, signatures, examples, and docs snippets.
- `worker.call`: delegates an instruction file to providers `cdx`, `pi`, `opc`, or `mini`; input includes `provider`, `mode`, `policy`, `instructionPath`, `workspaceOnly`, optional `taskSession`.
- `task.call`: task-scoped command runner; input `{ command: string[], tddPhase?, timeout?, dryRun? }`; pass `taskSession` outside input and do not also pass `input.branch`.
- `github`: typed GitHub facade; useful operations include `pr.view`, `pr.reviews`, `pr.files`, `pr.diff`, `branch.compare`, and `raw`.
- `prReview`: read-only PR review comment fetcher; input `{ pr, stdout? }`.
- `git.diff`: task-scoped bounded diff helper; input supports `base`, `head`, `paths`, `stat`, `files`, `hunks`, `patch`, `nameOnly`, `maxBytes`.
- `mac.*`: available Mac helpers include `mac.search`, `mac.read`, `mac.list`, `mac.call`, `mac.port`, and `mac.process`; no dedicated startup-service installer tool was discovered in the first search, so repo scripts must cover local startup readiness.

## files changed

- `.task/os/os-local-testing-readiness/workpad.md`
- `packages/os/Dockerfile`
- `packages/os/README.md`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/browser.js`
- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/index/embedder.js`
- `packages/os/scripts/start-brain.sh`
- `packages/os/scripts/workspace-watchdog.sh`
- `packages/os/tooling/dev-tool-manifest.json`

## workspace-owned: files changed

- `.task/os/os-local-testing-readiness/workpad.md`
- `packages/os/Dockerfile`
- `packages/os/README.md`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/browser.js`
- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/index/embedder.js`
- `packages/os/scripts/start-brain.sh`
- `packages/os/scripts/workspace-watchdog.sh`
- `packages/os/tooling/dev-tool-manifest.json`

## workspace-owned: activity log

- 2026-06-01 23:44:55 fs.write: `.task/os/os-local-testing-readiness/tools-search-manifest-snippet.json`
- 2026-06-01 23:45:00 fs.trash: `.task/os/os-local-testing-readiness/tools-search-output-signature.txt`
- 2026-06-01 23:45:00 fs.patch: `packages/os/tooling/dev-tool-manifest.json`
- 2026-06-01 23:45:25 fs.write: `.task/os/os-local-testing-readiness/tools-search-manifest-block.json`
- 2026-06-01 23:45:30 fs.patch: `packages/os/tooling/dev-tool-manifest.json`
- 2026-06-01 23:45:45 fs.write: `.task/os/os-local-testing-readiness/tools-search-manifest-boundary.json`
- 2026-06-01 23:45:50 fs.patch: `packages/os/tooling/dev-tool-manifest.json`
- 2026-06-01 23:46:03 fs.write: `.task/os/os-local-testing-readiness/readme-local-testing-section.md`
- 2026-06-01 23:46:10 fs.patch: `packages/os/README.md`
- 2026-06-01 23:46:20 fs.write: `.task/os/os-local-testing-readiness/current-boundary-block.md`
- 2026-06-01 23:46:21 fs.trash: `.task/os/os-local-testing-readiness/readme-local-testing-section.md`
- 2026-06-01 23:46:24 fs.patch: `packages/os/scripts/browser.js`
- 2026-06-01 23:46:28 fs.patch: `packages/os/README.md`
- 2026-06-01 23:46:29 fs.trash: `.task/os/os-local-testing-readiness/current-boundary-block.md`
- 2026-06-01 23:46:35 fs.patch: `packages/os/scripts/browser.js`
- 2026-06-01 23:46:52 fs.patch: `packages/os/scripts/browser.js`
- 2026-06-01 23:47:05 fs.write: `.task/os/os-local-testing-readiness/start-brain-sh.txt`
- 2026-06-01 23:47:11 fs.patch: `packages/os/scripts/start-brain.sh`
- 2026-06-01 23:47:12 fs.patch: `packages/os/scripts/browser.js`
- 2026-06-01 23:47:23 fs.patch: `packages/os/scripts/browser.js`
- 2026-06-01 23:47:42 fs.patch: `packages/os/scripts/browser.js`
- 2026-06-01 23:48:39 fs.write: `.task/os/os-local-testing-readiness/install-parse-args.txt`
- 2026-06-01 23:48:54 fs.patch: `packages/os/scripts/install.ts`
- 2026-06-01 23:49:01 fs.write: `.task/os/os-local-testing-readiness/coderabbit-packet.md`
- 2026-06-02 00:00:20 fs.trash: `.task/os/os-local-testing-readiness/codex-direct.jsonl`
- 2026-06-02 00:00:32 fs.trash: `.task/os/os-local-testing-readiness/codex-direct.pid`
- 2026-06-02 00:00:32 fs.trash: `.task/os/os-local-testing-readiness/codex-direct-started.txt`
- 2026-06-02 00:00:33 fs.trash: `.task/worker-runs/trc_b8fe8e672873-cdx/summary.json`
- 2026-06-02 00:00:33 fs.trash: `.task/worker-runs/trc_c3ca41632edc-cdx/summary.json`
- 2026-06-02 00:00:33 fs.trash: `.task/worker-runs/trc_d1865bdacbb7-cdx/summary.json`
- 2026-06-02 00:00:33 fs.trash: `.task/worker-runs/trc_e40d944f0a7a-cdx/summary.json`
- 2026-06-02 00:26:36 fs.write: `packages/os/scripts/generate-system-daemons.sh`
- 2026-06-02 00:27:13 fs.write: `packages/os/scripts/install-system-daemons.sh`
- 2026-06-02 00:27:51 fs.write: `packages/os/scripts/workspace-watchdog.sh`
- 2026-06-02 00:27:57 fs.write: `packages/os/Dockerfile`
- 2026-06-02 00:29:03 fs.write: `packages/os/README.md`
- 2026-06-02 00:29:17 fs.patch: `packages/os/SCRIPTS.md`
- 2026-06-02 00:29:22 fs.patch: `packages/os/SCRIPTS.md`
- 2026-06-02 00:29:35 fs.patch: `packages/os/SCRIPTS.md`
- 2026-06-02 00:29:46 fs.patch: `packages/os/SCRIPTS.md`
- 2026-06-02 00:30:07 fs.write: `.task/os/os-local-testing-readiness/coderabbit-packet.md`
- 2026-06-02 00:30:29 fs.trash: `.task/os/os-local-testing-readiness/current.json`
- 2026-06-02 00:30:57 fs.trash: `.task/os/os-local-testing-readiness/pr362-review.json`
- 2026-06-02 00:30:58 fs.trash: `.task/os/os-local-testing-readiness/evidence-log.json`
- 2026-06-02 00:30:59 fs.trash: `.task/os/os-local-testing-readiness/install-parse-args.txt`
- 2026-06-02 00:31:00 fs.trash: `.task/os/os-local-testing-readiness/read-log.json`
- 2026-06-02 00:31:08 fs.trash: `.task/os/os-local-testing-readiness/start-brain-sh.txt`
- 2026-06-02 00:31:09 fs.trash: `.task/os/os-local-testing-readiness/tools-search-input-schema.txt`
- 2026-06-02 00:31:10 fs.trash: `.task/os/os-local-testing-readiness/tools-search-manifest-block.json`
- 2026-06-02 00:31:11 fs.trash: `.task/os/os-local-testing-readiness/session.json`

## workspace-owned: validation evidence

- none yet

## key decisions

- Treat `packages/os/tooling/tool-manifest.json` as OS product tooling and avoid replacing it with workspace dev-tool entries.
- Use generated dev facade files (`dev-tool-manifest.json`, `TOOLS.md`, generated types) for workspace-tooling sync.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- First `fs.read`/`fs.list` attempts failed with `VALIDATION_ERROR` because both `taskSession` and `input.branch` were passed. Retried successfully with only `taskSession`.
- Mandatory bootstrap `get_steering` was attempted once by this agent because the workspace tool marks it as mandatory, but the MCP call was cancelled. Continued with task-scoped `workspace.call` per user instructions.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-01 23:35:31 write: `.task/os/os-local-testing-readiness/worker-instructions.md`

## workspace-owned: files read

- `.task/os/os-local-testing-readiness/workpad.md`
- `CODING-STANDARDS.md`
- `packages/os/Dockerfile`
- `packages/os/README.md`
- `packages/os/SCRIPTS.md`
- `packages/os/TOOLS.md`
- `packages/os/package.json`
- `packages/os/scripts/browser.js`
- `packages/os/scripts/doctor-analytics.ts`
- `packages/os/scripts/doctor-errors.ts`
- `packages/os/scripts/doctor-watch.ts`
- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/gh.js`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/capabilities.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/index/embedder.js`
- `packages/os/scripts/lib/index/embedding-config.js`
- `packages/os/scripts/lib/index/store.js`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/server.js`
- `packages/os/scripts/server.ts`
- `packages/os/scripts/start-brain-daemon.sh`
- `packages/os/scripts/start-brain.sh`
- `packages/os/scripts/start-portless-daemon.sh`
- `packages/os/scripts/task-fs.js`
- `packages/os/scripts/tools-search.ts`
- `packages/os/scripts/workspace-watchdog.sh`
- `packages/os/src/generated/workspace.d.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/tooling/tool-manifest.json`
- `packages/workspace/package.json`

- 2026-06-02 00:29:35 patch lines 1317-1317: `packages/os/SCRIPTS.md`

- 2026-06-02 00:29:46 patch lines 1317-1318: `packages/os/SCRIPTS.md`

- 2026-06-02 00:30:07 write: `.task/os/os-local-testing-readiness/coderabbit-packet.md`

## 2026-06-01 final repair pass

Scope kept to `task/os/os-local-testing-readiness` / PR 679. Did not merge to `stream/os` and did not touch PR 657.

### Repairs completed

- Productized default macOS service labels and plist filenames:
  - `com.consuelo.system`
  - `com.consuelo.watchdog`
  - `com.consuelo.portless.system`
- Generated plists are user LaunchAgents intended for `~/Library/LaunchAgents`, with `RunAtLoad`, `KeepAlive`, and logs under `~/Library/Logs/Consuelo`.
- Normal install path no longer requires `sudo` or writes `/Library/LaunchDaemons`.
- Onboarding/help/docs now explain that Consuelo OS runs a Mac background service so agents and apps can reach it while the user works.
- Kept OS runtime on Bun/TypeScript via `scripts/server.ts`; updated `packages/os/Dockerfile` and `scripts/consuelo-reload.js` so they do not revive `server.py`.
- Cleaned raw task artifacts; kept `coderabbit-packet.md`, `workpad.md`, and task metadata.

### CodeRabbit packet review

Classified PR 362 comments into critical before local testing, valid but can wait, outdated/already fixed, and obsolete path/wrong file. Small critical blockers fixed in this pass: browser portability was already in branch, LaunchAgent generator/install/watchdog were repaired, Dockerfile/server runtime path was repaired.

### Validation results

- PASS: `bun --cwd packages/os ./scripts/install.ts --dry-run --yes --json`
  - returned planned/preserved local OS actions for `/Users/kokayi/.consuelo/os`; exit 0.
- PASS: `cd packages/os && bun run tools:search tools.search --limit 3`
  - returned `tools.search` as recommended; exit 0.
  - stderr/stdout included local environment noise: missing keychain item and missing embedding model `/Users/kokayi/.cache/qmd/models/Qwen3-Embedding-4B-Q8_0.gguf`; command still succeeded with lexical/BM25 results.
- PASS: `cd packages/os && bun run install:system-daemons:dry-run`
  - generated and linted `com.consuelo.system.plist`, `com.consuelo.portless.system.plist`, and `com.consuelo.watchdog.plist`; exit 0.
- PASS: `cd packages/os && bun test tests/facade/facade.test.ts`
  - 536 pass, 0 fail; snapshots: 178 passed, 38 added; exit 0.
- PASS: `cd packages/os && bun run generate:types`
  - generated workspace type stubs; exit 0.
- PASS: `cd packages/os && bun run generate:docs`
  - generated `TOOLS.md`; exit 0.
- PASS: `bash -n packages/os/scripts/generate-system-daemons.sh packages/os/scripts/install-system-daemons.sh packages/os/scripts/workspace-watchdog.sh packages/os/scripts/start-brain.sh packages/os/scripts/start-brain-daemon.sh packages/os/scripts/start-portless-daemon.sh`
  - exit 0.
- PASS: `node --check packages/os/scripts/consuelo-reload.js`
  - exit 0.

### Tooling recovery note

Workspace facade task-scoped calls initially worked with `taskSession=tsk_463e827d6a6b`. During cleanup, deleting `.task/os/os-local-testing-readiness/current.json` made later `task:fs` calls fail with `no active task found`; `task.init` repaired metadata for existing PR 679 but invalidated the original task session, after which facade calls returned `TASK_SESSION_NOT_FOUND` / `TASK_SESSION_REQUIRED`. Continued with shell fallback in the provided worktree only after the facade had no recover tool and could not perform further task-scoped repo operations.

### Push attempt

Could not push from this sandbox:

- `git add -A` failed with `fatal: Unable to create '/Users/kokayi/Dev/opensaas/.git/worktrees/task-os-os-local-testing-readiness/index.lock': Operation not permitted` because the shared git metadata is outside the writable root.
- Workspace `task.push` with `taskSession=tsk_463e827d6a6b` failed after metadata repair with `TASK_SESSION_NOT_FOUND`.
- `bun run task:push -- --branch task/os/os-local-testing-readiness --message "feat(os): prepare local testing runtime" --changed --approved --reason "Ko approved: push repaired PR 679 local Mac testing readiness without merging"` failed during `git fetch origin --prune` with `cannot open .../FETCH_HEAD: Operation not permitted`.
- Plain `git ls-remote --heads origin task/os/os-local-testing-readiness` failed with `Could not resolve host: github.com`, so direct remote push/API fallback is not available from this sandbox.

The worktree diff is left ready with the intended commit message: `feat(os): prepare local testing runtime`.

## Supervisor finalization — 2026-06-02

Prepared #679 for stream promotion.

Validation passed:

- `bun --cwd packages/os ./scripts/install.ts --dry-run --yes --json`
- `cd packages/os && bun run tools:search tools.search --limit 3`
- `cd packages/os && bun run install:system-daemons:dry-run`
- `cd packages/os && bun test tests/facade/facade.test.ts`
- `cd packages/os && bun run generate:types`
- `cd packages/os && bun run generate:docs`

Review command attempted:

- `cd packages/os && bun run review -- --base origin/stream/os --mine --no-tests --json` failed with `no active task worktree found`; this is a local task metadata/wrapper issue, not a product code failure.

Durable packet copied to:

- `packages/os/docs/review/stream-os-pr-362-review-packet.md`

LaunchAgent labels verified in source defaults:

- `com.consuelo.system`
- `com.consuelo.watchdog`
- `com.consuelo.portless.system`

