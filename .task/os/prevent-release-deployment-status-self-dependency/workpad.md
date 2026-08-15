# prevent release deployment status self-dependency

branch: `task/os/prevent-release-deployment-status-self-dependency`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1732/prevent-release-deployment-status-self-dependency
github pr: https://github.com/consuelohq/opensaas/pull/1732
started: 2026-07-29

## acceptance criteria

- [x] GitHub Deployment creation sends `auto_merge=false` and an explicitly empty `required_contexts` array so the in-progress publication job cannot gate itself.
- [x] Existing workflow and signed release gates remain unchanged; only the redundant Deployment API status-context default is disabled.
- [x] A focused regression test fails before the implementation change and passes afterward.
- [x] Provider retry/idempotency coverage proves a partial attempt can resume without replacing immutable bytes.
- [x] Focused distribution tests, strict review, and the task verification gate pass before promotion.
- [ ] The fix is merged through `stream/os` to `main`, and exact-main publication completes successfully.

## plan

1. Reproduce the exact GitHub 409 and map provider write ordering/retry behavior.
2. Change the deployment command contract test first and record the focused red result.
3. Send an explicit empty `required_contexts` array in the Deployment API request.
4. Run focused provider/release tests, strict review, and verification.
5. Promote task to stream, gate exact head, merge to main, and monitor exact-main publication.

## current status

- Implementation and local validation are complete; the task is ready for promotion. Exact-main run `30437242653` reached the provider mutation after signature verification, then GitHub returned HTTP 409 because the default `required_contexts` included the in-progress publication job.

## files changed

- `packages/os/scripts/lib/distribution/release-channel-provider.ts`
- `packages/os/tests/distribution/release-channel-provider-retries.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- RED: `bun test tests/distribution/release-channel-provider-retries.test.ts` — 9 passed, 1 failed at the new `required_contexts[]` assertion.
- GREEN: the same focused file — 11 passed, 0 failed, 30 expectations after the implementation and retry regression.
- GREEN: `bun test tests/distribution` — 81 passed, 7 existing todo, 0 failed, 421 expectations.
- GREEN: `bun run typecheck` — workspace script syntax checks passed.
- GREEN: strict workspace review — 0 task issues, 0 pre-existing issues, 0 blockers.
- GREEN: workspace `verify` — publish-valid stamp; package registry test and database guard passed.
- GitHub CLI contract: `gh api --help` documents `key[]` without a value as an empty array; the request uses typed `-F` for both booleans and arrays.
- Root Prettier check reports both touched files, but an attempted formatter run rewrote the full legacy files; that formatting-only noise was removed, leaving a bounded 44-line insertion/1-line replacement diff for review.
- 2026-07-29 09:24:17 `review.run`: passed — OK
- 2026-07-29 09:24:34 `verify`: passed — OK
- 2026-07-29 09:25:02 `verify`: passed — OK

## key decisions

- Preserve `auto_merge=false` and explicitly pass an empty `required_contexts` array. The workflow already owns the release gates and the Deployment API call executes inside the final gated job, so inheriting all commit contexts creates a circular dependency rather than an additional security boundary.
- Keep the existing operation ordering and identity-based deployment lookup. Immutable GitHub/R2 writes are digest-checked, and a failed deployment creation leaves no matching deployment; a retry resumes safely.

## notes for ko

- This is a GitHub Deployment request-shape defect, not a Cloudflare credential or Caddy failure.

## improvements noticed

- none yet

## issues and recovery

- Exact-main publication attempt 2 failed only at `create GitHub Deployment consuelo-os-dev` with `required_contexts` invalid because `Publish immutable release and dev pointer` was still `in_progress`.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-29 09:18:58 apply-patch: `.task/os/prevent-release-deployment-status-self-dependency/workpad.md`
- 2026-07-29 09:19:09 apply-patch: `packages/os/tests/distribution/release-channel-provider-retries.test.ts`
- 2026-07-29 09:19:45 apply-patch: `packages/os/scripts/lib/distribution/release-channel-provider.ts`
- 2026-07-29 09:19:46 apply-patch: `packages/os/tests/distribution/release-channel-provider-retries.test.ts`
- 2026-07-29 09:20:34 apply-patch: `packages/os/tests/distribution/release-channel-provider-retries.test.ts`
- 2026-07-29 09:22:41 apply-patch: `packages/os/scripts/lib/distribution/release-channel-provider.ts`
- 2026-07-29 09:22:41 apply-patch: `packages/os/tests/distribution/release-channel-provider-retries.test.ts`

- 2026-07-29 09:23:31 apply-patch: `.task/os/prevent-release-deployment-status-self-dependency/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/prevent-release-deployment-status-self-dependency/current.json`, `.task/os/prevent-release-deployment-status-self-dependency/session.json`, `.task/os/prevent-release-deployment-status-self-dependency/verify.json`, `.task/os/prevent-release-deployment-status-self-dependency/workpad.md`, `.task/tasks/os/prevent-release-deployment-status-self-dependency.json`, `packages/os/scripts/lib/distribution/release-channel-provider.ts`, `packages/os/tests/distribution/release-channel-provider-retries.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none
