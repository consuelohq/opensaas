# rd8 remove lockfile trigger with local phone normalization

branch: `task/dialer/rd8-remove-lockfile-trigger-with-local-phone-normalization`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2481/rd8-remove-lockfile-trigger-with-local-phone-normalization
github pr: https://github.com/consuelohq/opensaas/pull/2481
started: 2026-09-14

## acceptance criteria

- [x] Preserve callback admission for formatted 10-digit US numbers and 11-digit leading-1 numbers.
- [x] Preserve syntactically valid international E.164 normalization and reject implausible lengths.
- [x] Remove both `@consuelo/contacts` and `libphonenumber-js` from the Dialer Server runtime boundary.
- [ ] Promote a final stream state where `yarn.lock` no longer differs from `main`, so unrelated Twenty Server CI is not selected by this RD8 repair.
- [ ] Re-run review/verify, merge the task into `stream/dialer`, then finish stream PR #2436 only after current CI/review/ancestry are green.

## plan

1. Lock the no-extra-runtime-dependency behavior with focused tests and prove RED.
2. Replace the package dependency with the smallest route-local normalizer and regenerate the lockfile.
3. Prove focused tests, package tests/typecheck/build, review, and canonical verify.
4. Publish PR #2481 into `stream/dialer`, confirm the stream PR no longer contains a `yarn.lock` delta, refresh #2436 against current `main`, and merge only when current required checks/reviews are clean.

## current status

- Focused RED and GREEN are complete. The local task diff removes `libphonenumber-js` from Dialer Server and removes its one-line lockfile entry relative to the current stream.
- On 2026-09-19, PR #2481 remains open/clean and its old bootstrap CI is green; stream PR #2436 remains open at `afb419c10bf3ef5977ed9dabb9102557539c028f` with the nine known unrelated CI Server failures from 2026-09-14. No new stream commits landed while this chat was paused.
- Before publish, rerun the current task validation because the worktree and installed dependencies were stale after five days.

## files changed

- `packages/dialer-server/package.json`
- `packages/dialer-server/src/architecture.test.ts`
- `packages/dialer-server/src/routes/inbound-customer.test.ts`
- `packages/dialer-server/src/routes/inbound-customer.ts`
- `yarn.lock`

## workspace-owned: files changed

- `packages/dialer-server/package.json`
- `packages/dialer-server/src/architecture.test.ts`
- `packages/dialer-server/src/routes/inbound-customer.test.ts`
- `packages/dialer-server/src/routes/inbound-customer.ts`
- `yarn.lock`

## workspace-owned: activity log

- 2026-09-14 15:35:09 fs.write: `.task/dialer/rd8-remove-lockfile-trigger-with-local-phone-normalization/workpad.md`
- 2026-09-14 15:35:51 fs.write: `.task/dialer/rd8-remove-lockfile-trigger-with-local-phone-normalization/workpad.md`
- 2026-09-19 14:23:22 fs.write: `.task/dialer/rd8-remove-lockfile-trigger-with-local-phone-normalization/workpad.md`
- 2026-09-19 14:25:06 fs.write: `.task/dialer/rd8-remove-lockfile-trigger-with-local-phone-normalization/workpad.md`
- 2026-09-19 14:25:31 fs.write: `.task/dialer/rd8-remove-lockfile-trigger-with-local-phone-normalization/workpad.md`

## workspace-owned: validation evidence

- 2026-09-19 14:24:17 `review.run`: passed — OK
- 2026-09-19 14:24:37 `verify`: passed — OK
- 2026-09-19 14:25:23 `verify`: passed — OK

## key decisions

- Do not modify broad CI workflows or Twenty Server to accommodate an RD8-only dependency. The eight CI Server shard failures are outside the Dialer change surface and were selected only because the stream currently changes `yarn.lock`.
- Keep phone normalization local to the public callback route. This avoids depending on an unbuilt workspace package in fresh CI and avoids adding another root lockfile dependency.

## notes for ko

- The decisive Linux Dialer CI failure from 2026-09-14 was already fixed: `Consuelo / dialer` completed successfully, including release package tests and Railway container build. The remaining stream failures were all Twenty Server setup failures selected through `yarn.lock`.

## improvements noticed

- none yet

## issues and recovery

- 2026-09-19 resume: the stale task worktree had lost its disposable `node_modules` symlink, causing task-local `fs.read` to fail on missing `yaml`/`sqlite-vec`. Restored `node_modules` and `packages/workspace/node_modules` as untracked symlinks to `/Users/kokayi/Dev/opensaas`; no repository source changed. Traces: `trc_7b761c1a7282`, `trc_99d247bc0905`, `trc_14c15bf19f81`.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: Dialer Server must normalize supported customer callback numbers without depending on another workspace package or adding a root lockfile dependency that causes unrelated Twenty Server CI selection. Accept standard 10-digit US formatting, normalize 11-digit leading-1 input, preserve syntactically valid international E.164 input, and reject malformed/implausible lengths.
existing local pattern: `packages/dialer-server/src/routes/inbound-customer.ts` owns a small route-local `normalizePhone` boundary and `packages/dialer-server/src/architecture.test.ts` locks direct dependency constraints.
new or changed tests: architecture must require both `@consuelo/contacts` and `libphonenumber-js` to be absent from Dialer Server dependencies/imports; route tests retain the formatted domestic regression and add international E.164 / invalid-length coverage if absent.
focused red command: `bun test packages/dialer-server/src/architecture.test.ts packages/dialer-server/src/routes/inbound-customer.test.ts`
expected red failure: architecture currently requires/directly imports `libphonenumber-js`, so the no-extra-runtime-dependency contract fails before implementation.
no-test waiver: not applicable.

Release motivation: PR #2436 changes no `packages/twenty-server/**` or `packages/logger/**` files. Full PR inspection showed `yarn.lock` is the only root/server-selection path, and its entire patch is the single `libphonenumber-js` dependency line in Dialer Server (GitHub trace `trc_45c62e39f60b`). CI Server's 8 shard failures are unrelated baseline setup errors (`@consuelo/logger` unbuilt; `FILE_PREVIEW` seed mapping), so restoring lockfile parity removes the accidental trigger rather than masking a branch-owned failure.

Tooling note: this fresh task worktree was missing untracked `packages/workspace/node_modules/sqlite-vec`, so the first typed workpad write failed (trace `trc_96846b304381`). A task-local untracked symlink to the already-installed module in the prior RD8 worktree restored the workspace fs helper (trace `trc_085c6b2de9aa`); no repository source was changed by that tooling repair.

- 2026-09-14 15:35:09 append: `.task/dialer/rd8-remove-lockfile-trigger-with-local-phone-normalization/workpad.md`

## workspace-owned: files read

- `packages/dialer-server/package.json`
- `packages/dialer-server/src/architecture.test.ts`
- `packages/dialer-server/src/routes/inbound-customer.test.ts`
- `packages/dialer-server/src/routes/inbound-customer.ts`

- 2026-09-19 14:20:17 apply-patch: `.task/dialer/rd8-remove-lockfile-trigger-with-local-phone-normalization/workpad.md`

## validation evidence — 2026-09-19 resume

- Focused callback/architecture contracts: 8/8 pass, 247 assertions (`trc_340532e6beb4`; same run continued into broader validation).
- Full Dialer Server suite: 202 pass / 57 intentional service-backed skips / 0 fail, 1,118 assertions (`trc_340532e6beb4`).
- Dialer Server typecheck: pass (`trc_340532e6beb4`).
- Dialer Server compiled build: pass, 2,953 modules bundled (`trc_340532e6beb4`).
- First immutable-lock attempt used the wrong Yarn mode spelling; second attempt confirmed repo config forbids `--immutable` with lockfile-only update mode. Neither changed files (`trc_1e9ae204343e`).
- Canonical lockfile-only resolver rerun completed successfully and left `yarn.lock` byte-for-byte unchanged: SHA-256 `90a3367e87080b6d68b33b7898a0ceca7a0d2c8e18a7e78086ad9cadab99457a` before and after (`trc_d3bf4d6af7b0`).

- 2026-09-19 14:23:22 append: `.task/dialer/rd8-remove-lockfile-trigger-with-local-phone-normalization/workpad.md`

- Yarn temporarily flipped `packages/cli/bin/consuelo.js` and `packages/twenty-sdk/bin/twenty.mjs` from mode 100644 to 100755 with no content changes (`trc_74dc9498f791`). Reverted only those mode bits before publish (`trc_6969a2fea111`); typed filesystem tooling does not expose chmod, so this used the smallest task-local shell fallback.

- 2026-09-19 14:25:06 append: `.task/dialer/rd8-remove-lockfile-trigger-with-local-phone-normalization/workpad.md`

- Final canonical verify after reverting accidental mode drift: pass / publishValid=true, exact changed product set = Dialer Server package + architecture test + customer route test + customer route + `yarn.lock`; review 0 findings, DB 0 risks (`trc_3455e702928e`).

- 2026-09-19 14:25:31 append: `.task/dialer/rd8-remove-lockfile-trigger-with-local-phone-normalization/workpad.md`
