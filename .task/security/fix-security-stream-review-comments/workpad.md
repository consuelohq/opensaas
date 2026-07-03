# fix security stream review comments

branch: `task/security/fix-security-stream-review-comments`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1339/fix-security-stream-review-comments
github pr: https://github.com/consuelohq/opensaas/pull/1339
started: 2026-07-02

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-02 20:04:33 `review.run`: passed — OK
- 2026-07-02 20:06:13 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/install.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/workspace/scripts/pr-review.js`
- `packages/workspace/tests/review-run-state.test.js`

## workspace-owned: test selection

- changed files: `.task/security/fix-security-stream-review-comments/current.json`, `.task/security/fix-security-stream-review-comments/evidence-log.json`, `.task/security/fix-security-stream-review-comments/read-log.json`, `.task/security/fix-security-stream-review-comments/session.json`, `.task/security/fix-security-stream-review-comments/workpad.md`, `.task/tasks/security/fix-security-stream-review-comments.json`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/tests/consuelo-home-config.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/install-workspace-bootstrap-contract.test.ts`, `packages/workspace/scripts/pr-review.js`, `packages/workspace/tests/pr-review.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
