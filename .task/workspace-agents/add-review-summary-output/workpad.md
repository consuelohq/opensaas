# add review summary output

branch: `task/workspace-agents/add-review-summary-output`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/541/add-review-summary-output
github pr: https://github.com/consuelohq/opensaas/pull/541
started: 2026-05-23
recovered-after-restart: 2026-05-23

## acceptance criteria

- [ ] Preserve existing `review --json` full/raw array contract.
- [ ] Add `review --summary-json` for agent-oriented semantic summary output.
- [ ] Route agent-facing `review.run` and `verify --json` paths to summary payloads.
- [ ] Preserve actual review/verify checks and pass/fail semantics.
- [ ] Validate syntax, full JSON contract, summary JSON contract, verify JSON contract, audit, and verify gate.
- [ ] Push and promote task PR into the stream PR.

## implementation plan

1. Reapply approved additive contract after restart because the recreated worktree did not contain `--summary-json`.
2. Modify only review/verify/ai-review/manifest/docs plus task metadata.
3. Validate exact behavior with bounded commands.
4. Push through task workflow and promote to stream.

## notes for ko

The approved direction is additive: do not make `review --json` compact by default. Keep full raw arrays there. Add summary output separately and make agent-facing facade paths use it.

## files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/ai-review.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/tooling/tool-manifest.json`

## validation evidence

- pending

## issues and recovery

- Earlier local work was lost when the computer restarted. The remote PR survived, and `task.start` recreated the worktree for PR #541.

- 2026-05-23 21:11:59 write: `.task/workspace-agents/add-review-summary-output/workpad.md`

## workspace-owned: files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/ai-review.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/tooling/tool-manifest.json`

## workspace-owned: activity log

- 2026-05-23 21:11:59 fs.write: `.task/workspace-agents/add-review-summary-output/workpad.md`
- 2026-05-23 21:12:25 write: `packages/workspace/scripts/review.js`
- 2026-05-23 21:12:25 fs.write: `packages/workspace/scripts/review.js`
- 2026-05-23 21:12:25 write: `packages/workspace/scripts/verify.js`
- 2026-05-23 21:12:25 fs.write: `packages/workspace/scripts/verify.js`
- 2026-05-23 21:12:26 write: `packages/workspace/scripts/ai-review.js`
- 2026-05-23 21:12:26 fs.write: `packages/workspace/scripts/ai-review.js`
- 2026-05-23 21:12:26 write: `packages/workspace/tooling/tool-manifest.json`
- 2026-05-23 21:12:26 fs.write: `packages/workspace/tooling/tool-manifest.json`
- 2026-05-23 21:12:26 write: `packages/workspace/SCRIPTS.md`
- 2026-05-23 21:12:26 fs.write: `packages/workspace/SCRIPTS.md`
- 2026-05-23 21:13:49 fs.write: `.task/workspace-agents/add-review-summary-output/workpad.md`

## workspace-owned: validation evidence

- pending
- 2026-05-23 21:13:13 `audit`: passed — OK
- 2026-05-23 21:13:22 `verify`: passed — OK

## validation after restart recovery

Recovered existing PR #541 by recreating the task worktree for `task/workspace-agents/add-review-summary-output`.

Applied approved additive design:

- `review --json` stays full/raw and returns array keys: `yours`, `preExisting`, `testResults`.
- Added `review --summary-json` with schema `review.summary.v1`.
- `verify.js` runs review with `--summary-json` internally.
- `ai-review.js` reads summary review output and supports summary counts/samples.
- `review.run` manifest `jsonFlag` changed to `--summary-json`.
- Docs updated in `SCRIPTS.md`.

Validation evidence:

- `node --check packages/workspace/scripts/review.js`: passed.
- `node --check packages/workspace/scripts/verify.js`: passed.
- `node --check packages/workspace/scripts/ai-review.js`: passed.
- Manifest JSON parse: passed.
- Contract check via direct scripts:
  - `review --json --no-tests`: full/raw keys preserved; `yours`, `preExisting`, `testResults` are arrays.
  - `review --summary-json --no-tests`: schema `review.summary.v1`; full evidence command included.
  - `verify --json --no-db --no-stamp --review-arg=--no-tests`: passed and embedded review schema `review.summary.v1`.
- `audit --scripts`: passed; 52 documented / 52 actual.
- Typed `verify` against `origin/stream/workspace-agents` with `noDb`: passed; review passed; stamp written.

Caveat:

- The currently loaded typed `verify` facade still showed review stderr invoking `--json`; direct script-level validation shows the changed task script emits `review.summary.v1`. This should resolve after the workspace server reloads and uses the changed script/manifest.

Files changed:

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/ai-review.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/tooling/tool-manifest.json`

- 2026-05-23 21:13:49 append: `.task/workspace-agents/add-review-summary-output/workpad.md`
