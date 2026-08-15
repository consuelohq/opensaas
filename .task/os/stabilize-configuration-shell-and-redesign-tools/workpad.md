# stabilize configuration shell and redesign tools — Overview refinement

branch: `task/os/stabilize-configuration-shell-and-redesign-tools`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2030/stabilize-configuration-shell-and-redesign-tools
github pr: https://github.com/consuelohq/opensaas/pull/2030
started: 2026-08-15

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.

## plan

1. Extend the critical workspace-shell regression suite before implementation.
2. Make Overview the durable root and first unsectioned route-picker item.
3. Add Tufte-style readiness context, Guides/Documentation, mobile centering, and semantic light/dark chrome.
4. Validate the focused shell suite, CWD-sensitive lifecycle/materialization suites, browser geometry/theme behavior, strict review, and formal task verification.

## current status

- Implementation complete. Focused workspace-shell tests, neighboring lifecycle/materialization tests, syntax, selection-rule tests, desktop/light and mobile/dark browser checks, strict review, and formal task verification are green. Ready to publish.

## files changed

- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/launcher-local-customization.test.ts`
- `packages/os/tests/launcher-nodes-materialization.test.ts`
- `packages/os/tests/local-agent-connectivity.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/sites-cli.test.ts`

## workspace-owned: files changed

- Same files as `files changed`; all edits were made through the task-scoped filesystem.

## workspace-owned: activity log

- 2026-08-15 06:47:49 fs.write: `.task/os/stabilize-configuration-shell-and-redesign-tools/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 06:49 focused RED: workspace shell tests failed on the intended root/menu/theme/Overview assertions (`trc_51cd4e86f185`).
- 2026-08-15 06:51 focused GREEN: 3 files / 19 tests passed (`trc_5966286ab46a`).
- 2026-08-15 06:53 CWD-sensitive neighboring suites: 3 files / 48 tests passed (`trc_4287b5ad6556`).
- 2026-08-15 06:53 selection-registry contract: 37 tests passed (`trc_c05774f529dc`).
- 2026-08-15 06:54 critical workspace-shell command + syntax: 7 files / 69 tests passed and syntax checks passed (`trc_424f6c86e7b9`).
- 2026-08-15 06:54 browser light/desktop: Overview first, Documentation present, menu center 720 on 1440px viewport, light chrome/menu tokens resolved (`trc_9e281afc20ba`).
- 2026-08-15 06:54 browser dark/mobile: menu center 201 on 402px viewport, groups Observe/Configure/Guides, `/docs` last, dark chrome/menu tokens resolved (`trc_66495657ce6f`).
- 2026-08-15 06:56:14 `review.run`: passed — OK
- 2026-08-15 06:57 formal `verify`: passed; publishValid=true (`trc_7705d6a18c90`).
- 2026-08-15 06:57:43 `verify`: passed — OK
- 2026-08-15 06:58:35 `verify`: passed — OK

## key decisions

- The root route is a materialization contract, not a redirect: `buildSitesIndex()` renders Overview so daemon refresh/update/restart cannot regenerate Nodes or the retired launcher.
- Overview remains static-shell safe; all workspace readiness data hydrates from the existing signed `/gateway/configuration/snapshot` path.
- The route picker owns its own semantic theme tokens so the same component can override both Configuration and Tracing vendor chrome without weakening either page's data/auth boundary.

## notes for ko

- Overview is now the intended workspace home; Nodes remains a first-class focused surface at `/nodes`.
- Disabled Tool recovery, shared Tracing chrome, and signed-edge behavior from the earlier task scope are preserved.

## improvements noticed

- Keep the `os-internal-workspace-shell` rule critical + exclusive; it is the loud regression gate for these materialization/UI contracts.

## issues and recovery

- An initial multi-suite run from repository root produced false failures for tests that intentionally use `packages/os`-relative imports. Re-running from `packages/os` passed 48/48; the canonical critical selection command already uses `bun --cwd packages/os`.
- One attempted safety search contained a forbidden fixture literal and was rejected before dispatch as `mcp_network_error`; ordinary read-only OS calls immediately remained healthy. No restart was performed.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/capabilities.ts`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/settings-snapshot.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/launcher-local-customization.test.ts`
- `packages/os/tests/launcher-nodes-materialization.test.ts`
- `packages/os/tests/local-agent-connectivity.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/sites-cli.test.ts`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## Acceptance criteria — Overview refinement

- [x] `/` materializes the authenticated Overview surface and daemon refresh/restart cannot revert root to Nodes or the retired launcher.
- [x] The shared route picker starts with an unsectioned Overview item, then grouped workspace routes, and ends with a Guides section containing Documentation.
- [x] Overview uses the same Tufte-inspired, direct-labeled data language as Tools: high data-ink ratio, no legend/grid chrome, a meaningful readiness comparison, accessible text, and responsive layout.
- [x] The route picker is centered against the viewport on mobile rather than offset from the title/control column.
- [x] The shared top bar and route picker use semantic light/dark tokens and follow `prefers-color-scheme` on Configuration and Tracing surfaces.
- [x] Existing Tracing, Nodes, Tools, and Secrets navigation remains intact and private state continues to hydrate only through signed same-origin gateways.
- [x] Loud regression coverage protects root/default routing, route order/grouping, Documentation, mobile menu centering, light/dark chrome tokens, and the Overview visualization contract.

## Plan — Overview refinement

1. Extend the existing workspace-shell regression suite first and prove current root/menu/theme/Overview behavior fails the new contract.
2. Refactor shared workspace chrome routing/theme primitives; keep the browser script and security boundaries unchanged.
3. Change Sites root materialization to Overview and redesign Overview around direct-labeled workspace readiness plus compact identity/connection/source-control detail.
4. Run focused Settings/Sites/Tracing tests, then selected OS verification and strict review before publishing the task branch.

## Test-first contract — Overview refinement

behavior under test: root defaults to Overview; Overview is unsectioned and first in the picker; Guides/Documentation is last; mobile menu is viewport-centered; shared chrome follows light/dark mode; Overview exposes a direct-labeled readiness visualization without embedding private state.
existing local pattern: `packages/os/tests/settings-site.test.ts`, `packages/os/tests/launcher-nodes-materialization.test.ts`, and `packages/os/tests/observability-traces-site.test.ts` assert generated private-site HTML contracts.
new or changed tests: extend those focused HTML/materialization tests with the routing, grouping, responsive-theme, and Overview visualization assertions above.
focused red command: `bunx vitest run packages/os/tests/settings-site.test.ts packages/os/tests/launcher-nodes-materialization.test.ts packages/os/tests/observability-traces-site.test.ts`
expected red failure: current root renders Nodes; Overview is grouped under Configure; no Guides/Documentation route exists; mobile menu is right-offset; shared menu/top-bar colors are dark literals; Overview has no readiness visualization.
no-test waiver: not applicable.

- 2026-08-15 06:47:49 append: `.task/os/stabilize-configuration-shell-and-redesign-tools/workpad.md`

- 2026-08-15 06:48:01 apply-patch: `packages/os/tests/settings-site.test.ts`
- 2026-08-15 06:48:06 apply-patch: `packages/os/tests/launcher-nodes-materialization.test.ts`
- 2026-08-15 06:48:11 apply-patch: `packages/os/tests/observability-traces-site.test.ts`
- 2026-08-15 06:49:24 apply-patch: `packages/os/tests/settings-site.test.ts`
- 2026-08-15 06:49:27 apply-patch: `packages/os/tests/observability-traces-site.test.ts`

- 2026-08-15 06:49:52 apply-patch: `packages/os/scripts/lib/workspace-chrome.ts`

- 2026-08-15 06:50:59 apply-patch: `packages/os/scripts/lib/settings-site.ts`
- 2026-08-15 06:51:05 apply-patch: `packages/os/scripts/lib/settings-site.ts`
- 2026-08-15 06:51:16 apply-patch: `packages/os/scripts/lib/settings-site.ts`
- 2026-08-15 06:51:22 apply-patch: `packages/os/scripts/lib/sites.ts`

- 2026-08-15 06:51:39 apply-patch: `packages/os/tests/install-state.test.ts`
- 2026-08-15 06:51:43 apply-patch: `packages/os/tests/launcher-local-customization.test.ts`
- 2026-08-15 06:51:46 apply-patch: `packages/os/tests/local-agent-connectivity.test.ts`
- 2026-08-15 06:51:50 apply-patch: `packages/os/tests/sites-cli.test.ts`
- 2026-08-15 06:52:01 apply-patch: `packages/os/scripts/lib/settings-site.ts`

- 2026-08-15 06:56:55 apply-patch: `.task/os/stabilize-configuration-shell-and-redesign-tools/workpad.md`

- 2026-08-15 06:57:03 apply-patch: `.task/os/stabilize-configuration-shell-and-redesign-tools/workpad.md`

- 2026-08-15 06:57:53 apply-patch: `.task/os/stabilize-configuration-shell-and-redesign-tools/workpad.md`
