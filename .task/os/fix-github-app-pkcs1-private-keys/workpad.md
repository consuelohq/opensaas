# fix GitHub App PKCS1 private keys

branch: `task/os/fix-github-app-pkcs1-private-keys`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2360
started: 2026-09-01

## acceptance criteria

- [ ] Device Authority signs GitHub App JWTs using GitHub's actual downloaded PKCS#1 `RSA PRIVATE KEY` format.
- [ ] Existing PKCS#8 private-key values remain compatible.
- [ ] No private-key material is logged, returned, or persisted outside the existing Cloudflare secret boundary.
- [ ] Existing GitHub OAuth, installation ownership, retry, and handoff tests remain green.
- [ ] The fix is promoted into `stream/os`, deployed to Device Authority, and the real `internal.consuelohq.com/diffs` connection flow completes end to end.

## plan

1. Make the existing GitHub source-control test fixture use provider-realistic PKCS#1 and prove the current importer fails red.
2. Add the smallest portable PKCS#1-to-PKCS#8 DER wrapper before the existing WebCrypto import while preserving direct PKCS#8 support.
3. Run focused and adjacent source-control/release tests, review, and full verify.
4. Push/promote to `stream/os`, deploy Device Authority, and rerun the live launcher Diffs GitHub connection until repositories load.

## Test-first contract

behavior under test: Device Authority accepts the actual GitHub App downloaded private-key format (`-----BEGIN RSA PRIVATE KEY-----`, PKCS#1) when signing the app JWT used for installation API calls.
existing local pattern: `githubAppJwt()` imports PKCS#8 through WebCrypto, and `github-source-control-authority.test.ts` exercises the full mocked OAuth/install/token flow with generated RSA keys.
new or changed tests: switch the test GitHub App private-key fixture from PKCS#8 to PKCS#1 so all existing installation/JWT tests use the provider-realistic format.
focused red command: `bun test tests/github-source-control-authority.test.ts` from `packages/os`.
expected red failure: current `pemBytes()` strips only `BEGIN PRIVATE KEY` and WebCrypto receives invalid DER for a PKCS#1 `RSA PRIVATE KEY`, causing successful installation paths to return `GITHUB_APP_PRIVATE_KEY_INVALID`/503.
no-test waiver: not applicable.

## files changed

- `packages/os/cloudflare/os-device-authority/src/services/github-source-control.ts` — accept GitHub PKCS#1 RSA private keys by wrapping them as PKCS#8 for WebCrypto; keep PKCS#8 direct support.
- `packages/os/tests/github-source-control-authority.test.ts` — use a provider-realistic PKCS#1 GitHub App key fixture.

## validation

- Red: `bun test tests/github-source-control-authority.test.ts` with the PKCS#1 fixture — 4 passed / 6 failed; installation/JWT success paths returned 503 as expected.
- Green: same focused suite after implementation — 10 passed / 0 failed.
- Adjacent suites: `github-source-control-authority`, `settings-hono-routes`, and `os-device-authority-release-contract` — 42 passed / 0 failed, 222 expectations.
- `review.run --strict --mine` — 0 issues, 0 blockers.
- Full `verify` against `origin/stream/os` — passed and publish-valid.

## key decisions

- Live E2E already reached `GITHUB_APP_PRIVATE_KEY_INVALID` after the OAuth client-secret and GitHub REST User-Agent fixes landed on `stream/os`.
- GitHub App private keys are provider-issued PKCS#1 RSA keys; rotating the real key would not solve a parser that only accepts PKCS#8.
- Preserve WebCrypto and convert only the outer key container in-process; do not add a Node crypto dependency to the Worker runtime.

## notes for ko

- This is the third previously-hidden boundary exposed by exercising the real Diffs connection flow. The earlier auth fixes are already in `stream/os`; this follow-up is isolated because the original task branch was deleted automatically after its first merge.

## improvements noticed

- none yet

## errors i ran into

- The original task PR had already merged and its remote task branch was deleted when the live E2E exposed this follow-up. A second `task.push` correctly failed with `remote branch not found`, so this continuation was moved to a fresh task branch from current `stream/os` rather than recreating stale remote state.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/services/github-source-control.ts`
- `packages/os/tests/github-source-control-authority.test.ts`

- 2026-09-01 01:45:42 apply-patch: `packages/os/tests/github-source-control-authority.test.ts`
- 2026-09-01 01:45:59 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/github-source-control.ts`

## workspace-owned: validation evidence

- 2026-09-01 01:47:34 `review.run`: passed — OK
- 2026-09-01 01:48:33 `verify`: passed — OK

- 2026-09-01 01:48:42 apply-patch: `.task/os/fix-github-app-pkcs1-private-keys/workpad.md`