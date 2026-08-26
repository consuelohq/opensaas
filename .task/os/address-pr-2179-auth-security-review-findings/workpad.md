# Address PR 2179 auth security review findings

branch: `task/os/address-pr-2179-auth-security-review-findings`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2184/address-pr-2179-auth-security-review-findings
github pr: https://github.com/consuelohq/opensaas/pull/2184
started: 2026-08-26

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

- 2026-08-26 02:10:49 fs.write: `.task/os/address-pr-2179-auth-security-review-findings/workpad.md`
- 2026-08-26 02:18:38 fs.write: `.task/os/address-pr-2179-auth-security-review-findings/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 02:18:15 `review.run`: passed — OK

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: established workspaces are approved only from the current active membership snapshot; fallback uses the most recent verified membership; enrollment-reset failures preserve the standard nested API error envelope.
existing local pattern: node:test coverage in canonical-device-identity.test.ts, internal-dashboard-integration.test.ts, and internal-user-dashboard.test.ts.
new or changed tests: add revoked-established-membership coverage, unordered-membership freshness coverage, and nested enrollment-reset error parsing assertions; normalize changed test names.
focused red command: bun test packages/os/tests/canonical-device-identity.test.ts packages/os/tests/internal-dashboard-integration.test.ts packages/os/tests/internal-user-dashboard.test.ts
expected red failure: revoked cached memberships are currently accepted; unordered memberships can select stale verification; reset error bodies are currently flat.
no-test waiver: not applicable.

- 2026-08-26 02:10:49 append: `.task/os/address-pr-2179-auth-security-review-findings/workpad.md`

## Review resolution

- [x] CodeRabbit newest-membership ordering fixed with unordered regression coverage.
- [x] Codex established-membership finding fixed with a seven-day signed-verification ceiling; first claims retain the 15-minute ceiling.
- [x] Enrollment reset failures use the nested API error envelope and the dashboard displays error.message.
- [x] Changed review-target test names follow the should/when convention.

## Evidence

- Focused red: 4 expected failures across membership ordering, stale established membership, error envelope, and dashboard parsing.
- Focused green: 30 passed, 0 failed.
- Adjacent auth/security green: 58 passed, 0 failed, 369 assertions across seven files.
- Syntax: packages/os/scripts/check-syntax.js passed.
- Workspace review: 0 blocking issues, 0 findings, typecheck/eslint/static/spec checks passed.
- Full verify intentionally not repeated because prior attempts on this exact stream wedge the live supervisor; Ko explicitly authorized the release and focused safety gates are green.

- 2026-08-26 02:18:38 append: `.task/os/address-pr-2179-auth-security-review-findings/workpad.md`
