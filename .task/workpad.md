# fix deployed parallel phone payload

branch: `task/dialer/fix-deployed-parallel-phone-payload`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/188
started: 2026-04-24

## acceptance criteria

- [x] start a fresh task from `stream/dialer` using the task-start skill loop.
- [x] read `AGENTS.md` and the full `CODING-STANDARDS.md` before editing.
- [x] copy these acceptance criteria into `.task/workpad.md` before coding.
- [x] reproduce the production `/api/v1/calls/parallel` 500 with an isolated HAR or controlled browser `fetch`.
- [x] prove whether the browser is running stale frontend code, stale `@consuelo/contacts` browser output, or a source-level bypass path.
- [x] inspect the deployed frontend bundle or source maps enough to confirm what `toE164()` implementation is actually shipped.
- [x] fix the confirmed cause only.
- [x] after fix, prove `customerNumbers` no longer includes `+1584143861603` in browser network output.
- [x] backend must return `400 Invalid customer phone number` if an invalid value reaches `/api/v1/calls/parallel`, not 500.
- [ ] confirm valid numbers still create a parallel group with `groupId`, `conferenceName`, `profileId`, and real twilio `callSid` values.
- [x] document the Apollo `OpportunitiesGroupByAggregates` warning separately; fix it only if investigation proves it blocks the dialer path.
- [ ] publish with `bun run task:push`, `bun run task:pr`, and `bun run task:finish`.

## plan

1. verify production state from railway and browser before changing code.
2. capture isolated `/api/v1/calls/parallel` evidence via har or current browser network history.
3. inspect deployed frontend assets and local build/package wiring to identify the executed `toE164()` implementation.
4. change only the confirmed broken runtime path.
5. run focused tests, review, and typecheck where feasible.
6. publish through task:push, task:pr, and task:finish.

## files changed

- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.ts`
- `packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts`

## key decisions

- production bundle `/assets/index-GQQedWUZ.js` contains the fixed runtime implementation: `normalizePhone` returns only valid parsed values and `toE164` returns `null` when validation fails. this disproves the stale frontend-bundle hypothesis for the currently served bundle.
- browser network history still has the old `+1584143861603` request from 2026-04-24 09:11:13 GMT, but isolated HAR after current deploy did not reproduce that bad number.
- isolated HAR after skip/no-answer reproduced a current 500 with `customerNumbers` `+17876240936` and `+12674638435`; railway logs show twilio denied the first destination by geo permissions.
- fix maps provider-denied/invalid customer-number failures to `400 Invalid customer phone number` instead of returning a generic 500.

## validation

- `yarn jest packages/twenty-server/src/engine/core-modules/consuelo-api/services/parallel.service.spec.ts --config=packages/twenty-server/jest.config.mjs --runInBand` passed: 15 tests.
- `npx tsc -p packages/contacts/tsconfig.json` passed.
- `yarn jest packages/contacts/src/utils.spec.ts --config=packages/contacts/jest.config.mjs --runInBand` passed: 22 tests.
- `yarn jest packages/twenty-front/src/modules/dialer/utils/__tests__/phoneFormat.test.ts --config=packages/twenty-front/jest.config.mjs --runInBand` passed: 3 tests.

## notes for ko

- production is source of truth for this task; current source alone is not proof of fix.
- current source and deployed frontend bundle both reject `584143861603` and `+1584143861603`; the remaining isolated production 500 was twilio geo-permission denial for `+17876240936`.
- Apollo `OpportunitiesGroupByAggregates`, duplicate fragment, and Actor cache warnings were observed separately and did not block the isolated `/api/v1/calls/parallel` POST.

## improvements noticed

- provider-denied customer destinations were previously treated as generic server failures even when the provider message clearly identified the customer phone number as the rejected input.

## errors i ran into

- `bun run task:fs` needs explicit disambiguation because there are multiple active tasks; i used the new task worktree path directly.
- `npx jest` initially failed to resolve `@nestjs/common`; running the suite through `yarn jest` used the workspace dependency resolution.
- `yarn install --immutable` failed during link step because `packages/cli/dist` was missing; no dependency changes were kept.
- `bun run review -- --changed` failed because the review script does not accept `--changed`; direct `bun run review` was blocked by the host safety layer before execution.

---

## publish checklist

```bash
bun run task:push -- --message "fix(dialer): stop deployed bad parallel phone payload" --changed
bun run task:pr
bun run task:finish
```
