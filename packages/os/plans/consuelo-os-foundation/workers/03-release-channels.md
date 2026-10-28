# Worker 03: Automatic Versioning, Release Publication, and Channel Promotion

## Dependencies

Do not begin until Worker 01 and Worker 02 are integrated into `stream/os-distribution`.

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` completely, repository steering, and both OS engineering/task skills. Start an isolated task from the updated distribution stream. Do not revert concurrent work.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Objective

Implement automatic, idempotent Consuelo OS version assignment plus immutable runtime-bundle publication and promotion. Signed channel manifests, immutable tags, GitHub Releases, and GitHub Deployments are authoritative; permanent protected `canary`, `beta`, and `stable` branches are secondary visibility refs. Never deploy arbitrary open PRs.

## Release behavior

- Pull requests run build and validation checks only.
- A successful merge to `main` computes Worker 02's version-neutral release fingerprint before publication.
- If that fingerprint equals current dev, record a successful no-op: no version bump, archive build, tag, Release, Deployment, or channel movement.
- If it changed, derive one SemVer from the highest immutable `consuelo-os-vX.Y.Z` tag. Default to patch; accept minor or major only from an explicit validated release-intent label/manual input. Require one explicit seed version for the first Consuelo OS release.
- Supply that version to Worker 02, build the platform runtime-bundle set exactly once, create the immutable tag and matching GitHub Release, publish by digest, record the Deployment, and update the signed dev manifest.
- Promotion moves the exact digest from dev to canary, canary to beta, and beta to stable.
- Promotion never changes version, recompiles, repackages, or rewrites runtime-bundle bytes.
- Mac Mini tracks dev.
- MacBook Air is the on-demand real-machine canary/beta acceptance gate; Ko controls when it is online and runs the checkpoint command.
- Protected `canary`, `beta`, and `stable` branches are automation-only, secondary promotion refs. They accept no feature work, may point only to commits integrated into `main`, and may never override immutable release metadata.
- Publish matching GitHub Release/prerelease assets and Cloudflare-served bundle bytes without requiring customer GitHub or Cloudflare accounts.

## Implementation requirements

Create typed channel manifests and verification logic for:

- one authoritative version value shared by runtime-bundle manifests, immutable tag, GitHub Release, GitHub Deployment, and signed channel manifests;
- version-neutral fingerprint comparison and a release-impact classifier that ignores docs, tests, internal audit fixtures, and unrelated GTM changes outside the OS runtime closure;
- automatic patch/minor/major calculation, first-release seed validation, and retry idempotency for the same source/fingerprint;
- a manually managed `schemaVersion` that is separate from SemVer and changes only with a format migration/compatibility decision;
- legal transitions;
- platform completeness;
- runtime-bundle existence and digest;
- signature verification;
- source commit and version visibility;
- required evidence references;
- idempotent repromotion;
- concurrency control;
- rollback of a channel pointer to a previous verified runtime bundle;
- audit history without secrets.

Create GitHub Actions workflows using environments named consistently for dev, canary, beta, and stable. Use environment protections for consequential promotion. Main publication and automatic version assignment may run only after all required checks. Stable is manual.

Add a Bun-owned release command that can:

```text
publish --channel dev --bundle <id>
promote --from dev --to canary --bundle <id>
promote --from canary --to beta --bundle <id>
promote --from beta --to stable --bundle <id>
inspect --channel <name>
rollback-channel --channel <name> --bundle <id>
```

Support dry-run and structured JSON output. Fail closed when credentials, signatures, evidence, or source-channel identity are missing.

## Owned files

- Channel schema and release commands under the distribution modules.
- Dedicated OS release workflows under `.github/workflows/`.
- Focused channel and workflow contract tests.
- Release documentation specific to channel operation.

## Forbidden scope

- Do not allow direct commits or feature merges to the protected release branches.
- Do not deploy pull-request runtime bundles to active machines.
- Do not create a second runtime-bundle builder.
- Do not make a channel manifest mutable without signed/audited history.
- Do not couple channel promotion to Ko's machine being online.

## Required tests

- Main publication references exactly the built runtime-bundle digest.
- Unchanged runtime closure creates no version, archive, tag, Release, Deployment, or channel update.
- Changed runtime closure defaults to one patch version; explicit minor/major intent is validated.
- First release requires the configured seed, and retrying the same source/fingerprint reuses the same version and assets.
- Runtime-bundle manifests, immutable tag, GitHub Release, Deployment, and every referencing channel manifest agree on version and fingerprint.
- `schemaVersion` does not follow SemVer and cannot change without an explicit format migration decision.
- Every promotion preserves the digest and bytes.
- Illegal transition fails.
- Missing platform runtime bundle fails.
- Concurrent promotion serializes safely.
- Stable requires explicit approval/manual dispatch.
- PR workflows cannot update a channel pointer.
- Secondary release-branch refs, signed channel metadata, GitHub Release assets, GitHub Deployments, and Cloudflare bytes all resolve to the same version and digest.
- Secret values never appear in logs or runtime bundles.

## Completion output

Report workflow triggers, environment names, promotion commands, required GitHub secrets/variables by name only, exact tests, and a dry-run example proving no rebuild occurs.
