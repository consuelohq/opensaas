# Complete pending browser confirmations in their named session

branch: `task/os-computer-use/complete-pending-browser-confirmations-in-their-named-session`
stream: `stream/os-computer-use`
pr: https://github.com/consuelohq/opensaas/pull/2821
started: 2026-11-18

## acceptance criteria

- [x] Confirm only the matching, unconsumed decision in its originating browser session after explicit operator approval. Denial cancels the action. Report the actual result of replay.

## plan

1. Verify upstream confirm and deny semantics, capture regressions, implement session-bound decisions, and verify with a live fixture.

## files changed

- Computer-use schema, adapter, tests, generated signatures and public reference.

## key decisions

- The pinned native provider ignores the supplied decision ID. Enforce session-bound single-use decisions in the facade before invoking it.

## notes for ko

- Operator confirmation is requested for each policy-gated action and the continuation uses the same named session.

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os-computer-use): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract
- Behavior under test: accept a browser policy decision in its named session only. Confirmation needs explicit operator authorization, denial cancels the parked action.
- Existing local pattern: ComputerUseInput validation, stable provider session binding, and OS approved mutation contract.
- New or changed tests: schema validation, allowlisted commands and named-session binding, plus a live Dia approval round trip with a local fixture.
- Focused red command: cd packages/os && bun x vitest run tests/computer-use.test.ts -t 'browser decision'
- Observed red: action enum rejected the decision. All 27 adapter tests passed after implementation. A real headless Dia test denied a fill, rejected a used ID and an ID from another session, and delivered the authorized click exactly once to a local server.
- No-test waiver: not applicable.

- 2026-11-18 23:38:49 append: `.task/os-computer-use/complete-pending-browser-confirmations-in-their-named-session/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-18 23:38:49 fs.write: `.task/os-computer-use/complete-pending-browser-confirmations-in-their-named-session/workpad.md`

## workspace-owned: validation evidence

- 2026-11-18 23:42:04 `review.run`: passed — OK
- 2026-11-18 23:42:08 `review.run`: passed — OK
- 2026-11-18 23:42:22 `review.run`: passed — OK
- 2026-11-18 23:43:58 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/definitely-missing.json`
