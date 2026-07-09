# debug stream sync conflicts

branch: `task/os/debug-stream-sync-conflicts`
stream: `stream/os`
started: 2026-06-05

## acceptance criteria

- [ ] Determine why `stream.sync --area os` is producing broad conflicts instead of cleanly catching `stream/os` up to `main`.
- [ ] Verify whether root cause is stream branch divergence, stale/local worktree state, broken stream-sync logic, or a combination.
- [ ] Fix the concrete issue if it is code or local branch/worktree state and safe to fix.
- [ ] Preserve the raw-source docs work already pushed to `stream/os`.
- [ ] Record validation evidence and any remaining operational blocker.

## plan

1. Inspect branch graph for `main`, `origin/main`, `stream/os`, `origin/stream/os`, and recent stream commits.
2. Read the `stream.sync` implementation and task PR merge path to understand intended semantics.
3. Reproduce the failure in a disposable local worktree if needed.
4. Decide whether the correct fix is code, branch state, or process/tooling guardrails.
5. Apply the smallest safe fix and validate.

## Test-first contract

- Behavior under test: `stream.sync --area os` should update `stream/os` toward `main` without creating pathological add/add conflicts from stale or incorrect base assumptions; it should not leave stale worktree locks that block retries.
- Existing local test pattern: pending implementation inspection.
- Red command: pending.
- Expected red failure: pending.
- No-test waiver: not decided.

## current findings

- Ko hypothesis: stream sync may be failing because `stream/os` is behind, which could explain messy task PRs. Need verify rather than assume.
- Earlier observed `stream.sync --area os` conflict list was broad: root `package.json`, `packages/os/*`, docs nav, workspace files, server/shared files.
- Earlier `task.ensureSynced` reported `stream/os` behind by 383.
- Raw-source docs commit is already on `stream/os` at `3c79462c1b5d5f0947511fd6574f7ac2e4c11a86`.

## files changed

- `.task/os/debug-stream-sync-conflicts/workpad.md`
- `packages/workspace/scripts/stream-sync.js`

## validation evidence

- none yet

## issues / blockers

- `stream.context` call was blocked by safety guardrail in this chat; using task session and direct repo inspection instead.

- 2026-06-05 03:53:19 write: `.task/os/debug-stream-sync-conflicts/workpad.md`

## workspace-owned: files changed

- `.task/os/debug-stream-sync-conflicts/workpad.md`
- `packages/workspace/scripts/stream-sync.js`

## workspace-owned: activity log

- 2026-06-05 03:53:19 fs.write: `.task/os/debug-stream-sync-conflicts/workpad.md`
- 2026-06-05 03:59:05 fs.patch: `packages/workspace/scripts/stream-sync.js`
- 2026-06-05 03:59:21 fs.patch: `packages/workspace/scripts/stream-sync.js`
- 2026-06-05 03:59:40 fs.patch: `packages/workspace/scripts/stream-sync.js`

## workspace-owned: files read

- `packages/workspace/TOOLS.md`
- `packages/workspace/package.json`
- `packages/workspace/scripts/lib/git.js`
- `packages/workspace/scripts/stream-context.js`
- `packages/workspace/scripts/stream-sync.js`
- `packages/workspace/scripts/task-pr.js`
- `packages/workspace/scripts/task-start.js`

## workspace-owned: TDD post evidence

  - output: ree status=%s\\n' \"\$status\" printf 'stdout first 160 lines:\\n'; sed -n '1,160p' /tmp/stream-os-merge-tree.txt printf '\\nstderr first 80 lines:\\n'; sed -n '1,80p' /tmp/stream-os-merge-tree.err " → tmux: opensaas-os-debug-stream-sync-conflicts-9c0d1dbc git merge-tree --write-tree origin/stream/os origin/main > /tmp/stream-os-merge-tree.txt 2>/tmp/stream-os-merge-tree.err status=$? set -e printf 'merge-tree status=%s\n' "$status" printf 'stdout first 160 lines:\n'; sed -n '1,160p' /tmp/stream-os-merge-tree.txt printf '\nstderr first 80 lines:\n'; sed -n '1,80p' /tmp/stream-os-merge-tree.err
- 2026-06-05 03:56:43 `bash -lc set -e
printf 'git cherry counts (+ unique, - patch-equivalent):\n'
git cherry origin/main origin/stream/os | awk '{count[$1]++} END {for (k in count) print k, count[k]}' | sort
printf '\nfirst 80 cherry results:\n'
git cherry -v origin/main origin/stream/os | sed -n '1,80p'
printf '\nmerge-base commit:\n'; git show --no-patch --oneline $(git merge-base origin/main origin/stream/os)
`: passed exit 0 trace: `trc_ab262ff5ee96`
  - output: -v origin/main origin/stream/os | sed -n '1,80p' printf '\\nmerge-base commit:\\n'; git show --no-patch --oneline \$(git merge-base origin/main origin/stream/os) " → tmux: opensaas-os-debug-stream-sync-conflicts-9c0d1dbc printf 'git cherry counts (+ unique, - patch-equivalent):\n' git cherry origin/main origin/stream/os | awk '{count[$1]++} END {for (k in count) print k, count[k]}' | sort printf '\nfirst 80 cherry results:\n' git cherry -v origin/main origin/stream/os | sed -n '1,80p' printf '\nmerge-base commit:\n'; git show --no-patch --oneline $(git merge-base origin/main origin/stream/os)
- 2026-06-05 04:00:46 `bash -lc cat >> .task/os/debug-stream-sync-conflicts/workpad.md <<'MD'

## conclusion / root cause

- Ko's hypothesis is partly right, but the precise issue is not simply that local `stream/os` was behind.
- `stream.sync` semantics are: reset local `stream/<area>` to `origin/stream/<area>`, then run `git merge --no-ff origin/main`, then verify and push.
- Current remote branch state is real divergence, not only stale local state:
  - `origin/main`: `541efeddb56e516b69ca7fd152eb1aff7c023d5c`
  - `origin/stream/os`: `3c79462c1b5d5f0947511fd6574f7ac2e4c11a86`
  - merge-base: `572b3415c08f172fa59269cb367b59cb65d19c96`
  - `git rev-list --left-right --count origin/main...origin/stream/os`: `70 103`
  - files changed since merge-base: main `1115`, stream `431`
  - `git cherry origin/main origin/stream/os`: `46` stream commits are not patch-equivalent to main; `29` are patch-equivalent.
- That explains the broad conflicts: `stream/os` contains independent/additive OS and docs history while main contains related OS/docs history through separate merged stream PRs. A normal merge sees add/add and content conflicts; `stream.sync` cannot automatically infer semantic equivalence.
- There was also a concrete local/tooling bug: `stream.sync` called `git branch -f stream/<area> origin/stream/<area>` before pruning worktrees or checking whether that branch was checked out in an existing worktree. That causes the repeated local failure: `cannot force update the branch ... used by worktree`.

## fix applied

- Updated `packages/workspace/scripts/stream-sync.js` to:
  - call `pruneWorktrees(repoRoot)` before branch/worktree resolution;
  - inspect `getWorktreeForBranch(repoRoot, streamBranch)` before branch reset;
  - only force-reset the local stream branch when there is no existing worktree using it;
  - continue to hard-reset the selected worktree to `origin/<stream>` before merging `origin/main`.

## validation evidence

- Red synthetic repro: before the fix, `stream.sync` failed with `cannot force update the branch 'stream/test' used by worktree` (`trc_bf812ef7596f`).
- Green synthetic repro: after the fix, the same setup succeeded using the existing stream worktree, passed dummy verify, and pushed (`trc_ef9e5fc066be`).
- Syntax and whitespace:
  - `node --check packages/workspace/scripts/stream-sync.js` passed.
  - `git diff --check` passed.
- Branch divergence investigation:
  - branch graph/count evidence captured in `trc_4af08f3def2e` and `trc_ab262ff5ee96`.
  - merge-tree evidence confirms real add/add and content conflicts (`trc_fd4fbdd256e3`).

## remaining blocker

- The real `stream/os` conflict with `main` is still not safe to auto-resolve in `stream.sync` code. It needs an explicit stream history decision: either manually merge/resolve once, rebuild/reset `stream/os` from `main` and replay only intended stream deltas, or change task workflow so agents start from `stream` while `stream/os` remains divergent.
- The immediate safe tooling fix is complete; the larger branch-history repair is a separate operational decision because resetting or rewriting `stream/os` could drop stream-only work.
MD

git status --short`: passed exit 0 trace: `trc_a8545f634b96`
  - output: d local failure: `cannot force update the branch ... used by worktree`. ## fix applied - Updated `packages/workspace/scripts/stream-sync.js` to: - call `pruneWorktrees(repoRoot)` before branch/worktree resolution; - inspect `getWorktreeForBranch(repoRoot, streamBranch)` before branch reset; - only force-reset the local stream branch when there is no existing worktree using it; - continue to hard-reset the selected worktree to `origin/<stream>` before merging `origin/main`. ## validation evidence - Red synthetic repro: before the fix, `stream.sync` failed w... [truncated 1165 chars]

## workspace-owned: TDD red evidence

- 2026-06-05 03:57:57 `bash -lc set -e
script="$PWD/packages/workspace/scripts/stream-sync.js"
tmp=$(mktemp -d /tmp/stream-sync-red.XXXXXX)
origin="$tmp/origin.git"
repo="$tmp/repo"
git init --bare "$origin" >/dev/null
git init "$repo" >/dev/null
cd "$repo"
git config user.email test@example.com
git config user.name 'Test User'
cat > package.json <<'JSON'
{"scripts":{"verify":"node -e \"console.log('{\\\"ok\\\":true}')\""}}
JSON
echo base > README.md
git add README.md package.json
git commit -m init >/dev/null
git branch -M main
git remote add origin "$origin"
git push -u origin main >/dev/null 2>&1
git checkout -b stream/test >/dev/null
git push -u origin stream/test >/dev/null 2>&1
git checkout main >/dev/null
git worktree add "$tmp/stream-wt" stream/test >/dev/null 2>&1
set +e
bun "$script" --area test --stream stream/test --json > "$tmp/out.json" 2> "$tmp/err.txt"
status=$?
set -e
printf 'status=%s\n' "$status"
printf 'stderr:\n'; cat "$tmp/err.txt"
printf 'stdout:\n'; cat "$tmp/out.json"
if ! grep -q 'cannot force update the branch' "$tmp/err.txt"; then
  echo 'expected branch force-update failure did not occur'
  exit 1
fi
`: passed exit 0 trace: `trc_bf812ef7596f`
  - output: heckout -b stream/test >/dev/null git push -u origin stream/test >/dev/null 2>&1 git checkout main >/dev/null git worktree add "$tmp/stream-wt" stream/test >/dev/null 2>&1 set +e bun "$script" --area test --stream stream/test --json > "$tmp/out.json" 2> "$tmp/err.txt" status=$? set -e printf 'status=%s\n' "$status" printf 'stderr:\n'; cat "$tmp/err.txt" printf 'stdout:\n'; cat "$tmp/out.json" if ! grep -q 'cannot force update the branch' "$tmp/err.txt"; then echo 'expected branch force-update failure did not occur' exit 1 fi Switched to a new branch 'stream/test' Switched to branch 'main'

- 2026-06-05 03:59:05 patch lines 6-17: `packages/workspace/scripts/stream-sync.js`

- 2026-06-05 03:59:21 patch lines 222-239: `packages/workspace/scripts/stream-sync.js`

- 2026-06-05 03:59:40 patch lines 222-237: `packages/workspace/scripts/stream-sync.js`

## workspace-owned: TDD green evidence

git push -u origin stream/test >/dev/null 2>&1
git checkout main >/dev/null
git worktree add "$tmp/stream-wt" stream/test >/dev/null 2>&1
bun "$script" --area test --stream stream/test --json > "$tmp/out.json" 2> "$tmp/err.txt"
cat "$tmp/err.txt"
cat "$tmp/out.json"
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('$tmp/out.json','utf8')); if (data.status !== 'success') { throw new Error('expected success'); } if (data.temporaryWorktree !== false) { throw new Error('expected existing worktree'); } if (data.pushed !== true) { throw new Error('expected pushed true'); }"
`: passed exit 0 trace: `trc_ef9e5fc066be`
  - output: in >/dev/null git worktree add "$tmp/stream-wt" stream/test >/dev/null 2>&1 bun "$script" --area test --stream stream/test --json > "$tmp/out.json" 2> "$tmp/err.txt" cat "$tmp/err.txt" cat "$tmp/out.json" node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('$tmp/out.json','utf8')); if (data.status !== 'success') { throw new Error('expected success'); } if (data.temporaryWorktree !== false) { throw new Error('expected existing worktree'); } if (data.pushed !== true) { throw new Error('expected pushed true'); }" Switched to a new branch 'stream/test' Switched to branch 'main'
- 2026-06-05 04:00:16 `bash -lc node --check packages/workspace/scripts/stream-sync.js
git diff --check
git diff -- packages/workspace/scripts/stream-sync.js`: passed exit 0 trace: `trc_63fb18bbc499`
  - output: git diff --check git diff -- packages/workspace/scripts/stream-sync.js" → tmux: opensaas-os-debug-stream-sync-conflicts-9c0d1dbc git diff --check git diff -- packages/workspace/scripts/stream-sync.js

## conclusion / root cause

- Ko's hypothesis is partly right, but the precise issue is not simply that local `stream/os` was behind.
- `stream.sync` semantics are: reset local `stream/<area>` to `origin/stream/<area>`, then run `git merge --no-ff origin/main`, then verify and push.
- Current remote branch state is real divergence, not only stale local state:
  - `origin/main`: `541efeddb56e516b69ca7fd152eb1aff7c023d5c`
  - `origin/stream/os`: `3c79462c1b5d5f0947511fd6574f7ac2e4c11a86`
  - merge-base: `572b3415c08f172fa59269cb367b59cb65d19c96`
  - `git rev-list --left-right --count origin/main...origin/stream/os`: `70 103`
  - files changed since merge-base: main `1115`, stream `431`
  - `git cherry origin/main origin/stream/os`: `46` stream commits are not patch-equivalent to main; `29` are patch-equivalent.
- That explains the broad conflicts: `stream/os` contains independent/additive OS and docs history while main contains related OS/docs history through separate merged stream PRs. A normal merge sees add/add and content conflicts; `stream.sync` cannot automatically infer semantic equivalence.
- There was also a concrete local/tooling bug: `stream.sync` called `git branch -f stream/<area> origin/stream/<area>` before pruning worktrees or checking whether that branch was checked out in an existing worktree. That causes the repeated local failure: `cannot force update the branch ... used by worktree`.

## fix applied

- Updated `packages/workspace/scripts/stream-sync.js` to:
  - call `pruneWorktrees(repoRoot)` before branch/worktree resolution;
  - inspect `getWorktreeForBranch(repoRoot, streamBranch)` before branch reset;
  - only force-reset the local stream branch when there is no existing worktree using it;
  - continue to hard-reset the selected worktree to `origin/<stream>` before merging `origin/main`.

## validation evidence

- Red synthetic repro: before the fix, `stream.sync` failed with `cannot force update the branch 'stream/test' used by worktree` (`trc_bf812ef7596f`).
- Green synthetic repro: after the fix, the same setup succeeded using the existing stream worktree, passed dummy verify, and pushed (`trc_ef9e5fc066be`).
- Syntax and whitespace:
  - `node --check packages/workspace/scripts/stream-sync.js` passed.
  - `git diff --check` passed.
- Branch divergence investigation:
  - branch graph/count evidence captured in `trc_4af08f3def2e` and `trc_ab262ff5ee96`.
  - merge-tree evidence confirms real add/add and content conflicts (`trc_fd4fbdd256e3`).

## remaining blocker

- The real `stream/os` conflict with `main` is still not safe to auto-resolve in `stream.sync` code. It needs an explicit stream history decision: either manually merge/resolve once, rebuild/reset `stream/os` from `main` and replay only intended stream deltas, or change task workflow so agents start from `stream` while `stream/os` remains divergent.
- The immediate safe tooling fix is complete; the larger branch-history repair is a separate operational decision because resetting or rewriting `stream/os` could drop stream-only work.

## workspace-owned: validation evidence

- 2026-06-05 04:01:13 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/debug-stream-sync-conflicts/current.json`, `.task/os/debug-stream-sync-conflicts/evidence-log.json`, `.task/os/debug-stream-sync-conflicts/read-log.json`, `.task/os/debug-stream-sync-conflicts/session.json`, `.task/os/debug-stream-sync-conflicts/workpad.md`, `.task/tasks/os/debug-stream-sync-conflicts.json`, `packages/workspace/scripts/stream-sync.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
