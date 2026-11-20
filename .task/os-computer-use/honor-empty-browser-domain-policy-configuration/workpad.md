# Honor empty browser domain policy configuration

branch: `task/os-computer-use/honor-empty-browser-domain-policy-configuration`
stream: `stream/os-computer-use`
pr: https://github.com/consuelohq/opensaas/pull/2820
started: 2026-11-18

## acceptance criteria

- [x] Treat an empty, whitespace-only, or separator-only domain list as cleared using the provider's parsing semantics. Enforce any nonempty list before starting a persistent browser.

## plan

1. Confirm upstream parsing, reproduce the error, normalize the child environment once, test native navigation, and publish the review correction.

## files changed

- OS computer-use adapter and regression tests.

## key decisions

- Match the pinned Agent Browser parser, which ignores empty entries in comma-delimited domains.

## notes for ko

- Existing nonempty browser containment policies still fail before profile creation.

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
- Behavior under test: clearing AGENT_BROWSER_ALLOWED_DOMAINS restores background access with persistent profiles. A nonempty policy still fails before launch.
- Existing local pattern: isolated OS home and runComputerUse assertions in computer-use.test.ts.
- New or changed tests: explicit empty-policy case and existing nonempty-policy regression.
- Focused red command: cd packages/os && bun x vitest run tests/computer-use.test.ts -t 'empty domain policy'
- Observed red: all three cleared configurations returned INVALID_INPUT before lock acquisition. Green: 24 adapter tests passed, and the real OS facade opened Dia headlessly, entered text, delivered a click to the local server, and saved a screenshot with a separator-only policy.
- No-test waiver: not applicable.

- 2026-11-18 23:30:26 append: `.task/os-computer-use/honor-empty-browser-domain-policy-configuration/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-18 23:30:26 fs.write: `.task/os-computer-use/honor-empty-browser-domain-policy-configuration/workpad.md`

## workspace-owned: files read

- `packages/os/definitely-missing.json`

## workspace-owned: validation evidence

- 2026-11-18 23:32:02 `review.run`: passed — OK
- 2026-11-18 23:33:10 `verify`: passed — OK
