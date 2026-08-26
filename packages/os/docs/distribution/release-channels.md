# Consuelo OS release channels

Consuelo OS publishes immutable, signed runtime bundles and moves signed channel pointers through `dev -> canary -> beta -> stable`. The signed channel manifest is authoritative. Immutable Git tags and GitHub Releases are the next recovery layer; GitHub Deployments preserve environment and approval evidence; protected `canary`, `beta`, and `stable` branches are secondary human-readable refs.

## Invariants

- A push to `main` computes the version-neutral runtime `releaseFingerprint` before any build.
- When the current `dev` manifest already contains that fingerprint, the workflow succeeds as a true no-op. It allocates no version, builds no archive, creates no tag or GitHub Release, creates no Deployment, and moves no channel.
- A changed closure gets exactly one stable SemVer. Patch is the default intent; minor or major must be selected explicitly; the first release requires `CONSUELO_OS_FIRST_RELEASE_VERSION`.
- The same source commit and release fingerprint reuse the same allocation after retry.
- Each platform archive is built once with that assigned version. The archive bytes, bundle manifest, detached Ed25519 signature, GitHub asset digest, and Cloudflare R2 object digest must agree.
- The release-set bundle ID identifies the complete required platform set: `darwin-arm64`, `linux-x64`, and `windows-x64`.
- The release rule is explicit: promotion never rebuilds or relabels an archive. It changes only the signed channel pointer, Deployment evidence, GitHub Release prerelease/latest status, and the corresponding protected channel branch.
- Legal promotion edges are only `dev -> canary`, `canary -> beta`, and `beta -> stable`.
- A protected promotion may use an exact bundle from the source channel's recorded history when a newer publication has already advanced that source pointer. The bundle must remain a verified immutable release that previously occupied the source channel, and the target channel must move forward in SemVer. Intentional downgrades use rollback instead of promotion.
- Stable promotion and stable rollback execute through the protected `consuelo-os-stable` GitHub environment and require explicit approval evidence.
- `schemaVersion` describes the channel-manifest format. Runtime SemVer describes the shipped runtime. A schema-format change requires an explicit migration decision and does not imply a runtime version bump by itself.
- Every state mutation checks an expected revision when supplied. GitHub Actions concurrency groups serialize mutations, while revision checks fail stale jobs closed.

## Workflows and protected environments

| Workflow | Trigger | Approval/deployment environment | Credential environment | Mutation |
| --- | --- | --- | --- | --- |
| `consuelo-os-runtime-publish.yaml` | push to `main` | provider records `consuelo-os-dev` deployment evidence | `consuelo / production` | fingerprint, optional SemVer allocation, one multi-platform build, immutable publication, signed `dev` pointer |
| `consuelo-os-runtime-promote.yaml` | manual dispatch | `consuelo-os-canary`, `consuelo-os-beta`, or `consuelo-os-stable` gate | `consuelo / production` | legal forward pointer movement only |
| `consuelo-os-runtime-rollback.yaml` | manual dispatch | selected `consuelo-os-*` channel gate | `consuelo / production` | pointer rollback to a prior verified bundle ID |

Pull-request workflows validate code and workflow contracts only. They do not receive release credentials and cannot mutate protected channel pointers. Channel environments carry approval and deployment evidence; Cloudflare release credentials are read only by mutation jobs through the existing `consuelo / production` credential environment. Credentials are not copied into channel environments.

## GitHub variables

- `CONSUELO_OS_RELEASE_R2_BUCKET`: Cloudflare R2 bucket containing immutable bundles, channel history, current pointers, and release state.
- `CONSUELO_OS_RELEASE_SIGNING_KEY_ID`: active Ed25519 key identifier.
- `CONSUELO_OS_RELEASE_SIGNING_PUBLIC_KEY`: PEM public key for the active signer.
- `CONSUELO_OS_RELEASE_TRUSTED_PUBLIC_KEYS`: JSON object mapping current and retained key IDs to PEM public keys, used during key rotation.
- `CONSUELO_OS_FIRST_RELEASE_VERSION`: explicit stable SemVer seed used only when no immutable `consuelo-os-v*` tag exists.
- `CONSUELO_OS_RELEASE_INTENT`: optional default `patch`, `minor`, or `major` intent for automatic main publication.
- `CONSUELO_OS_MINIMUM_UPDATER_VERSION`: minimum updater accepted by the runtime bundle manifest.

## GitHub release configuration

- `consuelo / production` variable: `CLOUDFLARE_ACCOUNT_ID`.
- `consuelo / production` secret: `CLOUDFLARE_OS_RELEASE_API_TOKEN`.
- Repository secret: `CONSUELO_OS_RELEASE_SIGNING_PRIVATE_KEY`.
- Repository variables: the `CONSUELO_OS_RELEASE_*` values listed above.

GitHub supplies `GITHUB_TOKEN`. Provider tokens are passed only through process environment variables. They are never placed in command arguments, state, audit records, or JSON errors.

## Storage layout

```text
R2 bucket
├── bundles/<platform-bundle-id>/<archive>.tar.gz
├── bundles/<platform-bundle-id>/<archive>.tar.gz.sig
├── channels/dev.json
├── channels/canary.json
├── channels/beta.json
├── channels/stable.json
├── channel-history/<channel>/<manifest-digest>.json
└── state/release-state.json
```

GitHub uses immutable tags named `consuelo-os-vX.Y.Z`. Each tag has one GitHub Release containing all platform archives and detached signatures. Promotion to stable changes the existing Release from prerelease to latest; it does not create new artifact bytes.

## CLI

All commands emit JSON. Mutating commands default to dry-run unless `--apply` is supplied. `--apply` and `--dry-run` are mutually exclusive.

For normal operator work, prefer the top-level `release` tool/command. It owns the common `PR -> main -> exact runtime publication -> protected promotion -> exact local update -> verification` sequence. The lower-level `release:channels` commands below remain the state-machine and recovery surface used by the protected workflows.

### Plan or publish dev

```bash
bun run --cwd packages/os release:channels -- publish \
  --channel dev \
  --plan-only \
  --state ../../.release/release-state.json \
  --fingerprint sha256:<fingerprint> \
  --source-commit <commit> \
  --intent patch \
  --seed-version 1.0.0 \
  --json
```

A changed plan returns one `version`; an unchanged plan returns `noOp: true` and no version.

After the platform archives are verified and assembled into a publication input:

```bash
bun run --cwd packages/os release:channels -- publish \
  --channel dev \
  --bundle sha256:<release-set-id> \
  --input ../../.release/publication.json \
  --state ../../.release/release-state.json \
  --expected-revision <revision> \
  --dry-run \
  --json
```

Replace `--dry-run` with `--apply` only inside the protected workflow.

### Promote

```bash
bun run --cwd packages/os release:channels -- promote \
  --from dev \
  --to canary \
  --bundle sha256:<release-set-id> \
  --state ../../.release/release-state.json \
  --approval-actor <actor> \
  --approval-evidence <workflow-url> \
  --dry-run \
  --json
```

Use `canary -> beta` and `beta -> stable` for later stages. The CLI rejects skipped or reversed edges. If the source pointer has advanced while a promotion is queued, the exact bundle must still exist in the source channel's verified history, and promotion rejects any move that would make the target channel's SemVer go backward.

### Inspect

```bash
bun run --cwd packages/os release:channels -- inspect \
  --channel stable \
  --state ../../.release/release-state.json \
  --json
```

`inspect` verifies the Ed25519 channel signature and consensus among the pointer, immutable release record, platform bundle identities, provider digests, protected branch ref, and Deployment evidence.

### Roll back a channel

```bash
bun run --cwd packages/os release:channels -- rollback-channel \
  --channel canary \
  --bundle sha256:<previous-release-set-id> \
  --state ../../.release/release-state.json \
  --approval-actor <actor> \
  --approval-evidence <workflow-url> \
  --dry-run \
  --json
```

Rollback accepts only a bundle already present in that channel's verified history. It creates a new signed pointer revision and Deployment record; immutable bytes remain untouched.

## First-release procedure

1. Configure all four GitHub environments and the variables/secrets above.
2. Set `CONSUELO_OS_FIRST_RELEASE_VERSION` to the approved stable seed, for example `1.0.0`.
3. Merge a runtime-changing commit to `main`.
4. Confirm the plan reports `changed: true` and the exact seed version.
5. Confirm all three platform jobs pass and the publish job creates the tag, Release, R2 objects, Deployment, signed `dev` manifest, and release state.
6. Clear or retain the seed variable; later releases derive from immutable tags and do not use it.

## Key rotation

Add the new public key to `CONSUELO_OS_RELEASE_TRUSTED_PUBLIC_KEYS` before selecting the new active key ID/private key/public key. Promotion and rollback verify old pointers with retained keys and sign the new pointer with the active key. Remove an old public key only after no supported channel or rollback target depends on it.

## Failure and retry behavior

- A mismatched digest, signature, version, fingerprint, source commit, platform inventory, tag, Release, Deployment, or channel pointer fails closed.
- Exact retries return `idempotent: true` and do not increment state revision.
- A stale `--expected-revision` fails before provider mutation.
- Provider errors are redacted. Restore the same authoritative state and rerun the same command; do not allocate a new version or rebuild.
- If publication partially reaches a provider, inspect the immutable tag, Release assets, R2 objects, Deployment, and channel history before retrying. Never overwrite an object with different bytes.

## Operator-node checkpoint

The top-level `release` workflow updates the operator node by default after the exact bundle reaches the requested channel, then verifies that lifecycle status reports the same version and bundle ID. Use `releaseOnly: true` or `--release-only` to stop after channel promotion. A read-only manual checkpoint remains useful for another test machine:

```bash
curl -fsSL "https://<release-host>/channels/canary.json" | jq '{channel: .payload.channel, version: .payload.version, bundleId: .payload.bundleId, platforms: [.payload.platforms[] | (.platform + "-" + .architecture)]}'
```

Expected result: valid JSON reports `channel: "canary"`, the approved version and bundle ID, and exactly the required platform identities. Signature verification by the updater must succeed before any installation command is approved.
