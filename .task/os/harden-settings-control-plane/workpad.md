# Harden settings control plane

branch: `task/os/harden-settings-control-plane`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1528/harden-settings-control-plane
github pr: https://github.com/consuelohq/opensaas/pull/1528
started: 2026-07-16

## acceptance criteria

- [ ] Preserve the shipped Settings route, overlay, manifest filtering, CLI, signed local Hono routes, and edge gateway service descriptors.
- [ ] Replace private embedded Settings snapshots with a public static shell that loads private state only through the authenticated gateway API.
- [ ] Fail closed when Settings gateway identity, workspace, site, capability, or source-mode headers are missing or invalid.
- [ ] Put Settings snapshot reads, overlay mutations, materialization, persistence failures, and audit recording behind Effect programs with typed error codes.
- [ ] Serialize overlay read-modify-write operations per OS home and use collision-safe atomic temporary files.
- [ ] Consolidate Settings shell/snapshot materialization into one implementation used by Sites, the CLI, and gateway writes.
- [ ] Make disabled workflow bundles unavailable through workflow intent routing instead of recording a misleading no-op toggle.
- [ ] Record redacted `configuration.overlay.changed` audit events without request bodies or secret material.
- [ ] Prove local CLI, local signed Hono, Sites gateway scope enforcement, public-shell privacy, concurrent overlay writes, and workflow disable behavior.
- [ ] Keep Environments, Secrets, credential providers, browser-session issuance, and canonical `/tools` routing outside this PR.

## plan

1. Add focused contract tests for public-shell privacy, fail-closed gateway scope, serialized overlay mutation, workflow disable enforcement, typed failures, and redacted audit events.
2. Run the focused suite red and record the expected failures.
3. Add an Effect-backed Settings control-plane service and centralized materializer while keeping rendering pure.
4. Update CLI, Hono, Sites gateway, Sites materialization, and workflow intent adapters to use the hardened contracts.
5. Run the focused suites, OS typecheck, strict review, full verify, inspect the diff, then publish and merge into `stream/os`.

## Test-first contract

- Behavior under test: the public `/settings` shell contains no private workspace or manifest snapshot; authenticated APIs return private state; missing scope metadata fails closed; concurrent mutations preserve every change; disabled workflows cannot start or dispatch; successful mutations emit metadata-only audit records.
- Existing local pattern: Effect service composition in `scripts/lib/code-call/service.ts` and `scripts/lib/local-agent-connectivity.ts`; atomic local persistence in `manifest-overlay.ts`; signed local route tests in `settings-hono-routes.test.ts`; gateway audit JSONL conventions in `security-gateway.ts`.
- New or changed tests: `manifest-overlay.test.ts`, `settings-site.test.ts`, `settings-gateway.test.ts`, `settings-sites-gateway-endpoints.test.ts`, `settings-hono-routes.test.ts`, and `workflow-intent.test.ts`.
- Focused red command: `bun --cwd packages/os test tests/manifest-overlay.test.ts tests/settings-site.test.ts tests/settings-gateway.test.ts tests/settings-sites-gateway-endpoints.test.ts tests/settings-hono-routes.test.ts tests/workflow-intent.test.ts`.
- Expected red failure: the shell still embeds private snapshot JSON; missing gateway headers receive default read/write capability; concurrent async patch API and typed Effect service do not exist; workflow routing ignores the overlay; no control-plane audit event is written.
- No-test waiver: none; this changes persistence, authorization, UI data exposure, and workflow behavior.

## current status

- PR 0 contract is merged into `stream/os`.
- Discovery is complete and confirms the shipped stack performs real mutations but contains the privacy, fail-open, concurrency, duplication, and workflow mismatches named in the contract.
- Focused tests are being written before production edits.

## files changed

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/control-plane-audit.ts`
- `packages/os/scripts/lib/settings-control-plane.ts`
- `packages/os/scripts/lib/settings-gateway.ts`
- `packages/os/scripts/lib/settings-materialization.ts`
- `packages/os/scripts/lib/settings-overlay-command.ts`
- `packages/os/scripts/lib/settings-site.ts`

## workspace-owned: files changed

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/control-plane-audit.ts`
- `packages/os/scripts/lib/settings-control-plane.ts`
- `packages/os/scripts/lib/settings-gateway.ts`
- `packages/os/scripts/lib/settings-materialization.ts`
- `packages/os/scripts/lib/settings-overlay-command.ts`
- `packages/os/scripts/lib/settings-site.ts`

## workspace-owned: activity log

- 2026-07-16 21:19:30 fs.write: `.task/os/harden-settings-control-plane/workpad.md`
- 2026-07-16 21:21:56 fs.write: `packages/os/scripts/lib/control-plane-audit.ts`
- 2026-07-16 21:22:10 fs.write: `packages/os/scripts/lib/settings-materialization.ts`
- 2026-07-16 21:22:25 fs.write: `packages/os/scripts/lib/settings-materialization.ts`
- 2026-07-16 21:22:49 fs.write: `packages/os/scripts/lib/settings-control-plane.ts`
- 2026-07-16 21:23:39 fs.write: `packages/os/scripts/lib/settings-site.ts`
- 2026-07-16 21:24:00 fs.write: `packages/os/scripts/lib/settings-gateway.ts`
- 2026-07-16 21:24:17 fs.write: `packages/os/scripts/lib/settings-overlay-command.ts`
- 2026-07-16 21:25:18 fs.write: `packages/os/SCRIPTS.md`
- 2026-07-16 21:34:28 fs.write: `.task/os/harden-settings-control-plane/workpad.md`

## workspace-owned: validation evidence

- Test preflight found no machine-destructive command literals in the focused target suites.
- 2026-07-16 21:32:30 `review.run`: passed — OK
- 2026-07-16 21:33:12 `review.run`: passed — OK
- 2026-07-16 21:34:12 `verify`: passed — OK
- 2026-07-16 21:34:36 `verify`: passed — OK

## key decisions

- Preserve `/settings` as a compatibility shell in this PR; canonical route changes belong to PR 2.
- The public shell renders generic structure only and never receives a `SettingsSnapshot` argument.
- The existing private snapshot file may remain local under `.data/settings` with mode `0600`; it is not embedded into or published with the shell.
- Use one per-overlay-path asynchronous serialization queue plus unique atomic temp files. This protects one process and avoids temp-file collisions without introducing distributed locking before a multi-process writer exists.
- Workflow toggles remain because they become real enforcement in the workflow intent runtime.
- Use a focused OS control-plane audit JSONL instead of importing the large security-gateway module into Settings.

## notes for ko

- Workspace browser sign-in remains PR 3. Until then, the hardened public shell will show an authentication/unavailable state when a normal browser cannot reach the signed gateway API.
- This PR proves the existing edge descriptor and signed local route path; it does not claim a browser session already exists.

## improvements noticed

- The Settings route is registered as a public static snapshot, so private state must never be embedded in its HTML.
- Gateway scope parsing currently invents identity, workspace, allowed site, capabilities, and source modes when headers are absent.
- `settings-gateway.ts`, `settings-overlay-command.ts`, and `sites.ts` each perform overlapping materialization work.
- The fixed `.tmp` overlay filename can collide across writers even though final rename is atomic.
- The existing Settings edge integration contract has stale signature calls missing timestamp and nonce; this will be corrected only where required by the focused Settings path.

## issues and recovery

- The first PR 1 `task.start` call used the stream branch name for `startFrom`; the schema requires the literal `stream`. Retried successfully without creating duplicate task state.
- One discovery batch stopped because a guessed server service file did not exist. The relevant route and library files were still captured; subsequent reads used confirmed paths.

---

## publish checklist

```bash
bun run task:push -- --message "refactor(os): harden settings control plane" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-16 21:19:30 write: `.task/os/harden-settings-control-plane/workpad.md`

- 2026-07-16 21:20:27 apply-patch: `packages/os/tests/settings-site.test.ts`
- 2026-07-16 21:20:27 apply-patch: `packages/os/tests/settings-control-plane.test.ts`
- 2026-07-16 21:20:27 apply-patch: `packages/os/tests/settings-gateway.test.ts`
- 2026-07-16 21:20:27 apply-patch: `packages/os/tests/settings-sites-gateway-endpoints.test.ts`
- 2026-07-16 21:20:27 apply-patch: `packages/os/tests/workflow-intent.test.ts`
- 2026-07-16 21:21:56 write: `packages/os/scripts/lib/control-plane-audit.ts`

- 2026-07-16 21:22:10 write: `packages/os/scripts/lib/settings-materialization.ts`

- 2026-07-16 21:22:25 write: `packages/os/scripts/lib/settings-materialization.ts`

- 2026-07-16 21:22:49 write: `packages/os/scripts/lib/settings-control-plane.ts`

- 2026-07-16 21:23:39 write: `packages/os/scripts/lib/settings-site.ts`

- 2026-07-16 21:24:00 write: `packages/os/scripts/lib/settings-gateway.ts`

- 2026-07-16 21:24:17 write: `packages/os/scripts/lib/settings-overlay-command.ts`

- 2026-07-16 21:25:11 apply-patch: `packages/os/scripts/lib/manifest-overlay.ts`
- 2026-07-16 21:25:12 apply-patch: `packages/os/scripts/lib/capabilities.ts`
- 2026-07-16 21:25:12 apply-patch: `packages/os/scripts/lib/settings-sites-gateway-endpoints.ts`
- 2026-07-16 21:25:12 apply-patch: `packages/os/scripts/server/routes/settings.ts`
- 2026-07-16 21:25:12 apply-patch: `packages/os/scripts/os.ts`
- 2026-07-16 21:25:12 apply-patch: `packages/os/scripts/lib/sites.ts`
- 2026-07-16 21:25:12 apply-patch: `packages/os/hooks/intent.js`
- 2026-07-16 21:25:18 append: `packages/os/SCRIPTS.md`

- 2026-07-16 21:27:07 apply-patch: `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- 2026-07-16 21:27:40 apply-patch: `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- 2026-07-16 21:28:13 apply-patch: `packages/os/tests/settings-site.test.ts`
- 2026-07-16 21:28:13 apply-patch: `packages/os/tests/settings-cli.test.ts`
- 2026-07-16 21:29:05 apply-patch: `packages/os/scripts/lib/settings-overlay-command.ts`
- 2026-07-16 21:29:30 apply-patch: `packages/os/scripts/lib/settings-sites-gateway-endpoints.ts`

- 2026-07-16 21:32:50 apply-patch: `packages/os/scripts/lib/settings-gateway.ts`
- 2026-07-16 21:32:50 apply-patch: `packages/os/scripts/lib/settings-overlay-command.ts`

## workspace-owned: test selection

- changed files: `.task/os/harden-settings-control-plane/current.json`, `.task/os/harden-settings-control-plane/session.json`, `.task/os/harden-settings-control-plane/verify.json`, `.task/os/harden-settings-control-plane/workpad.md`, `.task/tasks/os/harden-settings-control-plane.json`, `packages/os/SCRIPTS.md`, `packages/os/hooks/intent.js`, `packages/os/scripts/lib/capabilities.ts`, `packages/os/scripts/lib/control-plane-audit.ts`, `packages/os/scripts/lib/manifest-overlay.ts`, `packages/os/scripts/lib/settings-control-plane.ts`, `packages/os/scripts/lib/settings-gateway.ts`, `packages/os/scripts/lib/settings-materialization.ts`, `packages/os/scripts/lib/settings-overlay-command.ts`, `packages/os/scripts/lib/settings-site.ts`, `packages/os/scripts/lib/settings-sites-gateway-endpoints.ts`, `packages/os/scripts/lib/sites.ts`, `packages/os/scripts/os.ts`, `packages/os/scripts/server/routes/settings.ts`, `packages/os/tests/settings-cli.test.ts`, `packages/os/tests/settings-control-plane.test.ts`, `packages/os/tests/settings-gateway.test.ts`, `packages/os/tests/settings-site.test.ts`, `packages/os/tests/settings-sites-gateway-endpoints.test.ts`, `packages/os/tests/workflow-intent.test.ts`, `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none

## final implementation status — 2026-07-16

- [x] Preserved the existing `/settings`, overlay, manifest filtering, CLI, signed Hono, Sites adapter, and edge descriptor foundations.
- [x] Replaced the embedded private snapshot with a public static shell that hydrates exclusively through `/gateway/settings/snapshot`.
- [x] Made Settings gateway scope parsing fail closed for missing identity, workspace, hostname, allowed site, capabilities, or valid source modes.
- [x] Added Effect-backed snapshot and overlay programs with typed control-plane failures.
- [x] Serialized mutations per overlay path and replaced the shared atomic temp filename with PID/UUID-specific files.
- [x] Centralized shell and private-snapshot materialization in `settings-materialization.ts`.
- [x] Enforced disabled workflow bundles in workflow intent resolution.
- [x] Added metadata-only `configuration.overlay.changed` JSONL audit records.
- [x] Fixed the existing Settings CLI argument bug that treated `--json` as the requested tool name.
- [x] Repaired the Settings edge integration contract to use the current timestamp-and-nonce signature shape.

## final files changed

- `packages/os/SCRIPTS.md`
- `packages/os/hooks/intent.js`
- `packages/os/scripts/lib/capabilities.ts`
- `packages/os/scripts/lib/control-plane-audit.ts`
- `packages/os/scripts/lib/manifest-overlay.ts`
- `packages/os/scripts/lib/settings-control-plane.ts`
- `packages/os/scripts/lib/settings-gateway.ts`
- `packages/os/scripts/lib/settings-materialization.ts`
- `packages/os/scripts/lib/settings-overlay-command.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/settings-sites-gateway-endpoints.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/server/routes/settings.ts`
- `packages/os/tests/settings-cli.test.ts`
- `packages/os/tests/settings-control-plane.test.ts`
- `packages/os/tests/settings-gateway.test.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/settings-sites-gateway-endpoints.test.ts`
- `packages/os/tests/workflow-intent.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

## final validation

- Red proof: focused Settings suite failed on the missing Effect control-plane service, embedded private snapshot, fail-open gateway scope, unenforced workflow disables, and missing audit/concurrency behavior.
- Red CLI proof: `settings disable-tool <name> --json` failed because `--json` was parsed as the tool name.
- Green focused Settings/Sites suite: 10 files, 40 tests passed.
- Green focused gateway/control-plane rerun after error handling: 5 files, 15 tests passed.
- Green signed edge contracts with `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1`: 3 files, 20 tests passed.
- Green OS script syntax check.
- Browser proof: public Settings shell loaded at desktop and mobile presets with the expected navigation and no embedded private snapshot; unauthenticated hydration remained in its safe unavailable state.
- Strict review against `origin/stream/os`: zero findings.
- Full `verify`: publish-valid; review, package selection, and database guard passed.

## final risks and boundaries

- Browser session issuance remains PR 3. The public shell intentionally cannot retrieve private state from an ordinary unsigned browser yet.
- `/tools`, `/environments`, and `/secrets` remain later stacks; this PR keeps `/settings` as the compatibility surface.
- The mutation queue serializes writers inside one OS process. A future multi-process writer requires a repository-level lock or revisioned compare-and-swap contract.

- 2026-07-16 21:34:28 append: `.task/os/harden-settings-control-plane/workpad.md`
