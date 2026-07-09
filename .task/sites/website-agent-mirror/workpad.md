# website agent mirror

branch: `task/sites/website-agent-mirror`
stream: `stream/sites`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1247/website-agent-mirror
github pr: https://github.com/consuelohq/opensaas/pull/1247
started: 2026-06-28

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-06-28 01:56:33 `review.run`: passed — OK
- 2026-06-28 01:56:46 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(sites): description" --changed
bun run task:pr
bun run task:finish
```


## acceptance criteria

- [x] Keep `areas/website/AGENTS.md` reproducible through the current task publish tooling.
- [x] Preserve package-level website rules as the canonical content.
- [x] Update the structure test to assert the area file mirrors package-level rules.

## Test-first contract

Behavior under test:
- `areas/website/AGENTS.md` must exactly mirror `packages/consuelo-website/AGENTS.md` because symlink mode is not preserved by the current `task.push` path.

Focused command:
- `bun test packages/consuelo-website/tests/website-structure.test.js`

Expected failure before fix:
- Stream currently has a normal file at `areas/website/AGENTS.md`, while the test expects a symlink.

## implementation

- Replaced symlink expectation with exact-content mirror expectation.
- Wrote `areas/website/AGENTS.md` as a full mirror of `packages/consuelo-website/AGENTS.md`.

## workspace-owned: test selection

- changed files: `.task/sites/website-agent-mirror/current.json`, `.task/sites/website-agent-mirror/session.json`, `.task/sites/website-agent-mirror/workpad.md`, `.task/tasks/sites/website-agent-mirror.json`, `packages/consuelo-website/tests/website-structure.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
