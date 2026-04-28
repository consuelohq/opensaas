# workspace explore decision confidence system

branch: `task/workspace-agents/workspace-explore-decision-confidence-system`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/222
started: 2026-04-27

## acceptance criteria

- [x] all 6 commands exist and run (`explore`, `decide-next`, `confidence-score`, `exploit`, `confirm`, `audit`)
- [x] `explore` works against real repo structure with tree-sitter + embeddings + graph expansion
- [x] incremental indexing works (only re-indexes changed files)
- [x] worktree overlays do not force full re-indexing
- [x] shared local persistence works at `~/.cache/workspace-index/`
- [x] both human-readable and `--json` output for all commands
- [x] `confirm` correctly piggybacks on existing verify flow
- [x] `audit --scripts` correctly compares SCRIPTS.md against package.json
- [x] SCRIPTS.md is updated with all new commands
- [x] `--help` works for all commands

## plan

1. Inspect existing workspace script patterns and package setup.
2. Add the git-aware index/search/state libraries.
3. Wire all six commands with human and json output.
4. Update package scripts and SCRIPTS.md.
5. Smoke test explore/audit and run verification.

## files changed

- `package.json`
- `packages/workspace/package.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/explore.js`
- `packages/workspace/scripts/decide-next.js`
- `packages/workspace/scripts/confidence-score.js`
- `packages/workspace/scripts/exploit.js`
- `packages/workspace/scripts/confirm.js`
- `packages/workspace/scripts/audit.js`
- `packages/workspace/scripts/lib/index/*`
- `packages/workspace/scripts/lib/search/*`
- `packages/workspace/scripts/lib/state/*`
- `packages/workspace/scripts/task-exec.js`
- `packages/workspace/scripts/task-fs.js`
- `.task/evidence-log.json`

## key decisions

- Qwen local embeddings remain the v1 embedding model. Full index completed locally.
- Evidence is the decision spine: commands write events to `.task/evidence-log.json` and mirror them into SQLite.
- `task:fs read` records `file.read` events automatically; `decide-next --mark-read <path>` is the manual fallback.

## notes for ko

- Full Qwen index completed: `69,609 / 69,609` chunks embedded, `0` missing.
- `explore -- "how does the dialer queue work?" --json` returned valid JSON with 3 `packages/dialer/` results and scores in range.
- `confirm --verify --json` passed and wrote `verify.pass`.

## improvements noticed

- Raised chunk line cap to 150 while preserving semantic chunking.
- Added SQLite `busy_timeout` after evidence write smoke exposed transient lock contention.

## errors i ran into

- Initial local embedding run had been stopped early; resumed and completed it fully.
- First `confirm --verify` found review-harness failures; fixed catch bindings, SQL template query warnings, async error-handling checks, then verify passed.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```


## clarified definition of done

- [x] Qwen local embedding index is complete: missing vectors equals 0.
- [x] explore -- "how does the dialer queue work?" --json returns valid JSON.
- [x] Explore output includes at least 3 real packages/dialer/ files.
- [x] decide-next --json returns an action based on evidence state.
- [x] confidence-score --json reports confidence plus evidence for/against and uncertainties.
- [x] exploit --json marks the state as exploiting and names target/context files.
- [x] confirm --verify --json piggybacks on existing verify.js and writes evidence events.
- [x] .task/evidence-log.json exists and is updated by commands.
- [x] Evidence is mirrored into SQLite for future ranking/learning.
- [x] Read tracking cannot be forgotten when using normal workspace scripts, or at minimum manual marking exists and is documented.
- [x] audit --scripts --json passes.
- [x] All six commands support --help and --json.
- [x] packages/workspace/SCRIPTS.md is truthful.
- [x] node --check passes for all touched JS command/lib files.
- [x] bun run verify passes or any failure is fixed before push.

- 2026-04-28 06:15:32 append: `.task/workpad.md`
