# separate release credentials from channel approvals

branch: `task/os-distribution/separate-release-credentials-from-channel-approvals`
stream: `stream/os-distribution`
pr: https://github.com/consuelohq/opensaas/pull/1630
started: 2026-07-24

## goal

Restore live Consuelo OS publication without copying or exposing the existing Cloudflare release token. Use the existing `consuelo / production` environment as the credential vault while preserving `consuelo-os-dev`, `consuelo-os-canary`, `consuelo-os-beta`, and `consuelo-os-stable` as channel approval and deployment-evidence boundaries.

## acceptance criteria

- [x] Publish planning and mutation jobs obtain Cloudflare credentials from `consuelo / production`.
- [x] Promotion and rollback require a separate destination-channel environment gate before the credentialed mutation job.
- [x] GitHub Deployment evidence continues to target the `consuelo-os-*` channel environment, not the credential vault.
- [x] Cloudflare account ID is read from a GitHub variable and the release API token remains a secret.
- [x] Workflow contracts parse YAML and prove the credential/approval split.
- [x] Release documentation and environment registry describe the split accurately.
- [x] Focused release workflow/domain tests, full distribution suite, workflow guard, and typecheck pass.
- [ ] Merge through `stream/os-distribution` to `main` without manually requesting or retrying external AI reviews.
- [ ] Observe a successful `Consuelo OS runtime publish` run and verify the first immutable dev release.
- [ ] Sync distribution, provider, and web streams to the final main SHA.

## discovery

- Live publication run `30072986603` passed package dependency installation, then failed because `consuelo-os-dev` contained no Cloudflare account variable, release token, or bucket variable.
- The existing `consuelo / production` environment already contains `CLOUDFLARE_OS_RELEASE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; GitHub does not expose secret values for copying.
- `consuelo-os-dev`, `consuelo-os-canary`, `consuelo-os-beta`, and `consuelo-os-stable` intentionally contain no copied production secrets.
- Created and verified R2 bucket `consuelo-os-releases` using the authenticated local Wrangler operator session.
- Configured repository-scoped signing authority and release variables: Ed25519 key ID `consuelo-os-release-2026-07-v1`, trusted/public key material, bucket, first release seed `0.1.0`, patch intent, and minimum updater `0.1.0`. The signing private key is stored only as a GitHub repository secret.
- Current promotion/rollback workflows combine the channel environment gate and credential lookup in one job; this fails because the channel environments correctly have no Cloudflare credentials.
- Existing release provider code creates GitHub Deployments for the destination `consuelo-os-*` environment independently of the workflow job environment.

## test-first contract

Before workflow edits, extend `release-channel-workflows.test.ts` to prove:

- publish credentialed jobs use `consuelo / production`;
- promotion and rollback each have an approval job using the dynamic `consuelo-os-*` destination environment;
- credentialed mutation jobs use `consuelo / production` and depend on the approval job;
- Cloudflare account ID is sourced from `vars`, while the API token remains in `secrets`;
- build and release behavior, no-rebuild promotion, concurrency, and channel deployment operations remain unchanged.

The focused contract must fail against the current workflows before production edits.

## plan

1. Add structured YAML assertions for the credential-vault/channel-gate split and observe RED.
2. Patch publish, promotion, and rollback workflows minimally.
3. Update release docs and environment registry.
4. Run focused and full distribution validation, workflow guard, and task verify.
5. Merge task to stream, promote stream to main, follow the live publication run to completion, and verify release artifacts/evidence.
6. Sync all wave streams and report the next dependency-ready worker briefs.

## constraints

- Do not expose, retrieve, copy, or print the production Cloudflare token.
- Do not manually trigger or retry CodeRabbit, Codex, Grok, or Qodo.
- Do not rebuild during promotion or rollback.
- Do not alter Ko's Mac installations.

## files changed

- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `.github/workflows/consuelo-os-runtime-promote.yaml`
- `.github/workflows/consuelo-os-runtime-rollback.yaml`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`
- `packages/os/docs/distribution/release-channels.md`
- `packages/os/plans/consuelo-os-foundation/environment-registry.md`

## issues and recovery

- Cloudflare dashboard token creation is blocked by a human verification challenge. The workflow split avoids needing to extract or duplicate the existing release token.

## validation evidence

- RED: the structured workflow contract failed because publish planning still used `consuelo-os-dev` as its credential source.
- GREEN: release workflow contracts passed 7/7 after the environment split.
- GREEN: release domain, provider retry, and publication preparation suites passed 26/26.
- GREEN: full distribution suite passed 73 tests with 7 existing TODO contracts.
- GREEN: OS package typecheck/syntax gate passed.
- Workflow security guard returned zero findings before commit; rerun after the first task commit is required so Git history includes the modified workflow files.
- GREEN: full task verify passed in publish-valid mode with static rules, ESLint, typecheck, spec compliance, and DB safety clean.

- 2026-07-24 06:52:30 write: `.task/os-distribution/separate-release-credentials-from-channel-approvals/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-24 06:52:30 fs.write: `.task/os-distribution/separate-release-credentials-from-channel-approvals/workpad.md`

- 2026-07-24 06:52:49 apply-patch: `packages/os/tests/distribution/release-channel-workflows.test.ts`
- 2026-07-24 06:53:18 apply-patch: `.github/workflows/consuelo-os-runtime-publish.yaml`
- 2026-07-24 06:53:18 apply-patch: `.github/workflows/consuelo-os-runtime-promote.yaml`
- 2026-07-24 06:53:18 apply-patch: `.github/workflows/consuelo-os-runtime-rollback.yaml`
- 2026-07-24 06:53:18 apply-patch: `packages/os/tests/distribution/release-channel-workflows.test.ts`
- 2026-07-24 06:53:18 apply-patch: `packages/os/docs/distribution/release-channels.md`
- 2026-07-24 06:53:19 apply-patch: `packages/os/plans/consuelo-os-foundation/environment-registry.md`

## workspace-owned: files read

- none yet

- 2026-07-24 06:53:58 apply-patch: `.task/os-distribution/separate-release-credentials-from-channel-approvals/workpad.md`

## workspace-owned: validation evidence

- RED: the structured workflow contract failed because publish planning still used `consuelo-os-dev` as its credential source.
- GREEN: release workflow contracts passed 7/7 after the environment split.
- GREEN: release domain, provider retry, and publication preparation suites passed 26/26.
- GREEN: full distribution suite passed 73 tests with 7 existing TODO contracts.
- GREEN: OS package typecheck/syntax gate passed.
- Workflow security guard returned zero findings before commit; rerun after the first task commit is required so Git history includes the modified workflow files.
- 2026-07-24 06:52:30 write: `.task/os-distribution/separate-release-credentials-from-channel-approvals/workpad.md`
- 2026-07-24 06:54:18 `verify`: passed — OK

- 2026-07-24 06:54:23 apply-patch: `.task/os-distribution/separate-release-credentials-from-channel-approvals/workpad.md`