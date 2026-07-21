# integrate OS TraceSite and stale reviewed work to main

branch: `task/os/integrate-os-tracesite-and-stale-reviewed-work-to-main`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1543/integrate-os-tracesite-and-stale-reviewed-work-to-main
github pr: https://github.com/consuelohq/opensaas/pull/1543
started: 2026-07-21

## acceptance criteria

- [x] Preserve every unique, still-relevant product change from `stream/os`, PRs #1541 and #1542, `stream/trace-site`, PR #1519, PR #1478, and the intended server display-name correction from PR #1354.
- [x] Exclude bootstrap commits, task-promotion commits, stale task metadata, merge-recovery commits, and duplicate changes unless inspection proves they contain unique product code.
- [ ] Resolve code conflicts by current product behavior, the newest coherent implementation, surrounding architecture, and tests; never choose ours/theirs mechanically for mixed code conflicts.
- [x] Verify every Codex/CodeRabbit finding against the reconstructed current code, fix all still-valid findings, and record concise reasons for skipped findings.
- [x] Keep provenance for each imported or rewritten change so original PRs and commits remain traceable.
- [x] Validate OS runtime/tooling, TraceSite history/live behavior, stream lifecycle tooling, generated surfaces, and the MCP server display name at the appropriate focused and package levels.
- [ ] Push a clean integration PR, merge the completed release to `main`, and verify the resulting `main` state.

## plan

1. Import the clean `stream/os` history exactly into the integration branch.
2. Import the latest heads of PRs #1541 and #1542, then address their still-valid review findings with regression coverage.
3. Reconstruct TraceSite from product commits only, preserving their order and omitting stale task/merge scaffolding.
4. Add the near-live PR #1519 product commits and address its current CodeRabbit findings against the reconstructed code.
5. Replay the unique Effect stream-lifecycle implementation from PR #1478 only where it remains absent from current code.
6. Implement the intended MCP server display-name correction directly against current code because PR #1354 has no isolatable product commit.
7. Inspect the complete diff for lost or duplicate behavior, regenerate owned generated surfaces, and run focused/package validation.
8. Run review and verify, publish the integration branch, merge through the clean release path to `main`, and smoke the resulting runtime.

## Test-first contract

This is primarily an integration and conflict-reconstruction task, so no single red test can represent the whole change.

- Pure branch imports and mechanical conflict resolutions use a no-test waiver; validation is exact diff/provenance inspection plus the existing focused and package suites owned by the imported changes.
- Every still-valid review finding that changes behavior must have focused regression coverage before or with the fix.
- The reconstructed TraceSite path must run storage/pagination, browser state, formatter, and gateway tests plus a realistic local trace-site smoke.
- The OS path must run the imported task tests, memory/trace tests, manifest/registry tests, typecheck, review, and verify.
- The server display-name correction must have an initialization/server-info assertion before implementation.

## current status

- Clean `stream/os` history and the full provenance of PRs #1541 and #1542 are integrated.
- The valid OS follow-ups are integrated: broken-symlink mutation detection, canonical trace DB selection, and local-memory stream decisions.
- TraceSite and PR #1519 were reconstructed from product commits while excluding stale task metadata, duplicate branch history, deleted Office architecture, and superseded Trace Home code.
- All ten PR #1519 CodeRabbit findings were evaluated. Nine correctness/stability/layout findings and the final 100,000-row live-prepend performance finding are now addressed.
- Unique newer live rows use an incremental virtual-list path; duplicate/update pages and capacity edges retain the correctness-first full rebuild.
- Focused status: 12/12 TraceSite gateway tests and 43/43 inspector tests pass.
- PR #1478 is reconstructed OS-first from commit `9729706245bb`: the modular Effect service, `stream.create`, thin context/list CLIs, bundled stream instructions, install seeding, facade schema, manifest catalog, and service tests are present. Workspace mirrors, generated files, and stale task records from the old PR were excluded.
- The required companion commit `8d94d629a8a2` is now included without its stale task metadata. Retargeting #1543 to `main` exposed the missing TSX email compilation in the API-breaking workflow; `.swcrc`, `nest-cli.json`, and a focused build-contract test now cover it.
- Stream decisions in the imported service use the current local Consuelo memory database rather than the old Supabase decision path.
- The active Python MCP transport now defaults to `consuelo-os`; its environment example and reload health expectation match the OS-native server identity.
- The metadata audit removed 26 obsolete TraceSite task/session/workpad files while preserving the imported OS task provenance and the current integration record.
- Focused stream status: 7/7 service tests, 2/2 install tests, 4/4 tool-search tests, 15/15 tool-manifest tests, and 5/5 `stream.create` facade contracts pass.

## files changed

- `packages/os/tests/stream-install-state.test.ts`
- `packages/os/tests/stream-service.test.ts`
- `packages/workspace/tests/api-breaking-workflow-build-toolchain.test.ts`
- `packages/workspace/tests/twenty-server-email-build-contract.test.ts`

## workspace-owned: files changed

- `packages/os/tests/stream-install-state.test.ts`
- `packages/os/tests/stream-service.test.ts`
- `packages/workspace/tests/api-breaking-workflow-build-toolchain.test.ts`
- `packages/workspace/tests/twenty-server-email-build-contract.test.ts`

## workspace-owned: activity log

- 2026-07-21 09:05:12 fs.write: `packages/os/tests/stream-service.test.ts`
- 2026-07-21 09:05:26 fs.write: `packages/os/tests/stream-install-state.test.ts`
- 2026-07-21 09:49:21 fs.write: `packages/workspace/tests/twenty-server-email-build-contract.test.ts`
- 2026-07-21 10:19:21 fs.write: `packages/workspace/tests/api-breaking-workflow-build-toolchain.test.ts`
- Added and proved the incremental newer-row prepend path with an observable `live-incremental` diagnostic.
- Confirmed the active `batch` wrapper still drops the outer task session; all task-scoped work uses direct calls.
- Recovered the exact pre-outage task worktree without copying or resetting it.
- Replaced unsupported `expect.poll` calls with Playwright/browser-compatible wait contracts.

## workspace-owned: validation evidence

- `bun test packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`: 12 passed, 0 failed.
- `bun test packages/workspace/tests/trace-site-inspector.test.ts`: 43 passed, 0 failed, 304 assertions.
- Targeted live/history browser contract failed red on missing incremental mutation, then passed green after the fast path.
- PR #1478 red contracts failed on the missing Effect service and absent Tools instruction seeding; both are green after reconstruction.
- The MCP display-name contract failed red on `openworkspace` and passes with `consuelo-os`.
- `stream.create` initially executed despite `dryRun: true`; the focused facade test exposed the missing shared dry-run schema field, and the corrected contract now returns `DRY_RUN` without execution.
- Release-owned OS packet: 122 tests passed across 21 files with 1,200 assertions.
- TraceSite inspector packet: 43 tests passed with 304 assertions.
- Active Python MCP server wrapper: 44 tests passed.
- Static validation: `git diff --check`; 49 JSON files parsed; 2 Python files compiled; 8 changed JavaScript files passed the repository file checker.
- Changed-diff review against `main`: zero owned, related, or pre-existing findings across 89 product files.
- Repository verification: publish-valid, review passed, database guard passed, zero risks.
- GitHub API-breaking CI initially failed before API comparison because Twenty could not require `clean-suspended-workspace.email`. The focused contract failed red, then passed after enabling SWC TSX parsing/React transforms and `.tsx` Nest compilation. `nx build twenty-server` compiled 4,888 files and produced the missing email module.
- After that fix, the API workflow still failed while checking out and seeding the separate `main` baseline, because the first compiler-fix PR cannot make the already-checked-out baseline contain its own fix. The workflow now preserves only `.swcrc` and `nest-cli.json` from the PR, restores them after the `main` checkout, and continues comparing `main`'s actual API source and schema. A focused ordering contract failed red and now passes; the workflow parses as valid YAML.
- 2026-07-21 09:30:26 `verify`: passed — OK
- 2026-07-21 09:31:08 `verify`: passed — OK
- 2026-07-21 09:59:23 `verify`: failed — COMMAND_FAILED
- 2026-07-21 10:02:55 `verify`: failed — COMMAND_FAILED
- 2026-07-21 10:20:26 `verify`: passed — OK
- 2026-07-21 10:34:28 `review.run`: passed — OK
- 2026-07-21 10:34:47 `verify`: passed — OK
- 2026-07-21 10:35:02 `verify`: passed — OK

## key decisions

- The latest coherent implementation wins only after confirming behavior and tests; commit recency alone is not sufficient evidence.
- Original stale PR branches will remain untouched until their unique code is safely present on the integration branch.
- The integration branch is the loss-prevention ledger: every imported, skipped, superseded, or rewritten change will be recorded here.
- PR #1478 will be replayed OS-first from its modular Effect stream source, with generated surfaces rebuilt and its stale Supabase decision lookup replaced by the current local-memory contract.
- `stream.create` is intentionally full-manifest-only; the core manifest keeps the existing session-safe read/sync stream surface.
- Legacy `OPENWORKSPACE_*` storage/environment aliases remain for compatibility. This task changes the active MCP display identity only, not every historical path or package name.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- The active `batch` runtime failed to propagate `taskSession` to task-scoped `fs.read`; task-scoped operations are being run directly. GitHub-only fan-out remains batched safely.
- The authenticated OS backend recovered after the outage. One later OAuth-introspection request failed transiently and succeeded on the single permitted retry.
- The task-scoped `status` command ignored the provided session and reported `main`; branch identity is verified through direct task-scoped filesystem/Git calls instead.
- The broad manifest workflow-role suite has an unrelated baseline assertion expecting `fs.write` in core while current manifest policy explicitly excludes it. Owned stream and manifest generation contracts are green.
- Bun's snapshot updater rewrote the full Vitest snapshot file during a targeted run; the file was restored byte-for-byte and only the two stream snapshot keys were renamed.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.github/workflows/ci-breaking-changes.yaml`
- `packages/os/SCRIPTS.md`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/manifest.config.json`
- `packages/os/package.json`
- `packages/os/scripts/lib/code-call/snapshot.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/stream-memory.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- `packages/os/scripts/stream-context.js`
- `packages/os/scripts/task-start.js`
- `packages/os/scripts/tools-search.ts`
- `packages/os/tests/tools-search-v2.test.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/workspace/scripts/trace-site-inspector/inspector-state.ts`
- `packages/workspace/scripts/trace-site-inspector/pagination-browser.ts`
- `packages/workspace/scripts/trace-site-inspector/table-formatters.ts`
- `packages/workspace/scripts/trace-site-inspector/trace-list.ts`
- `packages/workspace/scripts/trace-site-inspector/virtual-list-browser.ts`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/server.py`
- `packages/workspace/tests/server_call_test.py`
- `packages/workspace/tests/trace-site-inspector.test.ts`

- 2026-07-21 10:19:21 write: `packages/workspace/tests/api-breaking-workflow-build-toolchain.test.ts`

- 2026-07-21 10:19:39 apply-patch: `.github/workflows/ci-breaking-changes.yaml`

- 2026-07-21 10:19:59 apply-patch: `.task/os/integrate-os-tracesite-and-stale-reviewed-work-to-main/workpad.md`

## release finalization follow-up — 2026-07-21

- Acceptance: explicitly allowlist `.github/workflows/ci-breaking-changes.yaml` for its existing privileged permissions, add regression coverage, pass review/verify, merge PR #1543 to `main`, reload OS, and run live smoke checks.
- Test-first red: `packages/workspace/tests/github-workflow-policy.test.js` failed because the workflow was absent from `writePermissionAllowlist`.
- Green evidence: the focused policy test passes 4/4 and `check-github-workflows.cjs origin/main` reports zero findings.
- Recovery: `task.start --pr 1543` reused the correct head branch but created duplicate PR #1545 and overwrote the task workpad; the committed workpad was restored before publish.
- Review: zero owned, related, or pre-existing findings across the consolidated release diff.
- Verify: publish-valid; database guard passed with zero risks.
- Remaining: push final commit, wait for GitHub checks, merge PR #1543, reload OS, smoke runtime, close duplicate PR #1545.

- 2026-07-21 10:34:55 apply-patch: `.task/os/integrate-os-tracesite-and-stale-reviewed-work-to-main/workpad.md`
