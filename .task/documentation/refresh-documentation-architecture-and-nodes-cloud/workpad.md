# Refresh documentation architecture and Nodes

branch: `task/documentation/refresh-documentation-architecture-and-nodes-cloud`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1897/refresh-documentation-architecture-and-nodes-cloud
github pr: https://github.com/consuelohq/opensaas/pull/1897
started: 2026-08-12

## acceptance criteria

- [x] Change only `packages/documentation/**` plus task metadata.
- [x] Use current remote-main behavior as product truth; do not merge or copy the stale `stream/documentation` implementation into this task.
- [x] Make the global documentation order exactly `Start → Connect → Nodes → Tools → Skills → Steering → Memory → Observe → Secure → Reference`.
- [x] Make **Nodes** the one top-level home for local nodes, cloud nodes, node roles/presence, default-node selection, explicit routing, and task-owned routing. Remove Nodes from the Connect information architecture.
- [x] Preserve old browser and Markdown URLs with redirects when node pages move; do not leave duplicate canonical explanations behind.
- [x] Rewrite node/cloud guidance from current code and tests. Clearly distinguish `home` as an enrollment role from the mutable `defaultNodeId`, and distinguish default, explicit, and task-owned routing.
- [x] Document the current cloud-node launcher/pricing/provisioning boundary exactly as shipped; label unavailable behavior as planned/preview rather than implying it exists.
- [x] Update Start, Connect, Steering, Observe, Secure, and Reference where the recent node-routing/cloud epic materially changed what a user needs to understand.
- [x] Audit served but unnavigated legacy pages (`developers/**`, `user-guide/**`, legacy `os/**`) and remove or redirect pages that are obsolete rather than keeping zombie documentation.
- [x] Update `AUTHORING.md` to the current 10-section architecture and the workspace “How to Speak” model: orient first, simple mental model before mechanism, evidence where useful, clear next move.
- [x] Keep generated Skill Template pages exact; do not editorialize `build/skills/bundled/**`.
- [ ] Pass focused navigation/content tests, documentation validation, relevant browser regressions, production build, strict review, and full verify.

## plan

1. Verify the current remote-main Nodes/cloud/routing behavior from launcher, gateway, routing, steering, trace, and managed-cloud tests and source.
2. Write the navigation contract first: add top-level Nodes, remove Nodes from Connect, and specify canonical `/nodes/` routes plus compatibility redirects.
3. Run the focused test red before production edits.
4. Implement the Nodes section and rewrite the affected cross-section pages using the human-first writing model.
5. Remove or redirect obsolete hidden legacy docs after checking their current role and redirect dependencies.
6. Update authoring/validation/redirect registries and any evidence ledgers required by the package contract.
7. Run focused tests, validation, browser checks, release build, review, and verify; then publish the task branch for review.

## Test-first contract

- Behavior under test: the docs expose 10 top-level user intents with `Nodes` after `Connect`; old node URLs remain compatible; breadcrumbs/footer/sidebar resolve node pages to the new Nodes section; obsolete node canonical pages do not remain under Connect/Start.
- Existing pattern: `packages/documentation/tests/foundation.test.ts` owns registry-derived global links, breadcrumbs, footer columns, top-level route scaffolding, and source contracts.
- Changed test: extend `foundation.test.ts` before implementation; keep this in the existing test harness rather than adding another suite.
- Focused red command: `bun run --cwd packages/documentation test:foundation`.
- Expected red failure: current registry has only 9 top-level sections, no `/nodes/` route, Connect still owns Nodes, and node breadcrumbs/compatibility targets do not match the approved architecture.

## discovery

- Current `main` already split Tools, Skills, Steering, and Memory into top-level sections and already nests Sites under Tools; the remaining architecture mismatch is that Connect still owns Nodes.
- Local `main` was behind remote and had unrelated user-owned dirt. `task.start` created this isolated task directly from current `main` source SHA `7a77a4af…`, so no user-owned checkout changes were required.
- `stream/documentation` is stale and a `stream.sync` dry worktree merge hit content conflicts in documentation chrome/navigation files. No conflicts were resolved and no stream code was copied into this task.
- Current node control-plane tests prove a workspace has a separate `homeNodeId` and mutable `defaultNodeId`; launcher/session APIs can list safe node metadata and change the default node with CSRF protection.
- Current routing tests prove requests can route by default node, explicit node, or task ownership, and propagate routing context with current/default node plus node presence.
- Current steering tests prove `get_steering` can expose current/default/available node context and route source.
- Current trace tests persist requested/resolved/default node IDs, resolved node name, and route source, and the trace inspector exposes node/route labels.
- Current launcher tests expose authenticated cloud pricing with public plans/regions. The merged Nodes UI exposes plan/region/quote selection but disables the final action as `Provisioning coming soon`; the public installer cloud branch still hands setup to Consuelo and exits before local provisioning.
- Existing `AUTHORING.md` is stale: it still describes seven top-level intents (`Build with OS` and `Sites`) rather than the nine sections already on current main, let alone the approved Nodes section.
- The served docs tree contains 132 MDX files, including legacy `developers/**`, `user-guide/**`, and `os/**` pages that are not part of current global navigation and must be audited rather than silently retained.

## current status

- Implementation complete in the isolated documentation task.
- Top-level navigation is now `Start → Connect → Nodes → Tools → Skills → Steering → Memory → Observe → Secure → Reference`.
- Nodes owns the canonical local/cloud/default/explicit/task routing model; old Start/Connect node pages are removed behind compatibility redirects.
- Hidden stale CRM/Twenty-era developer, user-guide, and legacy OS pages were removed or migrated, with inbound redirects retargeted to current canonical docs.
- Subagents now have a current Tools page sourced from the merged facade/tool schema instead of the obsolete legacy OS page.
- Static tests, documentation validation, translation, all browser regression suites, release build, evidence-path audit, package-boundary check against `origin/main`, and strict review are green.
- Next: publish the task branch, rerun strict review against the committed diff, then hand the PR back for review.

## files changed

- `.task/documentation/refresh-documentation-architecture-and-nodes-cloud/workpad.md`
- `packages/documentation/AUTHORING.md`
- `packages/documentation/evidence/nodes-claims.md`
- `packages/documentation/scripts/test-build-browser.mjs`
- `packages/documentation/src/content/docs/nodes/cloud.mdx`
- `packages/documentation/src/content/docs/nodes/index.mdx`
- `packages/documentation/src/content/docs/nodes/local.mdx`
- `packages/documentation/src/content/docs/nodes/routing.mdx`
- `packages/documentation/src/content/docs/tools/subagents.mdx`
- `packages/documentation/tests/nodes.test.ts`

## workspace-owned: files changed

- `.task/documentation/refresh-documentation-architecture-and-nodes-cloud/workpad.md`
- `packages/documentation/AUTHORING.md`
- `packages/documentation/evidence/nodes-claims.md`
- `packages/documentation/scripts/test-build-browser.mjs`
- `packages/documentation/src/content/docs/nodes/cloud.mdx`
- `packages/documentation/src/content/docs/nodes/index.mdx`
- `packages/documentation/src/content/docs/nodes/local.mdx`
- `packages/documentation/src/content/docs/nodes/routing.mdx`
- `packages/documentation/src/content/docs/tools/subagents.mdx`
- `packages/documentation/tests/nodes.test.ts`

## workspace-owned: activity log

- 2026-08-12 19:02:15 fs.write: `.task/documentation/refresh-documentation-architecture-and-nodes-cloud/workpad.md`
- 2026-08-12 19:05:47 fs.write: `packages/documentation/src/content/docs/nodes/index.mdx`
- 2026-08-12 19:05:47 fs.write: `packages/documentation/src/content/docs/nodes/local.mdx`
- 2026-08-12 19:05:48 fs.write: `packages/documentation/src/content/docs/nodes/cloud.mdx`
- 2026-08-12 19:05:48 fs.write: `packages/documentation/src/content/docs/nodes/routing.mdx`
- 2026-08-12 19:06:39 fs.write: `packages/documentation/tests/nodes.test.ts`
- 2026-08-12 19:08:16 fs.write: `packages/documentation/AUTHORING.md`
- 2026-08-12 19:14:26 fs.write: `packages/documentation/src/content/docs/tools/subagents.mdx`
- 2026-08-12 19:14:26 fs.write: `packages/documentation/evidence/nodes-claims.md`
- 2026-08-12 19:27:11 fs.write: `packages/documentation/scripts/test-build-browser.mjs`
- 2026-08-12: read docs package guidance, current navigation, authoring contract, page inventory, and current OS node/routing/cloud tests.
- 2026-08-12: recorded acceptance criteria, implementation plan, and test-first contract before production edits.
- 2026-08-12: task started from current `main` in an isolated worktree.

## workspace-owned: validation evidence

- 2026-08-12 19:10:42 `checkFiles`: passed — OK
- 2026-08-12 19:30:14 `review.run`: passed — OK
- Test-first red: `test:foundation` failed before production edits because Nodes was absent from the 9-section registry; a later Start semantics test also failed before `core-concepts.mdx` was updated.
- `bun test` in `packages/documentation`: 93 passed, 0 failed, 2796 expectations.
- `bun run validate`: passed with 105 selected public pages.
- `bun run test:translation`: passed.
- Browser regressions passed for foundation/mobile global navigation, Connect, Tools/Skills/Steering/Memory, Sites, Observe, Secure, and Reference.
- Evidence integrity audit: 117 current MDX pages, 241 checked evidence references, 0 missing repository evidence paths.
- `DOCUMENTATION_BOUNDARY_BASE=origin/main bun run test:boundary`: passed; every changed path is under `packages/documentation/**` or `.task/**`.
- `bun run docs:check`: passed, including the production Astro build.
- `bun run docs:deploy -- --build-only`: passed (`build complete. skipping deploy.`).
- Strict review against `origin/main`: 0 issues in task changes, 0 blocking issues; one pre-existing project note reports no Nx `typecheck` target.

## key decisions

- `Nodes` is a top-level section, not a Connect subsection.
- Canonical node information will be consolidated instead of duplicating “home/local/cloud” explanations across Start and Connect.
- Keep the recent main-branch compatibility design for Tools/Skills/Steering/Sites child URLs unless this task finds a concrete correctness reason to move them; do not create unrelated route churn.
- Preserve old node URLs as redirects rather than placeholder MDX files.
- Treat code/tests/runtime as authoritative; old docs and directional artifacts are inputs, not evidence of shipped behavior.

## notes for ko

- The task is based on current main, not the stale local checkout or stale documentation stream.
- Cloud copy now states both current truths: the Nodes UI can compare plans/regions/quotes, while the final self-service action is still disabled as `Provisioning coming soon`.

## improvements noticed

- The existing validation list treated several old hidden CRM/developer pages as curated even though current navigation did not expose them. Those stale pages are now removed or migrated and their old URLs/inbound redirects resolve to current canonical docs.

## issues and recovery

- `stream.sync` found conflicts in documentation chrome/navigation. Because remote main is the requested truth and the stream is stale, the task was started from main instead of resolving those unrelated conflicts.
- The default package-boundary script chooses `origin/stream/documentation` for documentation task branches. That baseline is stale relative to the user-approved current main and therefore reports unrelated main changes. Validation was rerun with its documented `DOCUMENTATION_BOUNDARY_BASE=origin/main` override and passed.
- Browser/build tests initially resolved the task worktree's package-level `node_modules` symlink back into the stale local checkout, which broke Vite virtual-module identity. For validation only, dependencies were copied locally into the task worktree; after browser/build validation they were restored to the original untracked symlink. No dependency files are part of the task diff.

---

## publish checklist

```bash
bun run task:push -- --message "docs(documentation): refresh nodes and documentation architecture" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-12 19:02:15 write: `.task/documentation/refresh-documentation-architecture-and-nodes-cloud/workpad.md`

## workspace-owned: files read

- `packages/documentation/AUTHORING.md`
- `packages/documentation/evidence/connect-claims.md`
- `packages/documentation/package.json`
- `packages/documentation/scripts/check-package-boundary.mjs`
- `packages/documentation/scripts/test-boundary.mjs`
- `packages/documentation/scripts/test-build-browser.mjs`
- `packages/documentation/scripts/test-connect-browser.mjs`
- `packages/documentation/scripts/test-foundation-browser.mjs`
- `packages/documentation/scripts/test-sites-browser.mjs`
- `packages/documentation/scripts/validate-documentation.mjs`
- `packages/documentation/src/content/docs/build/index.mdx`
- `packages/documentation/src/content/docs/build/steering/how-steering-works.mdx`
- `packages/documentation/src/content/docs/connect/index.mdx`
- `packages/documentation/src/content/docs/developers/agent/crm-tools.mdx`
- `packages/documentation/src/content/docs/developers/agent/overview.mdx`
- `packages/documentation/src/content/docs/developers/api/auth.mdx`
- `packages/documentation/src/content/docs/developers/api/contacts.mdx`
- `packages/documentation/src/content/docs/developers/api/graphql.mdx`
- `packages/documentation/src/content/docs/developers/api/overview.mdx`
- `packages/documentation/src/content/docs/developers/api/voice.mdx`
- `packages/documentation/src/content/docs/developers/introduction.mdx`
- `packages/documentation/src/content/docs/index.mdx`
- `packages/documentation/src/content/docs/memory/index.mdx`
- `packages/documentation/src/content/docs/observe/artifacts.mdx`
- `packages/documentation/src/content/docs/observe/runs.mdx`
- `packages/documentation/src/content/docs/observe/tool-calls.mdx`
- `packages/documentation/src/content/docs/observe/traces.mdx`
- `packages/documentation/src/content/docs/os/concepts/data-model-and-graphql.mdx`
- `packages/documentation/src/content/docs/os/tools/subagents.mdx`
- `packages/documentation/src/content/docs/reference/cli.mdx`
- `packages/documentation/src/content/docs/reference/glossary.mdx`
- `packages/documentation/src/content/docs/reference/mcp.mdx`
- `packages/documentation/src/content/docs/reference/result-and-error-formats.mdx`
- `packages/documentation/src/content/docs/reference/tools.mdx`
- `packages/documentation/src/content/docs/reference/urls-and-ports.mdx`
- `packages/documentation/src/content/docs/secure/approvals.mdx`
- `packages/documentation/src/content/docs/secure/index.mdx`
- `packages/documentation/src/content/docs/secure/nodes-and-network-access.mdx`
- `packages/documentation/src/content/docs/secure/security-model.mdx`
- `packages/documentation/src/content/docs/secure/tailscale.mdx`
- `packages/documentation/src/content/docs/sites/index.mdx`
- `packages/documentation/src/content/docs/skills/index.mdx`
- `packages/documentation/src/content/docs/start/core-concepts.mdx`
- `packages/documentation/src/content/docs/start/index.mdx`
- `packages/documentation/src/content/docs/steering/index.mdx`
- `packages/documentation/src/content/docs/tools/index.mdx`
- `packages/documentation/src/content/docs/tools/tool-list.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/glossary.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/implementation-services.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/keyboard-shortcuts.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/how-tos/configure-your-workspace.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/how-tos/navigate-around-consuelo.mdx`
- `packages/documentation/src/content/docs/user-guide/glossary.mdx`
- `packages/documentation/src/content/docs/user-guide/user-stories-use-cases.mdx`
- `packages/documentation/src/content/docs/user-guide/user-stories.mdx`
- `packages/documentation/src/lib/docs-navigation.ts`
- `packages/documentation/src/lib/legacy-redirects.mjs`
- `packages/documentation/tests/build.test.ts`
- `packages/documentation/tests/connect.test.ts`
- `packages/documentation/tests/foundation.test.ts`
- `packages/documentation/tests/nodes.test.ts`
- `packages/documentation/tests/reference.test.ts`
- `packages/documentation/tests/secure.test.ts`
- `packages/documentation/tests/start.test.ts`
- `packages/os/docs/install-modes-and-cloud-provisioning.md`
- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/tests/launcher-nodes-control-plane.test.ts`
- `packages/os/tests/launcher-nodes-materialization.test.ts`
- `packages/os/tests/managed-cloud-node-enrollment-cli.test.ts`
- `packages/os/tests/managed-cloud-node-lifecycle-onboarding.test.ts`
- `packages/os/tests/subagent-orchestration-contract.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/os/tools/subagent/manifest.ts`
- `packages/os/tools/subagent/schema.ts`

- 2026-08-12 19:36:10 apply-patch: `.task/documentation/refresh-documentation-architecture-and-nodes-cloud/workpad.md`