# confirm list runner call start metadata routing

branch: `task/dialer/confirm-list-runner-call-start-metadata-routing`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/407/confirm-list-runner-call-start-metadata-routing
github pr: https://github.com/consuelohq/opensaas/pull/407
started: 2026-05-20

## acceptance criteria

- [x] Confirm `stream/dialer` already contains the metadata-client fix for `useStartDialerCall`.
- [x] Confirm the regression test guarding against `useApolloCoreClient` exists on `stream/dialer`.
- [x] Validate the dialer hook test surface before publishing stream to main.

## plan

1. Start clean task branch from `stream/dialer`.
2. Verify `useStartDialerCall` no longer injects `useApolloCoreClient`.
3. Verify the regression test exists and passes.
4. Publish the stream task and finish the stream→main review flow.

## files changed

- No code delta was needed in this replacement branch because `stream/dialer` already contains the confirmed fix from the earlier stream task.
- PR #406 was left unmerged because it was bootstrapped from `main` and conflicted with stream metadata; replacement PR #407 was started from `stream/dialer`.

## key decisions

- The production failure remains fixed by shipping the existing stream code to `main`: `StartDialerCall`/`TerminateDialerCall` must use the metadata Apollo provider, not the core/workspace Apollo client.

## notes for ko

- none yet

## improvements noticed

- `npx prettier --check packages/twenty-front/src/modules/dialer/hooks/useStartDialerCall.ts packages/twenty-front/src/modules/dialer/hooks/__tests__/useStartDialerCall.test.tsx`: passed.
- `git diff --check`: passed.
- `npx jest --config=packages/twenty-front/jest.config.mjs --runInBand packages/twenty-front/src/modules/dialer/hooks/__tests__`: passed, 5 suites / 32 tests.
- `workspace review.run --base origin/stream/dialer --noTests`: timed out; targeted validation above passed.

## errors i ran into

- PR #406 was not mergeable because it was created from `main` and would carry unrelated main/workspace divergence into `stream/dialer`; replacement PR #407 is stream-based.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```
