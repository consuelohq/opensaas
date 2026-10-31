# Resolve DEV-1658 rep-workflow review findings before shipping

branch: `task/dialer/resolve-dev-1658-rep-workflow-review-findings-before-shipping`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2736
started: 2026-10-31

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/lead-connector/src/embed/controller.test.ts`
- `packages/lead-connector/src/embed/rep-workflows.test.ts`
- `packages/lead-connector/src/embed/script-presentation.test.ts`
- `packages/lead-connector/src/embed/workspace-recovery.test.ts`
- `packages/lead-connector/src/embed/workspace-recovery.ts`

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
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract — DEV-1658 CodeRabbit release blockers (2026-10-31)

Behavior under test: (1) pending browser offers reject on renewal exhaustion while preserving connected calls; (2) transient renewal failures preserve the last valid token while genuine expiry clears it; (3) per-rep preferences restore only on the first idle repaint, not during live calls; (4) undefined manual script choice stays empty; (5) idle iframe switches cleanly between trusted locations without carrying stale context; (6) script cues never exceed 200 UTF-16 units including spaces and oversized tokens; (7) short-lived sessions start renewal early enough for up to three 8-second response deadlines; (8) typing a phone number resolves to a matching contact even beyond the first seven results.
Existing local pattern: controller.test.ts, click-to-call-runtime.test.ts, rep-workflows.test.ts, session-renewal.test.ts, script-presentation.test.ts, plus small pure helpers for tested internal-main behaviors.
New or changed tests: add explicit regression cases in those files, including a focused tested preference/script selection helper if needed.
Focused red command: bun test src/embed/controller.test.ts src/embed/click-to-call-runtime.test.ts src/embed/rep-workflows.test.ts src/embed/session-renewal.test.ts src/embed/script-presentation.test.ts
Expected red failure: at least one regression assertion fails in each affected behavior against the current stream HEAD 2e67039e1b36a8cb7d29776cd576f492729bdc9c.
No-test waiver: not applicable; all behavior bugs require regression coverage.
Shipping constraint: only source/test changes in packages/lead-connector; no live carrier action, backend deploy, Stripe mutation or repo-wide changes. Fix CodeRabbit findings before PR2733 merge, then verify, publish, merge, deploy source exact to Calls Worker, safe signed-in smoke, update Linear.

- 2026-10-31 05:18:43 append: `.task/dialer/resolve-dev-1658-rep-workflow-review-findings-before-shipping/workpad.md`

## workspace-owned: files changed

- `packages/lead-connector/src/embed/controller.test.ts`
- `packages/lead-connector/src/embed/rep-workflows.test.ts`
- `packages/lead-connector/src/embed/script-presentation.test.ts`
- `packages/lead-connector/src/embed/workspace-recovery.test.ts`
- `packages/lead-connector/src/embed/workspace-recovery.ts`

## workspace-owned: activity log

- 2026-10-31 05:18:43 fs.write: `.task/dialer/resolve-dev-1658-rep-workflow-review-findings-before-shipping/workpad.md`
- 2026-10-31 05:19:53 append: `packages/lead-connector/src/embed/script-presentation.test.ts`
- 2026-10-31 05:19:53 append: `packages/lead-connector/src/embed/session-renewal.test.ts`
- 2026-10-31 05:19:53 append: `packages/lead-connector/src/embed/controller.test.ts`
- 2026-10-31 05:19:53 append: `packages/lead-connector/src/embed/click-to-call-runtime.test.ts`
- 2026-10-31 05:19:53 fs.write: `packages/lead-connector/src/embed/script-presentation.test.ts`
- 2026-10-31 05:19:53 append: `packages/lead-connector/src/embed/rep-workflows.test.ts`
- 2026-10-31 05:19:53 fs.write: `packages/lead-connector/src/embed/click-to-call-runtime.test.ts`
- 2026-10-31 05:19:53 fs.write: `packages/lead-connector/src/embed/rep-workflows.test.ts`
- 2026-10-31 05:19:54 write: `packages/lead-connector/src/embed/workspace-recovery.test.ts`
- 2026-10-31 05:19:54 fs.write: `packages/lead-connector/src/embed/workspace-recovery.test.ts`
- 2026-10-31 05:20:28 write: `packages/lead-connector/src/embed/workspace-recovery.ts`
- 2026-10-31 05:20:28 fs.write: `packages/lead-connector/src/embed/workspace-recovery.ts`
- 2026-10-31 05:23:22 fs.write: `.task/dialer/resolve-dev-1658-rep-workflow-review-findings-before-shipping/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 05:22:12 `review.run`: passed — OK
- 2026-10-31 05:22:26 `review.run`: passed — OK
- 2026-10-31 05:22:38 `verify`: failed — COMMAND_FAILED
- 2026-10-31 05:23:06 `review.run`: passed — OK
- 2026-10-31 05:23:15 `verify`: passed — OK

## DEV-1658 review remediation and validation (2026-10-31)

- Read CodeRabbit PR #2733 at original stream head 2e67039e1b36a8cb7d29776cd576f492729bdc9c: 8 inline actionable findings (4 major, 4 minor); separately 1 pre-existing nonblocking stale-search follow-up (not changed in this release).
- TDD RED: focused tests reported 7 failing assertions plus 1 missing module, confirming token preservation, pending invite cleanup, tenant iframe reset, short-TTL renewal, cue bounds, contact identity and preference/script helpers.
- TDD GREEN: 62/62 focused tests passed, 252 assertions. Full package via exact repo registry `bun test packages/lead-connector/src`: 239/239 passed, 1811 assertions. Typecheck `bun run typecheck`: pass. Build `bun run build` (TypeScript + browser embed): pass.
- Reproduced an initial registry failure from matching contact-key versus phone-key prefixes; corrected using the already normalized phone suffix, reran exact registry suite green.
- `review.run` strict, base origin/stream/dialer: 0 blocking issues. `verify` full, base origin/stream/dialer: passed=true, publishValid=true, stamp written.
- Changed source only in packages/lead-connector and scoped task metadata. No live calls, readiness changes, payments, backend deployment, migrations, or production changes during fix.
- Review-only follow-up: older asynchronous contact-search responses can overtake newer queries (pre-existing at original main aa4fa55f52); assess separately if required, rather than expanding this shipping change.

- 2026-10-31 05:23:22 append: `.task/dialer/resolve-dev-1658-rep-workflow-review-findings-before-shipping/workpad.md`
