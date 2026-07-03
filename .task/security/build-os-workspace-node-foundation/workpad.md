# build os workspace node foundation

branch: `task/security/build-os-workspace-node-foundation`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1336/build-os-workspace-node-foundation
github pr: https://github.com/consuelohq/opensaas/pull/1336
started: 2026-07-02

## acceptance criteria

- [x] Introduce a single Consuelo home/path resolver that supports the approved flattened `~/.consuelo` layout while preserving compatibility with existing `~/.consuelo/os` installs.
- [x] Add typed YAML config support for the three trust boundaries: global `consuelo.yaml`, local-only `node/node.yaml`, and sync-safe `workspaces/<id>/shared/workspace.yaml`.
- [x] Keep generated secrets, node identity, tunnels, Caddy runtime files, local DB/state, and logs local-only under `node/`; keep workspace policy/project/routing config sync-safe under `workspaces/<id>/shared/`.
- [x] Update install/generated-state code paths to resolve through the new path/config layer instead of hard-coded `.consuelo/os` assumptions where this branch touches them.
- [x] Start replacing hardcoded `consuelohq/opensaas` operational defaults with a project/repo resolver backed by the workspace YAML config where contained.
- [x] Preserve current Cloudflare, Caddy, sites gateway, and MCP behavior unless explicitly covered by the central URL/node foundation tests.
- [x] Add focused tests that fail before implementation and pass after it.

## plan

1. Read existing path/config/install-state/server/gateway/repo-default code and tests.
2. Write focused failing tests for flattened home path resolution, YAML boundary parsing, install-generated path usage, and project/repo resolution.
3. Implement the smallest shared `paths` and config modules that preserve old-path compatibility.
4. Wire the new resolver into install-state and bounded script defaults without changing unrelated runtime behavior.
5. Run focused tests red/green, then typecheck/review/verify against `origin/stream/security`.

## current status

- Implementation complete on task session `tsk_cff4e1e6d108`.
- Added the flattened Consuelo home resolver and YAML config layer.
- Installer provisioning now writes default `consuelo.yaml`, `node/node.yaml`, and `workspaces/<id>/shared/workspace.yaml` while keeping generated auth, Caddy, tunnel, DB, logs, runs, cache, and temp state under `node/`.
- Runtime state, server auth discovery, gateway generated files, artifact tests, and steering trace tests now follow the node-local DB/runtime paths.
- OS and workspace repo defaults now resolve from workspace YAML first, with `CONSUELO_REPO` still available as an explicit override and `consuelohq/opensaas` retained only as a fallback seed/default.
- Runtime code is not physically packaged into `runtime/current` yet. This branch creates the layout and config contract without changing release packaging semantics.

## Test-first contract

- Behavior under test: Consuelo OS can resolve the approved flattened home layout, parse human-editable YAML config at the correct trust boundaries, keep sync-safe workspace config separate from node-local generated state, and resolve project repos from workspace config rather than hardcoded `consuelohq/opensaas` defaults.
- Existing local pattern followed: `packages/os/tests/install-state.test.ts`, script/lib unit tests under `packages/os/tests`, and temp `CONSUELO_HOME` directories with deterministic generated file assertions.
- New or changed tests: `consuelo-home-config.test.ts`, `repo-default-config.test.ts`, install-state generated-path assertions, connector bootstrap path assertions, gateway path assertions, artifact DB path assertions, and steering trace DB path assertions.
- No-test waiver: not applicable; this is configuration/routing/security-boundary behavior.

## files changed

- `packages/os/scripts/lib/consuelo-home.ts` - new flattened home resolver, typed YAML schemas, default config builders, and project repo resolver.
- `packages/os/scripts/lib/install-state.ts` - provisioning now creates the flattened runtime/node/workspace layout and writes config files at the approved trust boundaries.
- `packages/os/scripts/lib/runtime-state.ts` - runtime DB/artifacts/logs/runs/tmp now live under `node/`.
- `packages/os/scripts/lib/security-gateway.ts` - Caddy output moved to `node/caddy/Caddyfile` when called through install-state.
- `packages/os/scripts/server.ts` - auth config discovery now checks default, env, node, flat legacy, and `os` legacy generated auth paths.
- `packages/os/scripts/lib/paths.js` and `packages/workspace/scripts/lib/paths.js` - repo defaults can resolve from workspace YAML config.
- `packages/os/package.json`, `packages/os/bun.lock`, `packages/workspace/package.json`, `packages/workspace/bun.lock` - added `yaml` dependency where the config readers run.
- `packages/os/tests/consuelo-home-config.test.ts`, `packages/os/tests/repo-default-config.test.ts` - new focused coverage.
- `packages/os/tests/install-state.test.ts`, `packages/os/tests/install-workspace-bootstrap-contract.test.ts`, `packages/os/tests/security-gateway.test.ts`, `packages/os/tests/artifacts.test.ts`, `packages/os/tests/os-call-artifacts.test.ts`, `packages/os/tests/os-get-steering-trace.test.ts` - updated expected generated/runtime paths.

## workspace-owned: files changed

- Same as `files changed`; all repo operations were done through `workspace.call` / `code.call`.

## workspace-owned: activity log

- Started task from `stream/security` on branch `task/security/build-os-workspace-node-foundation`.
- Read `CODING-STANDARDS.md`, `packages/os/skills/senior-engineer/SKILL.md`, and `packages/os/skills/task/SKILL.md` before production edits.
- Added failing tests for layout/config/repo/default generated path behavior, then implemented the path/config layer.
- Used Bun-based `code.call` edits and verification, per Ko's request to avoid shell-only wrappers for Python/Bun work.

## workspace-owned: validation evidence

- PASS: `cd packages/os && bun run test -- tests/consuelo-home-config.test.ts` - 1 file, 4 tests.
- PASS: `cd packages/os && bun run test -- tests/consuelo-home-config.test.ts tests/repo-default-config.test.ts tests/install-state.test.ts` - 3 files, 21 tests.
- PASS: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 cd packages/os && bun run test -- tests/consuelo-home-config.test.ts tests/repo-default-config.test.ts tests/install-state.test.ts tests/install-workspace-bootstrap-contract.test.ts tests/cloudflare-connector-transport-contract.test.ts` - 5 files, 36 tests.
- PASS: `cd packages/os && bun run test -- tests/runtime-state.test.ts tests/security-gateway.test.ts tests/mcp-gateway.test.ts tests/workspace-gateway-contract.test.ts tests/dangerous-material-policy.test.ts tests/os-call-artifacts.test.ts tests/artifacts.test.ts tests/os-get-steering-trace.test.ts` - 7 files passed, 1 skipped; 47 tests passed, 5 skipped.
- PASS: `cd packages/os && bun run typecheck` - workspace script syntax checks passed.
- PASS: `workspace verify` - review/static/typecheck/spec/db guard passed and wrote `.task/security/build-os-workspace-node-foundation/verify.json` with `publishValid: true`.
- BROAD SUITE NOTE: `cd packages/os && bun run test -- --reporter=dot` still fails outside this task in generated-manifest/source-inspection paths and mutates `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`; the snapshot was restored to HEAD and is not part of this branch.
- 2026-07-02 18:49:57 `verify`: failed — COMMAND_FAILED
- 2026-07-02 18:51:11 `verify`: passed — OK
- 2026-07-02 18:51:41 `verify`: passed — OK

## key decisions

- `~/.consuelo` is the canonical home; `~/.consuelo/os` normalizes back to `~/.consuelo` for compatibility.
- YAML is used for human-editable config, not generated secrets. The sync-safe workspace config schema is strict and rejects secret-shaped extra sections.
- Local node state is deliberately under `node/`: generated auth, Caddy, tunnels, DB, logs, runs, cache, tmp, and workspace-local state.
- Shared workspace config is deliberately under `workspaces/<id>/shared/workspace.yaml`: project registry, routing, policy, sites, and agent defaults.
- Cloudflare/Caddy/MCP behavior stays fail-closed; this branch only moves generated file placement and config lookup.
- Repo defaults now read workspace YAML when present, but the old repo remains a fallback so current task/review scripts do not hard-break before every workspace has config.

## notes for ko

- This is the foundation branch, not the full multi-node/sync system. It gives us the path and config contract needed for Syncthing/Consuelo Cloud sync later.
- The installer still writes legacy `config.json` for compatibility while also writing the new YAML files.
- Runtime package installation is still rooted in the current release flow; moving actual code into `runtime/current` should be a separate packaging/release task.

## improvements noticed

- Server auth discovery had been env-only; this branch now includes the default resolved home too so normal installs do not rely on env vars being set perfectly.
- The broad OS suite has unrelated generated-manifest/source-inspection drift that mutates snapshots under verify. That should be cleaned up separately so full-suite verification can be trusted again.

## issues and recovery

- Broad `bun run test -- --reporter=dot` mutated `packages/os/tests/facade/__snapshots__/facade.test.ts.snap` during verify mode. Restored it from HEAD with `code.call`; current status no longer includes that file.
- Initial artifact/trace tests still opened the old root DB path. Updated them to `node/db/consuelo.db` and aligned one stale artifact storage-key assertion with the existing versioned artifact contract.
- `workspace verify` initially reported related pre-existing `console.*` findings in `os-get-steering-trace.test.ts`. Replaced spawned-snippet JSON output with `process.stdout.write(...)`, reran the test, and verify then passed.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `CODING-STANDARDS.md`
- `packages/os/package.json`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/paths.js`
- `packages/os/scripts/lib/runtime-state.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/server.ts`
- `packages/os/skills/senior-engineer/SKILL.md`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/runtime-state.test.ts`
- `packages/workspace/package.json`
- `packages/workspace/scripts/lib/paths.js`

- 2026-07-02 18:21:38 apply-patch: `packages/os/scripts/lib/consuelo-home.ts`

## workspace-owned: test selection

- changed files: `.task/security/build-os-workspace-node-foundation/current.json`, `.task/security/build-os-workspace-node-foundation/evidence-log.json`, `.task/security/build-os-workspace-node-foundation/read-log.json`, `.task/security/build-os-workspace-node-foundation/session.json`, `.task/security/build-os-workspace-node-foundation/verify.json`, `.task/security/build-os-workspace-node-foundation/workpad.md`, `.task/tasks/security/build-os-workspace-node-foundation.json`, `packages/os/bun.lock`, `packages/os/package.json`, `packages/os/scripts/lib/consuelo-home.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/paths.js`, `packages/os/scripts/lib/runtime-state.ts`, `packages/os/scripts/lib/security-gateway.ts`, `packages/os/scripts/server.ts`, `packages/os/tests/artifacts.test.ts`, `packages/os/tests/consuelo-home-config.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/install-workspace-bootstrap-contract.test.ts`, `packages/os/tests/os-call-artifacts.test.ts`, `packages/os/tests/os-get-steering-trace.test.ts`, `packages/os/tests/repo-default-config.test.ts`, `packages/os/tests/security-gateway.test.ts`, `packages/workspace/bun.lock`, `packages/workspace/package.json`, `packages/workspace/scripts/lib/paths.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
