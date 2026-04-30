# ignore repo tmp directory

branch: `task/clean-up/ignore-repo-tmp-directory`
stream: `stream/clean-up`
pr: https://github.com/consuelohq/opensaas/pull/241
started: 2026-04-30

## acceptance criteria

- [x] Root `tmp/` directory is ignored by git.
- [x] Existing ignore rules remain intact.
- [x] Diff is reviewed and validation is run.

## plan

1. Read repo standards and current `.gitignore`.
2. Add a root-scoped `/tmp/` ignore rule near existing temp cache rules.
3. Verify the diff and run a lightweight review gate.
4. Publish the task branch for review.

## files changed

- `.gitignore`
- `.task/workpad.md`

## key decisions

- Used `/tmp/` instead of `tmp/` so only the repo-root temp directory is ignored.
- Existing tracked files under `tmp/` were left untouched because this task request was to add the ignore rule.

## notes for ko

- `git ls-files tmp` shows `tmp/linear-mutation.json` and `tmp/opensaas-embedding.md` are already tracked. The new ignore rule prevents future untracked files under root `tmp/` from showing up, but tracked files stay tracked until removed in a cleanup task.

## improvements noticed

- `.gitignore` currently has `.claude/settings.local.jsonesbuild-*` on one line, which looks like two rules collapsed together. Left unchanged because it is outside this request.

## errors i ran into

- Decision engine confidence is polluted by an existing `verify.fail` evidence event unrelated to this trivial ignore-file change. I treated `.gitignore` as the direct evidence-backed target after reading it.

---

## publish checklist

```bash
bun run task:push -- --message "chore(clean-up): ignore repo tmp directory" --changed
bun run task:pr
bun run task:finish
```

- 2026-04-30 20:15:04 write: `.task/workpad.md`
- 2026-04-30 20:15:35 verified ignore behavior: `git check-ignore -v --no-index tmp/new-temp-file` matched `.gitignore:81:/tmp/`.
- 2026-04-30 20:16:11 ran `workspace review.run { base: stream/clean-up, noTests: true }`; wrapper returned OK, with existing stream typecheck failures in `twenty-server` unrelated to `.gitignore`.
- 2026-04-30 20:16:40 patch lines 53-53: `.task/workpad.md`
- 2026-04-30 20:18 task push via facade failed because stale verify stamp referenced `task/dialer/fix-railway-docker-chown-build-timeout`; refreshed verify stamp inside this task worktree.
- 2026-04-30 20:21 ran task-context `bun run verify -- --base stream/clean-up --no-review --no-db --json`; branch stamp now matches `task/clean-up/ignore-repo-tmp-directory`.
- 2026-04-30 20:22 task push via facade explicit files failed with `file is outside the repository root: .gitignore`; using task-context publish command keeps paths relative to this worktree.
- 2026-04-30 20:23:34 patch lines 56-56: `.task/workpad.md`
