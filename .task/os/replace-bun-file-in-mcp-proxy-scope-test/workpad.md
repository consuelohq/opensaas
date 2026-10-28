# replace bun.file in mcp proxy scope test

branch: `task/os/replace-bun-file-in-mcp-proxy-scope-test`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2326
started: 2026-08-31

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/tests/mcp-central-proxy-scope.test.ts`
- `packages/os/scripts/lib/tool-scope-authorization.ts`


## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: mcp-central-proxy-scope.test.ts keeps the read-only facade classifier aligned with tool.manifest.json under vitest (Consuelo / verify package-test), without requiring the Bun global.
existing local pattern: packages/os/tests/mcp-central-proxy-scope.test.ts currently uses Bun.file().json().
new or changed tests: keep the same equality assertion; replace Bun.file with readFileSync + JSON.parse so vitest can run it.
focused red command: bunx vitest run tests/mcp-central-proxy-scope.test.ts
expected red failure: ReferenceError: Bun is not defined at the classifier alignment test.
no-test waiver: not applicable

- 2026-08-31 04:06:05 append: `.task/os/replace-bun-file-in-mcp-proxy-scope-test/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-31 04:06:05 fs.write: `.task/os/replace-bun-file-in-mcp-proxy-scope-test/workpad.md`

- 2026-08-31 04:06:05 apply-patch: `packages/os/tests/mcp-central-proxy-scope.test.ts`

## workspace-owned: files read

- `packages/os/scripts/lib/tool-scope-authorization.ts`

- 2026-08-31 04:07:09 apply-patch: `packages/os/scripts/lib/tool-scope-authorization.ts`