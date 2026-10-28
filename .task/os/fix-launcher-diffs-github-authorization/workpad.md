# fix launcher diffs github authorization

branch: `task/os/fix-launcher-diffs-github-authorization`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2357
started: 2026-09-01

## acceptance criteria

- [ ] The real launcher `/diffs` Connect GitHub flow completes GitHub user authorization instead of returning `GITHUB_USER_AUTHORIZATION_FAILED`.
- [ ] GitHub App installation/selection and the one-time handoff still configure the selected repositories and return to `/diffs`.
- [ ] OAuth/PKCE state, authorization codes, client secrets, and access tokens are not exposed in logs, UI errors, or traces.
- [ ] A failed GitHub token exchange returns enough sanitized diagnostic information to distinguish configuration failure from protocol/user failure without exposing credentials.
- [ ] Existing source-control authorization, installation ownership, retry, and spoof-protection tests remain green.
- [ ] The fix is validated against the real launcher flow and promoted into `stream/os`.

## plan

1. Reproduce the production launcher flow and isolate the failing boundary.
2. Compare the production GitHub App OAuth configuration with the Device Authority configuration; repair stale/mismatched credentials if confirmed.
3. Add a focused regression test for safe token-exchange failure diagnostics, run it red, then make the smallest code change if needed.
4. Run the source-control focused suite plus review/verify.
5. Push/promote to `stream/os`, apply any required Device Authority configuration/release update, and rerun the real `/diffs` GitHub connection end to end.

## Test-first contract

behavior under test: when GitHub rejects the OAuth access-token exchange, Device Authority preserves the existing safe `GITHUB_USER_AUTHORIZATION_FAILED` boundary while surfacing only a sanitized upstream OAuth reason/code useful for operations; successful PKCE exchange and installation flows remain unchanged.
existing local pattern: `GitHubSourceControlError` is the typed Device Authority boundary and `packages/os/tests/github-source-control-authority.test.ts` mocks the GitHub token/install APIs without real provider calls.
new or changed tests: add a focused authority test with a mocked non-success token response (for example `incorrect_client_credentials`) and assert the returned diagnostic is sanitized and contains no authorization code, client secret, or token.
focused red command: `bun test tests/github-source-control-authority.test.ts` from `packages/os`.
expected red failure: current token-exchange code collapses every GitHub OAuth error into the same generic message, so the new safe diagnostic assertion fails.
no-test waiver: not applicable.

## files changed

- `packages/os/cloudflare/os-device-authority/src/services/github-source-control.ts` — add the required GitHub REST `User-Agent` and safe OAuth failure classification.
- `packages/os/tests/github-source-control-authority.test.ts` — cover rejected client credentials without secret leakage and enforce the REST `User-Agent` contract.

## validation

- Red: focused authority test failed on the new safe client-credential diagnostic before implementation.
- Green: `bun test tests/github-source-control-authority.test.ts` — 10 passed.
- Red: existing installation flow failed after asserting the required GitHub REST `User-Agent` before implementation.
- Green: `bun test tests/github-source-control-authority.test.ts tests/settings-hono-routes.test.ts tests/os-device-authority-release-contract.test.ts` — 42 passed, 0 failed.
- `review.run --strict --mine` — 0 issues, 0 blockers.
- Full `verify` against `origin/stream/os` — passed and publish-valid.
- Live before code deploy: rotating the GitHub App client secret advanced production from `GITHUB_USER_AUTHORIZATION_FAILED` to the first REST request, proving the credential mismatch was repaired; final live E2E remains pending Device Authority code deploy.

## key decisions

- The Diffs page itself is not the failing boundary. Production reaches GitHub, GitHub returns an OAuth authorization code, and the failure occurs when Device Authority exchanges that one-time code for a GitHub user token.
- PKCE construction is structurally correct in the current code (`S256`, SHA-256/base64url challenge, same callback URL on authorize and exchange).
- The GitHub App client ID in production matches the Consuelo OS GitHub App. The only pre-existing GitHub App client secret showed `Never used`, while Device Authority was actively attempting exchanges, proving the Worker held a stale/mismatched client secret. A new GitHub client secret was generated and copied directly to the system clipboard, then uploaded to Cloudflare via stdin without exposing the value in tool output or argv.
- After rotating `GITHUB_APP_CLIENT_SECRET`, the live flow advanced past token exchange and failed on the first GitHub REST call (`GET /user/installations`). GitHub requires a valid `User-Agent` on REST requests; the shared `githubRequest` helper omitted it. A focused test reproduced this as a red failure before the production edit.
- The implementation now adds `user-agent: consuelo-os-device-authority` centrally and maps a small allow-list of OAuth error categories to safe operator messages without returning upstream descriptions, codes, secrets, or tokens.

## notes for ko

- The real launcher flow was reproduced against `internal.consuelohq.com/diffs`; no synthetic-only failure is being inferred.
- Ko completed GitHub sudo-mode confirmation. The GitHub App callback URL is correct and exact: `https://os.consuelohq.com/workspace/source-control/github/oauth/callback`.
- Secret rotation is already live in Cloudflare. No secret value was printed, logged, stored in the repo, or written to disk by this task.

## improvements noticed

- The current OAuth exchange throws a generic error and discards GitHub's safe error category, which makes configuration mistakes unnecessarily opaque.
- GitHub REST requests did not set the required `User-Agent`, a protocol requirement that mocks previously failed to enforce.

## errors i ran into

- One exact-symbol `explore` query failed while two parallel discovery queries succeeded; direct file search located the error source.
- The shared headed Chrome profile initially had a stale SingletonLock; closing the existing browser session and reopening it recovered cleanly.
- Initial workpad overwrite used `fs.write` without `force`; retried with the required overwrite flag.
- After the client-secret repair, the live flow exposed the second independent failure (`GITHUB_API_FAILED`); this was not a regression from the rotation but the next previously-unreachable boundary.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-09-01 01:20:15 write: `.task/os/fix-launcher-diffs-github-authorization/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-01 01:20:15 fs.write: `.task/os/fix-launcher-diffs-github-authorization/workpad.md`

- 2026-09-01 01:26:44 apply-patch: `packages/os/tests/github-source-control-authority.test.ts`
- 2026-09-01 01:26:57 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/github-source-control.ts`
- 2026-09-01 01:28:07 apply-patch: `packages/os/tests/github-source-control-authority.test.ts`
- 2026-09-01 01:28:14 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/github-source-control.ts`

- 2026-09-01 01:28:38 apply-patch: `.task/os/fix-launcher-diffs-github-authorization/workpad.md`

## workspace-owned: validation evidence

- 2026-09-01 01:29:18 `review.run`: passed — OK
- 2026-09-01 01:29:34 `verify`: passed — OK

- 2026-09-01 01:29:44 apply-patch: `.task/os/fix-launcher-diffs-github-authorization/workpad.md`