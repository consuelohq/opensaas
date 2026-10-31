# Compress steering context and preserve historical alignment doctrine

branch: `task/os/compress-steering-context-and-preserve-historical-alignment-doctrine`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2738
started: 2026-10-31

## acceptance criteria

- [x] Exclude offline node records from steering and give an accurate offline count while preserving routable online node IDs and fail-closed behavior.
- [x] Emit only installed skill title and unchanged description while retaining installed/disabled selection behavior.
- [x] Replace the oversized core manifest with effective core tool names and on-demand discovery guidance.
- [x] Preserve and selectively restore historical alignment doctrine in user-owned local steering, with backups outside the auto-loaded directory.
- [x] Execute focused TDD, broader test slice, typecheck and diff-check before publication.
- [ ] Publish through stream/os, then record exact PR and SHA; do not merge main or deploy.

## plan

1. Trace historical steering deletion and preserve sources (completed).
2. Add red tests for node inventory, skills, and tool list (completed; 5 expected assertion failures).
3. Implement renderer changes, maintain source metadata and routing contracts (completed).
4. Backup user-owned steering; restore concise historical doctrine without bloating steering (completed).
5. Run focused + broader tests, typecheck, review and publish through stream workflow (in progress).

## files changed

- `packages/os/scripts/os.ts`
- `packages/os/scripts/lib/steering-snapshot-cache.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`
- User-owned: `~/Consuelo/Steering/system.md` (separate work session).
- User-owned backups: `~/Consuelo/Backups/steering/system-2026-10-31-before-restoration.md` and `system-prompt-pre-migration-2026-09-10.md`.
- Additional user-owned backup: `~/Consuelo/Backups/steering/dev-steering-latest-repo-2026-10-31.md` (1,088 lines).

## key decisions

- Keep source skill metadata untouched; alter only user-visible steering projection.
- Use exact effective core tool names and existing `tools.search` for schema discovery; no new tool-discovery mechanism.
- Preserve online/stale route records; exclude explicit offline records and count them. Fail-closed routing remains enforced by OS.
- The historical source was 1,398 lines (59,336 bytes), last removed by commit `cd1e9b3a71` on 2026-09-10. Back it up outside `~/Consuelo/Steering` rather than inlining its old command documentation.

## notes for ko

- Live `system.md` now contains a compact alignment-first doctrine plus existing Consuelo path, subagent, and media rules.
- The installed product needs a future approved release/update to pick up the source renderer changes. Local user-authored steering updates are already saved.

## improvements noticed

- The largest previous steering block was the raw effective core tool manifest, beyond the user's originally noticed offline-node and skills bloat.

## errors i ran into

- First red test invocation from repo root failed because this test file assumes cwd `packages/os`. Retried with correct cwd and reproduced 5 intended red assertions. The subsequent 25-test slice passed.
- An initial oversized workpad replacement call failed through input transport; switched to smaller supported `fs.write` append and `fs.apply_patch` operations.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/manifest.ts`
- `packages/os/scripts/lib/mcp-node-routing.ts`
- `packages/os/scripts/lib/steering-snapshot-cache.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`

## Test-first contract

behavior under test: offline nodes become a count; skill steering contains only title and description; core manifest is summarized with on-demand tools.search instructions.
existing local pattern: packages/os/tests/os-get-steering-trace.test.ts fixtures.
new or changed tests: offline routing fixture, skill metadata projection assertions, compact manifest assertions.
focused red command: bunx vitest run packages/os/tests/os-get-steering-trace.test.ts
expected red failure: offline node ids and redundant skill metadata still present.
no-test waiver: local user-owned markdown is copy-only and verified by backup and read.

## Expanded acceptance criteria
- [ ] Offline IDs absent with accurate count, online routable node identity preserved.
- [ ] Skill titles and original descriptions only; selection, disabled overlays unaffected.
- [ ] Core tool names discoverable without raw manifest dump.
- [ ] Archive old document without loading full content into live steering.
- [ ] Validate, publish to stream/os, do not merge main or deploy.

- 2026-10-31 05:37:43 append: `.task/os/compress-steering-context-and-preserve-historical-alignment-doctrine/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-31 05:37:43 fs.write: `.task/os/compress-steering-context-and-preserve-historical-alignment-doctrine/workpad.md`
- 2026-10-31 05:37:59 apply-patch: `packages/os/tests/os-get-steering-trace.test.ts`
- 2026-10-31 05:38:08 apply-patch: `packages/os/tests/os-get-steering-trace.test.ts`
- 2026-10-31 05:38:35 fs.write: `.task/os/compress-steering-context-and-preserve-historical-alignment-doctrine/workpad.md`

## Red test evidence (2026-10-31)

- Initial run from repo root was a test-harness cwd mistake: runOsSnippet imports ./scripts/os.ts relative to packages/os. Corrected execution cwd to packages/os.
- Correct red run: code.call({language:'bash', mode:'verify', cwd:'packages/os', code:'bunx vitest run tests/os-get-steering-trace.test.ts'}).
- 5 expected assertion failures: offlineNodeCount absent, offline node records still projected, skill metadata still verbose, core raw manifest still present.
- Next: implement only the renderer projections; rerun same focused test green.

## Green verification evidence (2026-10-31)

- `bunx vitest run tests/os-get-steering-trace.test.ts tests/skill-selection-cli.test.ts tests/steering-canonical-source.test.ts` from `packages/os`: **25/25 passed**, including selected and disabled skill overlay behavior, custom skill inclusion, source precedence, snapshot cache, offline routing inventory.
- `bunx nx run consuelo-os:typecheck`: **passed**.
- `git diff --check`: **passed**.
- `review.run` returned zero blocking issues and zero failed suites (review baseline encompasses unrelated ahead/behind stream changes; rely on focused test proof for this patch).
- `verify`: **passed, publishValid=true**, exact task-branch base; static rules, ESLint, typecheck, spec compliance, 8 selected critical suites (including 107-node-routing tests and 46 workspace guard tests), database guard all passed with zero blocking findings.
- Live user-owned steering read back successfully; three archived snapshots verified by `wc` (1,417; 59,336; 47,920 bytes).

- 2026-10-31 05:38:35 append: `.task/os/compress-steering-context-and-preserve-historical-alignment-doctrine/workpad.md`

- 2026-10-31 05:38:44 apply-patch: `packages/os/scripts/os.ts`
- 2026-10-31 05:38:44 apply-patch: `packages/os/scripts/lib/steering-snapshot-cache.ts`

- 2026-10-31 05:38:58 apply-patch: `packages/os/tests/os-get-steering-trace.test.ts`

- 2026-10-31 05:40:45 apply-patch: `packages/os/scripts/os.ts`

- 2026-10-31 05:41:08 apply-patch: `.task/os/compress-steering-context-and-preserve-historical-alignment-doctrine/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 05:41:39 `review.run`: passed — OK
- 2026-10-31 05:42:15 `review.run`: passed — OK
- 2026-10-31 05:42:41 apply-patch: `.task/os/compress-steering-context-and-preserve-historical-alignment-doctrine/workpad.md`
- 2026-10-31 05:42:57 `verify`: passed — OK

- 2026-10-31 05:43:04 apply-patch: `.task/os/compress-steering-context-and-preserve-historical-alignment-doctrine/workpad.md`