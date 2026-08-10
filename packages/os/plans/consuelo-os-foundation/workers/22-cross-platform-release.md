# Worker 22: Cross-Platform Release Integration

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` in full and the completed outputs of workers 03, 19, 20, and 21. This task owns shared release-matrix integration; platform workers must not each invent workflow logic.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Mission

Publish one coherent OS release whose macOS, Linux, and Windows runtime bundles share version, source commit, protocol compatibility, manifests, and promotion semantics.

## Required implementation

1. Build platform/architecture runtime bundles through a matrix from one source commit.
2. Consume Worker 03's single automatically allocated SemVer and version-neutral release fingerprint. Platform builders must not calculate their own versions.
3. Generate one release manifest that records that version/fingerprint plus every required runtime bundle, digest, size, compatibility level, and signature/attestation state.
4. Fail the release if a required platform runtime bundle is missing or incompatible.
5. Publish the immutable runtime-bundle set once to the immutable tag, matching GitHub Release assets, GitHub Deployment record, and Cloudflare delivery storage.
6. Advance `dev` only after the matrix is complete and every authority agrees on version, fingerprint, and digest.
7. Promote canary, beta, and stable by updating signed channel metadata, Deployment evidence, Release state, and the secondary protected branch to that same runtime-bundle set; never rebuild or re-version.
8. Add concurrency controls so stale release jobs cannot overwrite newer channel pointers.
9. Retain deployment history and support explicit rollback to a prior complete release set.
10. Keep open PRs check-only.

## Compatibility contract

Define and validate compatibility between:

- local lifecycle API;
- native shell client;
- MCP facade;
- connector protocol;
- workspace/shared config schema;
- managed-component schema.

A release with incompatible components must either migrate safely or fail before channel promotion.

## Tests

- Matrix build on all supported runner families.
- Manifest schema and digest validation.
- Missing-platform fail-closed test.
- Promotion-without-rebuild proof.
- Concurrent/stale promotion rejection.
- Cross-platform clean install smoke.
- Upgrade from the prior supported release.
- Rollback to prior release.
- Channel visibility test for dev/canary/beta/stable.
- Protected release-branch ancestry and no-direct-commit enforcement.
- GitHub Release asset and Cloudflare-delivered byte digest parity.
- Immutable tag, GitHub Release, GitHub Deployment, signed channel manifest, and secondary branch all agree on version, fingerprint, source commit, and digest.

## Acceptance gates

- Every platform installs bytes identified by the same logical release manifest.
- Promotions do not invoke compilers or package installation.
- The Mac Mini can follow dev while the Air remains offline.
- Bringing the Air online later can select canary/beta and converge correctly.
- Stable cannot advance unless required platform gates pass.
- Release metadata is auditable without exposing secrets.

## Out of scope

- App Store, Microsoft Store, or Linux package-repository publication.
- Automatic stable promotion without an explicit product policy.
- Deploying arbitrary PR builds.

## Completion report

Include the release manifest, protected-branch/channel history, workflow evidence, runtime-bundle digests, rollback rehearsal, and any signing gates not yet satisfied.
