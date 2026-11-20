# Preserve privacy across composed computer use calls

branch: `task/os-computer-use/preserve-privacy-across-composed-computer-use-calls`
stream: `stream/os-computer-use`
pr: https://github.com/consuelohq/opensaas/pull/2818
started: 2026-11-18

## acceptance criteria

- [x] Preserve the browser operator output cap.
- [x] Mark private computer operations before execution and redact direct, code.run, batch and identified subagent trace payloads.
- [x] Keep the normal raw result for ordinary, classifiable code.run transcripts.

## plan

1. Verify the real composition entry points, reproduce parent trace leaks, apply the marker and run package and publication checks.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- Five focused assertions initially failed across parent Trace results and provider output caps, plus a separate subagent trace fixture. Operation metadata tracks computer use before dispatch so failed children also protect parent traces.

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

behavior under test: direct, batched and code.run-composed computer operations omit raw UI payloads from parent facade traces while ordinary code.run traces retain their content. Preserve the browser's operator output cap.
existing local pattern: code.run owns its operation ledger; facade logger already suppresses raw direct and nested batch payloads.
new or changed tests: computer-use-trace.test.ts and computer-use.test.ts, plus a composed call through the real facade.
focused red command: cd packages/os && bun x vitest run tests/computer-use.test.ts tests/computer-use-trace.test.ts
expected red failure: parent code.run traces include the raw computer result and child environments lose AGENT_BROWSER_MAX_OUTPUT.
no-test waiver: not applicable.

- 2026-11-18 23:08:13 append: `.task/os-computer-use/preserve-privacy-across-composed-computer-use-calls/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-18 23:08:13 fs.write: `.task/os-computer-use/preserve-privacy-across-composed-computer-use-calls/workpad.md`

## workspace-owned: validation evidence

- 2026-11-18 23:11:50 `review.run`: passed — OK
- 2026-11-18 23:14:31 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/definitely-missing.json`
