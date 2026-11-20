# Protect computer use in Pi subagent event logs

branch: `task/os-computer-use/protect-computer-use-in-pi-subagent-event-logs`
stream: `stream/os-computer-use`
pr: https://github.com/consuelohq/opensaas/pull/2823
started: 2026-11-18

## acceptance criteria

- [x] Sanitize private Pi MCP events and comparable provider events before writing logs and building summaries. Retain normal final reports, usage and progress.

## plan

1. Reproduce using a fixture Pi process through the real OS facade, classify private tool records including partials and repeated messages, and verify before publication.

## files changed

- Provider log sanitizer, foreground/durable provider writers and regression tests.

## key decisions

- Filter structured tool data at persistence boundaries and retain the agent's final output.

## notes for ko

- Verified with synthetic content and an isolated OS home.

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
- Behavior under test: Pi JSON events and other structured provider tool records cannot persist private computer-use contents, including replayed contexts, deltas, errors and result-only messages. Preserve ordinary output and final messages.
- Existing local pattern: sanitized provider writer, compactSubagentOutput, facade tests with fake provider processes.
- New or changed tests: Pi real facade runner with MCP config and assertions on stdout/stderr, summary and final message. Common provider event regressions.
- Focused red command: cd packages/os && bun x vitest run tests/computer-use-log.test.ts
- Observed red: the fixture Pi process exposed the marker in stored JSON. Green: the production facade's log files, API response and summaries omitted it and retained the final message and usage. OpenCode tool parts and multiline Grok output were also exercised.
- No-test waiver: not applicable.

- 2026-11-18 23:50:17 append: `.task/os-computer-use/protect-computer-use-in-pi-subagent-event-logs/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-18 23:50:17 fs.write: `.task/os-computer-use/protect-computer-use-in-pi-subagent-event-logs/workpad.md`

## workspace-owned: validation evidence

- 2026-11-18 23:53:12 `review.run`: passed — OK
- 2026-11-18 23:54:32 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/definitely-missing.json`
