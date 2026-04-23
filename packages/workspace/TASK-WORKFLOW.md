# task:publish — push, promote, and clean up

when your task work is done, publish it. this is a 3-step process that pushes code to the remote, promotes it through the stream to main, and cleans up the worktree.

```
task:push → task:pr → task:finish
```

every step requires `.task-meta.json` in the worktree (created by `task:start`). if it's missing, the scripts reject with a clear error telling you to start over with `task:start`.

run all three from inside the task worktree.

---

## step 1: `task:push` — push code to the remote task branch

pushes changed files via github api. no local `git push`. validates everything before writing.

```bash
bun run task:push -- --message "fix(dialer): decouple queue session start" --changed
```

- reads `.task-meta.json` for branch context
- rejects if not in a `task/*` worktree
- validates conventional commit message format
- `--changed` pushes all tracked changes (including deletions)
- can also use `--files <paths>` or `--files-json <json>` for explicit files
- can be called multiple times before step 2

---

## step 2: `task:pr` — promote task→stream, create stream→main review PR

merges the task into the stream and creates the review PR in one command.

```bash
bun run task:pr
```

what happens:
1. ensures `task/<area>/<slug> → stream/<area>` PR exists
2. merges it automatically
3. creates or reuses `stream/<area> → main` review PR (title defaults to `Stream/<area>`)

the PR ko reviews is always `stream/<area> → main`.

optional flags:
- `--title "custom title"` to override the review PR title
- `--ready` to mark the review PR as ready (not draft)
- `--task-only` to stop after creating the task→stream PR without merging

---

## step 3: `task:finish` — verify merge and clean up

confirms the task branch was merged into the stream, removes the worktree, and deletes the local branch.

```bash
bun run task:finish
```

- verifies task branch is merged into the stream
- removes the worktree directory
- deletes the local branch
- fails if the branch hasn't been merged yet

---

## full example

```bash
# from inside the task worktree:
bun run task:push -- --message "fix(dialer): tune queue scoring" --changed
bun run task:pr
bun run task:finish
```

that's it. three commands, task is published, worktree is gone.
