# Compact steering runtime identity and restore curated tool guidance

branch: `task/os/compact-steering-runtime-identity-and-restore-curated-tool-guidance`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2744
started: 2026-10-31

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/manifests/generated/core.manifest.json`
- `packages/os/scripts/lib/manifest.ts`
- `packages/os/scripts/lib/steering-snapshot-cache.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`
- `packages/os/tests/steering-canonical-source.test.ts`

## Task scope / user approval

- User approved implementation, review, main release and Mac update. Do not touch their local user-owned system.md; previous historical recovery is irrelevant to this task.
- Build on already-released 0.1.144 compact steering renderer: retain active skill title+description; omit offline nodes except count; preserve routing safety and exact canonical identity fields.
- Format Runtime identity as compact human-readable quote-free object where safe, retaining keys, commas/braces, true/false/null and escaping unsafe values; mark as non-JSON; do not modify actual machine identities.
- Restore essential tool *transport* guidance with small accurate agent-oriented examples from old dumped core manifest: discover exact signatures via tools.search; top-level os.call tool/input/nodeId/taskSession; begin task/work session; code.call with mode and bounded results, patch, reviews, batch; do not reinsert 1200-line manifest; keep docs on-demand.
- Respect tool disabling by effective manifest, cache invalidation, preserve user's authority over system.md, no execution-scope bypasses.
- Bounded growth target: tool guidance <= 2,800 characters, net full steering far smaller than old ~53k chars. Include tests for escaping hostile strings and metadata rehydration.
- Test-first contract: add focused steering integration assertions for runtime identity and critical tool examples before modifying source, run focused vitest red and record failure; then implement, green, OS verify, exact-head CI, main-targeting isolated PR, release canary, install and verify live.
- No-test waiver: none.

## Approved transport choices

- Use cached, effective tool manifest ONLY for enabled core tool names; short examples curated for correctness and one-level call shape. Fetch complete metadata on demand with tools.search({query:<exact>,detail:"full"}); not by inlining JSON.
- Render scalar names unquoted only if unambiguous and single-line, otherwise keep quoted/escaped to prevent newline/comma/Markdown injection. All values are authoritative identity data and must not be modified.

## Test-first contract

Behavior under test: compact quasi-object identity contains id/slug/route and offline count but not quoted JSON keys, preserves commas and nested arrays, escapes malformed/delimiter-bearing strings; tool guidance includes exact working os.call({tool,input,taskSession}) and tools.search query, code.call modes, session.start, patch, review.run, current core enumeration and no stale trigger metadata/full manifest.
Existing patterns: packages/os/tests/os-get-steering-trace.test.ts renders getSteering() with per-test isolated homes and mocks.
Focused red: bunx vitest run tests/os-get-steering-trace.test.ts, before source edits.
Expected: old JSON rendering fails new quote-free assertions; current bare tool list fails new guidance assertions.

- 2026-10-31 06:28:12 append: `.task/os/compact-steering-runtime-identity-and-restore-curated-tool-guidance/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-31 06:28:12 fs.write: `.task/os/compact-steering-runtime-identity-and-restore-curated-tool-guidance/workpad.md`
- 2026-10-31 06:28:35 apply-patch: `packages/os/tests/os-get-steering-trace.test.ts`
- 2026-10-31 06:28:52 apply-patch: `packages/os/tests/os-get-steering-trace.test.ts`
- 2026-10-31 06:29:03 fs.write: `.task/os/compact-steering-runtime-identity-and-restore-curated-tool-guidance/workpad.md`
- 2026-10-31 06:31:10 fs.write: `.task/os/compact-steering-runtime-identity-and-restore-curated-tool-guidance/workpad.md`
- 2026-10-31 06:32:13 fs.write: `.task/os/compact-steering-runtime-identity-and-restore-curated-tool-guidance/workpad.md`
- 2026-10-31 06:33:08 fs.write: `.task/os/compact-steering-runtime-identity-and-restore-curated-tool-guidance/workpad.md`

## Focused red evidence

- `bunx vitest run tests/os-get-steering-trace.test.ts` on main-based task branch with new tests: 5 expected contract failures and 15 existing passes (20 total), demonstrating old JSON runtime identity and bare core name list lack the approved behavior. Syntax was corrected before recording this red. No source production edits yet.

- 2026-10-31 06:29:03 append: `.task/os/compact-steering-runtime-identity-and-restore-curated-tool-guidance/workpad.md`

- 2026-10-31 06:29:25 apply-patch: `packages/os/scripts/os.ts`
- 2026-10-31 06:29:48 apply-patch: `packages/os/scripts/lib/steering-snapshot-cache.ts`
- 2026-10-31 06:30:04 apply-patch: `packages/os/tests/os-get-steering-trace.test.ts`
- 2026-10-31 06:30:46 apply-patch: `packages/os/scripts/lib/steering-snapshot-cache.ts`
- 2026-10-31 06:30:46 apply-patch: `packages/os/tests/os-get-steering-trace.test.ts`
## Implemented + targeted verification (2026-10-31)

- `formatSteeringRuntimeIdentity` renders the authoritative nested identity as a Markdown `text` code fence with unquoted safe key/value tokens, preserving braces, commas, arrays, booleans, nulls and all original fields. Ambiguous values remain quoted and escape backticks/HTML angle bracket sequences.
- `readSteeringSnapshot` retains the installed skill list and effective core tool names while appending seven executable, succinct os.call workflow examples for search, task start, code.call, typed patch, batch, GitHub reviews and review.run. Disabled tools do not receive examples, and batch example drops out when tools.search is disabled. Full schemas remain on demand via tools.search.
- Code footprint: 3 product/test files (OS runtime identity, steering snapshot renderer, steering regression suite), user-authored system.md untouched.
- `bunx vitest run tests/os-get-steering-trace.test.ts tests/skill-selection-cli.test.ts tests/steering-canonical-source.test.ts`: **27/27 passed**, including newly added hostile-scalar escaping and disabled tool guidance tests.
- `bunx nx run consuelo-os:typecheck`: PASSED. `git diff --check`: PASSED. Core tool guidance measured 1,940 chars / 7 examples; no full manifest reintroduced.
- Next: managed verify for full critical suites and review; then task push, retarget PR #2744 to main, verify exact-head CI, source-backed OS canary release and install.

- 2026-10-31 06:31:10 append: `.task/os/compact-steering-runtime-identity-and-restore-curated-tool-guidance/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 06:31:57 `verify`: failed — COMMAND_FAILED
- 2026-10-31 06:32:06 apply-patch: `packages/os/scripts/lib/steering-snapshot-cache.ts`
- 2026-10-31 06:33:01 `verify`: passed — OK

## Review gate finding and fix

Initial full verify ran all 8 registry-critical suites successfully and DB guard clean, but review flagged a LOGGING static-rule false-positive in the literal `console.log(1)` used solely for a documentation/example snippet. Replaced it with equally valid `code:"process.stdout.write(String(1))"` in the inline Bun `code.call` example; real tests still validate the example call shape. Do not bypass review. Re-run full verification on changed HEAD.

- 2026-10-31 06:32:13 append: `.task/os/compact-steering-runtime-identity-and-restore-curated-tool-guidance/workpad.md`

## Managed verification final

Full managed OS verify **PASSED**, publishValid=true, eight selected critical suites passed, zero failed suites, review yourIssues=0 and blockingIssues=0, DB guard no risks. Earlier LOGGING hit resolved without suppressing any rules. Scope remains exactly three runtime/test paths plus task evidence. User approved main-targeting isolated ship and installation to existing canary channel. PR #2744 must be retargeted to main from auto-created stream/os base, check exact diff and CI, invoke signed release orchestrator, verify installed output and update. Cleanup may require retaining worktree because task.finish expects stream merge; do not rewrite stream to satisfy cleanup.

- 2026-10-31 06:33:08 append: `.task/os/compact-steering-runtime-identity-and-restore-curated-tool-guidance/workpad.md`
