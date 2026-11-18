# Redact computer use events before subagent log writes

branch: `task/os-computer-use/redact-computer-use-events-before-subagent-log-writes`
stream: `stream/os-computer-use`
pr: https://github.com/consuelohq/opensaas/pull/2819
started: 2026-11-18

## acceptance criteria

- [x] Remove private structured MCP payloads before writing OS-managed foreground or durable Codex logs and summaries.
- [x] Withhold partial JSON, discard unclassifiable oversized/truncated records, and preserve live plain-text progress and final messages.
- [x] Exercise a real durable provider process and check both stdout.log and stderr.log.

## plan

1. Trace both persistence paths, reproduce the missing filter, exercise buffered and streaming writes, validate and publish.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- The OS-owned Codex log writer now classifies complete JSONL events before writing. A real spawned provider split its private event across writes, emitted an error and a final message, and only sanitized events reached either log.

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

behavior under test: redact computer-use tool arguments, errors and results before OS-owned subagent logs are written, for both foreground/buffered and durable streaming Codex launches. Preserve ordinary logs and usable final messages.
existing local pattern: Codex JSONL item events, bounded durable log files, and the computer-use privacy classifier.
new or changed tests: log redaction and durable runner regressions with synthetic private values, split chunks and final messages.
focused red command: cd packages/os && bun x vitest run tests/computer-use-log.test.ts
expected red failure: synthetic UI payloads reach stdout.log today.
no-test waiver: not applicable.

- 2026-11-18 23:21:11 append: `.task/os-computer-use/redact-computer-use-events-before-subagent-log-writes/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-18 23:21:11 fs.write: `.task/os-computer-use/redact-computer-use-events-before-subagent-log-writes/workpad.md`

## workspace-owned: validation evidence

- 2026-11-18 23:24:35 `review.run`: passed — OK
- 2026-11-18 23:26:14 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/definitely-missing.json`
