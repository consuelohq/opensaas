# fix Railway project token release auth

branch: `task/dialer/fix-railway-project-token-release-auth`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2512
started: 2026-09-21

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `.github/workflows/consuelo-production-release.yaml`
- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`

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
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
- The dialer production release must authenticate with a Railway project token using only project-scoped deployment operations.
- CI must not call `railway link`, because Railway 5.27.2 treats linking as an account/workspace operation while project tokens are documented for project-level actions such as `railway up`.
- A project token scoped to the configured production environment must still support deployment listing, deployment upload, wait/status polling, and logs for the configured dialer service.

existing local pattern:
- `.github/workflows/consuelo-production-release.yaml` exports `RAILWAY_DIALER_PROJECT_TOKEN` as `RAILWAY_TOKEN`.
- The workflow currently runs an explicit `railway link --project ... --environment ... --service ...` before snapshot/deploy.
- `railway-deployment.ts` and the deploy/log commands already pass service/environment IDs directly.
- Live Railway CLI 5.27.2 docs state project tokens use `RAILWAY_TOKEN` for project-level actions; account/workspace tokens use `RAILWAY_API_TOKEN`.
- A disposable project token succeeded in a clean HOME for `railway deployment list --service <dialer> --environment <production>` without any linked account context.
- The same class of project token is rejected by `railway link`.

new or changed tests:
- Tighten the dialer release workflow contract so production release must not contain the `Link Railway release target` step or a `railway link` invocation.
- Preserve assertions that snapshot/deploy/wait/log commands receive explicit service/environment/project identifiers as applicable.

focused red command:
- `bun test packages/lead-connector/src/deployment/release-workflow.contract.test.ts`

expected red failure:
- Current workflow still contains `Link Railway release target` and `bunx @railway/cli@5.27.2 link`.

no-test waiver: not applicable.

runtime evidence:
- Post-migration production runs 35564741719 and 35597601967 both pass all dialer tests/build/config checks and fail only at `Link Railway release target` with Railway Unauthorized.
- Fresh project token rotation did not change that failure.

- 2026-09-21 12:12:00 append: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`

## workspace-owned: files changed

- `.github/workflows/consuelo-production-release.yaml`
- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`

## workspace-owned: activity log

- 2026-09-21 12:12:00 fs.write: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`
- 2026-09-21 12:12:48 fs.write: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`
- 2026-09-21 12:13:20 fs.write: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`
- 2026-09-21 12:14:48 fs.write: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`
- 2026-09-21 12:15:27 fs.write: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`
- 2026-09-21 12:15:52 fs.write: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`
- 2026-09-21 12:16:30 fs.write: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`
- 2026-09-21 12:17:19 fs.write: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`
- 2026-09-21 12:18:17 fs.write: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`
- 2026-09-21 12:19:11 fs.write: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`
- 2026-09-21 12:20:05 fs.write: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`
- 2026-09-21 12:22:00 fs.write: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`

## workspace-owned: files read

- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`

- 2026-09-21 12:12:15 apply-patch: `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- 2026-09-21 12:12:29 apply-patch: `.github/workflows/consuelo-production-release.yaml`
## RED / GREEN evidence

- RED: release workflow contract failed 3 pass / 1 fail because `Link Railway release target` was still present.
- Live Railway 5.27.2 docs: project token uses `RAILWAY_TOKEN` for project-level actions; account/workspace token uses `RAILWAY_API_TOKEN`.
- Disposable production-scoped project token in a completely clean HOME successfully ran:
  `railway deployment list --service f97bc786-ba06-44e7-a854-3294ac857c06 --environment 6de4fa99-b047-4587-b003-69f78b650aa1 --limit 1 --json`.
- Same token class is rejected by `railway link`, matching the two production failures.
- Implementation: removed only the `Link Railway release target` step.
- GREEN: dialer release workflow contract 4/4.
- GREEN: GitHub workflow policy 8/8.
- `git diff --check`: clean.

Next: strict review + canonical verify against main, then publish PR directly to main and rerun dialer-only production release.

- 2026-09-21 12:12:48 append: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`

## workspace-owned: validation evidence

- 2026-09-21 12:13:00 `review.run`: passed — OK
- 2026-09-21 12:13:09 `verify`: passed — OK
- 2026-09-21 12:22:10 `review.run`: passed — OK
- 2026-09-21 12:22:15 `verify`: passed — OK

## Publish gate

- strict review against origin/main: 0 findings / 0 blockers.
- canonical verify against origin/main: passed=true, publishValid=true, DB guard clean.
- changed production files: `.github/workflows/consuelo-production-release.yaml` + focused release contract.
- intended PR base is `main` because this task started from the already-merged migration head; the legacy `stream/dialer` branch is hundreds of commits behind and must not be used as the merge base.

- 2026-09-21 12:13:20 append: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`

## Wait plan — PR CI attachment

start time UTC: 2026-09-21T12:14:36Z
Wait reason: allow GitHub pull_request/base-retarget webhooks to attach the normal CI matrix to PR #2512 at head 6af2f465abd7292ef347ba74694c24ae632aa718.
Duration: 20s.
Resume action: run `gh pr checks 2512 --repo consuelohq/opensaas --json name,state,link,bucket`.
Expected signal: Consuelo CI and/or platform checks appear in addition to CodeRabbit.
Fallback: if still absent, explicitly dispatch the repository Consuelo CI workflow on the exact task branch with base=origin/main, then verify that run before merge.

- 2026-09-21 12:14:48 append: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`

wait observed result: after 20s, PR #2512 still had only CodeRabbit; no GitHub Actions matrix attached.
next decision: use fallback and explicitly dispatch Consuelo CI on task/dialer/fix-railway-project-token-release-auth with base=origin/main. Merge remains blocked until that exact-head run passes.

- 2026-09-21 12:15:27 append: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`

## Wait plan — authoritative Consuelo CI

start time UTC: 2026-09-21T12:15:46Z
Wait reason: Consuelo CI run 35598517189 is queued on exact hotfix head 6af2f465abd7292ef347ba74694c24ae632aa718.
Duration: 20s.
Resume action: inspect run 35598517189 job status immediately.
Expected signal: changed-files classification completes and substantive lanes fan out or the run completes successfully.
Fallback: if still queued, continue bounded 20s polling; if any lane fails, inspect only that failed step before further mutation.

- 2026-09-21 12:15:52 append: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`

wait observed result: run 35598517189 advanced from queued to in_progress on Consuelo / changed files; no failure.
next decision: continue one 20s bounded poll.
start time UTC: 2026-09-21T12:16:22Z
Wait reason: allow changed-files classification to complete and selected lanes to fan out.
Duration: 20s.
Resume action: inspect run 35598517189 job status immediately.
Expected signal: classification success plus dialer/workflow-security/verify lanes selected as appropriate.
Fallback: inspect any failed lane immediately; otherwise continue bounded polling.

- 2026-09-21 12:16:30 append: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`

wait observed result: classification passed; Sites/Cloudflare and OS contracts passed; verify, dialer, and workflow security fanned out and are running. No failure.
next decision: continue one 30s bounded poll because the remaining jobs are in normal checkout/setup stages.
start time UTC: 2026-09-21T12:17:11Z
Wait reason: allow verify/dialer/workflow-security jobs to progress through checkout and substantive tests.
Duration: 30s.
Resume action: inspect run 35598517189 job status immediately.
Expected signal: workflow-security completes and verify/dialer advance or complete.
Fallback: inspect any failed lane immediately; otherwise continue bounded polling without duplicate runs.

- 2026-09-21 12:17:19 append: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`

wait observed result: verify and workflow security completed successfully; dialer passed tests, typechecks, and release artifact builds and is now in Build Railway dialer container.
next decision: continue one 30s bounded poll for the final dialer container gate.
start time UTC: 2026-09-21T12:18:10Z
Wait reason: allow the final Railway dialer container build to finish.
Duration: 30s.
Resume action: inspect run 35598517189 immediately.
Expected signal: Consuelo / dialer completes successfully and the overall run concludes success.
Fallback: if dialer fails, inspect only its failed step/log before any merge.

- 2026-09-21 12:18:17 append: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`

wait observed result: all lanes except dialer are green; dialer remains solely in Build Railway dialer container with all prior dialer stages green.
next decision: continue one 30s bounded poll; container builds are the known longest stage.
start time UTC: 2026-09-21T12:19:04Z
Wait reason: allow final Railway container build to complete.
Duration: 30s.
Resume action: inspect run 35598517189 immediately.
Expected signal: dialer and overall run complete success.
Fallback: if still running, one further bounded poll; if failed, inspect failed container log only.

- 2026-09-21 12:19:11 append: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`

wait observed result: run 35598517189 completed success on exact head 6af2f465abd7292ef347ba74694c24ae632aa718. All selected jobs passed: changed files, Sites Gateway + Cloudflare, verify, dialer (including Railway container), OS contracts, workflow security.
next decision: race-check current main, merge PR #2512 if main remains an ancestor / PR remains mergeable, then rerun dialer-only production release to validate the project token through deployment.

- 2026-09-21 12:20:05 append: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`

## Main sync validation

- origin/main advanced to 3862b917640743d665ffa9fa76120e2632eea0ef while CI was running.
- Merged current origin/main cleanly into the hotfix; no release-auth conflict.
- synchronized local head: 221c6f240934b87e17b2d65942ef29437e278ae9.
- focused release workflow contract after sync: 4/4 passed.
- GitHub workflow policy after sync: 8/8 passed.
- git diff checks are clean.

Next: strict review and canonical verify against current origin/main, push synchronized head, then require fresh exact-head CI before merge.

- 2026-09-21 12:22:00 append: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`
