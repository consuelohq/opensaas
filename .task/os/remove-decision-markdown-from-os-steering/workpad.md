# Remove decision markdown from OS steering

branch: `task/os/remove-decision-markdown-from-os-steering`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1515/remove-decision-markdown-from-os-steering
github pr: https://github.com/consuelohq/opensaas/pull/1515
started: 2026-07-15

## acceptance criteria

- [x] Normal OS `get_steering` never injects `decision.md`, including a user-local copy under `$CONSUELO_HOME/steering`.
- [x] Raw/operator steering never injects the bundled OS `decision.md`.
- [x] Steering loop-guard guidance no longer directs agents to read `decision.md`.
- [x] Other supported local steering Markdown files continue to load.
- [x] Keep `decision.md` files and installer preservation behavior unchanged; this task removes them from steering payloads rather than deleting user-owned material.
- [x] Focused tests, review, and verify pass; merge into `stream/os`.

## plan

1. Add failing assertions for normal and raw steering exclusion.
2. Exclude `decision.md` from local steering discovery and remove the raw/operator append path.
3. Remove the stale loop-guard suggestion.
4. Run focused steering tests, inspect the diff, review, verify, push, and promote.

## current status

- Implementation complete.
- Normal steering excludes `decision.md` by filename while preserving `system_prompt.md` and other supported local Markdown.
- Raw/operator steering no longer appends the bundled decision file.
- The loop guard no longer suggests reading the decision file.
- Focused steering and installer regressions are green. Strict review found zero issues and verify is publish-valid.

## Test-first contract

- Behavior under test: all OS steering surfaces omit `decision.md` while preserving `system_prompt.md` and other supported local Markdown.
- Existing pattern: `packages/os/tests/os-get-steering-trace.test.ts` exercises local steering assembly; `packages/os/tests/os-raw-steering.test.ts` exercises raw/operator output.
- Changed tests: update the local steering test to assert exclusion and add raw steering exclusion assertions.
- Focused command: `bun --cwd packages/os test <test-file>` for each focused file.
- Red proof: normal output still contained the local decision file and loop-guard path; raw output still contained `# bundled OS decision.md`.
- Green proof: 4/4 local steering tests, 2/2 raw steering tests, and 19/19 installer-state tests passed.
- Scope boundary: do not delete `packages/os/steering/decision.md`, do not alter workspace steering, and do not remove installer preservation of local files.

## discovery

- Primary normal path: `packages/os/scripts/os.ts` → `readSteeringMarkdownFiles` → `getSteering`.
- Raw path: `packages/os/scripts/os.ts` → `getRawSteering`.
- Server `get_steering` delegates to `getSteering` through `steering-service.ts`.
- Existing tests already create a local `decision.md`, making the normal exclusion contract direct and deterministic.

## files changed

- `packages/os/scripts/os.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`
- `packages/os/tests/os-raw-steering.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/os.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`
- `packages/os/tests/os-raw-steering.test.ts`

## workspace-owned: activity log

- 2026-07-15 18:29:28 fs.write: `.task/os/remove-decision-markdown-from-os-steering/workpad.md`

## workspace-owned: validation evidence

- Red: normal and raw steering exclusion assertions failed against the previous implementation.
- Green: `tests/os-get-steering-trace.test.ts` — 4 passed.
- Green: `tests/os-raw-steering.test.ts` — 2 passed.
- Green: `tests/install-state.test.ts` — 19 passed, proving stored decision files remain seeded and preserved.
- Strict review: 0 issues across static rules, ESLint, typecheck, and spec compliance.
- Verify: publish-valid stamp written.
- 2026-07-15 18:29:52 `review.run`: passed — OK
- 2026-07-15 18:30:04 `verify`: passed — OK

## key decisions

- “For everyone” covers both normal and raw/operator steering output.
- Retain the Markdown file as stored material; stop injecting it into agent context.
- Exclude `decision.md` case-insensitively by filename so additional local Markdown remains extensible.

## notes for ko

- Workspace steering is untouched.
- `packages/os/steering/decision.md` and local installed copies are not deleted.

## improvements noticed

- none yet

## issues and recovery

- Initial `task.start` passed the branch name to `startFrom`; corrected to the supported `startFrom: "stream"` plus `stream: "stream/os"`.
- Initial focused test invocation ran from the repository root, while embedded imports require the OS package cwd. Re-ran with `bun --cwd packages/os test ...`, which produced the intended red proof and later passed green.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-15 18:29:28 write: `.task/os/remove-decision-markdown-from-os-steering/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/remove-decision-markdown-from-os-steering/current.json`, `.task/os/remove-decision-markdown-from-os-steering/evidence-log.json`, `.task/os/remove-decision-markdown-from-os-steering/read-log.json`, `.task/os/remove-decision-markdown-from-os-steering/session.json`, `.task/os/remove-decision-markdown-from-os-steering/workpad.md`, `.task/tasks/os/remove-decision-markdown-from-os-steering.json`, `packages/os/scripts/os.ts`, `packages/os/tests/os-get-steering-trace.test.ts`, `packages/os/tests/os-raw-steering.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
