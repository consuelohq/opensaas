# release readiness retry

branch: `task/security/release-readiness-retry`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1391/release-readiness-retry
github pr: https://github.com/consuelohq/opensaas/pull/1391
started: 2026-07-10

## acceptance criteria

- [x] Device-authority post-deploy verification tolerates bounded Cloudflare propagation delay.
- [x] Verification retries transient health/readiness failures and succeeds once connector provisioning is live.
- [x] Exhausted retries still fail closed with one concise final error.
- [x] Retry attempts and delay are configurable for operator use and deterministic tests.
- [x] Existing remote-secret preflight, R2 upload, Worker deployment, and live hardening checks remain unchanged.
- [x] Focused release tests, OS syntax checks, review, and full verify pass.
- [ ] Change is promoted through `stream/security`, merged to `main`, and the OS-only production workflow is green.

## plan

1. Add test-first coverage for a temporarily stale `/health` response that becomes ready on a later attempt.
2. Add bounded retry options and an injectable delay using the installer release script's existing pattern.
3. Retry the complete device-authority verification sequence, preserving fail-closed final errors.
4. Run focused tests, review, verify, push, promote, merge, and exercise the real GitHub OS release workflow.

## test-first contract

- Behavior under test: after a successful Worker deployment, device-authority verification must tolerate Cloudflare propagation and pass when readiness becomes true within the configured attempt budget.
- Existing local pattern: `os-release-install.ts` performs 12 attempts with a 5-second delay and reports the final failure after exhaustion.
- Changed tests: extend `packages/os/tests/os-device-authority-release-contract.test.ts` with a stale-then-ready health sequence and a no-delay injected sleeper; keep the existing concise failure assertion at one attempt.
- Focused red command: `bun --cwd packages/os vitest run tests/os-device-authority-release-contract.test.ts`.
- Expected red failure: `--verify-attempts` is currently unknown and verification exits before retrying the second health response.

## current status

- Production evidence isolated the failure to a propagation race: CI completed installer deploy, R2 uploads, Worker deploy, and route update; immediate readiness failed, while the same live verification passed about one minute later.
- Added bounded verification retries with defaults of 12 attempts and 5 seconds, plus an injectable delay for deterministic tests.
- Runtime `CLOUDFLARE_API_TOKEN` remains present by name; live health, Google approval, and device-key hardening checks pass.
- Eight device-authority release contracts and three production-workflow contracts pass; OS syntax checks, repository review, and full verify pass with a publish-valid stamp.

## files changed

- `.task/security/release-readiness-retry/workpad.md`
- `packages/workspace/scripts/os-release-device-auth.ts`
- `packages/os/tests/os-device-authority-release-contract.test.ts`

## workspace-owned: files changed

- `.task/security/release-readiness-retry/workpad.md`

## workspace-owned: activity log

- 2026-07-10 23:56:04 fs.write: `.task/security/release-readiness-retry/workpad.md`

## workspace-owned: validation evidence

- 2026-07-10 23:59:14 `review.run`: passed — OK
- 2026-07-11 00:00:12 `review.run`: passed — OK
- 2026-07-11 00:01:02 `verify`: passed — OK
- 2026-07-11 00:01:38 `verify`: passed — OK

## key decisions

- Treat the CI failure as eventual-consistency handling, not a Cloudflare permission or runtime-secret problem.
- Reuse the install release verifier's bounded retry model rather than adding a workflow sleep.
- Keep the independent Pages authentication error outside this code task; it requires replacing `CLOUDFLARE_PAGES_API_TOKEN`.

## notes for ko

- GitHub OS credentials are proven valid: the workflow deployed both Workers, uploaded R2 objects, and updated the zone route.
- No credential values were read or recorded.

## improvements noticed

- Add a typed GitHub Actions run/log operation; the current typed wrapper omits long failure tails.

## issues and recovery

- The typed GitHub log packet omitted the failure tail and the browser profile was not signed in, so a bounded local GitHub log parser was used to extract only matching failure context.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-10 23:56:04 write: `.task/security/release-readiness-retry/workpad.md`

- 2026-07-10 23:56:21 apply-patch: `packages/os/tests/os-device-authority-release-contract.test.ts`
- 2026-07-10 23:57:07 apply-patch: `packages/workspace/scripts/os-release-device-auth.ts`
- 2026-07-10 23:57:28 apply-patch: `packages/workspace/scripts/os-release-device-auth.ts`

- 2026-07-10 23:59:34 apply-patch: `packages/workspace/scripts/os-release-device-auth.ts`

## workspace-owned: files read

- none yet

- 2026-07-11 00:00:47 apply-patch: `.task/security/release-readiness-retry/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/release-readiness-retry/current.json`, `.task/security/release-readiness-retry/evidence-log.json`, `.task/security/release-readiness-retry/read-log.json`, `.task/security/release-readiness-retry/session.json`, `.task/security/release-readiness-retry/verify.json`, `.task/security/release-readiness-retry/workpad.md`, `.task/tasks/security/release-readiness-retry.json`, `packages/os/tests/os-device-authority-release-contract.test.ts`, `packages/workspace/scripts/os-release-device-auth.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
