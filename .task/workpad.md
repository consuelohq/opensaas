# diagnose call queue not dialing

branch: `task/dialer/diagnose-call-queue-not-dialing`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/248
started: 2026-05-01

## acceptance criteria

- [ ] Reproduce the Start Dialer request chain enough to name the exact first stop/failure.
- [ ] Verify `/v1/voice/status` behavior and whether `workspace_phone_numbers` is still the blocking production error.
- [ ] Patch only the first proven blocker.
- [ ] Add or update focused backend/frontend coverage for the patched path where feasible.
- [ ] Run focused validation plus workspace review or document the blocker.
- [ ] Publish through `task.push`, `task.pr`, and `task.finish`.

## plan

1. Check production/runtime evidence for `/v1/voice/status` and queue/call errors.
2. Run the decision-engine loop and read the highest-value files before editing.
3. Prove the first blocker from logs/API/code path.
4. Implement the simplest correct fix in the proven file path.
5. Add targeted coverage or document why coverage is blocked.
6. Validate, self-review, push, and update the PR.

## files changed

-

## key decisions

- The handoff identifies `/v1/voice/status` failing on missing `workspace_phone_numbers` as the highest-probability blocker; live evidence must confirm before editing.

## notes for ko

- Handoff input is the uploaded markdown titled "Dialer queue starts but no outbound calls".

## improvements noticed

-

## errors i ran into

- First workpad overwrite failed because the file already existed; reran with force.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-01 01:12:25 write: `.task/workpad.md`
- 2026-05-01 01:35:00 patch lines 649-652: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.ts`
- 2026-05-01 01:35:08 patch lines 647-653: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.ts`
- 2026-05-01 01:35:24 patch lines 642-650: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.ts`
- 2026-05-01 01:35:49 patch lines 690-692: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.ts`
- 2026-05-01 01:36:17 patch lines 968-987: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.ts`
- 2026-05-01 01:36:28 patch lines 966-995: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.ts`
- 2026-05-01 01:38:58 patch lines 1-2: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.spec.ts`
## implementation notes

- Patched queue selection to check whether contact_attempt_ledger exists before running the ledger join. Missing table now goes straight to FIFO fallback and can still claim the next pending item as calling.
- Removed Sentry reporting for expected contact_attempt_ledger compatibility fallbacks in queue selection and queue item claiming.
- Patched workspace phone-number storage catches to avoid reporting the expected missing workspace_phone_numbers relation before the existing voice status route raw fallback handles it.
- Added focused coverage for missing workspace_phone_numbers Sentry suppression and missing contact_attempt_ledger FIFO queue claiming.

## validation

- passed: npx jest packages/api/src/services/workspace-phone-numbers.spec.ts --config=packages/api/jest.config.mjs --runInBand, using NODE_PATH for root dependencies after worktree node_modules cleanup.
- passed: npx jest packages/twenty-server/src/engine/core-modules/consuelo-api/services/queues.service.spec.ts --config=packages/twenty-server/jest.config.mjs --runInBand, using a temporary node_modules symlink for SWC plugin resolution and removing it after the test.
- passed: npx prettier --write on changed source and spec files.
- passed: git diff --check.
- passed: workspace checkFiles on changed source and spec files.
- blocked: workspace review.run with base stream/dialer and noTests timed out before returning a structured result.

## runtime note

- Direct authenticated voice status probing from task exec was blocked by Cloudflare 1010 on sign-in, so the live browser request chain still needs final manual verification after deploy. Sentry handoff evidence drove the patch target.

- 2026-05-01 01:48:32 append: `.task/workpad.md`