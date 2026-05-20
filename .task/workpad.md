# fix list runner start dialer call metadata routing

branch: `task/dialer/fix-list-runner-start-dialer-call-metadata-routing`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/406/fix-list-runner-start-dialer-call-metadata-routing
github pr: https://github.com/consuelohq/opensaas/pull/406
started: 2026-05-20

## acceptance criteria

- [x] Route StartDialerCall and TerminateDialerCall through the default metadata Apollo provider instead of the core/workspace Apollo client.
- [x] Add a regression test that fails if useApolloCoreClient is called by useStartDialerCall.
- [x] Validate targeted dialer hook behavior and formatting.

## plan

1. Read AGENTS.md and CODING-STANDARDS.md.
2. Confirm the production evidence maps to useStartDialerCall using useApolloCoreClient.
3. Remove the explicit core client override so the active metadata Apollo provider handles the metadata mutations.
4. Add a focused hook regression test.
5. Run targeted validation and review.

## files changed

- `packages/twenty-front/src/modules/dialer/hooks/useStartDialerCall.ts`
- `packages/twenty-front/src/modules/dialer/hooks/__tests__/useStartDialerCall.test.tsx`

## key decisions

- `StartDialerCall` and `TerminateDialerCall` are metadata mutations; using `useApolloCoreClient()` sends them to `/graphql`, which produced the production schema errors.
- The minimal safe fix is to remove the explicit client override and let the app metadata Apollo provider handle these mutations.
- The test mocks `useApolloCoreClient` to throw, preventing a future regression.

## notes for ko

- Production browser evidence confirmed `/graphql` routing before Twilio. No additional live call attempt is needed for this patch.
- After this reaches production, rerun one approved safe List runner attempt to confirm `/metadata`; only then investigate the contactId + targetPhone fallback suspicion.

## improvements noticed

- none for this patch.

## errors i ran into

- `npx prettier --check packages/twenty-front/src/modules/dialer/hooks/useStartDialerCall.ts packages/twenty-front/src/modules/dialer/hooks/__tests__/useStartDialerCall.test.tsx`: passed.
- `git diff --check`: passed.
- `npx jest --config=packages/twenty-front/jest.config.mjs --runInBand packages/twenty-front/src/modules/dialer/hooks/__tests__/useStartDialerCall.test.tsx`: passed, 1 test.
- `npx jest --config=packages/twenty-front/jest.config.mjs --runInBand packages/twenty-front/src/modules/dialer/hooks/__tests__`: passed, 5 suites / 32 tests.
- `npx nx typecheck twenty-front`: failed before changed dialer files in pre-existing `twenty-sdk` optional story dependency imports: `@chakra-ui/react` and `@mui/material/Button`.
- `workspace review.run --base origin/main --noTests`: ok for changed files; reports pre-existing async error-handling warnings in the hook and the same `twenty-sdk` typecheck blocker.
- `bun run verify`: failed because its review gate treats the same pre-existing `twenty-sdk` optional story dependency typecheck blocker as failing. Scoped review showed no new changed-file findings.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```
