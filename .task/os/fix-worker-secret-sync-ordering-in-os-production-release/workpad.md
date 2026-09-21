# fix Worker secret sync ordering in OS production release

branch: `task/os/fix-worker-secret-sync-ordering-in-os-production-release`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1945/fix-worker-secret-sync-ordering-in-os-production-release
github pr: https://github.com/consuelohq/opensaas/pull/1945
started: 2026-08-14

## acceptance criteria

- [x] The production OS release deploys the current Device Authority Worker before rotating its connector provisioning secret, so Wrangler never rejects secret sync because an undeployed latest version exists.
- [x] Existing fail-closed checks for both GitHub Cloudflare credentials remain intact; no secret value is logged or committed.
- [x] The production workflow contract explicitly protects deploy-before-secret-sync ordering.
- [x] Focused workflow test, strict review, and publish verify pass before promotion back through `stream/os` and `main`.

## plan

1. Change the existing workflow contract test first so it requires `Release Consuelo OS` before `Sync Consuelo OS connector provisioning secret`; run it RED against the current workflow.
2. Reorder only those two workflow steps. Keep the same secret presence checks and `wrangler secret put` command so Cloudflare rotates the token only after the newest Worker version is deployed.
3. Run the same focused test GREEN, inspect the two-file diff, then review/verify and promote through the normal task lifecycle.

## current status

- Live release run `31778494377` failed in the secret-sync step with Wrangler 4.105.0: `Secret edit failed. You attempted to modify a secret, but the latest version of your Worker isn't currently deployed.`
- The production environment contains both required secret names; this is workflow ordering, not missing credentials.
- Cloudflare documents `wrangler secret put` as creating and immediately deploying a Worker version, which requires the current latest version to already be deployed. The workflow currently runs secret sync before `bun run os:release` deploys that version.
- Implementation complete: `Release Consuelo OS` now precedes `Sync Consuelo OS connector provisioning secret`; command bodies and secret sources are otherwise unchanged.
- Validation: owning workflow contract went RED 1/3 then GREEN 3/3; strict review found 0 issues/blockers; full verify is `publishValid: true` with DB guard clean.

## files changed

- `.github/workflows/consuelo-production-release.yaml`
- `packages/workspace/tests/website-deploy.test.js`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-14 07:23:28 `review.run`: passed — OK
- 2026-08-14 07:24:32 `verify`: passed — OK

## key decisions

- Keep `wrangler secret put` rather than introducing a second versions/deployment flow. After `os:release`, the latest version is deployed, so the existing secret command performs the intended immediate rotation on the same code.
- Do not move secret values into source/config or print them. Preserve GitHub Environment secret transport.
- This is a release-workflow repair only; no Device Authority auth/runtime behavior changes.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Initial main runtime-publication distribution regression failed once but passed on rerun and advanced to publication planning; no code fix is being attributed to that transient failure.
- The public OS release failure is deterministic under Cloudflare's current version/secret semantics and must be fixed before rerunning the OS production release.
- Task-session batch read briefly returned `Connection failed`; split single-file reads succeeded with no mutation loss.
- Test-selection has no explicit rule for this workflow and selects zero suites. The exact owning workflow test was run manually RED→GREEN, and full verify passed without package-wide test fanout.

## Test-first contract

- Behavior under test: the production workflow deploys the OS Worker before calling `wrangler secret put CLOUDFLARE_API_TOKEN`, while retaining credential checks and dedicated provisioning-token transport.
- Existing local pattern: `packages/workspace/tests/website-deploy.test.js` statically validates the production release workflow and already asserts the two step names/order.
- Changed test: invert the existing order assertion so `osReleaseIndex < provisioningSecretSyncIndex`.
- Focused RED command: `bun x vitest run packages/workspace/tests/website-deploy.test.js` after source safety preflight.
- Expected RED: the current workflow has provisioning secret sync before OS release.
- No-test waiver: none; this failure has a direct deterministic workflow contract.
- RED evidence: `packages/workspace/tests/website-deploy.test.js` failed on the new deploy-before-sync assertion (`expected 6257 to be less than 5430`).
- GREEN evidence: the same test passes 3/3 after the workflow reorder.
- Review evidence: strict review against `origin/stream/os` reports 0 task issues and 0 blockers.
- Verify evidence: full verify against `origin/stream/os` reports `publishValid: true`; DB guard has 0 risks/findings.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.github/workflows/consuelo-production-release.yaml`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/tests/website-deploy.test.js`

- 2026-08-14 07:24:45 apply-patch: `.task/os/fix-worker-secret-sync-ordering-in-os-production-release/workpad.md`