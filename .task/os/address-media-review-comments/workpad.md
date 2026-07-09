# Address media review comments

branch: `task/os/address-media-review-comments`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1195/address-media-review-comments
github pr: https://github.com/consuelohq/opensaas/pull/1195
started: 2026-06-23

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

- 2026-06-23 19:47:08 `review.run`: passed — OK

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```


## Review comment triage

Accepted:
- Normalize media test names to the repo `should ... when ...` convention across the suite.
- Add runtime shape checks before dependency catalog type assertions.
- Make whisper dependency lookup explicit.
- Prefer structured assertions over `JSON.stringify` in installer/doctor tests.
- Convert file URL path handling in workflow intent test with `fileURLToPath`.
- Require exact media schema kind set instead of loose array containment.
- Trim stdout/stderr before parsing fallback CLI JSON.
- Extract long inline YouTube fixtures into named constants.
- Split audio transcription model/profile/default/download assertions.
- Add invalid export-package schema rejection path.
- Extract artifact handoff fixture and storage budget intermediate values.

Rejected / ignored:
- Codex: no actionable review, only usage-limit notification.
- CodeRabbit docstring coverage: generated/pre-merge noise for test-only PR.
- CodeRabbit stream title check: stream PR title is owned by stream workflow.
- Danger yarn.lock warning: package.json changes are scripts only; no dependency changes.
- Cloudflare deploy failure: unrelated deployment noise for stream PR.

## Validation

- title convention scanner for regular and conditional media tests: pass
- `bun run --cwd packages/os typecheck`: pass
- `bun --cwd packages/os test tests/media/01-package-boundaries.test.ts`: pass, 4 tests
- `bun --cwd packages/os test tests/media`: expected red, 30 failed / 1 passed, 94 failed / 6 passed; failures remain missing media implementation contracts
- `review.run --base origin/stream/os`: pass, blocking issues 0
