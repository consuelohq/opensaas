# make cloudflare edge router registry contracts green

## Goal

Implement the three Cloudflare edge contract modules introduced on `stream/security` so the opt-in contract tests pass without weakening the tests.

## Acceptance criteria

- Run the opt-in edge router / D1 registry / provisioning contract suite red before implementation.
- Implement the simplest correct production modules under `packages/os/scripts/lib/`.
- Preserve the default package test behavior where contract tests stay skipped unless `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1` is set.
- Validate the focused opt-in contract suite green.
- Run relevant existing OS gateway/security tests where practical.
- Inspect the diff before push and promote to `stream/security`.

## Test-first contract

Behavior under test:
- Cloudflare edge router fails closed for unknown workspace hosts, unknown paths, and offline OS connectors.
- Edge router proxies Dialer routes to a Railway upstream with signed internal edge headers.
- Edge router proxies OS routes only through connected outbound connector origins and signs upstream requests.
- D1 route registry stores workspace hostname route rows, resolves longest-prefix routes, ignores disabled routes, keeps Dialer active while OS is offline, and revokes hostnames fail-closed.
- Cloudflare provisioning plans/applies one public workspace hostname, one hidden OS tunnel origin hostname, idempotent Cloudflare operation keys, and separates connector bootstrap credentials from durable registry rows.

Existing local pattern followed:
- `packages/os/scripts/lib/workspace-cloudflare-gateway.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/tests/workspace-gateway-contract.test.ts`
- Prior workpad: `task/security/write-cloudflare-edge-router-registry-tests`

## Red evidence

- Focused opt-in command failed before implementation with 14 failing contract assertions across three files.
- Meaningful failure signal: missing future module imports under `packages/os/scripts/lib/`, including `workspace-cloudflare-d1-route-registry.ts`.

## Implementation notes

- Added `workspace-cloudflare-edge-router.ts` with a pure Worker-style router that asks a registry for route resolution, returns safe JSON deny responses, builds upstream URLs, and signs proxied internal requests with `x-consuelo-edge-signature`.
- Added `workspace-cloudflare-d1-route-registry.ts` with an in-memory D1-compatible seam, migration flag, durable hostname rows, longest-prefix matching, disabled-route filtering, host revocation, and connector-offline fail-closed behavior.
- Added `workspace-cloudflare-provisioning.ts` with deterministic workspace hostname / hidden OS tunnel hostname planning, Cloudflare tunnel/DNS apply operations, and explicit separation of connector bootstrap credentials from the registry record.
- Review initially found two `ERROR_HANDLING` issues for async functions with awaits; fixed by adding local try/catch in the router and provisioning apply path.
- Initial edit attempt through `code.run` failed before any file changes because nested template literals broke the transport payload; switched to direct typed `fs.write` calls.
- `git.diff` did not show untracked files against `origin/stream/security`, so `git add -N` was used only to make the untracked diff inspectable.

## Files changed

- `.task/security/make-cloudflare-edge-router-registry-contracts-green/*`
- `.task/security/make-cloudflare-edge-router-registry-contracts-green/workpad.md`
- `.task/tasks/security/make-cloudflare-edge-router-registry-contracts-green.json`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`

## Validation evidence

- `checkFiles` on the three new source files: passed. Latest trace `trc_aef6c0886d50`.
- Focused opt-in contract suite: passed 3 files / 14 tests. Latest trace `trc_0609a4493755`.

```bash
env CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-edge-router.test.ts tests/cloudflare-d1-route-registry.test.ts tests/cloudflare-provisioning-contract.test.ts
```

- Default targeted contract command without env: passed with 14 skipped tests, preserving opt-in gating. Latest trace `trc_8114b406fcc2`.
- Existing OS security gateway suite: passed 19 tests. Trace `trc_b9f76c552307`.
- Existing OS workspace gateway opt-in contract suite: passed 5 tests. Trace `trc_a4a363af1ef4`.
- Full `bun --cwd packages/os test`: still fails outside this task scope after the new contract files are skipped by default. Visible failures include pre-existing/non-target suites such as `tests/consuelo-design.test.ts` and `tests/facade/facade.test.ts`; this task's new default-gated tests are skipped in that run.
- Review gate: `review.run` with `base: origin/stream/security` and `noTests: true` passed with 0 issues / 0 blocking issues. Trace `trc_1c42a4b4ee74`.
- Diff inspection: `git diff --stat` after intent-to-add showed 9 files changed / 1216 insertions, including the three new source files and task metadata. Trace `trc_b47e701b3386`.

## Running notes

- Started from `stream/security` because the contract tests already live on the stream.
- Task session: `tsk_d6a08865fc70`.
- Initial `task.start` attempt used `startFrom: "stream/security"` and failed schema validation; retry with `startFrom: "stream"` succeeded.

- 2026-06-11 05:36:04 write: `.task/security/make-cloudflare-edge-router-registry-contracts-green/workpad.md`

## workspace-owned: files changed

- `.task/security/make-cloudflare-edge-router-registry-contracts-green/*`
- `.task/security/make-cloudflare-edge-router-registry-contracts-green/workpad.md`
- `.task/tasks/security/make-cloudflare-edge-router-registry-contracts-green.json`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`

## workspace-owned: activity log

- 2026-06-11 05:36:04 fs.write: `.task/security/make-cloudflare-edge-router-registry-contracts-green/workpad.md`

## workspace-owned: validation evidence

- `checkFiles` on the three new source files: passed. Latest trace `trc_aef6c0886d50`.
- Focused opt-in contract suite: passed 3 files / 14 tests. Latest trace `trc_0609a4493755`.
```bash
env CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-edge-router.test.ts tests/cloudflare-d1-route-registry.test.ts tests/cloudflare-provisioning-contract.test.ts
```
- Default targeted contract command without env: passed with 14 skipped tests, preserving opt-in gating. Latest trace `trc_8114b406fcc2`.
- Existing OS security gateway suite: passed 19 tests. Trace `trc_b9f76c552307`.
- Existing OS workspace gateway opt-in contract suite: passed 5 tests. Trace `trc_a4a363af1ef4`.
- Full `bun --cwd packages/os test`: still fails outside this task scope after the new contract files are skipped by default. Visible failures include pre-existing/non-target suites such as `tests/consuelo-design.test.ts` and `tests/facade/facade.test.ts`; this task's new default-gated tests are skipped in that run.
- Review gate: `review.run` with `base: origin/stream/security` and `noTests: true` passed with 0 issues / 0 blocking issues. Trace `trc_1c42a4b4ee74`.
- Diff inspection: `git diff --stat` after intent-to-add showed 9 files changed / 1216 insertions, including the three new source files and task metadata. Trace `trc_b47e701b3386`.
- 2026-06-11 05:36:25 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/make-cloudflare-edge-router-registry-contracts-green/current.json`, `.task/security/make-cloudflare-edge-router-registry-contracts-green/evidence-log.json`, `.task/security/make-cloudflare-edge-router-registry-contracts-green/read-log.json`, `.task/security/make-cloudflare-edge-router-registry-contracts-green/session.json`, `.task/security/make-cloudflare-edge-router-registry-contracts-green/workpad.md`, `.task/tasks/security/make-cloudflare-edge-router-registry-contracts-green.json`, `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
