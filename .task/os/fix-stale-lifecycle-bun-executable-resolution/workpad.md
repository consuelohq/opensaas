# fix stale lifecycle bun executable resolution

branch: `task/os/fix-stale-lifecycle-bun-executable-resolution`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2413
started: 2026-09-08

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: the fixed stale lifecycle compatibility command must start its inline Bun bootstrap on every supported historical install shape. It must prefer the Consuelo-managed `$CONSUELO_HOME/bin/consuelo-os` executable when present; otherwise safely resolve an existing Bun from infrastructure-owned/runtime environment (`BUN_BIN`, `command -v bun`, then `$HOME/.bun/bin/bun`) without allowing caller-supplied executable paths. Missing/non-executable candidates fail before the recovery script starts. Existing trust/revocation/input-validation behavior remains unchanged.
existing local pattern: public bootstrap already accepts `BUN_BIN`, Bun from `PATH`, or `$HOME/.bun/bin/bun`; modern installs additionally clone Bun to `$CONSUELO_HOME/bin/consuelo-os`, but that named runtime was introduced after the pre-lifecycle-facade releases this bridge must recover. The stale bridge currently hardcodes `$HOME/.bun/bin/bun`, which Codex correctly flagged as incomplete for Homebrew/PATH installs.
new or changed tests: change generated-command assertions to require a fixed resolver; add mocked shell execution proving (1) managed runtime is preferred, (2) a Bun available only on PATH can start the inline bootstrap, (3) `$HOME/.bun/bin/bun` still supports old managed-cloud nodes, and (4) no executable candidate fails before metadata/lifecycle execution. Preserve all existing lifecycle trust, exact-version, injection, revoked, and compatible-node cases.
focused red command: `bun x vitest run tests/workspace-node-registry-routing.test.ts -t lifecycle` after `tests/test-source-safety.test.ts` preflight.
expected red failure: PATH-only/managed-runtime resolver cases fail because the current generated command directly executes `$HOME/.bun/bin/bun`.
no-test waiver: not applicable.

RED evidence: canonical `tests/test-source-safety.test.ts` passed. Focused lifecycle run produced 3 failures / 7 passes: generated-command assertions found no resolver, stale non-managed command still lacked `command -v bun`, and the managed-runtime fixture exited 127 because production directly invoked the missing `$HOME/.bun/bin/bun`. This is the Codex P1 reproduced exactly.

## plan

1. Verify historical install shapes using real `consuelo-os-v0.1.x` tags and current bootstrap conventions.
2. Freeze executable-resolution behavior in focused tests and capture RED.
3. Replace the single hardcoded executable with a fixed shell resolver that has no caller-controlled path input, then rerun focused GREEN.
4. Run the full affected Device Authority/auth/session boundary and Worker dry-run, strict review, and formal verify.
5. Publish #2413 into `stream/os`, repin #2411 to the new head, require fresh CI/review, then continue main/deploy/live `cloud-1` acceptance.

## implementation and validation

- Historical release evidence: `consuelo-os-v0.1.11`, `v0.1.20`, and `v0.1.36` all resolve Bun as configured `BUN_BIN` -> `command -v bun` -> `$HOME/.bun/bin/bun`, and persist/export `BUN_BIN`. The newer `$CONSUELO_HOME/bin/consuelo-os` clone was introduced after the pre-lifecycle-facade recovery window.
- Production resolver order: executable `$CONSUELO_HOME/bin/consuelo-os` -> executable `${BUN_BIN:-}` -> `command -v bun` -> executable `$HOME/.bun/bin/bun` -> fail 127 with `legacy Bun runtime unavailable`.
- Resolver uses only node-owned environment/install state; no lifecycle caller field can select or inject an executable path.
- Canonical source-safety preflight passed after final test edits.
- Focused lifecycle GREEN: 10/10 passed, including managed runtime, persisted BUN_BIN, PATH-only/Homebrew-style Bun, `$HOME/.bun`, and unavailable-runtime failure.
- Affected Device Authority/auth/session boundary: 10 files / 155 tests passed, 0 failed.
- Device Authority Worker dry-run passed; bundle 623.95 KiB / 126.69 KiB gzip.
- Structured diff contains only `mcp-proxy.ts`, routing tests, and workspace-owned task metadata/logs.

- 2026-09-08 14:39:25 append: `.task/os/fix-stale-lifecycle-bun-executable-resolution/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-08 14:39:25 fs.write: `.task/os/fix-stale-lifecycle-bun-executable-resolution/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-09-08 14:40:08 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-09-08 14:40:40 apply-patch: `.task/os/fix-stale-lifecycle-bun-executable-resolution/workpad.md`
- 2026-09-08 14:40:49 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`

- 2026-09-08 14:41:48 apply-patch: `.task/os/fix-stale-lifecycle-bun-executable-resolution/workpad.md`

## workspace-owned: validation evidence

- 2026-09-08 14:42:42 `review.run`: passed — OK
- 2026-09-08 14:43:16 `verify`: passed — OK
