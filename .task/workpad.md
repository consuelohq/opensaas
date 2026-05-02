# expand dialer scenario e2e harness

branch: `task/workspace-agents/expand-dialer-scenario-e2e-harness`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/279
started: 2026-05-02

## acceptance criteria

- [x] Add a Bun entrypoint for the dialer queue scenario.
- [x] Authenticate with user token flow for user/workspace context.
- [x] Resolve exactly five contacts from `CONSUELO_SCENARIO_CONTACT_IDS` or `CONSUELO_SCENARIO_LIST_ID`.
- [x] Create a queue, start it, advance dispositions, require cadence suppression for contact 3, test user skip, verify completion, restart, and CSV export.
- [x] Write a JSON transcript after every step/failure.

## plan

1. Add `packages/workspace/scripts/run-dialer-scenario.ts`.
2. Add `bun run dialer:scenario` in `packages/workspace/package.json`.
3. Validate syntax, JSON parse, and smoke failure behavior without credentials.
4. Publish task branch and promote to stream review PR.

## files changed

- `packages/workspace/package.json`
- `packages/workspace/scripts/run-dialer-scenario.ts`

## key decisions

- The script uses sign-in/user token auth for dialer queue endpoints because those endpoints require user + workspace context.
- The script supports either explicit contact IDs or a list ID so local deterministic runs do not depend on GraphQL contact creation work tomorrow.
- Cadence suppression is a hard assertion: after contact 2 is answered, contact 3 must appear in the suppression payload and contact 4 must be selected.
- User skip is tested separately on contact 4, then contact 5 exhausts the queue.

## notes for ko

- Docker is not fixed in this task. The workspace shell could inspect compose files, but `docker` was not visible in PATH from the repo shell. Treat that as tomorrow setup work unless the Mac terminal shows Docker working.
- For tomorrow local run, set `CONSUELO_API_BASE_URL=http://localhost:3000`, matching metadata/graphql URLs if they differ, and provide five deterministic contacts.
- Contact 3 needs seeded prior attempt/ledger state that triggers cadence suppression. If the backend does not mark suppressed items as skipped, the transcript will show the exact mismatch.

## improvements noticed

- The queue service currently returns cadence suppression but does not appear to mark the suppressed queue item as skipped in the rows read so far; this harness is designed to make that behavior visible.

## errors i ran into

- `workspace checkFiles` passed the TypeScript script but failed on `package.json` because the helper applies `node --check` to JSON. Validated `package.json` with `python3 -m json.tool` instead.

## validation

- `node --check packages/workspace/scripts/run-dialer-scenario.ts` passed.
- `bun run dialer:scenario` executed and failed cleanly without credentials, writing a transcript.
- `python3 -m json.tool packages/workspace/package.json` passed.

---

## publish checklist

```bash
bun run task:push -- --message "feat(workspace): expand dialer scenario harness" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-02 06:09:03 write: `.task/workpad.md`