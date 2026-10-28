# Worker 09: Generic Railway Provider Adapter

## Dependencies

Begin only after Worker 08 is integrated into `stream/os-provider-tools`.

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` in full and read the repository/OS skills. Start a task from the updated provider stream. You are not alone in the repo.

Also consume Worker 26's canonical tool-package contract. The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory.

## Objective

Replace the Consuelo/opensaas-specific Railway tool implementation with a generic customer-facing adapter built on the provider core while preserving useful log and redeploy behavior.

## Current behavior to verify

- Default services include `opensaas` and `twenty-worker`.
- At least one network path contains fixed Railway project/service/environment IDs.
- Logs use shell-string composition in places.
- One path reads Railway's local token file and directly calls Railway GraphQL.
- Manifest operations are `railway.logs` and `railway.redeploy`.

## Required capabilities

- Detect Railway CLI/version.
- Report authenticated/not-authenticated using CLI-supported behavior without returning a token.
- Inspect the currently linked project/environment/workspace.
- List services and deployments.
- Read runtime/build logs with structured filtering and bounded output.
- Report deployment status.
- Redeploy a selected service with optional bounded wait.
- List environment-variable names/scopes and set/delete variables with approval, never returning secret values.
- Return clear guidance when the directory is not linked.
- Support JSON/quiet behavior through provider core.

Remove all fixed Consuelo repositories, services, project IDs, environment IDs, URLs, and assumptions.

Use Railway CLI structured output where available. If a capability requires a non-CLI API, stop and document it rather than extracting a user's token from private config without approval.

## Owned files

- Railway adapter/service under the canonical deployment-provider tool package defined by Worker 26.
- Railway adapter tests.
- Migration or replacement of `packages/os/scripts/railway-logs.js` and `railway-redeploy.js` only within Railway ownership.
- Do not edit central manifests; Worker 12 owns integration.

## Required tests

- Missing CLI and unauthenticated states.
- Unlinked directory.
- Multiple services without internal defaults.
- Log filtering and truncation.
- Build/runtime log distinction.
- Redeploy approval and wait state.
- Provider command error mapping.
- Injection-resistant service/filter input.
- Secret variable values absent from results and traces.
- No hard-coded Consuelo identifiers remain.

## Completion output

Report removed assumptions, operation schemas, Railway CLI commands used, exact tests, unsupported capabilities, and manifest entries Worker 12 should publish.
