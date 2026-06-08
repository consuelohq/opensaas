# add os installer release operator

branch: `task/os/add-os-install-release-operator`
stream: `stream/os`
started: 2026-06-02

## acceptance criteria

- [x] Keep public installer/bootstrap code in `packages/os`.
- [x] Add private/operator-only release automation outside `packages/os`.
- [x] Release script deploys the OS bootstrap through Cloudflare Workers using `wrangler`.
- [x] Script supports dry-run and verify-only modes.
- [x] Update workspace script docs.
- [x] Validate dry-run and help behavior.
- [ ] Validate syntax/typecheck and public verification behavior.
- [ ] Push branch and open PR after Ko confirms placement is right.

## placement decision

Use `packages/workspace/scripts/os-release-install.ts` for now. This matches existing operator-script conventions and keeps Cloudflare release credentials/operators out of the user-facing OS package. Longer-term target could be a private `packages/operators` or `.ops` package if workspace is retired.

## test-first contract

Behavior under test:

- `--help` documents the operator flow and defaults.
- `--dry-run` generates a Worker from `packages/os/scripts/bootstrap.sh` and invokes `wrangler deploy --dry-run` without publishing.
- `--verify-only` checks that the public URL serves the exact bootstrap content by SHA-256.

Existing pattern:

- Workspace operator scripts live under `packages/workspace/scripts` and are exposed through `packages/workspace/package.json`.
- `packages/workspace/SCRIPTS.md` documents scripts.

Focused red/no-test note:

No standalone unit test added yet because this is an operator CLI around external `wrangler`. Validation is CLI help, dry-run deploy, and syntax/typecheck.

## files changed

- `packages/workspace/scripts/os-release-install.ts`
- `package.json`
- `packages/workspace/package.json`
- `packages/workspace/SCRIPTS.md`
- `.task/os/add-os-install-release-operator/workpad.md`

## validation

Pending.

## progress

- Added root `os:release-install` script alias matching existing root operator-script pattern.
- Cloudflare deploy dry-run succeeded with generated Worker and `--domain install.consuelohq.com`.
- Actual Cloudflare deploy succeeded; immediate verification failed because the custom domain was not reachable yet. Added verification retry flags for propagation.

## cloudflare deploy evidence

- `wrangler deploy` uploaded Worker `consuelo-os-install` and attached custom domain `install.consuelohq.com`.
- Immediate verification failed because DNS still resolves `install.consuelohq.com` through the wildcard Railway CNAME.
- Required DNS fix: add a specific Cloudflare DNS record for `install.consuelohq.com` with proxy enabled so it overrides the DNS-only wildcard.
