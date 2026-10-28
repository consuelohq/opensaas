# Clarify OS get_steering description

branch: `task/os/clarify-os-get-steering-description`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1514/clarify-os-get-steering-description
github pr: https://github.com/consuelohq/opensaas/pull/1514
started: 2026-07-15

## acceptance criteria

- [x] Change only the OS `get_steering` MCP descriptor to: `Return Consuelo OS steering and typed tool guidance. Call this once before using call.`
- [x] Do not change the workspace connector or workspace steering.
- [x] Prove the MCP gateway still exposes the two public OS tools with the exact updated description.
- [ ] Validate, push, and promote the task into `stream/os`.

## plan

1. Confirm the descriptor source and related MCP gateway test ownership.
2. Apply the exact one-word removal in the OS MCP descriptor.
3. Run the focused MCP gateway test and an exact `tools/list` description assertion.
4. Inspect the diff, run review/verify, push, and promote to `stream/os`.

## current status

- The exact OS-only descriptor edit is complete.
- Focused MCP gateway suite passed: 13 tests, 0 failures, 69 assertions.
- Direct `tools/list` verification returned exactly `get_steering` and `call` with the approved description.
- Working-tree diff contains one production line plus task metadata.
- Strict review passed with 0 findings.
- Verify passed and wrote a publish-valid stamp.
- Ready to push and promote into `stream/os`.

## Test-first contract

- Behavior under test: MCP `tools/list` returns the approved OS `get_steering` description without the word `current`.
- Existing pattern: `packages/os/tests/mcp-gateway.test.ts` validates the public two-tool MCP facade.
- New or changed tests: none.
- No-test waiver: this is a copy-only metadata edit with no control-flow, schema, authorization, or runtime behavior change. Validation will run the existing MCP gateway suite plus an exact descriptor assertion against `tools/list`.

## files changed

- `packages/os/scripts/lib/mcp-gateway.ts`
- task-local `.task/os/clarify-os-get-steering-description/*` metadata

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-15 17:52:36 fs.write: `.task/os/clarify-os-get-steering-description/workpad.md`

## workspace-owned: validation evidence

- 2026-07-15 17:54:21 `review.run`: passed — OK
- 2026-07-15 17:54:33 `verify`: passed — OK

## key decisions

- Use Ko's exact sentence and remove only `current`.
- Keep the task strictly inside `packages/os`; no workspace changes.

## notes for ko

- The workspace connector and workspace steering were not changed.

## improvements noticed

- none yet

## issues and recovery

- The first standalone descriptor verifier used a relative import from the temporary `code.call` directory and failed with module-not-found. Retried once using the task worktree absolute file URL; verification passed.
- The generic `status` tool reported the main checkout instead of task context. Task truth came from task-scoped `git.diff` and the task session.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-15 17:52:36 write: `.task/os/clarify-os-get-steering-description/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/clarify-os-get-steering-description/current.json`, `.task/os/clarify-os-get-steering-description/evidence-log.json`, `.task/os/clarify-os-get-steering-description/read-log.json`, `.task/os/clarify-os-get-steering-description/session.json`, `.task/os/clarify-os-get-steering-description/workpad.md`, `.task/tasks/os/clarify-os-get-steering-description.json`, `packages/os/scripts/lib/mcp-gateway.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## workspace-owned: files read

- none yet
