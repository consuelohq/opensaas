# Worker 12: Provider Manifest, Discovery, Approval, and End-to-End Integration

## Dependencies

Begin only after Workers 09, 10, and 11 are integrated into `stream/os-provider-tools`.

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md`, repository steering, both OS skills, and Worker 26's canonical tool-package contract. Start an integration task from the provider stream. Work with all adapter changes; do not replace them with a parallel architecture.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Objective

Register Railway, Vercel, and Cloudflare as coherent OS provider tools, make them discoverable through `tools.search`, enforce approvals/scopes, and prove they are included in customer runtime bundles while Consuelo operator code is excluded.

## Public naming

Use this consistent provider namespace as the product contract:

```text
deployment.detect
deployment.context
deployment.list
deployment.status
deployment.logs
deployment.deploy
deployment.environment
deployment.raw
```

with `provider: railway|vercel|cloudflare`, or provider-specific method paths if the existing typed facade makes that materially clearer. Choose one model and document why. Do not publish duplicate full surfaces.

## Integration requirements

- Update schemas and generated client types.
- Update the canonical full manifest and core/non-core classification.
- Update tools.search intents, synonyms, and ranking.
- Ensure deployment tools remain non-core unless there is a strong bootstrap reason.
- Add capability-aware help and missing-CLI guidance.
- Apply OAuth scope and local approval policy appropriate to read versus write operations.
- Keep environment values secret.
- Migrate current Railway behavior to the canonical names in this release and remove superseded names after updating every consumer and test. Do not add aliases or duplicate dispatch.
- Remove or retire ambiguous legacy manifest entries that caused stale tool discovery.
- Verify runtime-bundle inclusion/exclusion with Worker 02's classifier.
- Generate manifests from Worker 26's canonical tool packages; do not restore a hand-maintained `tooling` authority.

## Owned files

- Provider-related tool schemas.
- Provider `manifest.ts` contributions plus generated full-catalog integration through Worker 26's authority.
- `tools.search` provider intent integration.
- Generated client updates.
- Provider-focused package scripts in sorted order.
- Integration and behavior-parity tests.

## Forbidden scope

- Do not modify adapter internals unless fixing an integration defect with a focused regression test.
- Do not expose Consuelo operator commands.
- Do not make all provider tools core steering tools.
- Do not return stored environment secret values.

## Required tests

- Search finds the correct provider for natural-language deployment/log/env intents.
- Missing provider CLI produces install/auth guidance.
- Read operations do not require write approval.
- Deploy/redeploy/env mutation does require the intended approval.
- Superseded provider names have no remaining runtime, test, docs, or generated references before deletion.
- Customer runtime bundle includes provider adapters and excludes operator modules.
- Generated manifest/client drift checks pass.
- Representative provider tokens are absent from traces.

## Completion output

Report final public tool names, cutover decisions, scopes/approvals, runtime-bundle proof, search examples, exact tests, and a safe live-read validation checklist for each provider.
