# address CodeRabbit Diffs review findings

branch: `task/workspace-agents/address-coderabbit-diffs-review-findings`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1886/address-coderabbit-diffs-review-findings
github pr: https://github.com/consuelohq/opensaas/pull/1886
started: 2026-08-12

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

- 2026-08-12 05:02:23 fs.write: `.task/workspace-agents/address-coderabbit-diffs-review-findings/workpad.md`
- 2026-08-12 05:04:58 fs.write: `.task/workspace-agents/address-coderabbit-diffs-review-findings/workpad.md`
- 2026-08-12 05:06:37 fs.write: `.task/workspace-agents/address-coderabbit-diffs-review-findings/workpad.md`
- 2026-08-12 05:07:32 fs.write: `.task/workspace-agents/address-coderabbit-diffs-review-findings/workpad.md`

## workspace-owned: validation evidence

- 2026-08-12 05:07:12 `review.run`: passed — OK
- 2026-08-12 05:07:24 `verify`: passed — OK

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## discovery

- Follow-up to CodeRabbit review on stream PR #1879. CodeRabbit completed with 8 inline actionable comments across Diffs/configuration gateway code and one outside-diff note in the review body.
- Scope: fix owned review findings only, preserve the already-green Diffs behavior and current-main route safety, rerun focused tests + strict review + full verify, merge back to `stream/workspace-agents`, then re-review #1879 before main merge.
- Installed Consuelo OS must remain untouched: no update, restart, deploy, release-channel change, or production activation.

- 2026-08-12 05:02:23 append: `.task/workspace-agents/address-coderabbit-diffs-review-findings/workpad.md`

## workspace-owned: files read

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- `packages/os/scripts/lib/settings-sites-gateway-endpoints.ts`
- `packages/os/scripts/lib/source-control-config.ts`
- `packages/os/scripts/server/routes/diffs.ts`
- `packages/os/scripts/server/routes/settings.ts`
- `packages/os/scripts/server/services/diffs-gateway.ts`
- `packages/os/tests/diffs-hono-routes.test.ts`
- `packages/os/tests/settings-sites-gateway-endpoints.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

## Test-first contract

- Behavior under test: close all still-valid CodeRabbit findings on stream PR #1879 without changing installed Consuelo OS state.
- Public configuration errors must never echo raw validation/internal path text; stored-config read failures return a generic unavailable error and client write validation returns a generic invalid-configuration error.
- Diffs machine signatures must bind `pathname + search`; changing query parameters after signing must fail authentication.
- Nested tree/history UI routes must use a named trailing-path parameter and preserve the full repository-relative path.
- Source-control repositories missing a connection must report `SOURCE_CONTROL_CONNECTION_REQUIRED` (409), not repository-not-configured (404).
- Diffs read cache must have a fixed upper bound and prune expired/old entries; GitHub mutation requests must carry an abort timeout.
- Settings source-control POST body reads must occur inside the route error boundary.
- Workspace-edge integration fixture must model `/diffs` as authenticated gateway-backed, not a public snapshot.
- Command-palette copy must describe the configured main code location rather than a fixed `packages` directory.
- Focused RED packet: new/updated Diffs, settings-gateway, workspace-edge integration, and diff-cockpit review contracts must fail against the current stream implementation before production edits.

- 2026-08-12 05:04:58 append: `.task/workspace-agents/address-coderabbit-diffs-review-findings/workpad.md`

## GREEN evidence — CodeRabbit findings

- RED packet failed on the expected review contracts: raw Configuration validation text, public `/diffs` fixture, pathname-only request signing, missing-connection misclassification, lost nested path, structural cache/timeout/body-boundary assertions, and stale `packages` command copy.
- Implemented all 8 inline findings plus the one outside-diff copy note.
- Diffs/Configuration/edge focused packet: 35 pass / 0 fail / 176 assertions.
- Diff-cockpit packet: 38 pass / 0 fail / 385 assertions.
- Query signature regression proves a valid signed query succeeds and a changed query fails closed with 401.
- Missing repository connection now returns 409 `SOURCE_CONTROL_CONNECTION_REQUIRED`.
- Nested tree path `src/nested/file.ts` now survives route matching and rendering.
- Configuration write validation errors are generic at the public boundary; local/internal validation details are not echoed.
- Cache is capped at 256 entries with expired/old-entry pruning before insert; both GitHub mutation calls use a 15s abort timeout.
- Installed Consuelo OS remains untouched.

- 2026-08-12 05:06:37 append: `.task/workspace-agents/address-coderabbit-diffs-review-findings/workpad.md`

## validation

- Expanded OS focused packet: 71 pass / 0 fail / 348 assertions across Diffs, Configuration, source-control, route-seed, Sites/Gateway integration, and publisher contracts.
- Diff-cockpit packet: 38 pass / 0 fail / 385 assertions.
- Strict workspace review against `origin/stream/workspace-agents`: 0 issues / 0 blocking findings.
- Full workspace verify against `origin/stream/workspace-agents`: passed, full mode, publish-valid.
- This validation did not update, restart, deploy, or change the release channel of the installed Consuelo OS.

- 2026-08-12 05:07:32 append: `.task/workspace-agents/address-coderabbit-diffs-review-findings/workpad.md`
