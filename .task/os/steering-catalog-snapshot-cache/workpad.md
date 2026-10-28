# Steering catalog snapshot cache

branch: `task/os/steering-catalog-snapshot-cache`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1860/steering-catalog-snapshot-cache
github pr: https://github.com/consuelohq/opensaas/pull/1860
started: 2026-08-12

## acceptance criteria

- [x] Warm get_steering calls reuse a per-worker cached snapshot instead of rereading/reparsing authoritative steering Markdown, skill catalog JSON, and the effective core manifest.
- [x] Runtime/request identity remains assembled fresh and is never stored in the snapshot cache.
- [x] Cache invalidates when bundled/user steering files are added, removed, or changed.
- [x] Cache invalidates when the manifest overlay or generated core manifest changes.
- [x] Cache follows the current skill-catalog precedence and invalidates for components/installed-skills.json, legacy home skills/skills.json, bundled packages/os/skills/skills.json, and referenced/custom skill.json metadata.
- [x] refresh_steering with an accepted reason bypasses/repopulates the snapshot cache without weakening the existing loop/rate guard.
- [x] Failed snapshot builds are never cached; the next call can recover.
- [x] Cache entries are isolated by runtime home + visible user steering root + package root.
- [x] Existing tools.search cache behavior and public MCP tools/list are unchanged.
- [x] Existing steering/security/skills behavior remains green.

## plan

1. Add focused red coverage proving repeated full steering currently rereads authoritative sources.
2. Add regression coverage for skills.json/current installed-skill precedence, custom skill metadata, overlay invalidation, visible steering changes, refresh bypass, failed-build recovery, and cache-key isolation.
3. Implement one per-worker in-memory steering snapshot cache keyed by cheap authoritative-source metadata fingerprints (nanosecond mtime/ctime + inode + size, plus relevant directory membership).
4. Keep runtime identity/request context outside the cached snapshot and make refresh_steering force an authoritative rebuild.
5. Run focused steering tests, related manifest/skill tests, typecheck/static checks, strict review, and full verify before publish.

## Test-first contract

- Behavior being proven: two full getSteering() calls with unchanged authoritative inputs produce the same logical steering while the second call performs zero readFileSync reads of the cached steering/catalog/manifest sources.
- Red failure expected before production edits: the second getSteering() rereads bundled/user steering, skill catalog JSON, and/or generated manifest files.
- Regression matrix: installed-skills.json selection takes precedence; legacy/bundled skills.json fallback remains correct; custom skill.json edits invalidate; manifest overlay edits invalidate; user steering edits invalidate; forced refresh rereads unchanged sources; failed build is not cached; distinct homes/user roots never share a snapshot.
- Safety preflight: the target steering test contains none of the prohibited destructive command literals; its filesystem cleanup is limited to mkdtemp-created temp directories.

## current status

- Implementation complete and strict review clean.
- Warm steering calls reuse a bounded per-worker snapshot while runtime identity remains dynamic.
- Active skills catalog precedence is preserved: installed-skills.json -> legacy home skills/skills.json -> bundled packages/os/skills/skills.json, including referenced custom skill.json metadata and manifest overlay invalidation.
- refresh_steering forces an authoritative rebuild; failed builds are never cached.
- Targeted regressions are green: 15 steering + 2 overlay + 5 skill-selection + 29 steering/registry/manifest tests = 51 passing tests.
- Correct syntax checker and git diff --check pass; strict review reports 0 blocking findings.
- Full verify passed with `publishValid: true`; ready to publish.

## files changed

- `packages/os/scripts/lib/steering-snapshot-cache.ts` — bounded per-worker dependency-fingerprinted steering snapshot cache.
- `packages/os/scripts/lib/steering-skills.ts` — exposes exact active skill-catalog file dependencies to the snapshot tracker without changing catalog semantics.
- `packages/os/scripts/os.ts` — keeps runtime identity dynamic, reads cached derived snapshot, and forces rebuild on accepted refresh_steering.
- `packages/os/tests/os-get-steering-trace.test.ts` — TDD and invalidation/isolation/recovery regressions.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-12 00:48:20 `verify`: full safety gate passed — `publishValid: true`, 0 blocking findings, 0 DB risks.
- 2026-08-12 targeted regression: 51 tests passed across steering, manifest overlay, skill selection, steering sources, skills registry, and tool manifest.
- 2026-08-12 syntax/static: `node scripts/check-syntax.js` passed from `packages/os`; `git diff --check` passed.
- 2026-08-12 00:46:36 `review.run`: passed — OK
- 2026-08-12 00:47:40 `review.run`: passed — OK
- 2026-08-12 00:48:20 `verify`: passed — OK

## key decisions

- Cache only the derived steering snapshot; keep runtime identity/request context dynamic.
- Use per-worker memory only. Correctness never depends on cache persistence or sharing.
- Fingerprint authoritative sources with nanosecond stat identity and directory membership; avoid content rereads on warm calls.
- Preserve current skill catalog precedence exactly; do not invent a second catalog.

## notes for ko

- The recently corrected active skill steering path is explicitly covered by the cache key. The cache follows the current installed-skill index first, legacy registry fallback second, bundled skills.json last, and tracks custom skill.json metadata plus overlay state.
- No cache was added around MCP tools/list or tools.search; those existing paths remain unchanged.

## documentation impact review

- `verify` surfaced a non-blocking skill-lifecycle documentation opportunity because `steering-skills.ts` changed. No public docs update is warranted in this PR: skill selection, precedence, install/remove behavior, metadata shape, and steering-visible output are unchanged. The only change to `steering-skills.ts` is an optional internal dependency callback used by the cache invalidation layer.

## improvements noticed

- task.start should accept/retain an explicit stream base more reliably; this task initially started from main despite the requested stream and needed a task-scoped merge repair.
- Large OS facade fan-out calls intermittently dropped the MCP connection during this task; smaller idempotent calls recovered. This Branch 7 change intentionally does not expand into transport/lifecycle debugging.

## issues and recovery

- Several larger OS facade calls returned intermittent MCP network errors. Mutating operations were never blindly replayed; state was inspected before any retry.
- task.start initially defaulted to main instead of stream/os. Two typed task.call merge attempts dropped the MCP connection before execution. After verifying the merge had not happened, used task-scoped code.call as the narrow Git fallback to merge origin/stream/os non-destructively. origin/stream/os is now an ancestor of HEAD.
- Tooling gap: no typed stream.mergeIntoTask operation exists; Branch 7 needed a task-scoped Git merge fallback to repair the startFrom mistake.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/lib/manifest-overlay.ts`
- `packages/os/scripts/lib/manifest.ts`
- `packages/os/scripts/lib/steering-skills.ts`
- `packages/os/scripts/lib/steering-snapshot-cache.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`
- `packages/os/tests/skill-selection-cli.test.ts`

## discovery

- Branch 7 scope: revision-keyed steering/effective-manifest caching only.
- Must preserve the current skills.json contribution to steering.
- Cache presence must never be required for correctness; request/auth/principal context stays dynamic.
- Initial task was accidentally bootstrapped from main; verify and reconcile latest stream/os before production edits.

- 2026-08-12 00:40:48 apply-patch: `packages/os/tests/os-get-steering-trace.test.ts`

- 2026-08-12 00:42:22 apply-patch: `packages/os/tests/os-get-steering-trace.test.ts`
- 2026-08-12 00:43:02 apply-patch: `packages/os/scripts/lib/steering-skills.ts`
- 2026-08-12 00:43:28 apply-patch: `packages/os/scripts/lib/steering-snapshot-cache.ts`

- 2026-08-12 00:43:57 apply-patch: `packages/os/scripts/os.ts`

- 2026-08-12 00:44:42 apply-patch: `packages/os/tests/os-get-steering-trace.test.ts`

- 2026-08-12 00:47:21 apply-patch: `packages/os/scripts/lib/steering-snapshot-cache.ts`
