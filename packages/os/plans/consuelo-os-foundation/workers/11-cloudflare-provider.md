# Worker 11: Customer Cloudflare Provider Adapter

## Dependencies

Begin after Worker 08 is integrated.

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` in full and read the repo/OS skills. Start from `stream/os-provider-tools`. You are not alone in the repo.

Also consume Worker 26's canonical tool-package contract. The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory.

## Objective

Create a customer-facing Cloudflare provider adapter that uses the user's installed Cloudflare/Wrangler CLI context. Keep it rigorously separate from Consuelo platform provisioning, WAF migrations, route registries, connector tunnels, and release credentials.

## Required capabilities

- Detect Wrangler/Cloudflare CLI and version.
- Report authentication/account context without returning tokens.
- List projects/workers/pages applications where CLI support is stable.
- Inspect deployment/version status.
- Tail or read bounded logs where supported.
- Deploy a selected Worker or Pages project with explicit approval.
- List environment-variable/secret names and set/delete values without reading secret values.
- Inspect routes/domains read-only where supported.
- Provide a raw escape hatch with approval and redaction.

## Hard boundary

The adapter must not expose or call:

- Consuelo OS device-authority release;
- Consuelo workspace-edge deployment/migrations;
- Consuelo WAF migration;
- Consuelo DNS/connector provisioning;
- Consuelo account/zone IDs or production tokens;
- customer tunnel token creation used by platform onboarding.

Enforce the boundary structurally through separate modules and runtime-bundle classification, not only documentation.

## Owned files

- Cloudflare adapter under the canonical deployment-provider tool package defined by Worker 26.
- Adapter tests and security-boundary tests.
- No edits to Cloudflare Worker applications or central tool manifests.

## Required tests

- Missing CLI/auth/account states.
- Account/project selection without Consuelo defaults.
- Deploy/log/status normalization.
- Environment/secret names without values.
- Mutation approvals.
- argv safety and redaction.
- Explicit rejection of Consuelo operator command paths and known provisioning modules.
- Runtime-bundle classifier marks the customer adapter as shippable and operator provisioning as excluded.

## Completion output

Report supported operations, exact separation from platform provisioning, CLI commands, tests, limitations, and manifest/search metadata for Worker 12.
