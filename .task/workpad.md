# add os docs navigation skeleton

branch: `task/os/add-os-docs-navigation-skeleton`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/420/add-os-docs-navigation-skeleton
github pr: https://github.com/consuelohq/opensaas/pull/420
started: 2026-05-21

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/consuelo-docs/docs.json`
- `packages/consuelo-docs/os/data-layer/data-model-as-os-ontology.mdx` (deleted)
- `packages/consuelo-docs/os/data-layer/decision-engine.mdx` (deleted)
- `packages/consuelo-docs/os/data-layer/graphql-facades.mdx` (deleted)
- `packages/consuelo-docs/os/data-layer/structured-queries.mdx` (deleted)
- `packages/consuelo-docs/os/data-layer/vectorized-context.mdx` (deleted)
- `packages/consuelo-docs/os/integrations/ghl.mdx` (deleted)
- `packages/consuelo-docs/os/integrations/google-ads.mdx` (deleted)
- `packages/consuelo-docs/os/integrations/meta-ads.mdx` (deleted)
- `packages/consuelo-docs/os/integrations/s3-s3-files.mdx` (deleted)
- `packages/consuelo-docs/os/integrations/sentry-posthog.mdx` (deleted)
- `packages/consuelo-docs/os/integrations/stripe.mdx` (deleted)
- `packages/consuelo-docs/os/integrations/supabase-auth.mdx` (deleted)
- `packages/consuelo-docs/os/integrations/twilio.mdx` (deleted)
- `packages/consuelo-docs/os/overview/architecture.mdx` (deleted)
- `packages/consuelo-docs/os/overview/core-concepts.mdx` (deleted)
- `packages/consuelo-docs/os/overview/quickstart.mdx` (deleted)
- `packages/consuelo-docs/os/overview/what-is-consuelo-os.mdx` (deleted)
- `packages/consuelo-docs/os/portal/call.mdx` (deleted)
- `packages/consuelo-docs/os/portal/get-dev-steering.mdx` (deleted)
- `packages/consuelo-docs/os/portal/get-steering.mdx` (deleted)
- `packages/consuelo-docs/os/portal/permissions.mdx` (deleted)
- `packages/consuelo-docs/os/portal/steering-files.mdx` (deleted)
- `packages/consuelo-docs/os/portal/tool-manifest.mdx` (deleted)
- `packages/consuelo-docs/os/runtime/bun-runtime.mdx` (deleted)
- `packages/consuelo-docs/os/runtime/operator-scripts.mdx` (deleted)
- `packages/consuelo-docs/os/runtime/package-scripts-vs-os-portal.mdx` (deleted)
- `packages/consuelo-docs/os/runtime/sandbox-executor.mdx` (deleted)
- `packages/consuelo-docs/os/runtime/scheduled-skills.mdx` (deleted)
- `packages/consuelo-docs/os/skills/campaign-brief.mdx` (deleted)
- `packages/consuelo-docs/os/skills/daily-revenue-brief.mdx` (deleted)
- `packages/consuelo-docs/os/skills/follow-up-generator.mdx` (deleted)
- `packages/consuelo-docs/os/skills/google-ads-review.mdx` (deleted)
- `packages/consuelo-docs/os/skills/landing-page-builder.mdx` (deleted)
- `packages/consuelo-docs/os/skills/lead-prioritizer.mdx` (deleted)
- `packages/consuelo-docs/os/skills/meta-ads-review.mdx` (deleted)
- `packages/consuelo-docs/os/skills/overview.mdx` (deleted)
- `packages/consuelo-docs/os/skills/post-call-analysis.mdx` (deleted)
- `packages/consuelo-docs/os/skills/sales-coaching.mdx` (deleted)
- `packages/consuelo-docs/os/skills/weekly-manager-report.mdx` (deleted)
- `packages/consuelo-docs/os/workspace-filesystem/artifacts.mdx` (deleted)
- `packages/consuelo-docs/os/workspace-filesystem/local-development-filesystem.mdx` (deleted)
- `packages/consuelo-docs/os/workspace-filesystem/overview.mdx` (deleted)
- `packages/consuelo-docs/os/workspace-filesystem/reports.mdx` (deleted)
- `packages/consuelo-docs/os/workspace-filesystem/s3-files-production-target.mdx` (deleted)
- `packages/consuelo-docs/os/workspace-filesystem/skill-outputs.mdx` (deleted)
- `packages/consuelo-docs/get-started/connect-agents.mdx`
- `packages/consuelo-docs/get-started/first-artifact.mdx`
- `packages/consuelo-docs/get-started/first-skill.mdx`
- `packages/consuelo-docs/get-started/install-local.mdx`
- `packages/consuelo-docs/get-started/local-vs-cloud.mdx`
- `packages/consuelo-docs/get-started/overview.mdx`
- `packages/consuelo-docs/os/concepts/approvals.mdx`
- `packages/consuelo-docs/os/concepts/context-and-memory.mdx`
- `packages/consuelo-docs/os/concepts/data-model-and-graphql.mdx`
- `packages/consuelo-docs/os/concepts/files-and-artifacts.mdx`
- `packages/consuelo-docs/os/concepts/integrations-and-capabilities.mdx`
- `packages/consuelo-docs/os/concepts/local-and-cloud.mdx`
- `packages/consuelo-docs/os/concepts/observability.mdx`
- `packages/consuelo-docs/os/concepts/portal.mdx`
- `packages/consuelo-docs/os/concepts/scripts.mdx`
- `packages/consuelo-docs/os/concepts/skills.mdx`
- `packages/consuelo-docs/os/glossary.mdx`
- `packages/consuelo-docs/os/how-it-works.mdx`
- `packages/consuelo-docs/os/overview.mdx`


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

## docs skeleton implementation

- Created approved top-level navigation shape: Get Started, OS, Dialer, Developers.
- Added new `packages/consuelo-docs/get-started/*` starter pages.
- Replaced public OS docs tree with the approved OS overview/concepts skeleton.
- Kept this pass intentionally shallow so follow-up tasks can write one section at a time.
- Removed stale public OS scaffold pages that still used old structure such as portal/runtime/integrations/skills/data-layer/workspace-filesystem.
- Updated all language nav entries in `docs.json` to avoid stale old OS/User Guide/GraphQL API tabs remaining in localized nav blocks.
- Fixed Dialer nav paths to existing files.

## validation

- `python3 -m json.tool packages/consuelo-docs/docs.json >/dev/null`: passed.
- Full navigation path check across all language entries: passed.
- Forbidden terminology grep across new Get Started/OS docs and `docs.json`: passed for `runbook`, `MCP`, `pilot`, `Supabase`, `agent-interface`, `User Guide`, `GraphQL API`.
- `git diff --check`: passed.

## notes

- A first attempt to write the skeleton through `task.exec` failed because the heredoc command was too long for the tmux executor. Switched to smaller direct repo commands through `mac.exec`.
