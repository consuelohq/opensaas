# 2026-09-21 fix Cloudflare deployment customer path guard

branch: `task/self-healing/2026-09-21-fix-cloudflare-deployment-customer-path-guard`
stream: `stream/self-healing`
pr: https://github.com/consuelohq/opensaas/pull/2530
started: 2026-09-22

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(self-healing): description" --changed
bun run task:pr
bun run task:finish
```

## 2026-09-21 investigation

Acceptance criteria:
- A customer Worker project stored under the canonical `~/Consuelo/...` workspace can use the Cloudflare deployment provider without the path guard mistaking the parent directory name `Consuelo` for an operator-owned Cloudflare resource.
- Explicit operator-owned Cloudflare references such as `packages/os/cloudflare/workspace-edge/...`, `consuelo-workspace-edge`, device-authority, platform Cloudflare resources, and test-token names remain rejected before Wrangler executes.
- No authentication, authorization, approval, or provider-safety boundary is weakened.

Operational evidence:
- Current-source 24h monitor report observed 77 groups / 33 monitor-marked candidates, but those labels were manually reconstructed because non-OK != bug and several groups are maintenance/caller/transient noise.
- Independent ordinary-use evidence includes Cloudflare deployment failures for the Workout project outside this scheduled workflow: `deployment.deploy/MALFORMED_OUTPUT` with target `worker:workout` and source `/Users/kokayi/Consuelo/Workout/wrangler.jsonc`, plus related Workout raw operations. Failure occurs in ~30 ms before provider execution with `cloudflare could not build deploy/raw`.
- Separate operator-owned workspace-edge attempts are expected to be rejected and are not used as evidence for relaxing the boundary.
- Installed `monitor.errors` entrypoint is stale (`Script not found "monitor:errors"`), while current `origin/main` contains the script; current repository-equivalent report was used read-only. This runtime/source drift is not the selected defect.
- `explore` historical failures were reproduced as successful on the current installed runtime and are not selected.
- Hosted normalized install/onboarding impact tooling was not exposed by current tool discovery, so no hosted-user impact is inferred.

Root-cause contract:
- `cloudflare.ts` uses one `assertCustomerValue` guard for both Cloudflare identifiers and local source paths.
- `FORBIDDEN_REFERENCE` contains the unscoped term `consuelo`, so any normal path under `/Users/.../Consuelo/...` is rejected, even when it is a customer project and contains no operator Cloudflare identifier.
- Safety intent is to reject operator-owned Cloudflare resource identifiers/paths, not every filesystem path containing the product/workspace directory name.

Plan:
1. Add a focused regression to the existing Cloudflare provider test proving `worker:workout` + `/Users/kokayi/Consuelo/Workout/wrangler.jsonc` builds the expected Wrangler argv.
2. Run that test red and record the exact failure.
3. Split generic non-empty/string validation from operator-owned Cloudflare reference validation, applying the stricter guard only where an identifier/reference is actually a Cloudflare resource or raw argv.
4. Keep the explicit operator-owned rejection tests green.
5. Run focused tests, review, verify, then publish only if gates are credible.

## Test-first contract

behavior under test: a normal customer source/config path inside the canonical `~/Consuelo` directory must be accepted while operator-owned Cloudflare resource references remain blocked
existing local pattern: `packages/os/tools/deployment-provider/cloudflare.test.ts` tests deploy argv construction and explicit operator-owned raw rejection with a fake provider process
new or changed tests: add a customer-path regression to the existing deploy test (or adjacent focused test) using `/Users/kokayi/Consuelo/Workout/wrangler.jsonc`; retain existing rejection cases as negative controls
focused red command: `bun --cwd packages/os test tools/deployment-provider/cloudflare.test.ts`
expected red failure: the new customer-path case returns `ProviderError`/`MALFORMED_OUTPUT` because the broad forbidden-reference regex matches the `Consuelo` parent directory instead of reaching the fake Wrangler process
no-test waiver: not applicable

- 2026-09-22 01:20:38 append: `.task/self-healing/2026-09-21-fix-cloudflare-deployment-customer-path-guard/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-22 01:20:38 fs.write: `.task/self-healing/2026-09-21-fix-cloudflare-deployment-customer-path-guard/workpad.md`
- 2026-09-22 01:20:52 apply-patch: `packages/os/tools/deployment-provider/cloudflare.test.ts`
- 2026-09-22 01:21:27 append: `.task/self-healing/2026-09-21-fix-cloudflare-deployment-customer-path-guard/workpad.md`
- 2026-09-22 01:21:27 fs.write: `.task/self-healing/2026-09-21-fix-cloudflare-deployment-customer-path-guard/workpad.md`
- 2026-09-22 01:21:49 apply-patch: `packages/os/tools/deployment-provider/cloudflare.test.ts`
- 2026-09-22 01:21:54 apply-patch: `packages/os/tools/deployment-provider/cloudflare.ts`
- 2026-09-22 01:22:22 fs.write: `.task/self-healing/2026-09-21-fix-cloudflare-deployment-customer-path-guard/workpad.md`
- 2026-09-22 01:24:02 fs.write: `.task/self-healing/2026-09-21-fix-cloudflare-deployment-customer-path-guard/workpad.md`
- Command: `bun --cwd packages/os test tools/deployment-provider/cloudflare.test.ts`
- Failure signal: the new `worker:workout` case rejected `/Users/kokayi/Consuelo/Workout/wrangler.jsonc` with `(FiberFailure) ProviderError: cloudflare could not build deploy` before the fake provider process ran. This matches the independent production trace family.
- Result: 14 passed / 1 failed as intended.
- Trace: `trc_b33c47e05d1a`

## workspace-owned: files read

- `packages/os/tools/deployment-provider/cloudflare.ts`

### Implementation and focused GREEN
- Root fix: operator-reference scanning now ignores only an exact `Consuelo` directory segment when it is the canonical user workspace prefix (`/Users/<user>/Consuelo/...`, `/home/<user>/Consuelo/...`, or the Windows drive equivalent). The rest of the path is still scanned by the existing forbidden-reference regex.
- This preserves rejection of operator-owned names and of operator paths nested below the workspace (for example a path that still contains `packages/os/cloudflare` or `workspace-edge`). Exact/non-path `consuelo*` identifiers remain subject to the existing guard.
- Regression covers both typed `deploy` and `raw` argv construction for the observed Workout config path; existing explicit operator-owned rejection cases remain negative controls.
- Focused GREEN command: `bun --cwd packages/os test tools/deployment-provider/cloudflare.test.ts`
- Trace: `trc_4824c1ca9c54`
- Result: 15/15 tests passed.

- 2026-09-22 01:22:22 append: `.task/self-healing/2026-09-21-fix-cloudflare-deployment-customer-path-guard/workpad.md`

- 2026-09-22 01:22:29 apply-patch: `packages/os/tools/deployment-provider/cloudflare.test.ts`

## workspace-owned: validation evidence

- 2026-09-22 01:22:48 `review.run`: passed — OK
- 2026-09-22 01:23:48 `verify`: passed — OK

## Final task state before publish

Selected real defect:
- Cloudflare customer deployment safety scanning treated the canonical local workspace directory name `Consuelo` as an operator-owned Cloudflare reference. This caused legitimate customer Worker config paths under `~/Consuelo/...` to fail before Wrangler execution in both typed deploy and raw paths.

Files changed:
- `packages/os/tools/deployment-provider/cloudflare.ts`
- `packages/os/tools/deployment-provider/cloudflare.test.ts`
- generated task metadata/workpad evidence under `.task/self-healing/2026-09-21-fix-cloudflare-deployment-customer-path-guard/`

Validation:
- RED `trc_b33c47e05d1a`: 14 pass / 1 expected failure reproducing the observed Workout path rejection.
- GREEN `trc_4824c1ca9c54`: 15/15 Cloudflare provider tests pass.
- Broader focused `trc_e5a62ee7a954`: Cloudflare 15/15 + deployment facade 7/7 pass (22/22 total).
- Safety negative control additionally proves `/Users/kokayi/Consuelo/packages/os/cloudflare/workspace-edge/wrangler.toml` remains rejected.
- `review.run` trace `trc_8ea468bdad6d`: 0 blocking issues; one non-blocking docs opportunity only.
- `verify` trace `trc_16cf830570c1`: publish-valid, review passed, DB guard 0 risks / 0 findings.
- No real Cloudflare deployment was executed because deployment/release is outside this maintenance run's authority. The provider command boundary was validated with the existing fake provider process and safety rejection controls.

Other candidate classifications:
- Historical `explore` failures: current installed read-only `explore` succeeds; no current bounded source fix selected.
- GitHub failures sampled: missing raw reasons, missing repos/checks, invalid requested fields/JQ shapes; caller/external state, not selected.
- Release failures/timeouts sampled: failed-check refusal, merge already in progress, lifecycle already active, and bounded timeouts; policy/transient state, not selected.
- `batch` failures are aggregation of failed child steps, not an independent root cause.
- Session-start samples mostly omitted required `area`, protected managed paths, nonexistent work paths, or task-worktree creation state; not selected.
- `authorization.mcp/UNKNOWN_TOKEN` is high-volume ordinary evidence but current traces only prove unrecognized bearer tokens, not that acceptance/rejection behavior is incorrect; no auth boundary change made.
- Current `monitor.errors` installed entrypoint drift remains recorded but was not changed. Maintenance-harness fixes: 0.

Publication intent:
- Promote this validated daily task only into `stream/self-healing`; never merge that stream to `main` here.
- Publish the normalized 24-hour health report plus this generated workpad to Daily Schedules after promotion.

- 2026-09-22 01:24:02 append: `.task/self-healing/2026-09-21-fix-cloudflare-deployment-customer-path-guard/workpad.md`
