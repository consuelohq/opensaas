# Add gog license attribution

branch: `task/os/add-gog-license-attribution`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2206/add-gog-license-attribution
github pr: https://github.com/consuelohq/opensaas/pull/2206
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

- 2026-08-26 05:42:02 fs.write: `.task/os/add-gog-license-attribution/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 05:44:30 `review.run`: passed — OK
- 2026-08-26 05:44:53 `verify`: passed — OK

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

behavior under test:
- Every Consuelo-managed `gog` installation reconciles an accompanying copy of the upstream v0.38.1 MIT license notice, including when the binary is already current.

existing local pattern:
- `packages/os/scripts/lib/managed-gog.ts` owns the pinned release, download verification, and managed runtime filesystem layout.
- Managed-runtime metadata should reconcile idempotently in the same Consuelo-owned home rather than depending on external package-manager notices.

new or changed tests:
- Extend `packages/os/tests/managed-gog.test.ts` to assert the canonical license path/content and idempotent notice reconciliation.

focused red command:
- `bun --cwd packages/os test tests/managed-gog.test.ts`

expected red failure:
- Missing managed gog license notice/path/reconciliation exports.

no-test waiver: not applicable.

## current status

- Test-first RED reproduced the missing attribution reconciliation.
- GREEN: `bun --cwd packages/os test tests/managed-gog.test.ts` passes 5/5 tests.
- Strict review passes with 0 blocking findings and 0 documentation opportunities.
- Full verify passes with `publishValid: true` against `origin/stream/os`.
- Implementation writes the exact upstream v0.38.1 MIT notice to `<Consuelo home>/licenses/gogcli-MIT.txt`, including when the managed binary is already current.

- 2026-08-26 05:42:02 append: `.task/os/add-gog-license-attribution/workpad.md`

## workspace-owned: files read

- `packages/os/tests/managed-gog.test.ts`

- 2026-08-26 05:42:33 apply-patch: `packages/os/tests/managed-gog.test.ts`
- 2026-08-26 05:42:56 apply-patch: `packages/os/scripts/lib/managed-gog.ts`

- 2026-08-26 05:45:03 apply-patch: `.task/os/add-gog-license-attribution/workpad.md`