# Worker 15: Authenticated Launcher, Workspace Links, and `/gtm`

## Dependencies

Begin after Workers 13 and 14 are integrated.

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` in full, then read repository steering and the OS engineering/task skills. Start from `stream/os-web`. Preserve concurrent work.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Objective

Make the launcher and all product links derive from the authenticated workspace, and establish workspace-local GTM at `https://<workspace>.consuelohq.com/gtm`.

## Product rules

- Ko's internal route is `https://internal.consuelohq.com/gtm` because `internal` is Ko's workspace.
- Customer routes use their own authenticated workspace host.
- `app.consuelohq.com` is not the GTM destination.
- `sites.consuelohq.com` is not a fallback ownership model for this task.
- Protected launcher and GTM content must remain protected.
- Pre-auth launcher imagery is static/sanitized only.

## Required investigation

- Inventory launcher generation, sites registry, edge route targets, snapshot publication, current internal links, GTM links, artifacts/observability/code-review/docs/writing links, and cache behavior.
- Identify every hard-coded workspace/test/internal host.
- Verify route ordering before adding `/gtm`.

## Required implementation

- Add typed workspace URL generation from authenticated membership/route state.
- Route `/gtm` through the workspace edge to the correct protected GTM target.
- Ensure one workspace session allows launcher-to-GTM navigation without a second Google login.
- Update internal launcher links to use `internal.consuelohq.com` only through resolved workspace context.
- Preserve launcher whitespace/layout and existing requested naming.
- Define cache keys so one workspace's launcher/GTM content can never serve another workspace.
- Provide clear offline/unavailable-node behavior without exposing topology or secrets.

## Owned files

- Launcher/site URL builders and templates.
- Workspace-edge GTM route target and registry support.
- Relevant site snapshot generation and tests.
- No auth-store internals unless fixing a contract integration bug with a regression test.

## Required tests

- Internal and arbitrary customer workspace URL generation.
- No hard-coded `internal`, testing host, or `app.consuelohq.com` GTM fallback.
- Auth required for launcher and GTM.
- Session handoff allows navigation without repeat login.
- Cross-workspace cache isolation.
- Literal route order before parameter/catch-all routes.
- Existing site routes remain stable.
- Responsive launcher screenshots if UI output changes.

## Completion output

Report final route map, URL derivation source, cache key model, tests/screenshots, and any required route-registry migration.
