# Persist live Dialer landing redesign to main without billing changes

branch: `task/website/persist-live-dialer-landing-redesign-to-main-without-billing-changes`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2780
started: 2026-11-06

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
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## Main-source synchronization (approved production-only website release)
Goal: persist the already-reviewed and already-live Dialer website redesign into `main`, bypassing conflicting stream/website PR #2683, which contains unrelated server/Stripe billing work. Do NOT merge that stream; do NOT edit checkout runtime or dialer-server. This is a source-control recovery of a previously fully verified diff, not an additional website feature implementation.

## Acceptance criteria
1. Apply only the exact verified site-package delta from source commit `9d5b0f5570e72e161ea0bb377e26327a915f44a5` relative to its parent `eab73bf83474cd1bb60a28aecdc8678dbc87b382` to a main-derived isolated worktree. No task metadata or unrelated stream commits. Preserve any `main`-only changes including `scripts/test-pricing-browser.mjs`.
2. New PR targets `main` directly; diff only `packages/dialer-website` and metadata, no `packages/dialer-server` or Stripe code.
3. Test/build/review/verify, merge exact reviewed PR only if checks and constraints pass. Existing Cloudflare Pages live deployment already manually verified; CI website-only path may re-run, but do not trigger any dialer-server or OS deploy.

## Test-first contract
- Behavior under test: exact source synchronization of a previously tested and shipped website-only patch; no feature behavior changes from the already tested commit.
- Existing local pattern: landing-conversion.test.ts, marketing-contract.test.ts, test-marketing-browser.mjs, Astro production build from verified parent task.
- New/changed tests: carry over the existing five regressions in the patch unchanged; no new functional code or features in this recovery.
- Focused RED: the original task already ran `bun test packages/dialer-website/tests/landing-conversion.test.ts` before changes and got expected failures (see published original task workpad), then green (5/5), full package tests 43/43, full 8-viewport browser suite, strict review and formal verify. An additional red is unnecessary and would duplicate the existing verified coverage.
- No-test waiver: N/A, source-only cherry-pick includes tests; run tests and verify in main-derived task.

## Plan
1. Confirm new worktree HEAD originates at main and exact original patch is limited to the site package.
2. Check patch applies cleanly without touching other main changes; apply under managed task branch.
3. Run green tests, production build, strict review, verify; publish.
4. Retarget resulting task PR #2780 to main (not stream); assess checks, merge only this PR, verify current Cloudflare website remains live.

## Existing approved evidence
- Original task #2779 was reviewed (zero blockers), verified publish-valid, merged to stream, and released as scoped Wrangler Pages deployment `d72e4283` to `consuelohq.com`.
- `stream/website` PR #2683 is CONFLICTING and includes old dialer-server billing work; it must NOT be merged or used for production release.
- Source comparison to original parent: only `packages/dialer-website/scripts/test-pricing-browser.mjs` differs between `main` and the original stream baseline, and it was *not* changed by the verified UI patch. Preserve main version.

- 2026-11-06 05:05:17 append: `.task/website/persist-live-dialer-landing-redesign-to-main-without-billing-changes/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-06 05:05:17 fs.write: `.task/website/persist-live-dialer-landing-redesign-to-main-without-billing-changes/workpad.md`
- 2026-11-06 05:05:48 fs.write: `.task/website/persist-live-dialer-landing-redesign-to-main-without-billing-changes/workpad.md`
- 2026-11-06 05:07:00 fs.write: `.task/website/persist-live-dialer-landing-redesign-to-main-without-billing-changes/workpad.md`

## Source sync evidence
- Fresh task created `startFrom=main` PR #2780 (main-derived bootstrap c2fe7b5e5d).
- Derived exact binary-capable diff from earlier tested website-only commit (`eab73bf`..`9d5b0f`) limited to `packages/dialer-website` (20 files, 57,102 patch bytes). `git apply --check` passed, then `git apply` succeeded. No dialer-server or Stripe changes, no change to main-specific `scripts/test-pricing-browser.mjs`.
- Pinned dependency install succeeded; production build 10 routes, Astro 0 errors/0 warnings/7 hints; unit/contract tests 43/43, 306 assertions green; `git diff origin/main -- packages/dialer-server` is empty.
- Current live Cloudflare Pages URL already serves matching markup and 301 old route; don't redeploy without need.

- 2026-11-06 05:05:47 append: `.task/website/persist-live-dialer-landing-redesign-to-main-without-billing-changes/workpad.md`

## workspace-owned: validation evidence

- 2026-11-06 05:06:20 `review.run`: passed — OK
- 2026-11-06 05:06:25 `review.run`: passed — OK
- 2026-11-06 05:07:37 `verify`: passed — OK

## Verification wait checkpoint
- Wait reason: full managed verification run already active; must not create duplicate verification workers.
- Duration: 15 seconds, one bounded cycle.
- Resume action: call `verify` on `tsk_45726914266c` with `base: origin/main` immediately after timer.
- Expected signal: `passed=true`, `publishValid=true`, verification stamp written.
- Fallback: if still VERIFY_PENDING, inspect worker process and continue bounded polling; if failed, stop release and fix attributable failures.

- 2026-11-06 05:07:00 append: `.task/website/persist-live-dialer-landing-redesign-to-main-without-billing-changes/workpad.md`
