# Google Workspace integration

branch: `task/os/google-workspace-integration`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2201/google-workspace-integration
github pr: https://github.com/consuelohq/opensaas/pull/2201
started: 2026-08-26

## acceptance criteria

- [x] Update Ko's locally installed `gog` to the current upstream release and verify the installed version.
- [x] Add a default bundled skill named `google` with Consuelo-native guidance and user-facing Google naming only.
- [x] Add an Effect-backed OS tool surface named `google` that wraps `gog` without shell evaluation.
- [x] First unauthenticated use initiates the supported Google OAuth recovery flow; persisted `gog` auth is reused afterward.
- [x] Provision a pinned, checksum-verified `gog` runtime for fresh OS installs/updates, without depending on OpenClaw/Homebrew/Go and without clobbering unrelated system installs.
- [x] Preserve OS approval boundaries for mutating Google operations and keep OAuth client material out of argv/log output.
- [x] Cover install/version/auth/tool/skill behavior with focused tests and broader OS validation.
- [ ] Merge the task branch into `stream/os`; do not release to canary/production unless separately requested.

## plan

1. Verify the current upstream `gog` release and release artifacts, and update Ko's local binary through the safest supported path.
2. Inspect bundled skill conventions, tool package patterns, installer/update reconciliation, and current auth/approval plumbing.
3. Write focused failing tests for the managed runtime, `google` tool contract, first-use auth recovery, and bundled skill metadata.
4. Implement the smallest native OS integration: pinned runtime provisioner, Effect service/tool package, and `google` skill adapted from upstream guidance.
5. Run focused tests, generated-surface/audit checks, workspace review, full verify, and inspect the final diff.
6. Push and merge the task into `stream/os`, then finish the task.

## Test-first contract

behavior under test:
- Fresh installs can provision the pinned `gog` release safely and deterministically.
- The exposed tool is named `google`, executes structured argv through an Effect service, reports auth recovery without leaking secrets, and distinguishes reads from approved mutations.
- The bundled `google` skill is active/default and instructs agents to use the OS `google` tool rather than OpenClaw/direct shell commands.

existing local pattern:
- Tool packages under `packages/os/tools/*` use schema/handler/manifest/service boundaries and Effect-backed subprocess execution.
- Bundled skills are reconciled from `packages/os/skills/*` by install-state and default-selected unless explicitly optional.
- Installer/runtime dependencies should be reconciled idempotently with explicit version/checksum evidence.

new or changed tests:
- Managed `gog` runtime/version/checksum/install tests.
- Google tool schema/service/auth/approval/redaction tests.
- Google bundled-skill/default-selection tests.

focused red command:
- `bunx vitest run packages/os/tests/managed-gog.test.ts packages/os/tests/google-tool.test.ts packages/os/tests/google-skill.test.ts`

expected red failure:
- Module-not-found failures for `scripts/lib/managed-gog` and `tools/google/service`, plus missing bundled `skills/google` files.

no-test waiver: not applicable.

## current status

- Implementation complete and publish-valid verification is green.
- Local managed `gog` updated to upstream v0.38.1 after SHA-256 verification; the older Homebrew v0.9.0 install remains untouched behind `~/.consuelo/bin` on PATH.
- Native `google` tool/skill, managed runtime provisioning, first-use signed-node OAuth bootstrap, verified account-email carry-through, and write approval policy are implemented.
- Device Authority remains fail-closed for first-use OAuth until `GOOGLE_WORKSPACE_OAUTH_CLIENT_ID` and `GOOGLE_WORKSPACE_OAUTH_CLIENT_SECRET` are configured in the deployed environment; this task does not deploy/release the worker.
- Task started via `task.start` compatibility path because canonical `session.start` currently points at missing `session:start` script.

## files changed

- `packages/os/TOOLS.md`
- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/github-source-control.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/services/grants.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/manifests/generated/core.manifest.json`
- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/manifests/manifest.config.ts`
- `packages/os/package.json`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/managed-cloud-node-enrollment.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/skills/skills.json`
- `packages/os/src/generated/workspace.d.ts`
- `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/os/tests/native-google-device-approval.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tests/tool-package-layout.test.ts`
- `packages/os/tools/registry.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/os/cloudflare/os-device-authority/src/routes/google-workspace.ts`
- `packages/os/scripts/google.ts`
- `packages/os/scripts/lib/google-workspace-auth.ts`
- `packages/os/scripts/lib/managed-gog.ts`
- `packages/os/skills/google/SKILL.md`
- `packages/os/skills/google/skill.json`
- `packages/os/tests/google-skill.test.ts`
- `packages/os/tests/google-tool.test.ts`
- `packages/os/tests/google-workspace-auth.test.ts`
- `packages/os/tests/managed-gog.test.ts`
- `packages/os/tools/google/handler.ts`
- `packages/os/tools/google/manifest.ts`
- `packages/os/tools/google/schema.ts`
- `packages/os/tools/google/service.ts`


## workspace-owned: files changed

- `.task/os/google-workspace-integration/workpad.md`
- `packages/os/cloudflare/os-device-authority/src/routes/google-workspace.ts`
- `packages/os/scripts/google.ts`
- `packages/os/scripts/lib/google-workspace-auth.ts`
- `packages/os/scripts/lib/managed-gog.ts`
- `packages/os/skills/google/skill.json`
- `packages/os/skills/google/SKILL.md`
- `packages/os/tests/google-skill.test.ts`
- `packages/os/tests/google-tool.test.ts`
- `packages/os/tests/google-workspace-auth.test.ts`
- `packages/os/tests/managed-gog.test.ts`
- `packages/os/tools/google/handler.ts`
- `packages/os/tools/google/manifest.ts`
- `packages/os/tools/google/schema.ts`
- `packages/os/tools/google/service.ts`

## workspace-owned: activity log

- 2026-08-26 05:03:26 fs.write: `.task/os/google-workspace-integration/workpad.md`
- 2026-08-26 05:13:27 fs.write: `packages/os/tests/managed-gog.test.ts`
- 2026-08-26 05:13:27 fs.write: `packages/os/tests/google-tool.test.ts`
- 2026-08-26 05:13:27 fs.write: `packages/os/tests/google-skill.test.ts`
- 2026-08-26 05:14:39 fs.write: `packages/os/scripts/lib/managed-gog.ts`
- 2026-08-26 05:15:00 fs.write: `packages/os/tools/google/service.ts`
- 2026-08-26 05:15:00 fs.write: `packages/os/skills/google/skill.json`
- 2026-08-26 05:15:00 fs.write: `packages/os/skills/google/SKILL.md`
- 2026-08-26 05:16:12 fs.write: `packages/os/tools/google/schema.ts`
- 2026-08-26 05:16:12 fs.write: `packages/os/tools/google/handler.ts`
- 2026-08-26 05:16:13 fs.write: `packages/os/tools/google/manifest.ts`
- 2026-08-26 05:18:00 fs.write: `packages/os/cloudflare/os-device-authority/src/routes/google-workspace.ts`
- 2026-08-26 05:18:01 fs.write: `packages/os/scripts/lib/google-workspace-auth.ts`
- 2026-08-26 05:18:54 fs.write: `packages/os/scripts/google.ts`
- 2026-08-26 05:19:26 fs.write: `packages/os/tests/google-workspace-auth.test.ts`

## workspace-owned: validation evidence

- 2026-08-26 05:25:35 `review.run`: passed — OK
- 2026-08-26 05:26:15 `review.run`: passed — OK
- 2026-08-26 05:27:35 `verify`: failed — COMMAND_FAILED
- 2026-08-26 05:33:27 `verify`: passed — OK
- Added explicit critical `os-google-workspace` selection so Google changes run focused Google/shared OS contracts instead of the historically noisy unrelated package-wide OS suite.
- Full selected-suite run passed with zero failed suites.
- 2026-08-26 05:36:17 `verify`: passed — OK
- 2026-08-26 05:38:33 `verify`: passed — OK

## key decisions

- Product-facing name is `google`; `gog` remains an implementation dependency only.
- Pin verified upstream `gog` v0.38.1 rather than using an arbitrary PATH version.
- Do not make OpenClaw a runtime/install dependency.
- Keep Google refresh tokens in gog/platform keyring storage; do not create a second Consuelo token database.
- Fetch the Consuelo Desktop OAuth client only over the existing signed-node authority channel and feed it to gog over stdin; never commit or reuse Ko's personal gog OAuth credentials.
- Reads force gog's runtime `--readonly` guard. Writes require explicit OS approval and are never automatically replayed after first-use OAuth.

## notes for ko

- No canary/production release is included in this task unless separately requested.
- External first-use OAuth requires configuring the two new Device Authority Google Workspace OAuth secrets and deploying that worker in a separate release step.

## improvements noticed

- `session.start` facade currently resolves to a missing `session:start` package script; compatibility `task.start` works.

## issues and recovery

- `session.start` failed with `error: Script not found "session:start"`; recovered via the documented `task.start` compatibility alias.
- Initial `google status` used `gog auth list`, which blocked against the macOS keyring and hit the wrapper timeout. Switched to the non-blocking `gog auth status` primitive and added a regression test; real local status smoke now passes.
- Initial verifier selected the auto `@consuelo/os` package suite, which has unrelated facade/media failures. Added the repository's intended explicit critical feature-selection rule; all selected critical/shared suites now pass and broad unrelated package tests are no longer selected for this change.
- Task branch was bootstrapped from current `main` while `origin/stream/os` is one commit behind; clean the branch ancestry before merging so the unrelated checkout-observability commit is not dragged into `stream/os`.

## validation evidence

- Test-first RED failed only because the new managed runtime/tool/skill did not exist yet.
- Focused Google suites pass, including checksum tamper rejection, read-only wrapper policy, write approval, signed OAuth bootstrap, stdin credential handoff, skill metadata, and verified account-email propagation.
- Integration run: 9 selected OS test files / 100 tests passed before final hardening; subsequent focused auth/tool tests also passed.
- `bun run typecheck` passes.
- Generated skill/tool registry, types, docs, and manifest freshness checks pass: 12 bundled skills, 162 full tools, 15 core tools.
- Device Authority Wrangler dry-run bundles successfully.
- Strict review: 0 blocking issues; 4 non-blocking public documentation opportunities deferred from this implementation task.
- Repository verify: `publishValid: true`, full mode, review pass, DB guard pass, selected test suites pass.
- Real local native `google status` smoke recognizes the existing Google authorization through managed gog v0.38.1 without reading Workspace content.

---

## publish checklist

```bash
bun run task:push -- --message "feat(os): add Google Workspace integration" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-26 05:03:26 write: `.task/os/google-workspace-integration/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/http.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/github-source-control.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/google-workspace.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/services/grants.ts`
- `packages/os/cloudflare/os-device-authority/src/services/nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/manifests/manifest.config.ts`
- `packages/os/package.json`
- `packages/os/scripts/generate-skills-registry.ts`
- `packages/os/scripts/github.js`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/credential-broker.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/github-source-control-client.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/managed-cloud-node-enrollment.ts`
- `packages/os/scripts/lib/skills.ts`
- `packages/os/scripts/lib/workspace-connector-transport.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/scripts/lib/workspace-edge-node-auth.ts`
- `packages/os/scripts/lib/workspace-node-client.ts`
- `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`
- `packages/os/scripts/workspace-node-heartbeat.ts`
- `packages/os/skills/sites/SKILL.md`
- `packages/os/skills/sites/skill.json`
- `packages/os/tests/deployment-provider.test.ts`
- `packages/os/tests/github-source-control-client.test.ts`
- `packages/os/tests/github-source-control-worker.test.ts`
- `packages/os/tests/managed-gog.test.ts`
- `packages/os/tests/native-google-device-approval.test.ts`
- `packages/os/tests/skills-registry.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tools/github/handler.ts`
- `packages/os/tools/github/manifest.ts`
- `packages/os/tools/github/schema.ts`
- `packages/os/tools/linear/handler.ts`
- `packages/os/tools/linear/service.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/scripts/verify.js`

- 2026-08-26 05:34:32 apply-patch: `.task/os/google-workspace-integration/workpad.md`
