# replace browser auth profiles with persistent headed handoff

branch: `task/tooling/replace-browser-auth-profiles-with-persistent-headed-handoff`
stream: `stream/tooling`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1388/replace-browser-auth-profiles-with-persistent-headed-handoff
github pr: https://github.com/consuelohq/opensaas/pull/1388
started: 2026-07-10

## acceptance criteria

- [x] Add `browser.headed` as the public human-login/MFA/CAPTCHA/passkey handoff tool in workspace and OS.
- [x] Reuse the existing persistent browser data directory; do not migrate, clear, inspect, or log its authentication data.
- [x] A headed handoff closes an incompatible daemon, opens the requested URL visibly, and leaves the browser running.
- [x] `browser.open({ headed: true })` delegates to the headed lifecycle for compatibility; ordinary opens do not restart the daemon.
- [x] Remove `browser.login` and `browser.reauth` from CLI help, typed manifests, schemas, generated clients/docs, skills, fixtures, and tool search.
- [x] Add a safe `browser.status` tool that reports daemon/page metadata without cookie or storage values.
- [x] Put process execution and session lifecycle behind injectable Effect services, while retaining agent-browser as the underlying CLI.
- [x] Keep workspace and OS browser implementations byte-identical where practical and update parity classification.
- [x] Prove behavior with focused tests, facade/manifest generation checks, review, verify, and a live headed persistence smoke test.

## plan

1. Write failing service and public-contract tests in both packages.
2. Add shared Effect browser config/process/session/service modules and a thin CLI adapter.
3. Replace the two browser scripts with identical compatibility entrypoints.
4. Update schemas and manifests, remove auth-vault tools, add headed/status, then regenerate derived manifests, docs, and clients.
5. Update browser skill/docs/fixtures and parity classification.
6. Run focused tests, package tests/typechecks, review, verify, and live headed persistence proof.

## test-first contract

- Behavior: headed handoff restarts the daemon, uses the existing persistent browser home, opens the exact URL with `--headed`, and never closes afterward.
- Behavior: headed/open compatibility never invokes `auth login` or username-field detection.
- Behavior: ordinary open reuses the same browser home without restarting the daemon.
- Behavior: status returns safe session/page metadata and never exposes cookie or storage values.
- Behavior: public manifests contain `browser.headed` and `browser.status`, and omit `browser.login`/`browser.reauth`.
- Existing pattern: `scripts/lib/code-call/*` Effect service with injected process boundary and a thin CLI adapter.
- New tests: `packages/workspace/tests/browser-service.test.ts`, `packages/os/tests/browser-service.test.ts`.
- Focused red command: `bunx vitest run packages/workspace/tests/browser-service.test.ts packages/os/tests/browser-service.test.ts`.
- Expected red failure: browser Effect service module and headed/status manifest entries do not exist; legacy auth tools remain.

## current status

- Implementation complete and live-headed behavior proven against Cloudflare using the existing `/Users/kokayi/.agent-browser-ko` browser home.
- `browser.headed` starts a visible daemon at `about:blank`, navigates through the same daemon to the requested URL, and leaves it running.
- `browser.status` and `browser.snap` continued against the same active Cloudflare page after the headed command returned.
- Public `browser.login` and `browser.reauth` tools are removed; direct legacy CLI calls fail concisely and direct users to `browser.headed <url>`.
- Repository review and full verification are clean with a publish-valid stamp; publish is next.

## files changed

- `packages/workspace/scripts/browser.js`
- `packages/workspace/scripts/lib/browser/{cli,config,errors,process,service,types}.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/tests/browser-service.test.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/manifests/tool-manifest.json`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/TOOLS.md`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/os/scripts/browser.js`
- `packages/os/scripts/lib/browser/{cli,config,errors,process,service,types}.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/tests/browser-service.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/src/generated/workspace.d.ts`
- `packages/os/TOOLS.md`
- `packages/os/SCRIPTS.md`
- `packages/os/skills/browser/SKILL.md`
- `packages/os/skills/skills.json`
- `packages/os/tests/fixtures/skills/browser-workspace.SKILL.md`
- `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/os/tooling/script-parity-classifications.json`
- `packages/documentation/src/content/docs/os/tools/browser-tools.mdx`
- task metadata under `.task/tooling/replace-browser-auth-profiles-with-persistent-headed-handoff/` and `.task/tasks/tooling/`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-10 23:26:00 `review.run`: passed — OK
- 2026-07-10 23:26:56 `review.run`: passed — OK
- 2026-07-10 23:27:24 `verify`: passed — OK
- 2026-07-10 23:27:51 `verify`: passed — OK

## key decisions

- `browser.headed` is the public human-authentication handoff; named auth-vault profiles are removed from the public surface.
- The persistent browser data directory remains an internal implementation detail and stays at the existing resolved path.
- Effect owns process/lifecycle/error composition; agent-browser continues to own Chromium/CDP/browser automation.
- Browser daemon state is durable external state and must not be finalized/closed when an Effect completes.

## notes for ko

- Existing login state will be preserved in place; this task does not read or copy cookie values.

## improvements noticed

- The two browser wrappers have drifted and are currently classified high-risk `changed-needs-review`; this task will converge them.

## issues and recovery

- Initial combined facade snapshot update polluted unrelated snapshots; restored both files and applied only the four intended browser snapshot replacements.
- First live headed proof left the page at `about:blank`; split visible-daemon launch from target navigation, added red command-order contracts, and reproved live Cloudflare navigation.
- Full parity inventory audit reports unrelated pre-existing baseline omissions. This task does not classify 41 unrelated scripts; dedicated browser byte-parity tests cover the changed runtime.

---

## publish checklist

```bash
bun run task:push -- --message "feat(tooling): add persistent headed browser handoff" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.task/tasks/tooling/replace-browser-auth-profiles-with-persistent-headed-handoff.json`, `.task/tooling/replace-browser-auth-profiles-with-persistent-headed-handoff/current.json`, `.task/tooling/replace-browser-auth-profiles-with-persistent-headed-handoff/session.json`, `.task/tooling/replace-browser-auth-profiles-with-persistent-headed-handoff/verify.json`, `.task/tooling/replace-browser-auth-profiles-with-persistent-headed-handoff/workpad.md`, `packages/documentation/src/content/docs/os/tools/browser-tools.mdx`, `packages/os/SCRIPTS.md`, `packages/os/TOOLS.md`, `packages/os/manifests/tool.manifest.json`, `packages/os/scripts/browser.js`, `packages/os/scripts/lib/browser/cli.ts`, `packages/os/scripts/lib/browser/config.ts`, `packages/os/scripts/lib/browser/errors.ts`, `packages/os/scripts/lib/browser/process.ts`, `packages/os/scripts/lib/browser/service.ts`, `packages/os/scripts/lib/browser/types.ts`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/skills/browser/SKILL.md`, `packages/os/skills/skills.json`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tests/browser-service.test.ts`, `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`, `packages/os/tests/fixtures/skills/browser-workspace.SKILL.md`, `packages/os/tooling/dev-tool-manifest.json`, `packages/os/tooling/script-parity-classifications.json`, `packages/workspace/SCRIPTS.md`, `packages/workspace/TOOLS.md`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/scripts/browser.js`, `packages/workspace/scripts/lib/browser/cli.ts`, `packages/workspace/scripts/lib/browser/config.ts`, `packages/workspace/scripts/lib/browser/errors.ts`, `packages/workspace/scripts/lib/browser/process.ts`, `packages/workspace/scripts/lib/browser/service.ts`, `packages/workspace/scripts/lib/browser/types.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/browser-service.test.ts`, `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none
