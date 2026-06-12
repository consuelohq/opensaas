# fix hosted installer local cloud flow

branch: `task/os/fix-hosted-installer-local-cloud-flow`
stream: `stream/os`
task pr: https://github.com/consuelohq/opensaas/pull/987
started: 2026-06-12

## acceptance criteria

- Hosted `curl -fsSL https://install.consuelohq.com/os | bash` asks for `local` or `cloud` before downloading source or installing runtime dependencies.
- `cloud` opens `https://consuelohq.com/contact/` and exits without downloading source, installing dependencies, creating OS state, or launching the TypeScript onboarding UI.
- `local` proceeds with the existing dependency gate and installer flow.
- Installer labels are exactly `local` and `cloud`, with no parenthetical/hint text in the mode choices.
- Normal user onboarding exposes one current local path: enter the Consuelo workspace URL and short name. The fake manual-vs-browser activation split is removed.
- Normal installer code no longer links to `app.consuelohq.com/os/activate` or imports the device authorization helper as if the live approval endpoint exists.
- The hardcoded `internal.consuelohq.com` default is removed from user-facing install prompts.
- Release docs remain accurate: after merge, `bun run os:release-install` publishes the hosted Worker script.

## exploration

- Read `packages/workspace/SCRIPTS.md` release docs; `os:release-install` is the hosted Worker release surface.
- Read `packages/os/scripts/bootstrap.sh`; current dependency prompt runs before any local/cloud choice and always eventually downloads source.
- Read `packages/os/scripts/install.ts`; current mode labels are `local compute` / `cloud compute`, current auth choice offers manual URL or browser activation, and browser activation points at `https://app.consuelohq.com/os/activate`.
- Read `packages/os/scripts/onboarding-flow.test.ts` and `packages/os/tests/bootstrap-source.test.ts`; these are the nearby source-contract tests for installer UX and hosted bootstrap behavior.
- Context search had no relevant durable memory. Explore confirmed OS installer/edge context and nearest tests.

## Test-first contract

Behavior under test:
- Hosted shell path gates local/cloud before dependencies.
- Cloud path opens the website contact page and exits before download/install.
- Local path still uses one dependency gate and then TypeScript onboarding.
- TypeScript installer labels are exact `local` / `cloud` and no longer exposes the fake auth split or app activation URL.
- User workspace host prompt requires input and does not default to `internal.consuelohq.com`.

Existing pattern:
- `packages/os/tests/bootstrap-source.test.ts` string-tests hosted bootstrap shell behavior.
- `packages/os/scripts/onboarding-flow.test.ts` string-tests TypeScript onboarding UX/source contract.

Focused red command:
```bash
bun --cwd packages/os test tests/bootstrap-source.test.ts scripts/onboarding-flow.test.ts
```

Expected red failure:
- Current bootstrap lacks a pre-dependency local/cloud gate and contact handoff.
- Current install.ts still has `local compute`, `cloud compute`, auth choice, device authorization import, app activation URL, and `internal.consuelohq.com` default.

## implementation plan

1. Update source-contract tests first.
2. Patch `bootstrap.sh` to parse/choose `--mode local|cloud`, open contact, and exit before dependency work when cloud is selected.
3. Patch `install.ts` labels/options and remove activation split from normal user onboarding.
4. Run focused tests, shell syntax, dry-run smokes, review, verify.
5. Push to stream PR, then after merge publish hosted installer with `bun run os:release-install`.

- 2026-06-12 21:24:48 write: `.task/os/fix-hosted-installer-local-cloud-flow/workpad.md`

## files changed

- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/tests/bootstrap-source.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/tests/bootstrap-source.test.ts`

## workspace-owned: activity log

- 2026-06-12 21:24:48 fs.write: `.task/os/fix-hosted-installer-local-cloud-flow/workpad.md`
- 2026-06-12 21:25:06 write: `packages/os/tests/bootstrap-source.test.ts`
- 2026-06-12 21:25:06 fs.write: `packages/os/tests/bootstrap-source.test.ts`
- 2026-06-12 21:25:32 write: `packages/os/scripts/onboarding-flow.test.ts`
- 2026-06-12 21:25:32 fs.write: `packages/os/scripts/onboarding-flow.test.ts`
- 2026-06-12 21:34:58 fs.write: `.task/os/fix-hosted-installer-local-cloud-flow/workpad.md`

## workspace-owned: TDD red evidence

- 2026-06-12 21:25:57 `bun --cwd packages/os test tests/bootstrap-source.test.ts scripts/onboarding-flow.test.ts`: failed exit 1 trace: `trc_0e21b188ada0`
  - output: [39m bootstrap [33m=[39m [34mreadBootstrap[39m()[33m;[39m [90m 36| [39m [90m 37| [39m [34mexpect[39m(bootstrap)[33m.[39m[34mtoContain[39m([32m'handle_cloud_mode'[39m)[33m;[39m [90m | [39m [31m^[39m [90m 38| [39m expect(bootstrap).toContain('Consuelo cloud is handled by the Cons… [90m 39| [39m [34mexpect[39m(bootstrap)[33m.[39m[34mtoContain[39m([32m'exit 0'[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

## workspace-owned: files read

- `packages/os/scripts/bootstrap.sh`

## workspace-owned: TDD green evidence

- 2026-06-12 21:29:11 `bun --cwd packages/os test tests/bootstrap-source.test.ts scripts/onboarding-flow.test.ts`: passed exit 0 trace: `trc_41c87f875809`
  - output: → tmux: opensaas-os-fix-hosted-installer-local-cloud-flow-eec63822 $ vitest run tests/bootstrap-source.test.ts scripts/onboarding-flow.test.ts

## workspace-owned: validation evidence

- 2026-06-12 21:30:37 `checkFiles`: failed — COMMAND_FAILED
- 2026-06-12 21:31:00 `checkFiles`: passed — OK
- 2026-06-12 21:33:46 `review.run`: passed — OK
- 2026-06-12 21:34:16 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/fix-hosted-installer-local-cloud-flow/current.json`, `.task/os/fix-hosted-installer-local-cloud-flow/evidence-log.json`, `.task/os/fix-hosted-installer-local-cloud-flow/read-log.json`, `.task/os/fix-hosted-installer-local-cloud-flow/session.json`, `.task/os/fix-hosted-installer-local-cloud-flow/workpad.md`, `.task/tasks/os/fix-hosted-installer-local-cloud-flow.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/install.ts`, `packages/os/scripts/onboarding-flow.test.ts`, `packages/os/tests/bootstrap-source.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## final implementation notes

- Added hosted shell `--mode local|cloud` support.
- Hosted shell now asks for local or cloud before dependency setup.
- `cloud` opens `https://consuelohq.com/contact/`, marks dependency/onboarding/daemon work skipped, emits JSON summary when requested, and exits before Bun/source/dependency/install work.
- `local` continues through the existing dependency gate and onboarding flow.
- Hosted shell passes `--mode local` into `install.ts` so users do not get a second mode prompt in the TypeScript UI.
- `install.ts` mode labels are now exactly `local` and `cloud` for direct script use.
- Removed the fake manual-vs-browser activation choice from normal installer onboarding.
- Removed the device-authorization import and the `app.consuelohq.com/os/activate` activation URL from normal installer code.
- Removed the `internal.consuelohq.com` user-facing default and now validates empty workspace URL with `workspace URL is required`.

## validation evidence

- Red focused tests: `trc_0e21b188ada0` — failed on missing pre-dependency local/cloud shell choice, missing cloud exit path, fake activation split, old labels, and hardcoded internal default.
- Green focused tests: `trc_41c87f875809` — 2 files, 14 tests passed.
- Shell syntax: `trc_f9c6d8be92b3` — `bash -n packages/os/scripts/bootstrap.sh` passed.
- TS/source checks: `trc_f3fcdbc0187f` — install + source-contract TS files passed `node --check`.
- Correct package syntax command: `trc_631c813c299d` — `bun run --cwd packages/os typecheck` passed.
- Cloud dry-run smoke: `trc_bc36029b55c4` — `--mode cloud --json` exited before source/deps with `dependencyStatus=skipped`, `onboardingStatus=cloud_contact`, and contact URL dry-run output.
- Local dry-run smoke: `trc_b66161216989` — `--mode local --json` continued through source/dependency/onboarding dry-run.
- Installer manual workspace dry-run: `trc_fb3558440620` — `--workspace-url user.consuelohq.com --workspace-slug user` persisted workspaceHost/workspaceSlug and no activation field.
- Whitespace diff: `trc_39d87904b2d1` — `git diff --check` passed.
- Review: `trc_c785574f291d` — 0 issues, 0 blockers.
- Verify: `trc_63f4b9ce46a3` — publish-valid true. Automatic selector chose 0 suites, but manual focused tests above are the test evidence.

## files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/tests/bootstrap-source.test.ts`

## release note

After this lands in `main`, run:

```bash
bun run os:release-install
```

Then verify the live hosted shell no longer contains the old activation URL or hardcoded internal default.

- 2026-06-12 21:34:58 append: `.task/os/fix-hosted-installer-local-cloud-flow/workpad.md`
