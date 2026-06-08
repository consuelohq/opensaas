# document-agent-tdd-contract-stream

branch: `task/os/document-agent-tdd-contract-stream`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/841/document-agent-tdd-contract-stream
github pr: https://github.com/consuelohq/opensaas/pull/843
started: 2026-06-07

## acceptance criteria

- [x] Add an OS doc explaining test-driven development for agent work.
- [x] Explain why TDD preserves user intent through long tasks, compaction, future tasks, and handoff.
- [x] Include red/green/refactor language and adapt it to agents.
- [x] Include yellow/amber handling for unresolved assertions.
- [x] Include a workpad contract with user intent assertions, red checks, green checks, yellow checks, files changed, validation commands, and handoff notes.
- [x] Add a doc assertion test so the doc itself cannot drop the core vocabulary later.
- [x] Link the new doc from `packages/os/README.md`.

## User intent assertions

- [x] OS docs must include a TDD framework for agent work.
- [x] The doc must explain user intent assertions as the mechanism for preserving intent.
- [x] The doc must explain red, green, refactor, and yellow/amber.
- [x] The doc must define the workpad contract for long-running agent tasks.
- [x] The doc must explicitly cover compaction and handoff.
- [x] The doc must cover specs/Office artifacts, because generated pages can publish while still losing intent.

## Red checks

- RED: `packages/os/tests/docs-agent-tdd.test.js` initially failed on the missing `surviving compaction` assertion after the doc/test were created.

## Green checks

- GREEN: `node --check packages/os/tests/docs-agent-tdd.test.js` passed.
- GREEN: `node packages/os/tests/docs-agent-tdd.test.js` passed with `docs-agent-tdd assertions passed`.
- GREEN: `git diff --check` passed.

## Yellow / Amber checks

- YELLOW: `bun run audit -- --docs --json` still fails on pre-existing repository-wide missing path references. This task did not create those failures. The audit output reported `missing_count: 1993` before any task-specific issue was identified.

## files changed

- `packages/os/README.md`
- `packages/os/docs/test-driven-agent-work.md`
- `packages/os/tests/docs-agent-tdd.test.js`


## validation commands

```bash
node --check packages/os/tests/docs-agent-tdd.test.js
node packages/os/tests/docs-agent-tdd.test.js
git diff --check
bun run audit -- --docs --json
```

## Handoff notes

- This is a docs/process task. No runtime behavior changed.
- The doc intentionally frames TDD as an agent intent-preservation mechanism, not just unit testing.
- Future agents should use `packages/os/docs/test-driven-agent-work.md` when Ko gives a long task with many product decisions, spec updates, Office artifacts, traces dashboards, or generated pages.
- The `docs-agent-tdd` test should be kept when editing this doc; expand it instead of deleting it.

## current status

- Ready for review/publish.

- 2026-06-07 22:24:22 write: `.task/os/document-agent-tdd-contract-stream/workpad.md`

## workspace-owned: files changed

- `packages/os/docs/test-driven-agent-work.md`
- `packages/os/README.md`
- `packages/os/tests/docs-agent-tdd.test.js`

## workspace-owned: activity log

- 2026-06-07 22:24:22 fs.write: `.task/os/document-agent-tdd-contract-stream/workpad.md`
- 2026-06-07 22:26:56 fs.write: `.task/os/document-agent-tdd-contract-stream/workpad.md`

## final review update

- GREEN: `bun run review` reports `YOUR CHANGES: ✓ clean`.
- YELLOW: `bun run review` still exits non-zero because of pre-existing stream issues in `wait.js`, `consuelo-design.ts`, and `twenty-shared:typecheck`. These are not introduced by this docs task.

- 2026-06-07 22:26:56 append: `.task/os/document-agent-tdd-contract-stream/workpad.md`

## stream base recovery

- The first task PR conflicted because it started from `main` while `stream/os` had generated-doc changes.
- This replacement task merged `origin/stream/os` first, resolved unrelated generated-doc conflicts in favor of stream, then reapplied only this docs/test/README change.

## stream-base task note

- This replacement task was started with `startFrom: stream`, so the PR is based directly on `stream/os` and avoids unrelated generated-doc conflicts.
