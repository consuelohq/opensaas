# Fix Cloudflare Worker deployment route permission; add worker-only recovery release

branch: `task/release/fix-cloudflare-worker-deployment-route-permission-add-worker-only-recovery-release`
stream: `stream/release`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2793/fix-cloudflare-worker-deployment-route-permission-add-worker-only-recovery-release
github pr: https://github.com/consuelohq/opensaas/pull/2793
started: 2026-11-07

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `.github/workflows/consuelo-production-release.yaml`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-07 06:40:49 fs.write: `.task/release/fix-cloudflare-worker-deployment-route-permission-add-worker-only-recovery-release/workpad.md`
- 2026-11-07 06:41:01 fs.write: `.task/release/fix-cloudflare-worker-deployment-route-permission-add-worker-only-recovery-release/workpad.md`

## workspace-owned: validation evidence

- 2026-11-07 06:40:01 `review.run`: passed — OK
- 2026-11-07 06:40:53 `review.run`: passed — OK
- 2026-11-07 06:41:14 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(release): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-11-07 06:39:17 apply-patch: `.github/workflows/consuelo-production-release.yaml`

## 2026-11-07 Cloudflare route-permission recovery
Release run 42347462898 at exact merged main 8a3915f9 succeeded in Railway deploy, Railway await, safe smoke; `wrangler deploy` uploaded new Worker 60559f8d-fcb8-4dc5-b27a-87dab6403b18 then returned 403 `No access to specified resource` on Cloudflare zone Workers Routes API. Worker deployments read-only shows version at 100% traffic; public edge verify `/`, `/admin`, `/overlay`, `/health` successful and stable Marketplace JS/CSS SHA matched. GitHub log shows exact source compiled asset `chunks/internal-main-xajrjk01.js` uploaded. No need to broaden Cloudflare permissions.

Fix only `.github/workflows/consuelo-production-release.yaml`: full dialer production job now uses pinned Wrangler `versions upload` + `versions deploy` with `--keep-vars`, immutable GitHub SHA tag and message, avoiding route reconciliation. Capture step checks deployed version 100% and source SHA in annotation with typed artifact. Added `dialer_worker_only` opt-in boolean for manual `target=dialer`, fail-closed if target differs, and maps to existing Cloudflare-only job so no Railway restart. Existing 6 release contract tests pass, YAML schema parsed, dynamic bash classifier checks for worker-only, full release and invalid combination pass, isolated Git fixture confirms a workflow-only push releases **no** dialer or public/OS surface; strict review 0 new issues. Next formal verify, exact-head CI, merge workflow-only PR to main, then manual Worker-only dispatch from exact new main and verify edge/bytes; no live calls, credentials, numbers, billing or unrelated agent changes.

- 2026-11-07 06:40:49 append: `.task/release/fix-cloudflare-worker-deployment-route-permission-add-worker-only-recovery-release/workpad.md`

Wait reason: managed formal verification of workflow-only route-permission fix is running. Duration: 12s. Resume action: `verify` on taskSession tsk_5e8df71cd03a base origin/main, inspect publishValid and failed suites. Expected: publishValid true with no blockers. Fallback: inspect verification failure and repair only attributable workflow logic before task.push; do not deploy or merge prematurely.

- 2026-11-07 06:41:01 append: `.task/release/fix-cloudflare-worker-deployment-route-permission-add-worker-only-recovery-release/workpad.md`
