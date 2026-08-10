# write verified Consuelo OS getting-started journey

branch: `task/documentation/write-verified-consuelo-os-getting-started-journey`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1449/write-verified-consuelo-os-getting-started-journey
github pr: https://github.com/consuelohq/opensaas/pull/1449
started: 2026-07-13

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Implementation and local verification complete. Ready for full verify, push, PR merge, and cleanup.

## files changed

- `packages/documentation/evidence/start-claims.md`
- `packages/documentation/node_modules` (deleted)
- `packages/documentation/src/content/docs/os/concepts/local-and-cloud.mdx` (deleted)
- `packages/documentation/src/content/docs/os/getting-started/connect-agents.mdx` (deleted)
- `packages/documentation/src/content/docs/os/getting-started/install.mdx` (deleted)
- `packages/documentation/src/content/docs/os/getting-started/workspace-launcher.mdx` (deleted)
- `packages/documentation/src/content/docs/os/how-it-works.mdx` (deleted)
- `packages/documentation/src/content/docs/os/overview.mdx` (deleted)
- `packages/documentation/src/content/docs/start/connect-your-first-agent.mdx`
- `packages/documentation/src/content/docs/start/core-concepts.mdx`
- `packages/documentation/src/content/docs/start/create-a-workspace.mdx`
- `packages/documentation/src/content/docs/start/index.mdx`
- `packages/documentation/src/content/docs/start/install-consuelo-os.mdx`
- `packages/documentation/src/content/docs/start/local-and-consuelo-cloud.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/what-is-consuelo.mdx` (deleted)
- `packages/documentation/src/content/docs/user-guide/getting-started/how-tos/create-workspace.mdx` (deleted)
- `packages/documentation/src/content/docs/user-guide/introduction.mdx` (deleted)
- `packages/documentation/tests/start.test.ts`

## workspace-owned: files changed

- `packages/documentation/evidence/start-claims.md`
- `packages/documentation/node_modules` (deleted)
- `packages/documentation/src/content/docs/os/concepts/local-and-cloud.mdx` (deleted)
- `packages/documentation/src/content/docs/os/getting-started/connect-agents.mdx` (deleted)
- `packages/documentation/src/content/docs/os/getting-started/install.mdx` (deleted)
- `packages/documentation/src/content/docs/os/getting-started/workspace-launcher.mdx` (deleted)
- `packages/documentation/src/content/docs/os/how-it-works.mdx` (deleted)
- `packages/documentation/src/content/docs/os/overview.mdx` (deleted)
- `packages/documentation/src/content/docs/start/connect-your-first-agent.mdx`
- `packages/documentation/src/content/docs/start/core-concepts.mdx`
- `packages/documentation/src/content/docs/start/create-a-workspace.mdx`
- `packages/documentation/src/content/docs/start/index.mdx`
- `packages/documentation/src/content/docs/start/install-consuelo-os.mdx`
- `packages/documentation/src/content/docs/start/local-and-consuelo-cloud.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/what-is-consuelo.mdx` (deleted)
- `packages/documentation/src/content/docs/user-guide/getting-started/how-tos/create-workspace.mdx` (deleted)
- `packages/documentation/src/content/docs/user-guide/introduction.mdx` (deleted)
- `packages/documentation/tests/start.test.ts`

## workspace-owned: activity log

- 2026-07-13 05:32:34 fs.write: `.task/documentation/write-verified-consuelo-os-getting-started-journey/workpad.md`
- 2026-07-13 05:36:25 fs.write: `packages/documentation/tests/start.test.ts`
- 2026-07-13 05:37:21 fs.write: `.task/documentation/write-verified-consuelo-os-getting-started-journey/workpad.md`
- 2026-07-13 05:39:59 fs.write: `packages/documentation/src/content/docs/start/index.mdx`
- 2026-07-13 05:39:59 fs.write: `packages/documentation/src/content/docs/start/install-consuelo-os.mdx`
- 2026-07-13 05:40:00 fs.write: `packages/documentation/src/content/docs/start/create-a-workspace.mdx`
- 2026-07-13 05:40:27 fs.write: `packages/documentation/src/content/docs/start/connect-your-first-agent.mdx`
- 2026-07-13 05:40:27 fs.write: `packages/documentation/src/content/docs/start/local-and-consuelo-cloud.mdx`
- 2026-07-13 05:40:27 fs.write: `packages/documentation/src/content/docs/start/core-concepts.mdx`
- 2026-07-13 05:40:53 fs.write: `packages/documentation/evidence/start-claims.md`
- 2026-07-13 05:41:40 fs.trash: `packages/documentation/src/content/docs/os/overview.mdx`
- 2026-07-13 05:41:40 fs.trash: `packages/documentation/src/content/docs/os/how-it-works.mdx`
- 2026-07-13 05:41:41 fs.trash: `packages/documentation/src/content/docs/os/getting-started/install.mdx`
- 2026-07-13 05:41:41 fs.trash: `packages/documentation/src/content/docs/os/getting-started/connect-agents.mdx`
- 2026-07-13 05:41:41 fs.trash: `packages/documentation/src/content/docs/os/getting-started/workspace-launcher.mdx`
- 2026-07-13 05:41:41 fs.trash: `packages/documentation/src/content/docs/os/concepts/local-and-cloud.mdx`
- 2026-07-13 05:41:42 fs.trash: `packages/documentation/src/content/docs/user-guide/introduction.mdx`
- 2026-07-13 05:41:42 fs.trash: `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/what-is-consuelo.mdx`
- 2026-07-13 05:41:42 fs.trash: `packages/documentation/src/content/docs/user-guide/getting-started/how-tos/create-workspace.mdx`
- 2026-07-13 05:44:36 fs.trash: `packages/documentation/node_modules`

## workspace-owned: validation evidence

- 2026-07-13 05:50:37 `review.run`: passed — OK
- 2026-07-13 05:52:00 `verify`: passed — OK

## key decisions

- Treat the archived OS specification as a map, never as proof of shipped behavior.
- Publish only behavior verified in the current installer/runtime source, focused tests, and an isolated dry run.
- Keep provider-specific detail shallow in Start; the Connect PR owns full provider guides.
- Describe Cloud as an assisted handoff because the current public bootstrap opens contact and exits before provisioning.

## notes for ko

- The Start journey now has six verified pages and removes nine directly superseded legacy pages.
- The installer emits two consecutive JSON records in `--json` dry-run mode: the provision plan and the hosted-bootstrap summary. Both were parsed and verified without filesystem mutation.

## improvements noticed

- Evidence-path existence is now enforced by the Start contract test, preventing stale or invented source/test citations.

## issues and recovery

- The documentation worktree initially inherited an absolute `node_modules` symlink with stale Astro/Vite paths. Replacing the worktree-only symlink with a frozen local install restored a clean production build; no dependency files changed.
- The focused MCP connectivity test exceeded Bun's default five-second test timeout once. The exact test passed with a 20-second timeout in 3.88 seconds.
- The first browser assertion used an ambiguous text locator. It was corrected to target the level-two heading and the browser suite passed.

---

## publish checklist

```bash
bun run task:push -- --message "type(documentation): description" --changed
bun run task:pr
bun run task:finish
```

## acceptance criteria

- [x] Change only `packages/documentation/**` plus workspace-owned task metadata.
- [x] Write and verify Start pages: Overview, Install Consuelo OS, Create a workspace, Connect your first agent, Local and Consuelo Cloud, Core concepts.
- [x] Treat the OS spec as directional; verify every material claim against current code, tests, and runtime behavior.
- [x] Keep the getting-started journey concise, executable, and honest about preview limitations.
- [x] Delete or redirect replaced legacy getting-started pages only after replacements are complete.
- [x] Add focused documentation tests before substantive implementation.
- [ ] Run package validation, build, browser checks, review, verify, publish, merge to `stream/documentation`, and clean up.

## test-first contract

1. Inventory the current Start scaffold, legacy getting-started docs, installer, workspace initialization, agent connection, and Cloud behavior.
2. Add focused failing tests for required Start routes, evidence metadata, executable commands, and removal of placeholder copy.
3. Record the red result before production documentation edits.
4. Write only claims supported by code, tests, and runtime evidence.
5. Run focused and full documentation validation before publish.

## discovery

- Direct explore and structured source scans are in progress.

- 2026-07-13 05:32:34 append: `.task/documentation/write-verified-consuelo-os-getting-started-journey/workpad.md`

## workspace-owned: files read

- `cloud`
- `packages/documentation/AUTHORING.md`
- `packages/documentation/README.md`
- `packages/documentation/astro.config.mjs`
- `packages/documentation/package.json`
- `packages/documentation/scripts/test-foundation-browser.mjs`
- `packages/documentation/scripts/validate-documentation.mjs`
- `packages/documentation/src/content.config.ts`
- `packages/documentation/src/content/docs/connect/index.mdx`
- `packages/documentation/src/content/docs/index.mdx`
- `packages/documentation/src/content/docs/os/concepts/configuration.mdx`
- `packages/documentation/src/content/docs/os/concepts/files-and-artifacts.mdx`
- `packages/documentation/src/content/docs/os/concepts/integrations-and-capabilities.mdx`
- `packages/documentation/src/content/docs/os/concepts/local-and-cloud.mdx`
- `packages/documentation/src/content/docs/os/concepts/mcp-ingress-security.mdx`
- `packages/documentation/src/content/docs/os/concepts/portal.mdx`
- `packages/documentation/src/content/docs/os/concepts/scripts.mdx`
- `packages/documentation/src/content/docs/os/getting-started/connect-agents.mdx`
- `packages/documentation/src/content/docs/os/getting-started/install.mdx`
- `packages/documentation/src/content/docs/os/getting-started/workspace-launcher.mdx`
- `packages/documentation/src/content/docs/os/glossary.mdx`
- `packages/documentation/src/content/docs/os/how-it-works.mdx`
- `packages/documentation/src/content/docs/os/overview.mdx`
- `packages/documentation/src/content/docs/start/index.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/what-is-consuelo.mdx`
- `packages/documentation/src/content/docs/user-guide/getting-started/how-tos/create-workspace.mdx`
- `packages/documentation/src/content/docs/user-guide/introduction.mdx`
- `packages/documentation/src/lib/docs-navigation.ts`
- `packages/documentation/src/lib/legacy-redirects.mjs`
- `packages/documentation/tests/foundation.test.ts`
- `packages/os/package.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/consuelo-home-layout.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/local-agent-connectivity.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- `packages/os/tests/installer-local-agent-connectivity.test.ts`
- `packages/os/tests/installer-onboarding-ui.test.ts`
- `packages/os/tests/installer-runtime-dependencies.test.ts`
- `packages/os/tests/launcher-onboarding.test.ts`
- `packages/os/tests/onboarding-skills.test.ts`
- `packages/workspace/senior-engineer.md`

- 2026-07-13 05:51:05 apply-patch: `.task/documentation/write-verified-consuelo-os-getting-started-journey/workpad.md`

## workspace-owned: test selection

- changed files: `.task/documentation/write-verified-consuelo-os-getting-started-journey/current.json`, `.task/documentation/write-verified-consuelo-os-getting-started-journey/evidence-log.json`, `.task/documentation/write-verified-consuelo-os-getting-started-journey/read-log.json`, `.task/documentation/write-verified-consuelo-os-getting-started-journey/session.json`, `.task/documentation/write-verified-consuelo-os-getting-started-journey/workpad.md`, `.task/tasks/documentation/write-verified-consuelo-os-getting-started-journey.json`, `packages/documentation/evidence/start-claims.md`, `packages/documentation/package.json`, `packages/documentation/scripts/test-foundation-browser.mjs`, `packages/documentation/scripts/validate-documentation.mjs`, `packages/documentation/src/content/docs/os/concepts/configuration.mdx`, `packages/documentation/src/content/docs/os/concepts/files-and-artifacts.mdx`, `packages/documentation/src/content/docs/os/concepts/integrations-and-capabilities.mdx`, `packages/documentation/src/content/docs/os/concepts/local-and-cloud.mdx`, `packages/documentation/src/content/docs/os/concepts/mcp-ingress-security.mdx`, `packages/documentation/src/content/docs/os/concepts/portal.mdx`, `packages/documentation/src/content/docs/os/concepts/scripts.mdx`, `packages/documentation/src/content/docs/os/getting-started/connect-agents.mdx`, `packages/documentation/src/content/docs/os/getting-started/install.mdx`, `packages/documentation/src/content/docs/os/getting-started/workspace-launcher.mdx`, `packages/documentation/src/content/docs/os/glossary.mdx`, `packages/documentation/src/content/docs/os/how-it-works.mdx`, `packages/documentation/src/content/docs/os/overview.mdx`, `packages/documentation/src/content/docs/start/connect-your-first-agent.mdx`, `packages/documentation/src/content/docs/start/core-concepts.mdx`, `packages/documentation/src/content/docs/start/create-a-workspace.mdx`, `packages/documentation/src/content/docs/start/index.mdx`, `packages/documentation/src/content/docs/start/install-consuelo-os.mdx`, `packages/documentation/src/content/docs/start/local-and-consuelo-cloud.mdx`, `packages/documentation/src/content/docs/user-guide/getting-started/capabilities/what-is-consuelo.mdx`, `packages/documentation/src/content/docs/user-guide/getting-started/how-tos/create-workspace.mdx`, `packages/documentation/src/content/docs/user-guide/introduction.mdx`, `packages/documentation/src/lib/docs-navigation.ts`, `packages/documentation/src/lib/legacy-redirects.mjs`, `packages/documentation/tests/start.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
