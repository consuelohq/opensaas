# stabilize stream os for main merge

branch: `task/os/stabilize-stream-os-for-main-merge`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1863/stabilize-stream-os-for-main-merge
github pr: https://github.com/consuelohq/opensaas/pull/1863
started: 2026-08-12

## acceptance criteria

- [x] Triage every PR #1838 review comment posted against the current stream head at/after 2026-08-12 00:40 UTC and fix every still-valid Critical/Major finding plus safe contract/copy quick wins needed for a clean main merge.
- [x] Public docs keep the skill work from PR #1856 while removing stale Office destinations and correcting current bundled-skill routing/workflow copy.
- [x] Worker/gateway lifecycle fixes fail closed: bounded ports, bounded/recoverable worker restart behavior, health-route dependency overrides, graceful-drain failure exit, and realistic reload/connection timeout budgets.
- [x] Documentation-opportunity detection covers active `packages/os/tools/` sources and only advertises the check when it actually ran; both OS and workspace facade compactors preserve that distinction.
- [x] Focused regressions pass, strict workspace review reports no owned blockers, and full verify is publish-valid before promotion back to `stream/os`.

## plan

1. Read the Senior Engineer contract, docs source-of-truth instructions, current PR #1838 review comments, and affected source/tests.
2. Add focused red coverage for behavioral findings; use a no-test waiver only for copy-only bundled-skill wording.
3. Apply the smallest production/docs fixes that satisfy current-head findings without widening into unrelated stream debt.
4. Run focused tests, static/docs validation where touched, strict review, and full verify.
5. Publish the stabilization task to `stream/os`, re-check PR #1838 at its new head, then merge the stream to main when checks/reviews are clean enough to ship.

## current status

- Current-head PR #1838 review findings are implemented: skill prose is cleaned up, Office redirect targets are gone, rolling reload/replacement/drain/readiness behavior is bounded, gateway validation/timeouts are explicit, and review documentation-opportunity reporting now distinguishes executed from skipped scans.
- Focused OS/workspace/docs tests, docs validation, strict review, full verify, and a clean-copy Astro/Starlight production build pass. The task is ready to publish to `stream/os`.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-12 01:08:08 `review.run`: passed — OK
- 2026-08-12 01:08:22 `verify`: passed — OK
- Focused green: 50/50 OS lifecycle/security tests pass; OS facade documentation-opportunity regressions pass 2/2; workspace documentation-opportunity tests pass 6/6; workspace facade absent-field regression passes; Build docs pass 8/8 with 477 expectations; documentation validator passes across 121 selected pages. Trace: `trc_9ccad6a6fdc5`.
- Strict workspace review: 0 owned issues, 0 pre-existing issues, 0 blockers. Trace: `trc_c61ff90770ac`.
- Full task safety gate passed and reported `publishValid: true`. It emitted one non-blocking security documentation opportunity; the changed port validation and reverse-proxy timeout bounds are reliability hardening and do not alter the documented ingress/auth model, so no public security prose change is required. Trace: `trc_0db737c193de`.
- Direct docs build in the task worktree reproduced the known Astro/Vite dependency-symlink compile-metadata failure, trace `trc_105fc7c746b7`. A clean temporary package copy with its own frozen Bun install built successfully and rendered 124 HTML files including all bundled skill pages, trace `trc_823af29bf354`.
- 2026-08-12 01:10:15 `verify`: passed — OK

## key decisions

- Treat only current-head review comments as candidates; historical PR #1838 comments are not automatically reimplemented.
- Keep this task focused on merge readiness. Copy-only skill wording uses a no-test waiver plus docs validation; runtime findings get focused regression tests first.

## notes for ko

- The stream-sync probe found no merge conflict with main. Its verification failed only because the disposable sync worktree could not resolve the workspace `zod` dependency; other selected checks passed. This task validates in a real task worktree instead.

## improvements noticed

- none yet

## issues and recovery

- `stream.sync` currently rejects the facade-advertised `repo` argument; retrying without it succeeded and reported the stream already up to date. Recorded as tooling drift, not a product blocker.
- Running the broad OS facade suite while triaging current-head findings generated unrelated missing snapshot entries from pending facade drift. Both snapshot files were restored exactly from `origin/stream/os`; only the targeted documentation-opportunity facade regressions remain in this task.
- The task-worktree docs package symlinks `node_modules` to the main checkout, which triggers Starlight/Vite compile-metadata path confusion. Clean-copy build evidence verifies the actual documentation compiles without that worktree-only artifact.

## Test-first contract

- Behavior under test: current-head stream review findings remain fixed at the smallest contract layer: redirects never target removed Office routes; gateway ports are valid and transport waits are bounded; worker restart failure is bounded/backed off; drain failure terminates; readiness overrides remain composable; documentation review detection/reporting distinguishes `ran with zero findings` from `did not run` and recognizes `packages/os/tools/` changes.
- Existing local patterns: `packages/os/tests/security-gateway.test.ts`, `worker-pool-lifecycle.test.ts`, `health-readiness.test.ts`, `consuelo-reload.test.ts`, workspace/OS facade tests, and `review-documentation-opportunity.test.js`.
- New or changed tests: extend those focused suites only where a current finding is still valid; update Build docs redirect assertions for all remaining Office aliases.
- Focused red command: run only the touched OS/workspace/docs tests after test edits.
- Expected red failures: current implementation accepts an out-of-range gateway upstream port, can retry replacement forever, cannot safely accept partial health deps, may leave drain rejection unhandled, and review/docs compactors conflate an absent scan with an empty scan; legacy calendar-email aliases still target Office.
- No-test waiver: bundled skill prose/typo corrections are copy-only; validate via `packages/documentation` validator/build and surrounding docs contract tests instead of inventing content-only unit tests.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/documentation/README.md`
- `packages/documentation/src/content/docs/build/skills/bundled/branch.mdx`
- `packages/documentation/src/content/docs/build/skills/bundled/browser.mdx`
- `packages/documentation/src/content/docs/build/skills/bundled/index.mdx`
- `packages/documentation/src/content/docs/build/skills/bundled/research-ingest.mdx`
- `packages/documentation/src/content/docs/build/skills/bundled/task.mdx`
- `packages/documentation/src/lib/legacy-redirects.mjs`
- `packages/documentation/tests/build.test.ts`
- `packages/os/package.json`
- `packages/os/scripts/consuelo-reload.js`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/worker-pool.ts`
- `packages/os/scripts/server/main.ts`
- `packages/os/scripts/server/routes/health.ts`
- `packages/os/tests/consuelo-reload.test.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/health-readiness.test.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/os/tests/worker-pool-lifecycle.test.ts`
- `packages/os/tests/worker-pool-process.test.ts`
- `packages/os/vitest.config.ts`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/review-documentation.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/review-documentation-opportunity.test.js`

- 2026-08-12 01:09:52 apply-patch: `.task/os/stabilize-stream-os-for-main-merge/workpad.md`

- 2026-08-12 01:09:59 apply-patch: `.task/os/stabilize-stream-os-for-main-merge/workpad.md`
