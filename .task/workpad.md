# debug production dialer failure

branch: `task/dialer/debug-production-dialer-failure`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/354
started: 2026-05-09

## acceptance criteria

- [x] Reproduce production dialer request behavior without Sentry.
- [x] Identify whether call-start reaches backend, Twilio, callbacks, or locks.
- [x] Fix the confirmed frontend GraphQL schema mismatch.
- [x] Add a focused regression test.
- [x] Validate the touched frontend dialer surface.
- [ ] Publish the task branch and stream PR.
- [ ] Post a Linear follow-up with corrected root cause and validation.

## plan

1. Use production browser fetch capture and Railway logs as truth sources.
2. Verify the deployed frontend request path with redacted fake test data.
3. Inspect frontend call-start hook and Apollo provider wiring.
4. Patch the endpoint/client mismatch only.
5. Add a regression test for the fixed client path.
6. Run targeted syntax, formatting, Jest, and review validation.
7. Publish and update DEV-1506.

## files changed

- `packages/twenty-front/src/modules/dialer/hooks/useStartDialerCall.ts`
- `packages/twenty-front/src/modules/dialer/hooks/__tests__/useStartDialerCall.test.tsx`

## key decisions

- Production browser evidence showed `StartDialerCall` was emitted to the workspace GraphQL schema and returned schema errors for missing dialer call-start types/fields.
- The failure category is frontend GraphQL client/schema mismatch, not provider env, callback routing, or lock lifecycle.
- Call-start and terminate are metadata mutations. The app default Apollo provider is metadata-scoped; `useApolloCoreClient` is workspace-schema scoped.
- The fix removes the explicit core-client override so the hook uses the active metadata Apollo provider.
- Test data uses redacted placeholders instead of real phone numbers.

## validation commands and results

- `workspace check-files` on `useStartDialerCall.ts`: passed.
- `npx prettier --check` on changed hook/test plus `git diff --check`: passed after formatting.
- `npx jest --config=packages/twenty-front/jest.config.mjs --runInBand packages/twenty-front/src/modules/dialer/hooks/__tests__`: passed, 5 suites / 32 tests.
- `npx nx typecheck twenty-front`: failed in dependency `twenty-sdk:build` before reaching the dialer hook because optional story example dependencies are missing. This is outside the dialer change.
- `workspace check-files` cannot parse the new `.tsx` test with `node --check`; Jest covered the file.

## notes for ko

- No real customer call was placed.
- Production verification after deploy should confirm `StartDialerCall` uses the metadata endpoint, no schema error is returned, and Railway shows the resolver/provider path only for an approved safe test call.

## improvements noticed

- Add a post-deploy dialer smoke check for the metadata call-start path.
- Add CI guard against legacy call-start endpoints and explicit core-client use in metadata mutations.

## errors i ran into

- Initial browser reproduction was misleading because direct DOM mutation did not prove the React/Recoil dialpad state path.
- `workspace linear.comment` does not exist; comments require the Linear helper CLI.
- Some Railway filter calls returned network-flow summaries instead of app log lines.
- Broad frontend typecheck is blocked by unrelated story dependency errors.

---

## publish checklist

```bash
bun run task:push -- --message "fix(dialer): route call start to metadata graphql" --changed
bun run task:pr
```

## review evidence

- `workspace review.run` against `origin/main` returned ok for the two changed frontend files. It reported only pre-existing warnings: unchanged async error-handling warnings in the hook and the existing broad frontend typecheck blocker in `twenty-sdk` optional story examples.
