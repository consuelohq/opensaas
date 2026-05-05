# fix codex review findings for pr 308

branch: `task/workspace-agents/fix-codex-review-findings-for-pr-308`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/315
started: 2026-05-04

## acceptance criteria

- [x] Queue CSV export validation accepts both active server header schemas, including exports with leading `id`.
- [x] Sentry CLI preserves repeated values for array-style flags emitted by the typed facade.
- [x] Sentry issue-event only requests full payload when explicitly enabled.
- [x] Focused syntax and behavior checks pass.
- [ ] Task is published through the stream PR flow.

## plan

1. Patch run-dialer-scenario CSV header validation to parse by allowed header set.
2. Patch sentry.js argument parsing to consume multiple consecutive values after flags.
3. Patch Sentry issue-event full query semantics.
4. Add focused CLI-level tests/smokes using local command execution.
5. Run review/verify and publish.

## files changed

- `packages/workspace/scripts/run-dialer-scenario.ts`
- `packages/workspace/scripts/sentry.js`

## key decisions

- Use a small allowed-header set for queue CSV exports because both existing harness and active server schemas are valid.
- Preserve single-value behavior for normal Sentry flags while supporting multiple token values for repeated/array-style flags.
- Treat `--full` as opt-in instead of default-on to make the facade boolean meaningful.

## notes for ko

- This task starts from merged PR #308 on current main.

## improvements noticed

- Sentry CLI argument parsing would benefit from unit tests if this script grows more behavior.

## errors i ran into

- Initial combined workspace command failed because workspace commands accept only one JSON input argument.
- Decision-engine query was blocked by safety filter when it echoed review text, so I used targeted file reads.

---

## publish checklist

```bash
bun run task:push -- --message "fix(workspace-agents): address pr 308 codex findings" --changed
bun run task:pr
bun run task:finish
```

## validation

- `node --check packages/workspace/scripts/sentry.js` passed.
- `bun build packages/workspace/scripts/run-dialer-scenario.ts --no-bundle --outfile /tmp/run-dialer-scenario-check.js` passed.
- Confirmed active queue export service emits the leading-id queue CSV header.
- Sentry parser smoke passed for array flags plus normal positional handling.
- CSV header smoke passed for both allowed queue export headers.

## verification note

- `workspace review.run` passed with zero `yours` findings against `stream/workspace-agents`; only pre-existing run-dialer-scenario async error-handling warnings remain.
- Branch-local `verify.js --base stream/workspace-agents --no-db --json` failed because it treats the same pre-existing warnings as blocking. This is intentionally not fixed in this task because Codex requested three targeted PR #308 fixes only.
