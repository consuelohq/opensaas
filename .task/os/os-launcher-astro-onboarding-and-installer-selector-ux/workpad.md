# OS launcher Astro onboarding and installer selector UX

branch: `task/os/os-launcher-astro-onboarding-and-installer-selector-ux`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1304/os-launcher-astro-onboarding-and-installer-selector-ux
github pr: https://github.com/consuelohq/opensaas/pull/1304
started: 2026-06-30

## acceptance criteria

- [x] Fix the installer selector so arrow-key movement redraws in place instead of duplicating the prompt.
- [x] Keep Branch 1 scoped to launcher/installer UX and local rendering; do not change Cloudflare/IP allow rules.
- [x] Add an Astro launcher source using the Consuelo website theme tokens as the architectural anchor for future Sites pages.
- [x] Update the launcher/meta page copy to connect ChatGPT to the workspace and preserve the dynamic MCP URL.
- [x] Add contact, location, status, and linked Systems Engineer details below the ChatGPT URL copy.
- [x] Add subtle right-side sections for Sites, Guides and Tips, and Writing with the requested labels.
- [x] Update empty local-agent copy to say no local agents are connected to the workspace yet.

## plan

1. Read OS task guidance, current Sites materialization, launcher renderer, installer selector, and Consuelo website Astro/theme files.
2. Add red tests for selector redraw, launcher copy/link taxonomy, workspace local-agent copy, and Astro source ownership.
3. Implement the in-place selector redraw and themed launcher content.
4. Validate OS focused tests, OS typecheck, website Astro build, review, and verify gates.

## current status

- Implementation and validation are complete. Ready to publish/promote through the task workflow.

## files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/lib/launcher-onboarding.ts`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/launcher-onboarding.test.ts`
- `packages/os/tests/sites-cli.test.ts`
- `packages/os/tests/launcher-astro-source.test.ts`
- `packages/consuelo-website/src/pages/os/launcher.astro`

## workspace-owned: files changed

- `.task/os/os-launcher-astro-onboarding-and-installer-selector-ux/workpad.md`
- `.task/tasks/os/os-launcher-astro-onboarding-and-installer-selector-ux.json`

## workspace-owned: activity log

- Started task branch `task/os/os-launcher-astro-onboarding-and-installer-selector-ux` from `main` for `stream/os`.
- Read `CODING-STANDARDS.md`, `AGENTS.md`, OS senior engineer/task guidance, launcher/Sites renderer, installer selector, release scripts, and website Astro theme files.
- Captured red tests before implementation: missing Astro source, old launcher copy, old empty local-agent copy, and duplicate-print selector expectations.
- Implemented selector ANSI in-place redraw without an extra newline per arrow key.
- Implemented launcher page copy, sections, metadata links, token-based colors, and empty workspace-local-agent copy.
- Added an Astro launcher page under `packages/consuelo-website/src/pages/os/launcher.astro` using `MarketingLayout` and website design tokens as the forward path for Sites pages.

## workspace-owned: validation evidence

- Red: `bun --cwd packages/os test tests/bootstrap-source.test.ts tests/launcher-onboarding.test.ts tests/sites-cli.test.ts tests/launcher-astro-source.test.ts` failed 5 expected tests before implementation.
- Green: `bun --cwd packages/os test tests/bootstrap-source.test.ts tests/launcher-onboarding.test.ts tests/sites-cli.test.ts tests/launcher-astro-source.test.ts` passed 19 tests.
- Green: `bun --cwd packages/os typecheck` passed.
- Green: `bun --cwd packages/os test scripts/compact-daemon-output.test.ts scripts/install-tty.test.ts tests/bootstrap-source.test.ts tests/install-state.test.ts tests/install-edge-site-publisher.test.ts tests/installer-onboarding-ui.test.ts tests/launcher-onboarding.test.ts tests/launcher-astro-source.test.ts tests/sites-cli.test.ts` passed 51 tests, 4 skipped.
- Green: `bun --cwd packages/consuelo-website build` passed; Astro built `/os/launcher/index.html` with existing website hints only.
- Green: Playwright rendered the local launcher on desktop and mobile, found required text/links/agent names, and detected no horizontal overflow.
- Green: `review.run --base HEAD` reported 0 issues.
- Green: `bun run verify -- --base HEAD --json` passed and wrote publish-valid `.task/os/os-launcher-astro-onboarding-and-installer-selector-ux/verify.json`.
- Green: `git diff --check` passed.
- 2026-06-30 23:54:55 `review.run`: passed — OK
- 2026-06-30 23:57:23 `verify`: passed — OK

## key decisions

- Do not make first install depend on Astro or a full website build. OS install remains lightweight; the launcher renderer uses the same visible contract and website token values, while the new Astro source anchors future Sites migration.
- Keep MCP URL logic unchanged and dynamic. Branch 1 does not alter `/mcp`, Cloudflare allowlists, provider IPs, or reverse-proxy security.
- Keep the old site URLs as hrefs but update visible labels: Go to market, Artifacts, Observability, and Code review.

## notes for ko

- The local-agent count is rendered from `config.json` connected agents. If reinstall still shows zero after selecting agents, the next diagnostic should inspect whether selected agents were written to config versus a later connectivity/IP allowlist issue.

## improvements noticed

- The repo patch helper applies patches but exits non-zero on a workpad logging hook: `getTaskWorkpadPath is not a function`. The file writes still succeed, but this should be fixed separately.

## issues and recovery

- The typed `status` tool returned the main worktree despite receiving `taskSession`; used task-scoped `code.call` for task worktree git status evidence.
- The typed `verify` facade call hit an HTTP 524 transport timeout; reran the underlying `bun run verify -- --base HEAD --json` through task-scoped `code.call` and got a passing publish-valid result.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.task/os/os-launcher-astro-onboarding-and-installer-selector-ux/current.json`, `.task/os/os-launcher-astro-onboarding-and-installer-selector-ux/session.json`, `.task/os/os-launcher-astro-onboarding-and-installer-selector-ux/workpad.md`, `.task/tasks/os/os-launcher-astro-onboarding-and-installer-selector-ux.json`, `packages/consuelo-website/src/pages/os/launcher.astro`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/lib/launcher-onboarding.ts`, `packages/os/tests/bootstrap-source.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/launcher-astro-source.test.ts`, `packages/os/tests/launcher-onboarding.test.ts`, `packages/os/tests/sites-cli.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
