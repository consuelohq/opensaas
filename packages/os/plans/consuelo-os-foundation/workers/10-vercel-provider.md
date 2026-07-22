# Worker 10: Vercel Provider Adapter for Launch

## Dependencies

Begin after Worker 08 is integrated.

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` in full and read the repo/OS skills. Start from `stream/os-provider-tools`. Do not revert other workers.

Also consume Worker 26's canonical tool-package contract. The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory.

## Objective

Build a useful, opinionated Vercel adapter for an initial launch user. It must be deeper than raw passthrough while remaining bounded to reliable CLI-supported operations.

## Required capabilities

- Detect Vercel CLI/version.
- Report authentication state without returning credentials.
- Inspect current linked project/team/scope.
- Link or select a project only through an explicit mutating operation.
- List recent deployments.
- Inspect deployment status and URLs.
- Read bounded deployment/build logs where supported.
- Trigger preview and production deployment with distinct approval/consequence metadata.
- Redeploy/promote only when supported and semantically clear.
- List environment-variable names/scopes and set/delete values without ever returning stored secret values.
- Report project/domain configuration read-only where supported.
- Provide a raw escape hatch with explicit command preview and approval rules.

Use the installed Vercel CLI as the user's authenticated authority. Do not require a Vercel account connection through Consuelo and do not read token files.

## Design quality

- Prefer task-oriented operations over exposing every Vercel flag.
- Normalize provider output into stable OS schemas.
- Keep preview and production semantics explicit.
- Bound output and redact URLs/query parameters that contain credentials.
- Detect incompatible CLI output and return typed errors rather than guessing.

## Owned files

- Vercel adapter under the canonical deployment-provider tool package defined by Worker 26.
- Vercel fixtures/tests.
- No central manifest edits; Worker 12 owns registration.

## Required tests

- Missing CLI/auth/link states.
- Team/project context parsing.
- Preview versus production approval metadata.
- Deployment list/status/log normalization.
- Environment names without values.
- Injection-resistant argv.
- Bounded output and token redaction.
- CLI version/output drift failure.

## Live validation

Do not require Ko or a real user's Vercel credentials for automated tests. Prepare a safe, read-only live validation checklist that can be run later in an already authenticated project.

## Completion output

Report operation schemas, CLI commands, approval table, exact tests, known Vercel limitations, and proposed manifest/search metadata for Worker 12.
