# Worker 08: Effect-Based Deployment Provider Core

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` completely, repository steering, both OS engineering/task skills, and Worker 26's canonical tool-package contract. Start an isolated task from `stream/os-provider-tools`. Do not revert concurrent work.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Objective

Create a provider-neutral, Effect-based foundation for customer deployment tools. It must wrap installed provider CLIs safely, detect capabilities and authentication without extracting secrets, and give agents typed opinionated operations rather than defaulting to raw shell flags.

## Required investigation

- Inspect existing process execution, environment-variable capability, tool manifest/schema, approval, redaction, and Effect service patterns.
- Inspect current Railway scripts and identify every internal default and shell-injection risk.
- Verify how OS discovers CLI binaries and augments PATH under background services.

## Core interfaces

Model a provider service with typed operations such as:

```text
detect
auth.status
context.current
project.list
deployment.list
deployment.status
logs.read
deploy
redeploy
environment.listNames
environment.set
raw (escape hatch)
```

Not every provider must implement every operation. Capability discovery must be explicit and structured.

Define typed errors for:

- CLI missing;
- unsupported version;
- not authenticated;
- no project/context linked;
- permission denied;
- rate limited;
- provider unavailable;
- malformed provider output;
- command failed;
- unsupported capability;
- approval required;
- timeout/cancelled.

## Security requirements

- Use argv-based spawning through the existing safe process abstraction or a new bounded Effect service.
- Never interpolate untrusted values into shell commands.
- Never read or return provider token values when the CLI can operate on behalf of the user.
- Environment operations return names, scope, and presence, not secret values.
- Mutating operations carry the correct approval/consequence metadata.
- Redact representative provider tokens, authorization headers, cookies, and URLs containing credentials.
- Structured diagnostics must contain command identity and exit metadata without secret argv/env values.

## Owned files

- New provider core under the canonical domain tool package defined by Worker 26.
- Provider-neutral schemas/types/errors/services.
- Shared provider test fixtures and fake CLI service.
- No provider-specific adapter implementation beyond a tiny example fake.

## Forbidden scope

- Do not edit Railway, Vercel, or Cloudflare adapter files assigned to later workers.
- Do not update central tool manifests yet.
- Do not recreate `packages/os/tooling` or add a second hand-maintained manifest.
- Do not add provider SDK dependencies unless the CLI cannot satisfy an approved requirement.
- Do not make raw CLI passthrough the primary API.

## Required tests

- CLI detection and version parsing.
- PATH behavior under interactive and background-service environments.
- Authentication-state normalization.
- Missing/unsupported capability.
- argv preservation against injection strings.
- timeout/cancellation.
- redacted failures.
- environment names/presence without values.
- approval metadata on writes.

## Completion output

Report interfaces, capability matrix format, typed errors, security model, exact tests, and adapter instructions for Workers 09-11.
