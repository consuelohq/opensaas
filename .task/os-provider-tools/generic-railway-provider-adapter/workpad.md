# generic Railway provider adapter

branch: `task/os-provider-tools/generic-railway-provider-adapter`
stream: `stream/os-provider-tools`
base SHA: `11e1e998178b397148f5456bf3a7b2c7d636d958`
task session: `tsk_c056419bddd5`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1589/generic-railway-provider-adapter
github pr: https://github.com/consuelohq/opensaas/pull/1589
started: 2026-07-23

## acceptance criteria

- [x] Implement a generic Railway adapter on the Worker 08 provider core in the canonical `packages/os/tools/<domain>` package layout.
- [x] Detect Railway CLI/version and report authentication state through supported CLI behavior without exposing a token.
- [x] Inspect the linked project/environment/workspace and return clear unlinked-directory guidance.
- [x] List services and deployments without Consuelo-specific defaults.
- [x] Read bounded runtime/build logs with structured filters and truncation metadata.
- [x] Report deployment status and redeploy an explicitly selected service with approval and optional bounded wait.
- [x] List variable names/scopes and support approved set/delete operations without returning secret values.
- [x] Use argv-based execution and reject unsafe/injection-shaped service/filter input.
- [x] Map provider command failures into the shared typed provider errors and preserve JSON/quiet behavior through provider core.
- [x] Replace or migrate the Railway-owned legacy log/redeploy scripts without editing central manifests.
- [x] Prove missing CLI, unauthenticated, unlinked, multiple-service, filtering/truncation, build/runtime, approval/wait, error mapping, injection resistance, secret redaction, and no-hard-coded-identifier behavior with tests.
- [x] Record exact CLI commands, unsupported capabilities, and Worker 12 manifest publication guidance.
- [ ] Pass focused tests, broader OS validation, CodeRabbit review, Grok 4.5 review, and disposition every substantive finding on GitHub.
- [ ] Merge task PR #1589 into `stream/os-provider-tools` only; do not promote the stream to `main`.

## plan

1. Map Worker 08 provider-core contracts, canonical tool-package patterns, legacy Railway scripts, tests, and manifest routing without editing production code.
2. Record the exact test-first contract, add adapter behavioral tests, and run the focused test red.
3. Implement the smallest Railway adapter and Railway-owned script migration needed to satisfy the contract, using structured CLI output and argv execution.
4. Run focused green tests, provider/core regressions, static checks, workspace review, and full verify against `origin/stream/os-provider-tools`.
5. Push the independently reviewable task PR, request and disposition CodeRabbit, render/run/post the required Grok review, remove temporary review files, then merge only the task PR into the assigned stream.

## Test-first contract

- Behavior under test: Railway capabilities operate only through a caller-supplied authenticated CLI context, return provider-core envelopes/errors, never assume Consuelo resources, never compose a shell command from user input, and never expose variable values or tokens.
- Existing local pattern to follow: Worker 08 Effect provider service, command-runner test doubles, canonical tool-package handler/schema/test organization, and current OS Vitest conventions.
- New or changed tests: Railway adapter handler/service tests plus targeted characterization of legacy Railway entrypoints where migration requires compatibility.
- Focused red command: `bun run --cwd packages/os test -- tools/railway/handler.test.ts`.
- Expected red failure: missing Railway adapter package/operations and/or legacy behavior still contains internal defaults and unsafe token/API paths.
- Observed red: Vitest failed before collection because `packages/os/tools/railway/adapter.ts` does not exist (`trc_b7738c03c844`). This is the intended pre-implementation failure.
- No-test waiver: none; this is a behavior and security boundary change.

## current status

- Required plan, environment registry, Worker 09 brief, Worker 26 layout contract, Grok template, repository rules, OS senior-engineer/task skills, Railway skill, and full `packages/os/SCRIPTS.md` have been read.
- Worker 08 is integrated in `stream/os-provider-tools`; stream was synchronized with `main` and pushed before task creation.
- Implementation is complete and the focused contract is green. The canonical Railway package uses only structured CLI output and argv execution; the legacy scripts are thin compatibility entrypoints.
- The provider core now supports provider-neutral service listing, variable deletion, richer bounded-log inputs/metadata, typed invalid input, custom actionable provider errors, and suppression of sensitive command output from diagnostics.
- Public tool publication remains intentionally empty in the Railway package; Worker 12 owns manifest registration and public tool routes.
- CodeRabbit, Grok, CI, final dispositions, and merge remain.

## files changed

- `.task/os-provider-tools/generic-railway-provider-adapter/workpad.md`
- `package.json`
- `packages/os/package.json`
- `packages/os/scripts/railway-logs.js`
- `packages/os/scripts/railway-redeploy.js`
- `packages/os/tools/deployment-provider/errors.ts`
- `packages/os/tools/deployment-provider/schema.ts`
- `packages/os/tools/deployment-provider/service.ts`
- `packages/os/tools/deployment-provider/testing.ts`
- `packages/os/tools/deployment-provider/types.ts`
- `packages/os/tools/railway/README.md`
- `packages/os/tools/railway/adapter.ts`
- `packages/os/tools/railway/cli.ts`
- `packages/os/tools/railway/handler.test.ts`
- `packages/os/tools/railway/handler.ts`
- `packages/os/tools/railway/manifest.ts`
- `packages/os/tools/railway/README.md`
- `packages/os/tools/railway/schema.ts`
- `packages/os/tools/railway/service.ts`
- `packages/workspace/scripts/railway-logs.js`
- `packages/workspace/scripts/railway-redeploy.js`

## workspace-owned: files changed

- `.task/os-provider-tools/generic-railway-provider-adapter/workpad.md`
- `packages/os/scripts/railway-logs.js`
- `packages/os/scripts/railway-redeploy.js`
- `packages/os/tools/railway/adapter.ts`
- `packages/os/tools/railway/cli.ts`
- `packages/os/tools/railway/handler.test.ts`
- `packages/os/tools/railway/handler.ts`
- `packages/os/tools/railway/manifest.ts`
- `packages/os/tools/railway/README.md`
- `packages/os/tools/railway/schema.ts`
- `packages/os/tools/railway/service.ts`
- `packages/workspace/scripts/railway-logs.js`
- `packages/workspace/scripts/railway-redeploy.js`

## workspace-owned: activity log

- 2026-07-23 15:41:45 fs.write: `.task/os-provider-tools/generic-railway-provider-adapter/workpad.md`
- 2026-07-23 15:47:40 fs.write: `packages/os/tools/railway/handler.test.ts`
- 2026-07-23 15:49:33 fs.write: `packages/os/tools/railway/adapter.ts`
- 2026-07-23 15:50:01 fs.write: `packages/os/tools/railway/service.ts`
- 2026-07-23 15:50:37 fs.write: `packages/os/tools/railway/cli.ts`
- 2026-07-23 15:50:44 fs.write: `packages/os/tools/railway/handler.ts`
- 2026-07-23 15:50:47 fs.write: `packages/os/tools/railway/schema.ts`
- 2026-07-23 15:50:50 fs.write: `packages/os/tools/railway/manifest.ts`
- 2026-07-23 15:50:56 fs.write: `packages/os/scripts/railway-logs.js`
- 2026-07-23 15:51:02 fs.write: `packages/os/scripts/railway-redeploy.js`
- 2026-07-23 15:51:14 fs.write: `packages/workspace/scripts/railway-logs.js`
- 2026-07-23 15:51:22 fs.write: `packages/workspace/scripts/railway-redeploy.js`
- 2026-07-23 16:02:07 fs.write: `packages/os/tools/railway/README.md`
- Task tooling updates this section automatically when available.

## workspace-owned: validation evidence

- Task tooling updates this section automatically when available.
- 2026-07-23 15:55:21 `review.run`: passed — OK
- 2026-07-23 16:01:43 `review.run`: passed — OK
- Focused red: `bun run --cwd packages/os test -- tools/railway/handler.test.ts` failed on the missing adapter import as designed (`trc_b7738c03c844`).
- Focused green: 23/23 Railway tests passed (`trc_b44c50324bf8`).
- Hardened provider regression: 51/51 deployment-provider and Railway tests passed (`trc_2d00e0fa033f`).
- Standard OS syntax check and both compatibility-wrapper help paths passed with the provider regressions (`trc_de625d1ede74`).
- Strict scoped review against `origin/stream/os-provider-tools` passed static rules, ESLint, repository typecheck, and spec compliance with zero issues (`trc_2920b9888dc3`, `trc_eadc9bbb3fe7`).
- Direct strict TypeScript compilation initially found one Worker 09 `detect` indexing issue plus unchanged strict-baseline diagnostics (`trc_51c0ff7fa2c6`). The Worker 09 issue was fixed; rerun reported only unchanged baseline diagnostics in `scripts/lib/redaction.ts` and `deployment-provider/process.ts` (`trc_18ced5a782c3`).
- Complete OS Vitest run was attempted. It produced 1688 passes, 132 skips, 10 todos, and 64 failures across unrelated trace, lifecycle, installer, facade, and inventory suites; it also attempted to rewrite a facade snapshot in read mode (`trc_03fbccc975a2`). The snapshot was restored through `fs.apply_patch` and verified clean (`trc_f3dc0d259893`, `trc_e371d41374d6`). No failure referenced the Railway package or changed provider-core tests.

## key decisions

- Start from the synchronized provider stream because Worker 09 depends on Worker 08's unshipped provider-core work.
- Keep all provider execution argv-based; no shell-string interpolation and no direct read of Railway private token/config files.
- Treat Railway CLI structured output as the capability boundary. Any capability not supportable through the CLI will be documented rather than implemented via hidden token extraction or private GraphQL.
- Do not edit central generated/source manifests; Worker 12 owns integration.
- Add only provider-neutral gaps that the Railway, Vercel, and Cloudflare adapters share: service listing, variable deletion, richer log metadata/input, input-safe errors, and sensitive-output diagnostics.
- Support Railway CLI major versions 4 and 5. Variable deletion uses the modern `railway variable delete` command; older CLI unknown-subcommand output fails closed as `UNSUPPORTED_CAPABILITY` rather than extracting a token or calling a private API.
- Preserve the legacy command names, JSON/quiet behavior, build/runtime filters, environment-name presence check, and bounded redeploy wait while removing internal service defaults and browser/private-API fallbacks.

## notes for ko

- No real Mac lifecycle operation will be run. This task is source/test work only.
- Final merge target is `stream/os-provider-tools`; the stream will not be promoted to `main` by this worker.
- Human live validation is documented in `packages/os/tools/railway/README.md`. It requires an already-linked disposable project and explicit approval before the redeploy command.

## improvements noticed

- None yet.

## issues and recovery

- Initial required-file reads via `fs.read` failed because multiple active worktrees made ambient selection ambiguous (`trc_f589e991e4b3`, `trc_bb192508a1eb`). A branch-qualified retry also failed because `main` is not an active task (`trc_a8b54183c614`). Recovery: used OS `code.call` in read mode, scoped to the main repository, to read the mandatory pre-task files without using native filesystem or shell fallbacks.
- First `task.start` input used an invalid boolean `github` field and a full branch in `startFrom`; validation rejected it (`trc_923fe7397f13`). Recovery: retried with `startFrom: "stream"`, creating task session `tsk_c056419bddd5` successfully (`trc_e51f13ae0c65`).
- A discovery `batch` call accepted the outer task session but did not propagate it to nested filesystem steps (`trc_fdc350eddb3a`; nested failures `trc_a3dd6b3b5866`, `trc_d945e3ef77f5`, `trc_e9851754d57a`, `trc_8264073e5ddf`). Recovery: switched to direct task-scoped filesystem calls; all subsequent repository reads succeeded.
- The first test-file write failed because the new canonical package directory did not exist and `fs.write` requires `mkdirs: true` (`trc_2844d62ac8a3`). Recovery: retried with `mkdirs: true`; the test file was written successfully (`trc_dfa25924f6ef`).
- The first package-script patch used an outdated `packages/os/package.json` command anchor and failed (`trc_8040eced73be`). Recovery: searched the exact current anchors and applied the narrower patch successfully (`trc_bd76abc00733`).
- `task.status` is not exposed by the current OS tool manifest (403). Recovery: used supported `git.diff`, `review.run`, and task lifecycle routes instead; no repository fallback was used.
- An empty-path `fs.list` request failed schema validation (`trc_93479bc6726d`). Recovery: retried with `path: "."` (`trc_a1c73d005de7`).
- Direct TypeScript compilation with `--types bun` failed because the repository does not install a Bun type library (`trc_1138d09950b3`). Recovery: used installed Node types, fixed the only Worker 09 diagnostic, and documented the unchanged strict-baseline diagnostics.
- Two discovery searches named nonexistent optional paths (`bun.lock` and `types`) and failed (`trc_c5b5d391ac38`, `trc_8375d5c85b79`). Recovery: repeated each search against existing repository paths (`trc_1fb680c736cb`, `trc_a6ba0b85ca07`).
- The full OS test command was launched through read-mode `code.call`; Vitest attempted to update a facade snapshot, so OS correctly failed the route as a read-mode mutation (`trc_03fbccc975a2`). Recovery: restored the exact snapshot patch through task-scoped `fs.apply_patch`, verified no residual diff, and retained the full failure inventory as baseline evidence.
- A broad `review.run --all` attempt exceeded the facade timeout and returned no result. Recovery: reran supported scoped strict review, which completed successfully with zero issues (`trc_eadc9bbb3fe7`).

---

## publish checklist

- [x] focused red recorded
- [x] focused green recorded
- [x] scoped broader validation passes against `origin/stream/os-provider-tools`; unrelated full-suite baseline failures are recorded
- [ ] task PR updated and CodeRabbit requested/dispositioned
- [ ] Grok prompt rendered, review posted, findings dispositioned, temp files removed
- [ ] task PR merged into `stream/os-provider-tools`
- [ ] stream not promoted to `main`

- 2026-07-23 15:41:45 write: `.task/os-provider-tools/generic-railway-provider-adapter/workpad.md`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/plans/consuelo-os-foundation/workers/08-provider-core.md`
- `packages/os/tools/deployment-provider/service.ts`
- `packages/os/tools/package.ts`

- 2026-07-23 16:02:07 write: `packages/os/tools/railway/README.md`

- 2026-07-23 16:02:29 apply-patch: `.task/os-provider-tools/generic-railway-provider-adapter/workpad.md`