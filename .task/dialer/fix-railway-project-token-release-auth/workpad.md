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

- none yet

## workspace-owned: activity log

- 2026-09-21 12:12:00 fs.write: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`
- 2026-09-21 12:12:48 fs.write: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`
- 2026-09-21 12:13:20 fs.write: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`

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

## Publish gate

- strict review against origin/main: 0 findings / 0 blockers.
- canonical verify against origin/main: passed=true, publishValid=true, DB guard clean.
- changed production files: `.github/workflows/consuelo-production-release.yaml` + focused release contract.
- intended PR base is `main` because this task started from the already-merged migration head; the legacy `stream/dialer` branch is hundreds of commits behind and must not be used as the merge base.

- 2026-09-21 12:13:20 append: `.task/dialer/fix-railway-project-token-release-auth/workpad.md`
