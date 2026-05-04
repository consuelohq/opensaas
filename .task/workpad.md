# add Linear facade commands

branch: task/workspace-agents/add-linear-facade-commands
stream: stream/workspace-agents
pr: https://github.com/consuelohq/opensaas/pull/312
started: 2026-05-04

## acceptance criteria

- [x] Add typed Linear facade commands for issue search and issue creation.
- [x] Add typed Linear facade commands for issue update, labels, teams, projects, and states.
- [x] Issue creation supports team, title, description, state, labels, assignee, priority, project, cycle, and parent.
- [x] Issue creation defaults to DEV/open and resolves bracket type + repository labels.
- [x] Commands return structured JSON from the existing Linear GraphQL wrapper.
- [x] Duplicate-check workflow is supported through linear.search before creation.
- [x] Docs and facade schemas/manifest are updated.
- [x] Generated docs/types and facade validation pass.

## plan

1. Inspect existing linear.js and typed facade patterns.
2. Extend linear.js around existing commands instead of creating a second wrapper.
3. Add schema registry/type signatures for Linear command inputs.
4. Add manifest entries for first-class workspace linear.* commands.
5. Update workspace docs with Linear issue creation conduct and examples.
6. Validate syntax, facade behavior, generated artifacts, review, and publish.

## files changed

- packages/workspace/scripts/linear.js
- packages/workspace/scripts/lib/facade/schemas.ts
- packages/workspace/tooling/tool-manifest.json
- packages/workspace/SCRIPTS.md

## key decisions

- Reused packages/workspace/scripts/linear.js because it already owns token loading and Linear GraphQL access.
- Added typed facade entries instead of requiring agents to call generic bash or browser automation.
- Kept DEV as the default team and open as the default state.
- Labels resolve by name through Linear so titles like [bug] default to [bug] + opensaas instead of hardcoding only [task].
- Parent issue support is included for sub-issues. Blocking/related relation support still needs GraphQL mutation verification before exposing as a write facade.

## notes for ko

- I started the task branch from the default task.start source, which returned main, not stream. The branch still targets stream/workspace-agents through the task PR, and review will surface any stream conflicts.
- Linear live smoke is currently blocked by the checked-in OAuth token returning `Authentication required, not authenticated`.
- The external ChatGPT linear skill content was read, but the repo does not contain that skill bundle. I updated repo workspace docs/tooling; packaging the external skill would need the tracked skill source or uploaded skill archive.

## improvements noticed

- workspace task.start should probably default to startFrom stream when the stream has already been explicitly selected.
- The Linear wrapper should add a refreshed-token/config status command so auth failures are clearer.

## validation

- node --check packages/workspace/scripts/linear.js passed.
- Initial live Linear smoke for `bun run linear -- labels --first 5` failed with `Authentication required, not authenticated`.
- Fixed the facade envelope timestamp path for normal executor and batch results.
- `cd packages/workspace && bun run test -- tests/facade/facade.test.ts --reporter=json` passed with 0 failures.
- `workspace review.run` against stream/workspace-agents returned no new review findings in ours; only pre-existing error-handling warnings remain.


## oauth refresh follow-up

- Confirmed cron had a real mismatch: it calls `.agent/linear-refresh.sh --chatgpt`, but the script only recognized `--opencode`, so chatgpt refresh fell through to the kiro token path.
- Since opencode is retired, `--opencode` is now treated as an alias for the chatgpt token path for backwards compatibility with old commands.
- Updated `.agent/linear-refresh.sh` so `--chatgpt` refreshes `.agent/.chatgpt-token.json` using the chatgpt/opencode OAuth app config.
- Preserved token metadata (`user_id`, `user_name`, `note`) when refresh responses rotate the access/refresh token pair.
- Updated `.agent/webhook-receiver.py` on the task branch to support `state=chatgpt` writing to `.agent/.chatgpt-token.json` if we need browser reauth later.
- Live smoke passed after refresh: direct GraphQL viewer returned `chatgpt`; task-branch Linear wrapper `labels --first 3` returned label JSON.
