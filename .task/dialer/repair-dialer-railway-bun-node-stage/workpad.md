# repair dialer railway bun node stage

branch: `task/dialer/repair-dialer-railway-bun-node-stage`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2624/repair-dialer-railway-bun-node-stage
github pr: https://github.com/consuelohq/opensaas/pull/2624
started: 2026-10-08

## acceptance criteria

- [ ] Dialer Railway Docker build uses Bun 1.3.14 for install/build and an explicit Node 24 source stage for the Node binary required by the build.
- [ ] The Dockerfile no longer copies `/usr/local/bin/node` from an `oven/bun` stage where the path is absent.
- [ ] Existing Bun cutover contract remains green.
- [ ] Exact reviewed worktree deploys successfully to Railway production.
- [ ] DEV-1619 Wet Stone fresh Marketplace install and queue smoke succeeds without placing a carrier call.

## plan

1. Extend the existing Bun cutover Docker contract to reproduce the broken Node source stage.
2. Restore a dedicated Node 24 image stage while keeping Bun install/build stages.
3. Run the focused Bun cutover contract and dialer package validation.
4. Merge to `stream/dialer`, deploy the exact reviewed worktree directly to Railway, then finish the live install smoke.

## Test-first contract

behavior under test: `packages/dialer-server/Dockerfile` must retain Bun 1.3.14 for dependencies/build, but source `/usr/local/bin/node` from an explicit `node:24-bookworm-slim` stage rather than the Bun dependency stage.

existing local pattern: `packages/workspace/tests/twenty-migration-bun-cutover.test.ts` already asserts the active dialer Dockerfile uses Bun and the frozen Bun lockfile.

new or changed tests: extend that existing Dockerfile contract with Node 24 source-stage assertions.

focused red command: `bun test ./packages/workspace/tests/twenty-migration-bun-cutover.test.ts`

expected red failure: current Dockerfile has no Node 24 stage and copies Node from the Bun dependency stage.

no-test waiver: not applicable.

## current status

- DEV-1619 production release workflow was rejected because `stream/dialer` is not an allowed production environment branch.
- Direct Railway upload of the already-reviewed worktree then reached the Docker build and failed before application compilation: `COPY --from=dependencies /usr/local/bin/node /usr/local/bin/node` could not find that path in `oven/bun:1.3.14`.
- Git history shows the pre-Bun Railway image intentionally used Node 24; the Bun merge retained the copy but accidentally changed its source stage to the Bun image.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- Red: Bun cutover contract failed because the Dockerfile had no `node:24-bookworm-slim` source stage and still copied Node from the Bun dependency stage.
- Green: `packages/workspace/tests/twenty-migration-bun-cutover.test.ts` -> 8 pass / 0 fail / 47 assertions.
- `@consuelo/dialer-server`: typecheck pass; 219 pass / 71 integration skips / 0 fail / 1183 assertions.
- 2026-10-08 16:11:55 `review.run`: passed — OK

## key decisions

- Preserve the Bun migration; do not revert dependency/build stages back to npm/yarn.
- Restore Node 24 as a narrow source stage only, matching the prior runtime/build compatibility intent.
- Do not broaden this release repair beyond the Docker build blocker and DEV-1619 smoke.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-10-08 16:10:34 apply-patch: `.task/dialer/repair-dialer-railway-bun-node-stage/workpad.md`
- 2026-10-08 16:10:44 apply-patch: `packages/workspace/tests/twenty-migration-bun-cutover.test.ts`
- 2026-10-08 16:10:58 apply-patch: `packages/dialer-server/Dockerfile`

- 2026-10-08 16:11:18 apply-patch: `.task/dialer/repair-dialer-railway-bun-node-stage/workpad.md`
