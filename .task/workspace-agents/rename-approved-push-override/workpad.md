# rename approved push override

branch: `task/workspace-agents/rename-approved-push-override`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/572/rename-approved-push-override
github pr: https://github.com/consuelohq/opensaas/pull/572
taskSession: `tsk_df6ff428231f`
started: 2026-05-24

## objective

Rename the explicit task push verify-stamp exception flag to `--approved` / `approved`, while keeping `--reason` required and preserving the normal publish-valid verify stamp gate.

## plan

1. Carry over only the code/docs changes from the prior pushed commit.
2. Exclude prior task metadata.
3. Validate schema, docs, manifest, task push script, and formal verify.
4. Push, promote, ship, restart, and smoke the live facade.
5. Clean up temporary task PRs where safe.

- 2026-05-24 06:50:16 write: `.task/workspace-agents/rename-approved-push-override/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-05-24 06:50:16 fs.write: `.task/workspace-agents/rename-approved-push-override/workpad.md`
- 2026-05-24 06:51:26 fs.write: `.task/workspace-agents/rename-approved-push-override/workpad.md`

## workspace-owned: validation evidence

- 2026-05-24 06:50:41 `audit`: passed — OK
- 2026-05-24 06:51:06 `verify`: passed — OK

## validation before publish

- Static wording scan passed for task push/schema/docs/manifest files.
- `node --check packages/workspace/scripts/task-push.js`: passed.
- Manifest JSON parse: passed.
- Facade validation test subset passed.
- `audit --scripts`: passed.
- `git.diff`: inspected.
- Formal `verify` passed against `origin/main`; review and DB guard both ran and passed; publish-valid stamp written.

Ready to push and promote.

- 2026-05-24 06:51:26 append: `.task/workspace-agents/rename-approved-push-override/workpad.md`
