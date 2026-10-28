# managed cloud pricing and plans

branch: `task/os/managed-cloud-pricing-and-plans`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1877/managed-cloud-pricing-and-plans
github pr: https://github.com/consuelohq/opensaas/pull/1877
started: 2026-08-12

## acceptance criteria

- [x] Define five customer-facing managed cloud plans: Starter, Standard, Performance, Power, Max.
- [x] Public plan data exposes plan name, CPU/shared-CPU semantics, RAM, recommendation state, and supported region metadata, but never the provider machine type.
- [x] Keep provider machine-type mapping internal so the existing GCP provisioner can consume it later without leaking it into customer UI contracts.
- [x] Support the regions already provisionable by the current managed-cloud foundation: `us-east1`, `us-east4`, `us-central1`, `us-west1`, `europe-west1`.
- [x] Add a versioned GCP rate-card contract and deterministic monthly cost calculator using integer monetary units, not floating-point dollars.
- [x] Monthly fixed-cost calculation uses a 31-day/744-hour always-on ceiling so a flat monthly price is not under-costed in long months.
- [x] Cost model accounts separately for compute, boot/data disk, snapshots, NAT, variable-usage reserve, and platform/operations reserve through explicit rate/policy inputs.
- [x] Add configurable automatic gross-margin pricing using `price = landed_cost / (1 - target_margin)` with validation and deterministic upward rounding.
- [x] Separate internal cost/hosting metadata from the public quote DTO; public quotes expose the simple monthly customer price, CPU/RAM, region, and plan metadata only.
- [x] Pricing/rate-card versions and effective timestamps are retained so existing purchases can be pinned rather than silently changing when provider rates change.
- [x] No live GCP mutation, provisioning, node deployment, billing mutation, launcher UI, or runtime cutover in this task.
- [x] Existing managed-cloud provisioning tests remain green.

## plan

1. Add focused contract tests for plan visibility, region catalog, cost arithmetic, margin/rounding, versioning, and public/internal separation; run them red first.
2. Implement a small pricing-domain module beside the existing managed-cloud provisioning domain.
3. Keep provider rates injected/versioned so a later central pricing-sync service can source current Google Cloud Billing Catalog/Pricing API data without hardcoded retail prices.
4. Run focused pricing tests plus existing managed-cloud provisioning regressions.
5. Review/verify, reconcile the current `stream/os` tip, and publish only this task scope.

## Test-first contract

- Focused test file: `packages/os/tests/managed-cloud-pricing.test.ts`.
- Red condition: imports/plan catalog/quote functions do not exist before implementation.
- Required behaviors: five public plans; Standard recommended; machine type absent from public DTO; five currently provisionable regions; 744-hour fixed-cost math; exact gross-margin floor; configurable upward rounding; invalid margins/rates rejected; rate/pricing versions retained; public quote excludes provider/internal cost details.
- Existing regression gate: managed-cloud node instance/foundation/platform tests.

## discovery

- Current provisioner lives in `packages/os/scripts/lib/managed-cloud-node.ts` with GCP adapter/application service in `gcloud-managed-cloud-node.ts` and `platform-managed-cloud-node.ts`.
- Existing managed-cloud instance defaults to `e2-standard-2`, 30 GB `pd-balanced` boot disk, and 100 GB persistent `pd-balanced` data disk.
- Existing foundation supports exactly five regions via `SUBNET_CIDRS`: us-east1, us-east4, us-central1, us-west1, europe-west1.
- No existing OS pricing/margin module or Cloud Billing catalog client was found.
- Google Cloud exposes versionable public SKU/rate information through Cloud Billing APIs; this task defines the normalized rate-card boundary rather than coupling quote arithmetic to network availability.
- The earlier accidental `os-cloud` task/PR #1875 was closed and its local worktree/branch removed before production edits; this task is correctly based on `stream/os`.

## current status

- Pricing domain implementation is complete in this task.
- Five public plans and five currently supported regions are defined.
- Versioned GCP rate-card inputs, 744-hour monthly fixed-cost calculation, contingency/reserve handling, configurable target gross margin, deterministic upward rounding, and public/internal quote separation are implemented.
- No live GCP, billing, node, launcher, or runtime changes were made.
- Ready for strict review/verify and publication.

## files changed

- `packages/os/scripts/lib/managed-cloud-pricing.ts`
- `packages/os/tests/managed-cloud-pricing.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/managed-cloud-pricing.ts`
- `packages/os/tests/managed-cloud-pricing.test.ts`

## workspace-owned: activity log

- 2026-08-12 03:53:24 fs.write: `.task/os/managed-cloud-pricing-and-plans/workpad.md`
- 2026-08-12 03:54:11 fs.write: `packages/os/tests/managed-cloud-pricing.test.ts`
- 2026-08-12 03:54:22 fs.write: `.task/os/managed-cloud-pricing-and-plans/workpad.md`
- 2026-08-12 03:55:01 fs.write: `packages/os/scripts/lib/managed-cloud-pricing.ts`
- 2026-08-12 03:57:10 fs.write: `packages/os/tests/managed-cloud-pricing.test.ts`
- 2026-08-12 03:58:57 fs.write: `.task/os/managed-cloud-pricing-and-plans/workpad.md`
- Closed mistaken bootstrap PR #1875 and removed its local task worktree/branch.
- Corrected initial task routing from legacy `stream/os-cloud` to canonical `stream/os` before production edits.

## workspace-owned: validation evidence

- Test-first red: focused pricing suite failed before implementation because `managed-cloud-pricing` did not exist.
- Hardening red: provider/currency runtime-rejection test failed before validation was added.
- Focused + managed-cloud regression packet: 7 files, 35 tests passed from `packages/os`.
- `bun run typecheck` from `packages/os`: passed (`workspace script syntax checks passed`).
- Live Cloud Billing catalog probe was not used because local `gcloud` auth requires interactive reauthentication; the task intentionally keeps provider rate acquisition outside request-time quote calculation.
- 2026-08-12 03:58:27 `review.run`: passed — OK
- 2026-08-12 03:58:39 `verify`: passed — OK
- 2026-08-12 03:59:03 `verify`: passed — OK

## key decisions

- Flat monthly pricing is calculated against a 744-hour always-on fixed-cost ceiling; provider usage metering remains an implementation detail.
- Gross margin is configurable business policy, not hardcoded into the plan catalog.
- Provider machine types and provider cost breakdowns are internal-only; the public contract stays simple.
- Rate acquisition is separated from deterministic quote arithmetic so provider pricing can be refreshed centrally without making customer requests depend on a live billing API.

## notes for ko

- Customer UI will not show raw GCP machine types.
- This branch does not touch the live cloud node or Mac node.

## improvements noticed

- `task.start` area routing can still choose the legacy os-cloud stream when an `os-cloud` area is supplied; this task was restarted under `os` to converge on `stream/os`.

## issues and recovery

- Mistaken PR #1875: closed as superseded by #1877; no production edits were present.

---

## publish checklist

```bash
bun run task:push -- --message "feat(os): add managed cloud pricing plans" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-12 03:53:24 write: `.task/os/managed-cloud-pricing-and-plans/workpad.md`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/tests/managed-cloud-node-instance-contract.test.ts`

## test-first red evidence

- `bunx vitest run packages/os/tests/managed-cloud-pricing.test.ts` failed as expected before implementation: module `../scripts/lib/managed-cloud-pricing` did not exist. This is the focused red condition for the new pricing contract.

- 2026-08-12 03:54:22 append: `.task/os/managed-cloud-pricing-and-plans/workpad.md`

- 2026-08-12 03:55:01 write: `packages/os/scripts/lib/managed-cloud-pricing.ts`

- 2026-08-12 03:57:10 append: `packages/os/tests/managed-cloud-pricing.test.ts`

## final validation

- Strict `review.run` against `stream/os`: 2 production/test files reviewed, 0 issues, 0 blockers.
- Full `verify` against `stream/os`: passed, `publishValid: true`, 0 DB risks; verification stamp written.
- Final managed-cloud packet: 7 files, 35 tests passed.
- OS syntax/typecheck: passed.
- Whitespace/diff check on all newly authored files: passed.
- `stream/os` remained at the task's starting integration head during implementation (`ahead: 0`, `behind: 0` at final pre-publish context check), so no concurrent stream reconciliation was required before publish.

- 2026-08-12 03:58:57 append: `.task/os/managed-cloud-pricing-and-plans/workpad.md`
