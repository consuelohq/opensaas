# Cover private computer script aliases and legacy runner names

branch: `task/os-computer-use/cover-private-computer-script-aliases-and-legacy-runner-names`
stream: `stream/os-computer-use`
pr: https://github.com/consuelohq/opensaas/pull/2822
started: 2026-11-18

## acceptance criteria

- [x] Trace privacy covers canonical tools and their script aliases. The legacy runner recognizes codex.exe. Senior Engineer mirrors document the Linux ARM64 prerequisite.

## plan

1. Red-test the raw alias and legacy runner cases, align privacy classification and bundled skill copies, verify, publish and resolve the review.

## files changed

- Shared redaction, provider detection, trace and runner regression tests, Senior Engineer skill and its mirrors.

## key decisions

- Limit alias normalization to the privacy-sensitive bundled implementations.

## notes for ko

- Preserves ordinary nonprivate traces and existing macOS behavior.

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
- Behavior under test: supported script aliases receive the same UI redaction in nested batches and composed calls. Legacy codex.exe launches have sanitized logs. Linux ARM64 setup guidance matches runtime behavior.
- Existing local pattern: Trace persistence spies and a real detached child process.
- New or changed tests: private aliases including nested batches and legacy Windows executable basename without provider metadata.
- Focused red command: cd packages/os && bun x vitest run tests/computer-use-trace.test.ts tests/computer-use-log.test.ts
- Observed red: all four new cases exposed the marker before correction. Green: 62 focused tests passed across adapter, Trace, durable logs, and manifest. The 4 Senior Engineer copies now describe the ARM64 exception.
- No-test waiver: not applicable.

- 2026-11-18 23:45:01 append: `.task/os-computer-use/cover-private-computer-script-aliases-and-legacy-runner-names/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-18 23:45:01 fs.write: `.task/os-computer-use/cover-private-computer-script-aliases-and-legacy-runner-names/workpad.md`

## workspace-owned: validation evidence

- 2026-11-18 23:45:59 `review.run`: passed — OK
- 2026-11-18 23:48:04 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/definitely-missing.json`
