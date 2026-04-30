# Recover revoked auth tokens on workspace subdomains

branch: `task/clean-up/recover-revoked-auth-tokens-on-workspace-subdomains`
stream: `stream/clean-up`
pr: https://github.com/consuelohq/opensaas/pull/237
started: 2026-04-30

## acceptance criteria

- [x] `app.consuelohq.com` remains the canonical `SERVER_URL`; no Railway env changes in this task.
- [x] Expired or revoked refresh tokens clear local auth state deterministically.
- [x] Workspace subdomain users are redirected to sign-in/session recovery without a persistent blank bootstrap retry loop.
- [x] Relevant auth/Apollo tests cover failed token renewal behavior.
- [x] Review/type validation passes or failures are documented.

## plan

1. Confirm task starts from `stream/clean-up` to keep the PR diff scoped.
2. Re-apply the verified Apollo renewal patch from the first attempted task branch.
3. Run focused ApolloFactory Jest coverage.
4. Run branch-scoped review.
5. Publish task branch into stream review flow.

## files changed

- `packages/twenty-front/src/modules/apollo/services/apollo.factory.ts`
- `packages/twenty-front/src/modules/apollo/services/__tests__/apollo.factory.test.ts`

## key decisions

- `SERVER_URL=https://app.consuelohq.com` is confirmed correct and out of scope.
- Runtime evidence points to expired/revoked token recovery, not a Railway process hang.
- Failed token renewal must reject instead of resolving and retrying the original operation without valid auth; otherwise Apollo can loop through unauthenticated requests.

## notes for ko

- Production Railway env was not changed.
- Any later Railway/DNS change should be done together after this code branch is reviewed.
- Branch-scoped raw review ran against `origin/stream/clean-up`. It still marks existing Apollo `console.*` and module-boundary warnings as `yours` because this task touches `apollo.factory.ts`; this patch removed logs in the token-renewal path and did not introduce new logging. Typecheck still fails in pre-existing `twenty-shared` relative date utilities.
- Focused Jest passed on this branch: `npx jest packages/twenty-front/src/modules/apollo/services/__tests__/apollo.factory.test.ts --config=packages/twenty-front/jest.config.mjs --runInBand`.
- First task attempt was PR 236, started from `main`; PR 237 superseded it because this branch starts from `stream/clean-up` and keeps the diff scoped.

## improvements noticed

- Existing Apollo code still has production `console.log` calls outside this patch. I removed the two logs in the touched renewal success/failure path, but left unrelated existing logs alone.

## errors i ran into

- First task branch started from `main`, which made the PR diff include stream changes. I created this replacement task from `stream/clean-up` and applied only the auth patch.

---

## publish checklist

```bash
bun run task:push -- --message "fix(clean-up): recover revoked auth tokens" --changed
bun run task:pr
bun run task:finish
```
