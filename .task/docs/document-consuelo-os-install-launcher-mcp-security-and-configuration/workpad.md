# document consuelo os install launcher mcp security and configuration

branch: `task/docs/document-consuelo-os-install-launcher-mcp-security-and-configuration`
stream: `stream/docs`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1340/document-consuelo-os-install-launcher-mcp-security-and-configuration
github pr: https://github.com/consuelohq/opensaas/pull/1340
started: 2026-07-02

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-02 19:54:55 `review.run`: passed — OK
- 2026-07-02 19:55:10 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(docs): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.task/docs/document-consuelo-os-install-launcher-mcp-security-and-configuration/current.json`, `.task/docs/document-consuelo-os-install-launcher-mcp-security-and-configuration/session.json`, `.task/docs/document-consuelo-os-install-launcher-mcp-security-and-configuration/workpad.md`, `.task/tasks/docs/document-consuelo-os-install-launcher-mcp-security-and-configuration.json`, `packages/documentation/astro.config.mjs`, `packages/documentation/src/content/docs/os/concepts/configuration.mdx`, `packages/documentation/src/content/docs/os/concepts/local-and-cloud.mdx`, `packages/documentation/src/content/docs/os/concepts/mcp-ingress-security.mdx`, `packages/documentation/src/content/docs/os/concepts/portal.mdx`, `packages/documentation/src/content/docs/os/getting-started/connect-agents.mdx`, `packages/documentation/src/content/docs/os/getting-started/install.mdx`, `packages/documentation/src/content/docs/os/getting-started/workspace-launcher.mdx`, `packages/documentation/src/content/docs/os/overview.mdx`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
