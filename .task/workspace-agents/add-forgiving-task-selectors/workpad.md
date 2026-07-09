# add forgiving task selectors

branch: `task/workspace-agents/add-forgiving-task-selectors`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/854/add-forgiving-task-selectors
github pr: https://github.com/consuelohq/opensaas/pull/854
started: 2026-06-08

## acceptance criteria

- [x] Add a shared PR reference parser for GitHub, Consuelo diffs, Graphite, numbers, `#N`, and `PR #N`.
- [x] Reject ambiguous free text and non-PR URLs instead of stripping arbitrary digits.
- [x] Wire forgiving `--pr` / `--github` selectors through task tooling.
- [x] Teach `task:start` to infer/adopt from PR metadata when given a PR URL.
- [x] Update workspace facade schemas so OS/workspace tools accept string/URL PR refs.
- [x] Update OS docs and manifests.
- [x] Add focused tests and run validation.

## plan

1. Read task tooling, facade schemas, and OS docs/manifests.
2. Add `packages/workspace/scripts/lib/pr-ref.js` and parser tests.
3. Wire parser into CLI task selectors and PR-number parsers.
4. Add facade branch resolution by PR number and schema support for `github` URL refs.
5. Update OS docs/manifests.
6. Validate and publish.

## current status

- Implementation complete.
- Review passed with 0 issues from this change.
- Verify passed and wrote publish-valid stamp.

## files changed

- `packages/workspace/scripts/lib/pr-ref.js`
- `packages/workspace/scripts/lib/task-selection.js`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/scripts/task-fs.js`
- `packages/workspace/scripts/task-exec.js`
- `packages/workspace/scripts/task-finish.js`
- `packages/workspace/scripts/task-init.js`
- `packages/workspace/scripts/task-merge.js`
- `packages/workspace/scripts/task-pr.js`
- `packages/workspace/scripts/task-prs.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/scripts/lib/facade/branch-resolver.ts`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/manifests/core.manifest.json`
- `packages/os/SCRIPTS.md`
- `packages/os/TOOLS.md`
- `packages/workspace/tests/pr-ref.test.js`
- `packages/workspace/tests/task-selector-pr-ref.test.js`

## workspace-owned: files changed

- `.task/tasks/workspace-agents/add-forgiving-task-selectors.json`
- `.task/workspace-agents/add-forgiving-task-selectors/current.json`
- `.task/workspace-agents/add-forgiving-task-selectors/session.json`
- `.task/workspace-agents/add-forgiving-task-selectors/workpad.md`
- `.task/workspace-agents/add-forgiving-task-selectors/verify.json`

## workspace-owned: activity log

- Read task CLI scripts, facade schema/executor, branch resolver, GitHub helpers, and OS SCRIPTS/TOOLS/manifest references.
- Added shared parser and wired CLI/facade/docs/manifests.
- Ran focused parser and task selector tests.
- Ran syntax checks for JS task scripts.
- Ran audit, review, and verify.

## workspace-owned: validation evidence

- `bun test packages/workspace/tests/pr-ref.test.js packages/workspace/tests/task-selector-pr-ref.test.js` -> 6 pass / 0 fail / 16 assertions.
- `bun packages/workspace/scripts/check-files.js --branch task/workspace-agents/add-forgiving-task-selectors --files ... --json` -> ok true for changed JS task scripts.
- `bun run audit -- --scripts --json` -> documented_count 59, actual_count 59, missing [], undocumented [], passed true.
- `git diff --check` -> passed.
- `review.run against origin/stream/workspace-agents` -> 0 issues from this change; 1 pre-existing task-merge error-handling finding.
- `verify against origin/stream/workspace-agents` -> publishValid true.

## key decisions

- Use one shared parser in `lib/pr-ref.js` rather than ad-hoc regexes in each task script.
- `--github` is an alias for explicit URL/text PR refs; `--pr` remains backwards compatible and becomes smarter.
- For recognized URLs, only accept PR numbers in trusted path positions: GitHub/diffs `/pull/<number>` and Graphite `/github/pr/<owner>/<repo>/<number>`.
- Wrong repo, issue URLs, commit URLs, compare URLs, actions URLs, and ambiguous free text are rejected.
- Facade branch-mode task tools resolve `pr`/`github` to a task branch before command planning.
- `task:start --github <task-pr>` adopts the task branch; `task:start --github <stream-pr>` starts a new task from that stream.

## notes for ko

- This gives the "we know what you mean" behavior without stripping arbitrary digits.
- Example: `bun run task:fs -- --github "https://diffs.consuelohq.com/consuelohq/opensaas/pull/780" read .task/current.json`.
- Example: `bun run task:start -- --github "https://app.graphite.com/github/pr/consuelohq/opensaas/686/some-slug"`.

## improvements noticed

- Some direct task script help still focuses on numeric examples; this task updated the critical visible help paths and OS docs, but future cleanup can make every example URL-based.

## issues and recovery

- Full facade suite has an unrelated tools.search timeout in one broad test. Verify selected the facade input-contract subset and passed.
- `docs:check-os-skill-docs` command was blocked by the wrapper, so OS docs/manifests were validated by JSON parse, targeted grep, audit, review, and verify instead.

---

## publish checklist

```bash
bun run task:push -- --message "feat(workspace): accept pr urls in task selectors" --changed
bun run task:pr
bun run task:finish
```
