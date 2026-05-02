# add sentry typed facade commands

branch: `task/workspace-agents/add-sentry-typed-facade-commands`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/250
started: 2026-05-01

## acceptance criteria

Research phase before code:

- [x] Summarize relevant Sentry API endpoints and authentication model from official docs.
- [x] Inspect repo facade/script patterns for adding a new workspace script and typed facade entries.
- [x] Propose command names and input/output shapes.
- [x] Propose Sentry config/credential strategy.
- [x] List exact files to update.
- [x] List exact validation commands.
- [x] Ask Ko missing-requirement questions before coding.
- [x] Make no code changes before Ko approves the implementation plan.

Implementation phase after Ko approval:

- [x] Add dedicated Sentry script under `packages/workspace/scripts/`.
- [x] Add package script entry for Sentry.
- [x] Add typed Sentry facade commands to the manifest.
- [x] Add schemas in `packages/workspace/scripts/lib/facade/schemas.ts`.
- [x] Regenerate `TOOLS.md` and `workspace.d.ts`.
- [x] Document Sentry workflows in `SCRIPTS.md`.
- [x] Update facade tests and snapshots.
- [x] Ensure JSON output and structured error handling.
- [x] Avoid logging tokens or raw secrets.
- [x] Pass tests and review; audit blocked by missing `tree-sitter` dependency resolution in this worktree.

## plan

1. Research official Sentry API docs for auth, issues, events, pagination, rate limits, and trace-related lookup.
2. Use the decision engine and repo reads to inspect workspace facade/script patterns.
3. Search existing Sentry usage and config conventions with workspace file tools.
4. Return to Ko with questions, proposed command shape, files, and validation plan.
5. Implement only after Ko approves the plan.

## proposed implementation plan after approval

1. Add `packages/workspace/scripts/sentry.js` as a dedicated read-only Sentry API wrapper.
2. Add `sentry` to `packages/workspace/package.json`.
3. Add typed facade entries under `sentry.*` in `packages/workspace/tooling/tool-manifest.json`.
4. Add Sentry Zod schemas and type signatures in `packages/workspace/scripts/lib/facade/schemas.ts`.
5. Regenerate `packages/workspace/TOOLS.md` and `packages/workspace/src/generated/workspace.d.ts`.
6. Update `packages/workspace/SCRIPTS.md` with CLI and facade examples.
7. Update facade snapshots via the package facade test.
8. Validate with checkFiles, package facade test, script audit, and review.

## research findings

- Sentry API uses bearer auth and `/api/0/` JSON endpoints.
- Organization issues endpoint is the right v1 list/search primitive; project issues endpoint is deprecated in favor of org issues with project filtering.
- Issue detail and issue events endpoints cover issue summary and latest/recommended/full event retrieval.
- Short ID and event ID resolvers exist, so v1 can support both human keys and raw IDs.
- Project event detail endpoint can retrieve an event directly when project slug and event ID are known.
- Pagination uses Link headers; rate-limit headers should be surfaced on failure/debug output.
- Existing app config uses `SENTRY_DSN`, `SENTRY_FRONT_DSN`, and `SENTRY_ENVIRONMENT`; API token/org/project config for the workspace script still needs Ko approval.
- Existing CLI Sentry setup redacts sensitive extras and lazily imports `@sentry/node`; the new workspace API client should not depend on Sentry SDK imports at all.

## proposed command shape

- `workspace sentry.config` / generated `workspace.sentry.config(...)`: validate config and optionally fetch org/projects.
- `workspace sentry.projects` / `workspace.sentry.projects(...)`: list projects for resolving project slugs to numeric IDs.
- `workspace sentry.issues` / `workspace.sentry.issues(...)`: list/search/filter issues.
- `workspace sentry.issue` / `workspace.sentry.issue(...)`: retrieve one issue by numeric/group ID or resolved short ID.
- `workspace sentry.issueEvent` / `workspace.sentry.issueEvent(...)`: retrieve `latest`, `recommended`, `oldest`, or specific event for an issue.
- `workspace sentry.event` / `workspace.sentry.event(...)`: resolve/retrieve a concrete event ID.
- `workspace sentry.trace` / `workspace.sentry.trace(...)`: best-effort trace-related issue lookup if Ko wants it in v1.

## open questions for ko

1. What org slug and default project slug should the script use?
2. Where should Sentry auth/config live: env vars, `.agent`, `~/.consuelo/config.json`, or another workspace config?
3. Should v1 be read-only only, or include mutation commands later?
4. Should v1 accept short IDs, numeric IDs, event IDs, or all three?
5. Should output be human + JSON, or JSON-only agent consumption?
6. Which environments should default first: production, all environments, or caller-specified only?
7. Should related issues in the same trace be best-effort or exact?
8. Which requested fields are mandatory for v1 versus nice-to-have?
9. Should this read app SDK config or remain a workspace-only API client?
10. Should request data and custom extras be redacted by default? Recommendation: yes.

## files changed

- `.task/workpad.md`

## key decisions

- Research/planning only until Ko approves code.
- Use a dedicated Sentry script instead of extending unrelated scripts.
- Propose env-only token/config by default unless Ko chooses a durable config location.
- Default to redacted event output unless Ko explicitly wants raw request/extras.
- Keep v1 read-only unless Ko requests mutation commands.

## notes for ko

- Later context memory corrected the original handoff: use workspace file search, not raw absolute-path `rg`.
- Decision engine confidence score is polluted by a prior unrelated validation-failure marker, so file reads and official docs are the useful evidence for this planning phase.

## improvements noticed

- Sentry API token config is separate from existing app DSN config; naming should avoid confusing `SENTRY_DSN` with `SENTRY_AUTH_TOKEN`.

## errors i ran into

- `workspace decideNext` kept recommending stale failed-validation evidence despite the relevant files already being read.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-01 00:16:53 write: `.task/workpad.md`


## validation results

- [x] `bun run generate-types`
- [x] `bun run generate-docs`
- [x] `bun run sentry -- config` read Keychain with token redacted
- [x] `bun run sentry -- config --verify` returned Sentry HTTP 200 for org `consuelo`
- [x] `bun run sentry -- projects --limit 1` returned project JSON
- [x] `bun run sentry -- issues --query is:unresolved --limit 1` returned capped issue JSON
- [x] `bun run sentry -- issue OPENSAAS-2` resolved short ID to numeric issue id
- [x] `bun run sentry -- issue-event OPENSAAS-2 recommended` returned event JSON and trace context
- [x] `bun run sentry -- trace <trace-id> --limit 1` returned best-effort events/issues attempts
- [x] `bun run test tests/facade/facade.test.ts` passed: 367 tests
- [x] `workspace checkFiles` passed for `sentry.js` and facade schemas
- [x] `git diff --check` passed
- [x] `workspace review.run --no-tests` returned `ok: true` after Sentry-specific findings were fixed
- [ ] `bun run audit -- --scripts --json` blocked before script audit: missing `tree-sitter` package resolution in this task worktree

## implementation notes

- V1 is read-only and JSON-only.
- Runtime config comes from macOS Keychain or env vars; token is never printed.
- Supports short issue IDs, numeric issue IDs, concrete event IDs, and best-effort trace lookup.
- Defaults to all environments unless `--environment` is explicitly passed.
- Redacts only obvious sensitive keys such as authorization, cookies, tokens, passwords, secrets, and API keys.
