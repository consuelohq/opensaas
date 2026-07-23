# Vercel deployment provider adapter

Worker 10 implements the Vercel CLI adapter inside the canonical `deployment-provider` package. Worker 12 owns public facade registration. This adapter does not add central manifest entries.

## Authority and safety boundary

- The installed `vercel` CLI is the authenticated authority.
- The adapter never reads Vercel credential files, token files, cookies, or environment-variable values.
- All process execution is argv-based with `shell: false` through the shared provider process boundary.
- Environment values are sent through stdin only.
- Provider stdout and stderr use the shared bounded-output limit and credential redaction.
- URL query parameters with credential-bearing names are redacted before results or diagnostics leave the provider boundary.
- Human-readable CLI output is parsed strictly. Missing headers, missing required fields, conflicting versions, or unknown JSON shapes fail with `MALFORMED_OUTPUT`.
- Vercel CLI semantic versions 40.x through 50.x are accepted. A later major version fails with `UNSUPPORTED_VERSION` until its contract is reviewed.

The development host reported Vercel CLI `50.1.3` on July 23, 2026. This observation is validation evidence, not a bundled runtime dependency.

## Operation contract

### Detection and context

`detect`

- CLI: `vercel --version`
- Input: execution timeout/cancellation only.
- Output: provider name, executable, and parsed semantic version.
- Approval: not required.

`auth.status`

- CLI: `vercel whoami --no-color`
- Output: `{ authenticated, identity?, source: "cli" }`.
- The output cannot contain token or credential fields.
- Approval: not required.

`context.current`

- CLI: `vercel project inspect --yes --no-color`
- Output: linked project plus available team and scope identifiers/names.
- Failure when unlinked maps to `NO_CONTEXT`.
- Approval: not required.

### Projects and domains

`project.list`

- CLI: `vercel project list --json [--next <cursor>] --no-color`
- Input: optional opaque cursor and limit hint.
- Output: stable project IDs/names plus an opaque `vercel:<base64url>` cursor.
- Approval: not required.

`project.link`

- CLI: `vercel link --project <name> [--scope <scope>] --yes --no-color`
- Input: project, optional scope, optional checkout path.
- Output: linked project and scope metadata.
- Approval consequence: links the checkout to a remote Vercel project and changes local provider context.

`project.configuration`

- CLI: `vercel project inspect [project] --yes --no-color`
- Output: project ID/name, framework, Node.js version, root directory, team/scope, and listed domains.
- Approval: not required.

`domain.list`

- CLI: `vercel domains list --no-color`
- Output: domain name, registrar, and nameserver classification.
- Approval: not required.
- The current CLI surface is scope-wide; `projectId` is reserved in the typed input but cannot be enforced by Vercel CLI 50.1.3.

### Deployments and logs

`deployment.list`

- CLI: `vercel list [project] [--environment <environment>] [--next <cursor>] --no-color`
- Output: deployment ID/URL, normalized uppercase status, and lowercase environment.
- Approval: not required.

`deployment.status`

- CLI: `vercel inspect <deployment> --json --no-color`
- Output: deployment ID, status, URL, creation timestamp, project ID, and environment when present.
- Approval: not required.

`logs.read`

- CLI: `vercel logs <deployment> --json --no-color`
- Output: bounded normalized log entries with message, timestamp, level, and stream/source.
- Approval: not required.
- Vercel streams runtime logs for up to five minutes. The shared timeout and output bound may end the read first.

`deploy` with `target: "preview"`

- CLI: `vercel deploy <source> --target preview --yes --no-color`
- Output: queued deployment ID/URL.
- Approval consequence: creates a preview deployment without assigning production domains.

`deploy` with `target: "production"`

- CLI: `vercel deploy <source> --target production --yes --no-color`
- Output: queued deployment ID/URL.
- Approval consequence: creates a production deployment and may reassign customer-facing domains.

`redeploy`

- CLI: `vercel redeploy <deployment> [--target <target>] --no-color`
- Output: queued deployment ID/URL.
- Approval consequence: rebuilds an existing deployment and may affect availability.

`deployment.promote`

- CLI: `vercel promote <deployment> --yes --no-color`
- Output: promoted deployment ID and `PROMOTED` status.
- Approval consequence: promotes an existing deployment and may reassign customer-facing traffic.

### Environment metadata

`environment.listNames`

- CLI: `vercel env list [environment] --no-color`
- Output: variable names, lowercase scopes, and presence only.
- Values are never parsed or returned.
- Approval: not required.

`environment.set`

- CLI: `vercel env add <name> [environment] --force --no-color`
- Value transport: stdin.
- Output: name, scopes, and `updated: true` only.
- Approval consequence: changes environment metadata and can alter future deployments.

`environment.delete`

- CLI: `vercel env remove <name> [environment] --yes --no-color`
- Output: name, scopes, and `deleted: true` only.
- Approval consequence: deletes environment metadata and can break future deployments.

### Raw escape hatch

`raw`

- CLI: exact caller-provided argv after the `vercel` executable.
- The adapter neither joins nor evaluates arguments and does not append flags.
- Output: bounded/redacted stdout, stderr, exit code, and truncation markers.
- Approval consequence: arbitrary CLI commands may mutate remote resources.

## Typed failures

The adapter uses the shared provider error taxonomy:

- `CLI_MISSING`: executable unavailable on normalized PATH.
- `UNSUPPORTED_VERSION`: recognized semantic version outside 40.x-50.x.
- `UNAUTHENTICATED`: CLI login is missing or invalid.
- `NO_CONTEXT`: checkout is not linked when a linked operation is required.
- `PERMISSION_DENIED`, `RATE_LIMITED`, `UNAVAILABLE`: recognized CLI failures.
- `MALFORMED_OUTPUT`: command construction validation or parser drift.
- `COMMAND_FAILED`: remaining nonzero CLI exits.
- `APPROVAL_REQUIRED`: mutation attempted without explicit approval.
- `TIMEOUT` and `CANCELLED`: bounded process termination outcomes.

## Deterministic fixtures and tests

Fixtures live in `fixtures/vercel.ts`. `vercel.test.ts` covers:

- supported, missing, incompatible, and malformed CLI versions;
- authenticated and unauthenticated states;
- linked and unlinked context;
- explicit project linking and argv integrity;
- distinct preview/production approval consequences;
- project/deployment/status/log normalization;
- deploy, redeploy, and promote command semantics;
- environment names/scopes with stdin-only value transport;
- environment deletion;
- read-only project/domain configuration;
- raw argv preservation, bounded-output metadata, and token-query redaction;
- strict failure on JSON/table output drift.

## Safe live validation checklist

This checklist is read-only and does not require Worker 10 to mutate Ko's Vercel account.

1. Run `detect`; expect a supported semantic version and executable `vercel`.
2. Run `auth.status`; expect only authentication state and CLI identity.
3. From an intentionally linked checkout, run `context.current` and verify project/team/scope metadata.
4. Run `project.list`, `deployment.list`, and `project.configuration`.
5. Inspect one known deployment with `deployment.status`.
6. Read a short, explicitly timed `logs.read` sample.
7. Run `environment.listNames` and `domain.list`.
8. Confirm no environment value, bearer token, cookie, credential URL component, or sensitive query value appears in results or diagnostics.
9. Do not run `project.link`, `deploy`, `redeploy`, `deployment.promote`, `environment.set`, `environment.delete`, or `raw` during read-only validation.

Human checkpoint for a future authenticated operator:

```bash
bun --cwd packages/os -e "import { Effect } from 'effect'; import { createDeploymentProviderService } from './tools/deployment-provider/service.ts'; import { createVercelProviderAdapter } from './tools/deployment-provider/vercel.ts'; console.log(JSON.stringify(await Effect.runPromise(createDeploymentProviderService(createVercelProviderAdapter()).authStatus()), null, 2));"
```

Expected result: a typed read-only response containing `authenticated`, optional CLI identity, and `source: "cli"`; no token or credential fields. An unauthenticated CLI should return the typed `UNAUTHENTICATED` failure. This checkpoint does not link projects or mutate Vercel resources.

## Proposed Worker 12 manifest and search metadata

The source of truth is `vercelOperationCatalog` in `vercel.ts`. Worker 12 should register provider-specific tools from that catalog rather than duplicating command strings or mutation metadata.

Required discoverability names include:

- `vercel.detect`
- `vercel.auth.status`
- `vercel.context.current`
- `vercel.project.list`
- `vercel.project.link`
- `vercel.deploy.preview`
- `vercel.deploy.production`
- `vercel.deployment.promote`
- `vercel.environment.listNames`
- `vercel.environment.set`
- `vercel.environment.delete`
- `vercel.raw`

Worker 12 should also expose the remaining typed capabilities (`project.configuration`, `domain.list`, `deployment.list`, `deployment.status`, `logs.read`, and `redeploy`) and preserve the adapter's read-only/mutating distinction, approval requirements, search terms, and consequence text.
