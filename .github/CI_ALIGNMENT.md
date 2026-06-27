# Consuelo CI alignment

## Status

This repository still carries a broad set of GitHub Actions inherited from the Twenty fork. The inherited workflows are not inherently bad, but their names, path filters, package targets, and status semantics do not yet match the Consuelo product and infrastructure surfaces that should control merge and deploy risk.

Treat this document as the current alignment map. Do not delete inherited workflows until a Consuelo-owned replacement exists and has run cleanly on real pull requests.

## Goals

- Make CI answer the question: "is this Consuelo change safe to merge or deploy?"
- Preserve useful inherited checks for Twenty-derived app/server/front/shared code.
- Add first-class checks for Consuelo OS, the workspace/task system, the dialer, Sites Gateway, Cloudflare-facing workers/routes/config, and Consuelo deploy paths.
- Stop using green checks as a proxy for safety when the check only proved that an old Twenty path did not change.
- Keep rollout additive first: observe, then gate, then retire obsolete checks.

## Current workflow inventory

| Workflow | Trigger class | Current role | Alignment decision | Notes |
| --- | --- | --- | --- | --- |
| `.github/workflows/cd-deploy-main.yaml` | push | Main deploy dispatch | Adapt | Dispatches an external deploy flow. Confirm the target is a Consuelo production deploy and not an inherited Twenty deploy. |
| `.github/workflows/cd-deploy-tag.yaml` | push | Tag deploy dispatch | Adapt | Keep only if tag release semantics still match Consuelo release operations. |
| `.github/workflows/changed-files.yaml` | workflow_call | Shared changed-file filter | Keep, but audit | Useful primitive, but it can create false confidence when a skipped workflow is interpreted as a safe workflow. |
| `.github/workflows/ci-breaking-changes.yaml` | pull_request | GraphQL/OpenAPI break detection | Keep/adapt | Useful for API drift. Reclassify under server/API schema safety, not generic inherited CI. |
| `.github/workflows/ci-create-app.yaml` | pull_request, push | `create-twenty-app` build | Reassess | Likely lower priority for Consuelo unless still shipped or supported. |
| `.github/workflows/ci-docker-build.yaml` | push, manual | Docker image build/push | Adapt | Uses Consuelo image naming, but still builds the Twenty Dockerfile. Confirm actual deploy image ownership. |
| `.github/workflows/ci-docs.yaml` | pull_request, push | Consuelo docs lint/checks | Keep | Already targets `packages/consuelo-docs` and OS docs validation. |
| `.github/workflows/ci-emails.yaml` | pull_request, push | Email package build/test | Keep/adapt | Keep if emails remain part of production product surface. |
| `.github/workflows/ci-front.yaml` | pull_request, merge_group | Front, Storybook, Chromatic, E2E | Keep/adapt | Useful for Twenty-derived app UI. Needs Consuelo-owned route/module mapping and clearer E2E ownership. |
| `.github/workflows/ci-release-create.yaml` | manual | Release PR creation | Reassess | Inherited release workflow. Confirm whether it is still operator-approved. |
| `.github/workflows/ci-release-merge.yaml` | pull_request | Release tagging | Reassess | Writes contents on release-labeled PR merge. Confirm this is still the intended release path. |
| `.github/workflows/ci-sdk.yaml` | pull_request, merge_group | SDK tests/e2e | Keep/adapt | Keep if SDK is shipped; map to Consuelo SDK/package ownership. |
| `.github/workflows/ci-server.yaml` | pull_request, merge_group | Server build/test/integration/schema checks | Keep/adapt | Valuable inherited backend lane. Add Consuelo server modules and dialer/API-specific ownership. |
| `.github/workflows/ci-shared.yaml` | pull_request, merge_group | Shared package checks | Keep | Useful as long as shared remains a cross-cutting dependency. |
| `.github/workflows/ci-test-docker-compose.yaml` | pull_request, merge_group | Docker compose smoke | Keep/adapt | Useful deployability smoke. Confirm compose stack reflects Consuelo runtime dependencies. |
| `.github/workflows/ci-utils.yaml` | pull_request_target | Danger + congratulate | Narrow | `pull_request_target` with broad write permissions should remain narrow and not be treated as a main safety gate. |
| `.github/workflows/ci-website.yaml` | pull_request, merge_group | Website build | Replace/adapt | Currently filters/builds `packages/twenty-website`; current Consuelo website package is `packages/consuelo-website`. This is the clearest likely wrong check. |
| `.github/workflows/claude.yml` | issue/pr comment, dispatch | Claude automation | Reassess/security audit | High-permission automation. Keep only with explicit operator posture and permission review. |
| `.github/workflows/docs-i18n-pull.yaml` | pull_request, manual, schedule, call | Docs translation pull/validation | Keep/adapt | Already mentions Consuelo docs; ensure PR mode remains validation-only. |
| `.github/workflows/docs-i18n-push.yaml` | push, manual, call | Docs translation push | Keep/adapt | Keep if Crowdin remains part of docs ops. |
| `.github/workflows/i18n-pull.yaml` | manual, schedule, call | App translation pull | Reassess | Inherited app i18n path. Confirm it still maps to shipped UI locales. |
| `.github/workflows/i18n-push.yaml` | push, manual, call | App translation push | Reassess | Same as app i18n pull. |
| `.github/workflows/i18n-qa-report.yaml` | manual, schedule | Translation QA report | Reassess | Useful only if app translations remain maintained. |
| `.github/workflows/preview-env-dispatch.yaml` | pull_request_target | Preview environment dispatch | Security audit | `pull_request_target` plus write/action permissions and path filters. Needs explicit threat model before expansion. |
| `.github/workflows/preview-env-keepalive.yaml` | repository dispatch | Preview environment runtime | Reassess/security audit | Long-running preview infra. Confirm current tunnel/runtime model and secret exposure. |
| `.github/workflows/upstream-sync.yml` | manual, schedule | Sync upstream Twenty | Keep isolated | Useful only as an explicit fork-maintenance workflow. Keep isolated from normal product CI. |

## Main findings

### 1. The current check taxonomy is package-oriented, not Consuelo-risk-oriented

Most inherited lanes are named after Twenty package boundaries: front, server, shared, SDK, website, emails, create-app. Those are useful build units, but they are not the product risk model for Consuelo.

The missing first-class CI surfaces are:

- Consuelo OS and workspace tooling.
- Task/workpad/verify/review publish gates.
- Dialer package and dialer runtime paths.
- Consuelo API package and Consuelo server modules.
- Sites Gateway and Cloudflare route/worker contracts.
- Consuelo website build/deploy path.
- Security-sensitive workflow permissions and `pull_request_target` usage.

### 2. `verify` and test-selection are closer to the desired CI model

The repo already has local validation primitives that understand more Consuelo-specific risk than the GitHub Actions layer:

- Root script `verify` delegates to `packages/workspace/scripts/verify.js`.
- `verify` runs review, affected test-selection, and DB/migration/API guardrails.
- `packages/workspace/test-selection.rules.json` has explicit critical rules for workspace facade contracts, workspace publish gate behavior, task-session behavior, test-selection behavior, dialer package changes, API package changes, and server changes.
- The generated test-selection registry reports 2161 test files, 2144 mapped tests, 17 unmapped tests, 29 total rules, and 10 explicit rules.

CI should reuse this model rather than duplicating another hand-written affected-files matrix from scratch.

### 3. Some existing checks are likely misleading

The most concrete mismatch found in this audit is `.github/workflows/ci-website.yaml`: it filters `packages/twenty-website/**` and builds `twenty-website`, while the current Consuelo website package and root deploy script point at `packages/consuelo-website` and `website:deploy`.

This means a PR can change the actual Consuelo website without this inherited website check proving the current website package.

### 4. Skipped checks need different semantics

The shared changed-files workflow is useful, but skipped downstream checks are easy to misread as safety. A skipped old Twenty check should mean "not applicable," not "Consuelo surface safe."

For cross-cutting files, a changed-file filter is especially dangerous:

- `.github/**`
- root package manager files
- `packages/workspace/**`
- `packages/os/**`
- generated manifests and schemas
- Cloudflare worker/config files
- shared API/schema files
- deploy scripts

Those paths should select a Consuelo-native gate even when old package-specific checks skip.

### 5. `pull_request_target` usage requires a narrow security posture

Current `pull_request_target` workflows include:

- `.github/workflows/ci-utils.yaml`, with broad write permissions for Actions, checks, contents, issues, pull requests, and statuses.
- `.github/workflows/preview-env-dispatch.yaml`, with write permissions for contents/actions and read pull-request access.

These workflows may be legitimate, but they should not expand without an explicit threat model. They should remain metadata/dispatch-only where possible, avoid checking out and executing untrusted PR code with privileged tokens, and have narrow permission blocks.

## Proposed Consuelo CI lanes

| Lane | Purpose | Initial status | Suggested command/check |
| --- | --- | --- | --- |
| `Consuelo / verify` | Reuse local publish gate in CI. | Add as manual first, then PR non-required, then required. | `bun run verify -- --base <base-ref> --no-stamp` |
| `Consuelo / OS contracts` | Prove OS/tooling/gateway/security contract tests. | Add after command runtime is stable in Actions. | `bun test packages/os/tests/*gateway* packages/os/tests/security-gateway.test.ts packages/os/tests/tool-manifest.test.ts` or registry-selected equivalent. |
| `Consuelo / workspace contracts` | Prove workspace facade, task, verify, review, and test-selection behavior. | Required for workspace changes. | Existing test-selection rules plus `bun run verify`. |
| `Consuelo / dialer` | Prove call-path critical package behavior. | Required for dialer changes. | Existing test-selection `dialer-package` rule; add scenario smoke separately if needed. |
| `Consuelo / Sites Gateway + Cloudflare` | Prove routes, worker configs, gateway contracts, and fail-closed policies. | Required for OS/Sites/Cloudflare changes once stable. | Registry-selected OS gateway/security tests; Cloudflare dry-run only for operator-approved contexts. |
| `Consuelo / website` | Build the actual Consuelo website. | Replace inherited `ci-website` after proof. | `cd packages/consuelo-website && bun run build`, plus Cloudflare Pages build-only/deploy validation where appropriate. |
| `Consuelo / workflow security` | Audit workflow permission changes and risky triggers. | Required for `.github/**` changes. | Static workflow audit: permissions, `pull_request_target`, third-party actions, secret exposure. |
| `Consuelo / deploy smoke` | Confirm deploy targets and post-deploy health. | Main/deploy only. | Railway/Cloudflare/Pages health checks, not normal PR checks. |

## Rollout plan

### Phase 0: Alignment document and workflow inventory

This document is Phase 0. It records the current state and identifies first replacements without changing required checks.

### Phase 1: Add manual Consuelo verify workflow

Add a new workflow that is `workflow_dispatch` only. It should install dependencies and run the workspace-native verify path against a selected base ref.

This proves that `verify` is usable inside GitHub Actions without adding a new PR status that can confuse reviewers or block merges.

Recommended initial shape:

```yaml
name: Consuelo Verify

on:
  workflow_dispatch:
    inputs:
      base:
        description: Base ref for verify
        required: false
        default: origin/main

permissions:
  contents: read
  pull-requests: read

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: ./.github/actions/yarn-install
      - name: Run workspace verify
        run: bun run verify -- --base "${{ inputs.base }}" --no-stamp
```

### Phase 2: Enable PR-mode as non-required

Once the manual workflow is green on a few representative branches, enable `pull_request` with path filters covering Consuelo-owned and cross-cutting surfaces:

- `.github/**`
- `package.json`, `yarn.lock`, `nx.json`, `tsconfig*.json`
- `packages/workspace/**`
- `packages/os/**`
- `packages/dialer/**`
- `packages/api/**`
- `packages/consuelo-core/**`
- `packages/consuelo-website/**`
- `packages/consuelo-docs/**`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/**`
- Cloudflare worker/config directories
- generated tool manifests, workflow bundles, and API schemas

Do not mark this required until it has observed enough representative PRs.

### Phase 3: Replace wrong inherited checks

Start with `.github/workflows/ci-website.yaml` because it appears to target the wrong package. Replace or rewrite it to validate `packages/consuelo-website`, then decide whether the old `twenty-website` check still has any purpose.

### Phase 4: Promote required status checks

After evidence, required checks should be product-surface names, not inherited package names. Suggested required set:

- `Consuelo / verify`
- `CI Server / ci-server-status-check` or renamed server/API equivalent
- `CI Front / ci-front-status-check` if app UI changed
- `Consuelo / OS contracts` when OS/gateway/security changed
- `Consuelo / dialer` when dialer/call-path code changed
- `Consuelo / website` when website changed
- `Consuelo / workflow security` when `.github/**` changed

## Immediate recommendations

1. Keep the Danger retry change narrow and do not treat Danger as a safety gate.
2. Add a manual-only `Consuelo Verify` workflow as the first implementation step.
3. Replace the website check so it validates `packages/consuelo-website` instead of `packages/twenty-website`.
4. Add a workflow security audit check before expanding any `pull_request_target` workflow.
5. Use the test-selection registry as the source of truth for affected Consuelo tests; add explicit rules where the registry selects zero suites for critical surfaces.
6. Keep inherited Twenty CI while it still covers Twenty-derived runtime code, but rename or wrap status semantics so reviewers can tell inherited package checks from Consuelo product gates.
