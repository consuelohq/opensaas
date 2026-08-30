# consolidate-stale-prs-for-canary

branch: `task/os/consolidate-stale-prs-for-canary`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2233/consolidate-stale-prs-for-canary
github pr: https://github.com/consuelohq/opensaas/pull/2233
started: 2026-08-28

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

- 2026-08-28 02:04:34 fs.write: `.task/os/consolidate-stale-prs-for-canary/workpad.md`
- 2026-08-28 02:21:14 fs.write: `.task/os/consolidate-stale-prs-for-canary/workpad.md`

## workspace-owned: validation evidence

- 2026-08-28 02:24:53 `verify`: passed — OK
- 2026-08-28 02:24:54 `verify`: passed — OK
- 2026-08-28 02:25:58 `review.run`: passed — OK
- 2026-08-28 02:27:01 `review.run`: passed — OK

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

## Release consolidation contract

behavior under test: preserve every unique, still-relevant change from PRs #2200, #2182, #2178, and #2167 while excluding obsolete bookkeeping/release-only PRs #2233 and #2159; maintain authenticated Sites/Artifacts/GitHub/security behavior and ship one exact immutable OS release through stable.
existing local pattern: task PRs merge to their stream, stream PRs merge to main, then the release workflow publishes dev and promotes the identical signed bundle dev -> canary -> beta -> stable.
new or changed tests: reuse and rerun each surviving PR's focused regression tests after restacking; add tests only if integration exposes uncovered behavior.
focused red command: not applicable before integration because this task consolidates already-tested commits rather than introducing a new behavior.
expected red failure: not applicable.
no-test waiver: approved for branch-only consolidation steps; production changes must retain existing tests and pass focused integration checks, strict review, and full release verification.

## Current release state

- dev/canary: 0.1.84 from f9c0e78cf5b0bf94dd9cc96571aae481eb299cc6
- beta/stable: 0.1.69 from 1f3062c63239bd378eeb3b7d4b9f09efb32a178c
- objective: audit exact commit containment, consolidate only unique changes, close/supersede stale duplicates, promote the resulting exact runtime through stable, and verify the local node.

- 2026-08-28 02:04:34 append: `.task/os/consolidate-stale-prs-for-canary/workpad.md`


## Consolidation audit result

- #2200 is patch-equivalent to current main; its stale branch history is excluded.
- #2182 and #2178 are semantically superseded by current authenticated Artifacts and GitHub App source-control implementations.
- #2159 is an empty obsolete 0.1.66 promotion request.
- #2167 site-publication hardening is already present on stream/os.
- The only missing production delta carried forward is patched protobufjs 7.6.5, tar 7.5.22, and @grpc/grpc-js 1.14.4 resolution state.

## Validation evidence

- Workspace gateway contracts: 60 pass, 0 fail.
- OAuth device contract: 5 pass, 0 fail.
- Gateway security contract with ambient live-worker identity removed: 30 pass, 0 fail.
- GitHub, settings, and Artifacts focused suite: 42 pass, 0 fail.
- packages/os typecheck: green.
- packages/consuelo-website build: 0 errors and complete.
- Website production audit: no findings for protobufjs, tar, @grpc/grpc-js, or fast-xml-parser.
- The broader website audit reports 40 newer unrelated advisories; those are deferred to separate maintenance so this release stays bounded.

## Validation environment notes

- Nx discovers consuelo-os, but the Nx test wrapper fails because packages/os is absent from the root Yarn workspace list. Canonical package tests were run directly.
- One gateway test inherited the live worker base port from the OS process. Removing that ambient variable produced 30/30 green; this is test-environment leakage, not a product failure.
- One long full-suite facade call briefly returned CONSUELO_NODE_UNAVAILABLE. Bounded follow-up calls recovered; no repository state was lost.

- 2026-08-28 02:21:14 append: `.task/os/consolidate-stale-prs-for-canary/workpad.md`
