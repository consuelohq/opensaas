# fix diffs cache script parity inventory

branch: `task/os/fix-diffs-cache-script-parity-inventory`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2501
started: 2026-09-21

## acceptance criteria

- [x] The OS script-parity baseline includes every live OS script introduced on `stream/os`, including the Diffs local cache.
- [x] The existing script-parity audit reproduces the CI failure before the fixture change and passes after it.
- [x] Focused regression coverage passes; stream CI remains the authoritative full verification gate because local strict review incorrectly expanded into an unrelated repo-wide Twenty lint and exceeded the OS timeout.
- [ ] Promote the task into `stream/os`, rerun stream CI, then release PR #2499 to canary and update this node.

## plan

1. Reproduce the exact `@consuelo/os` package-test failure from stream CI.
2. Compare the live script inventory with the canonical parity classification fixture.
3. Add classifications only for the three missing OS-owned scripts.
4. Run the focused audit green, review/verify, promote to the stream, then resume the canary release.

## files changed

- `packages/os/tests/audit/fixtures/script-parity-classifications.json` — classify the three OS-only scripts missing from the canonical inventory.

## key decisions

- Treat all three missing files as intentional OS-owned runtime/browser helpers rather than workspace parity candidates: live trace cursor streaming, live trace inspector browser updates, and the node-local Diffs cache are OS runtime concerns.
- Fix the canonical classification fixture rather than weakening the audit. The audit correctly caught the inventory drift.

## notes for ko

- Stream PR #2499 was otherwise green enough to reach release gating, but both `Consuelo / verify` and `Consuelo / workspace contracts` failed on the same script-parity audit.
- Focused RED reproduced all three missing paths; focused GREEN now passes 1/1.
- Two strict-review attempts incorrectly expanded this one-fixture task into a full `packages/twenty-server` ESLint traversal. Both exceeded the OS timeout and their leftover process groups were terminated; this task does not modify Twenty. The stream CI rerun will provide the authoritative full gate before release.

## improvements noticed

- none yet

## errors i ran into

- A full `packages/os` package-test run exceeded the OS call timeout locally; the focused CI-failing audit completed in ~0.2s and is green. Full task verification remains the publish gate.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: every executable/script file under packages/os is represented by the script-parity classification inventory; the new Diffs local cache module must not make the audit inventory drift.
existing local pattern: `packages/os/tests/audit/script-parity-audit.test.ts` compares the classified script baseline to the live inventory and fails on unclassified additions/removals.
new or changed tests: no new test file needed; use the existing script-parity audit as the regression contract and update the canonical classification fixture/source for the new module.
focused red command: `cd packages/os && bun run test -- tests/audit/script-parity-audit.test.ts`
expected red failure: `assertClassificationsMatchInventory` reports `scripts/server/services/diffs-local-cache.ts` missing from the classified baseline/inventory match.
no-test waiver: not applicable.

- 2026-09-21 04:08:39 append: `.task/os/fix-diffs-cache-script-parity-inventory/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-21 04:08:39 fs.write: `.task/os/fix-diffs-cache-script-parity-inventory/workpad.md`

- 2026-09-21 04:09:43 apply-patch: `packages/os/tests/audit/fixtures/script-parity-classifications.json`

- 2026-09-21 04:11:47 apply-patch: `.task/os/fix-diffs-cache-script-parity-inventory/workpad.md`

## workspace-owned: validation evidence

- 2026-09-21 04:13:46 `review.run`: passed — OK
- 2026-09-21 04:13:46 `review.run`: passed — OK

- 2026-09-21 04:13:57 apply-patch: `.task/os/fix-diffs-cache-script-parity-inventory/workpad.md`