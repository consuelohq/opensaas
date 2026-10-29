# Repair Linux browser prerequisite for Dialer verification

branch: `task/website/repair-linux-browser-prerequisite-for-dialer-verification`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2658
started: 2026-10-29

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

## Scope

Follow-up to tsk_a6d011c41eb2 / task PR #2655, promoted to stream review #2651. The managed workflow removed the merged task branch; use this new task for the CI prerequisite fix instead of recreating a deleted branch. Own only the Dialer website browser executable selection, its README, and scoped cutover-plan evidence. Preserve recent CI improvements, the existing Dialer release classifier, all production domains, authentication, WAF and carrier state. Ko confirmed the main ChatGPT tool call succeeds before cutover. The root-login/homepage preference question remains pending.

## Test-first contract

behavior under test: the now-required browser contract executes in the actual Linux hosted CI environment without assuming a Playwright browser download, while retaining explicit executable overrides and local/bundled fallback behavior.
existing local pattern: Playwright browser harness already prefers installed macOS Chrome; use installed Linux Chrome/Chromium when available as well.
new or changed tests: existing real browser gate added in the preceding task; actual hosted Linux execution is the decisive regression proof. Preserve all assertions.
focused red command: Consuelo / verify on stream SHA 5837f9e9bc6cd7655bcf9edde66f30c67fa4662e, run 40809584033, job 123236540416.
expected red failure: browserType.launch: Executable does not exist at the runner's ms-playwright/chromium_headless_shell path. Confirmed in hosted logs; other suites and the clean Bun build passed.
no-test waiver: none. Full local verify of the fix passed at 2026-10-29T03:05:04.647Z in the predecessor checkout; verify this task, publish, then require actual Linux CI success before merge.

- 2026-10-29 03:10:50 append: `.task/website/repair-linux-browser-prerequisite-for-dialer-verification/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-29 03:10:50 fs.write: `.task/website/repair-linux-browser-prerequisite-for-dialer-verification/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 03:12:28 `review.run`: passed — OK
- 2026-10-29 03:12:28 `verify`: passed — OK
