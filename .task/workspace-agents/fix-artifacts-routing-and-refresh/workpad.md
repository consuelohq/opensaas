# Fix artifacts routing and refresh

branch: `task/workspace-agents/fix-artifacts-routing-and-refresh`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2200/fix-artifacts-routing-and-refresh
github pr: https://github.com/consuelohq/opensaas/pull/2200
started: 2026-08-26

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/tests/artifacts-edge-routing.test.ts`
- `packages/os/tests/artifacts-facade-runtime.test.ts`

## workspace-owned: files changed

- `packages/os/tests/artifacts-edge-routing.test.ts`
- `packages/os/tests/artifacts-facade-runtime.test.ts`

## workspace-owned: activity log

- 2026-08-26 05:01:08 fs.write: `.task/workspace-agents/fix-artifacts-routing-and-refresh/workpad.md`
- 2026-08-26 05:09:25 fs.write: `packages/os/tests/artifacts-facade-runtime.test.ts`
- 2026-08-26 05:10:08 fs.write: `packages/os/tests/artifacts-edge-routing.test.ts`
- 2026-08-26 05:26:23 fs.write: `.task/workspace-agents/fix-artifacts-routing-and-refresh/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 05:21:12 `review.run`: passed — OK
- 2026-08-26 05:23:27 `verify`: failed — COMMAND_FAILED

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

## Test-first contract

behavior under test:
- Artifacts facade commands execute from the packaged OS runtime rather than the repository root, so `artifacts.check` and `artifacts.refresh` do not fail with `Script not found "artifacts"`.
- The workspace `/artifacts` route serves the Artifacts snapshot/content and cannot fall through to the launcher/Overview snapshot after an artifact refresh.
- The three requested legacy artifacts (How to Speak, Security Report, OS Spec) are migrated by preserving their existing rendered files once their exact local legacy sources are identified; migration is operational state, not a redesign.

existing local pattern:
- `tools.search` and lifecycle facade handlers use `executionScope: "runtime"` and have execution-plan regression coverage.
- Workspace edge routing resolves longest matching path prefixes first; `/artifacts` has a dedicated snapshot route.

new or changed tests:
- Add focused facade regression coverage proving `artifacts.check` and `artifacts.refresh` use runtime execution scope from an unrelated caller cwd.
- Add/extend route/snapshot refresh coverage only if investigation shows a code-level hosted snapshot regression rather than stale operational state.

focused red command:
- `bun vitest run packages/os/tests/artifacts-facade-runtime.test.ts`

expected red failure:
- Artifacts manifest entries currently have no runtime execution scope and plans resolve against the workspace/root package, reproducing the missing `artifacts` script failure.

no-test waiver: not applicable

- 2026-08-26 05:01:08 append: `.task/workspace-agents/fix-artifacts-routing-and-refresh/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/artifacts.ts`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/scripts/lib/artifacts-v2.ts`
- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/seed-workspace-edge-route.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tests/tool-package-layout.test.ts`
- `packages/os/tests/tools-search-v3.test.ts`
- `packages/os/tools/artifacts/handler.ts`
- `packages/os/tools/artifacts/manifest.ts`

## Findings and validation
- Hosted routing root cause: the D1 record for `internal.consuelohq.com` had `/` as a launcher site-snapshot and `/gateway/artifacts` as the live artifacts gateway, but no public `/artifacts` route. Longest-prefix matching therefore sent `/artifacts` to `/`, i.e. Overview.
- Restored the intended live route: `/artifacts` -> authenticated `artifacts-sites-read-layer`; removed Artifacts from static release-managed site snapshots and install-edge snapshot publishing so heartbeat reconciliation cannot regress it.
- `artifacts.refresh` root cause: Artifacts facade commands used the package script name from caller cwd. All Artifacts commands are now runtime-owned (`executionScope: runtime`), with generated manifest/baseline updated.
- Migrated legacy artifacts from the local Open Design archive without redesign: How To Speak, Network and Security Report, and Consuelo OS Spec. Local `/artifacts` plus all three nested routes return HTTP 200 after refresh.
- Focused tests: tool manifest/package layout + artifacts facade/runtime + edge routing: 24/24 passed (`trc_2f32fb896ada`); workspace edge integration: 16/16 (`trc_83af2edf169b`); install-edge publisher: 7/7 (`trc_bedbdb38510e`); generated manifest drift check passed (`trc_5178125169f1`).
- Strict review reports zero blocking issues. Full verify DB guard flags only the expected route-seed database-script warning with zero findings; package-wide facade tests retain unrelated baseline failures outside this change.

- 2026-08-26 05:26:23 append: `.task/workspace-agents/fix-artifacts-routing-and-refresh/workpad.md`
