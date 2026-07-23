# Effect-based deployment provider core

branch: `task/os-provider-tools/effect-based-deployment-provider-core`
stream: `stream/os-provider-tools`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1582/effect-based-deployment-provider-core
github pr: https://github.com/consuelohq/opensaas/pull/1582
started: 2026-07-23
source: fresh `main` at `05cb010a14f5ea130ff87350da2b34db1a3ae5eb`
task session: `tsk_f8724b5cbfc8`
execution node: Mac Mini dev lane (environment registry)
task-start trace: `trc_9a5344a7c2ff`

## acceptance criteria

- [x] Add a provider-neutral Effect service under the canonical `packages/os/tools/<domain>/` package boundary.
- [x] Model explicit capabilities and typed operations for detection, auth, context, projects, deployments, logs, deploy/redeploy, environment metadata, and raw escape-hatch execution.
- [x] Provide the full typed provider error taxonomy required by Worker 08.
- [x] Execute provider CLIs through bounded argv-based spawning with preserved arguments, PATH normalization, timeout/cancellation, and secret-safe diagnostics.
- [x] Normalize authentication without reading provider token files or returning secret values.
- [x] Return environment variable names, scope, and presence only; never values.
- [x] Attach explicit approval/consequence metadata to mutating operations.
- [x] Add shared deterministic fake CLI/provider fixtures; do not implement Railway, Vercel, or Cloudflare adapters.
- [ ] Prove all required behavior with focused tests, then run broader OS validation, workspace review, and verify gates.
- [ ] Request CodeRabbit and Grok 4.5 reviews, post all durable findings/dispositions to PR #1582, and merge only into `stream/os-provider-tools`.

## plan

1. Investigate current canonical tool packages, Effect service conventions, safe process execution, PATH augmentation, approval metadata, redaction, and Railway legacy risks.
2. Record the exact test-first contract and write focused failing behavioral tests before production code.
3. Implement the smallest provider-core package and fake fixtures that satisfy the behavioral contract without central-manifest or provider-adapter changes.
4. Run focused green tests, type/static checks, relevant OS suites, workspace review, and verify against `origin/main`.
5. Push PR #1582, request CodeRabbit, render/run the required Grok review, fix valid findings, post dispositions, remove temporary review artifacts, and merge the task PR into the assigned stream.

## Test-first contract

- Behavior under test: provider CLI/version detection, interactive and launchd-like PATH resolution, CLI-only auth normalization, explicit capability failures, argv preservation, timeout and cancellation, secret-safe diagnostics, environment-name-only output, and approval/consequence metadata before mutations.
- Existing local pattern to follow: canonical `packages/os/tools/<domain>/{manifest,handler,schema,handler.test}.ts` layout; Effect programs and typed `Data.TaggedError` failures; argv-based child-process execution with process-tree cleanup.
- New or changed tests: `packages/os/tools/deployment-provider/handler.test.ts` plus a shared deterministic fake process/adapter fixture exposed by the package.
- Focused red command: `bun run --cwd packages/os test -- tools/deployment-provider/handler.test.ts`.
- Expected red failure: the test imports the not-yet-created deployment-provider service, process, errors, schema, and testing modules.
- No-test waiver: none; this is a behavioral architecture task and requires TDD.

## current status

- Provider-neutral core implementation is complete and focused tests are green.
- Focused red test: `trc_280fd259e415` failed because `./errors` and the remaining provider-core modules did not exist.
- Focused green test: `trc_b69c31406eb8` (11/11); hardened suite: `trc_636408f8d416` (17 provider tests + 3 package-layout tests).
- Targeted provider, canonical package, runtime-bundle closure, lint, TypeScript, syntax, and generated-manifest drift gates are green.
- CodeRabbit, Grok, durable review dispositions, and stream-only merge remain.

## files changed

- `packages/os/tools/deployment-provider/service.ts`
- `packages/os/tools/deployment-provider/handler.test.ts`


## workspace-owned: files changed

- `.task/os-provider-tools/effect-based-deployment-provider-core/*`
- `.task/os-provider-tools/effect-based-deployment-provider-core/workpad.md`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tools/deployment-provider/{manifest,handler}.ts`
- `packages/os/tools/deployment-provider/errors.ts`
- `packages/os/tools/deployment-provider/handler.test.ts`
- `packages/os/tools/deployment-provider/process.ts`
- `packages/os/tools/deployment-provider/redaction.ts`
- `packages/os/tools/deployment-provider/schema.ts`
- `packages/os/tools/deployment-provider/service.ts`
- `packages/os/tools/deployment-provider/testing.ts`
- `packages/os/tools/deployment-provider/types.ts`

## workspace-owned: activity log

- 2026-07-23 02:53:10 fs.write: `.task/os-provider-tools/effect-based-deployment-provider-core/workpad.md`
- 2026-07-23 02:57:22 fs.write: `packages/os/tools/deployment-provider/handler.test.ts`
- 2026-07-23 03:10:52 fs.write: `packages/os/tools/deployment-provider/types.ts`

## workspace-owned: validation evidence

- Focused red: `bun run --cwd packages/os test -- tools/deployment-provider/handler.test.ts` -> expected missing-module failure (`trc_280fd259e415`).
- Focused green: same command -> 11/11 (`trc_b69c31406eb8`).
- Hardened focused + canonical layout: 20/20 (`trc_636408f8d416`).
- ESLint focused package: green, with only pre-existing Nx project-graph warnings (`trc_636408f8d416`).
- Focused TypeScript compile with available Node types: green (`trc_dcd5db9faf70`, repeated in `trc_636408f8d416`).
- `packages/os` syntax/typecheck: green (`trc_d32c9b54d4df`).
- Runtime-bundle classification red: `trc_95070acce7af` failed on `service.ts` and the real closure rejected `errors.ts`.
- Runtime-bundle classification green: 16/16 (`trc_cff0bf856ab3`); combined authoritative targeted suite 37/37, provider ESLint, focused TypeScript, and OS syntax all green (`trc_e62b452f4e8e`).
- Generated full/core manifests current: `bun run --cwd packages/os generate-tool-manifest:check` (`trc_2e442256dffb`).
- Compile-time typed operation contract red: `trc_1fef17b3c190`; green after generic input/output maps: `trc_f7dd606dc686`.
- Intermediate generic-map compile failures were narrowed and repaired in `trc_fc5ba0cf2528`; final typed facade and fake-adapter compile passed in `trc_f7dd606dc686`.
- Final targeted suite before Grok fixes: 37/37, provider ESLint, typed test compile, OS syntax, and manifest drift all green (`trc_538ddaacc979`).
- Workspace review first found two `CATCH_TYPING` findings (`trc_e790ac428cb7`); both fixed (`trc_2a8846112f67`) and focused validation reran green (`trc_d1df01d1e582`).
- Final workspace review: zero findings (`trc_2a6d67343839`).
- Final verify against `origin/main`: passed and publish-valid (`trc_f1d7f2698758`).
- 2026-07-23 03:08:34 `review.run`: passed — OK
- 2026-07-23 03:09:03 `review.run`: passed — OK
- 2026-07-23 03:09:16 `verify`: passed — OK
- 2026-07-23 03:11:58 `review.run`: passed — OK
- 2026-07-23 03:12:07 `verify`: passed — OK
- 2026-07-23 03:38:15 `review.run`: passed — OK
- 2026-07-23 03:38:24 `verify`: passed — OK

## key decisions

- Use the exact assigned stream `stream/os-provider-tools`; do not substitute an existing stream.
- Stay inside provider-neutral core ownership; later workers own Railway, Vercel, Cloudflare adapters and central manifest integration.
- Use fake CLI/provider fixtures for deterministic behavior and security tests; no real provider credentials or calls.

## notes for ko

- No install, update, reset, restart, or uninstall action will be run on either real Mac.

## improvements noticed

- The live generated `task.start` manifest on `main` omitted the supported `createStream -> --create-stream` argument even though the schema and tool search advertised it. The exact assigned branch was created through the OS GitHub facade, then normal `task.start` succeeded.
- `batch` and `status` did not honor the top-level task session in this run; direct task-scoped filesystem calls route correctly. Product work will use direct scoped calls unless that route is repaired outside this worker's ownership.

## issues and recovery

- Initial pre-task `fs.read` failed with `AMBIGUOUS_TASK_SELECTION` (`trc_f956cb1fc309` / child `trc_35577ec3251d`). A branch-qualified retry failed because no active task existed for `main` (`trc_d0c13eeddddc` / child `trc_f8d62278d90f`). Recovered with bounded OS `code.call` read mode on local fresh `main`; required files were then read fully in line ranges.
- First `task.start` failed because remote `stream/os-provider-tools` did not exist (`trc_fcbea384ebc4`). Retrying with `createStream: true` failed identically (`trc_ab6b88e2ce9d`) because the live generated task manifest omitted the flag mapping, despite the schema/catalog advertising it. Diagnosed via `tools.search`, `explore`, live manifest, facade, and task-start script reads (`trc_9662d63ef95b`, `trc_92b655c7537e`, `trc_acdb0ebcaa4c`). Recovered through the OS GitHub facade by creating the exact assigned stream at current `main` SHA (`trc_7417e70b0fd1`, `trc_8468f93c56f9`), then `task.start` succeeded (`trc_9a5344a7c2ff`).
- A task-scoped discovery `batch` failed to propagate `taskSession` to child calls and stopped after inspecting root `main` (`trc_30df274536e6`, child `trc_849dc2074985`). A direct task-scoped `fs.read` succeeded (`trc_58bcfe8b465e`). Direct scoped calls are the recovery path; no product files were modified by the failed batch.
- Direct `status` also ignored task routing and reported root `main` (`trc_9acc82a5d4ee`). Scoped task metadata was verified through direct `fs.read` (`trc_6432673e92b1`).
- An ad-hoc focused `tsc` invocation first requested a nonexistent `bun` type library and failed before compilation (`trc_94251f4a39b1`). Retried with the repository's available Node types and passed (`trc_dcd5db9faf70`).
- Full `packages/os` Vitest run failed on broad pre-existing environment/repository baseline issues (`Bun is not defined` in Vitest workers, unavailable `bun:sqlite`, missing legacy/generated paths, and stale unrelated contracts) and one scoped runtime-bundle classification gap (`trc_8d38b3273e4b`). The run also updated the facade snapshot. Recovered the snapshot exactly through OS/GitHub evidence plus bounded task-scoped edits (`trc_272540e84fba`, `trc_627aec846bfb`, `trc_cc5506b7cfdf`, `trc_6850032316af`, `trc_8f59ffac23b9`, clean at `trc_67c6bb9550db`). Fixed only the scoped classifier through a second red/green cycle (`trc_95070acce7af`, `trc_cff0bf856ab3`); unrelated baseline failures were not broadened into this worker.
- Focused linting of the touched legacy runtime-bundle source surfaced its pre-existing file-wide prefer-arrow/no-useless-escape debt (`trc_cff0bf856ab3`). The new provider package is lint-clean, and runtime-bundle behavior is covered by the green focused suite. No unrelated style rewrite was attempted.
- The doctrine referenced stale script `build:tool-manifest:check`; the command failed after all earlier gates passed (`trc_e62b452f4e8e`). Resolved the live script name from `packages/os/package.json` (`trc_89fd75b12ae5`) and reran `generate-tool-manifest:check` successfully (`trc_2e442256dffb`).
- Initial line-oriented workpad update through `code.call` failed on template-literal escaping (`trc_b27a38e82d45`) and changed no files. Retried with Python text replacement.
- Focused ESLint exposed repository-style violations (`trc_e4979511e1f2`). Its `--fix` retry could not auto-transform the prefer-arrow rule and changed no files (`trc_5dc960aa5243`).
- Three attempted AST conversions changed no files: TypeScript resolved to a version-only export (`trc_5289f39fd768`, `trc_c725431dfb39`, `trc_a4524a1e7da7`) and Tree-sitter lacked its Darwin native binary (`trc_6b5447c63cc2`). Recovered with a bounded lexical transformation of top-level function declarations (`trc_d96d3095c7e0`); lint then narrowed to inline type imports only (`trc_91b3ac75c1a7`).

---

## publish checklist

- [x] Focused red test recorded before production implementation.
- [x] Focused and broader validation green.
- [x] Workspace review and verify green against `origin/main`.
- [ ] CodeRabbit requested and findings dispositioned.
- [ ] Grok 4.5 structured review posted with inline findings/top-level summary and dispositions.
- [ ] Temporary Grok review directory removed.
- [ ] Task PR merged only into `stream/os-provider-tools`.

- 2026-07-23 02:53:10 write: `.task/os-provider-tools/effect-based-deployment-provider-core/workpad.md`

## workspace-owned: files read

- `packages/os/.tmp-reviews/effect-based-deployment-provider-core/grok-prompt.md`
- `packages/os/.tmp-reviews/effect-based-deployment-provider-core/grok-status.json`
- `packages/os/.tmp-reviews/effect-based-deployment-provider-core/grok-stdout.json`
- `packages/os/.tmp-reviews/effect-based-deployment-provider-core/review-packet.md`
- `packages/os/plans/consuelo-os-foundation/plan.md`
- `packages/os/plans/consuelo-os-foundation/workers/08-provider-core.md`
- `packages/os/plans/consuelo-os-foundation/workers/26-tool-package-layout.md`
- `packages/os/plans/consuelo-os-foundation/workers/grok-review-template.md`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/redaction.ts`
- `packages/os/tools/deployment-provider/process.ts`
- `packages/os/tools/deployment-provider/service.ts`
- `packages/workspace/scripts/task-push.js`

## wait log

- Start: 2026-07-23T03:20:38.284783+00:00
  - Wait reason: Grok 4.5 review process remained active after the outer Consuelo call timed out.
  - Duration: bounded polling every 30 seconds for up to 5 minutes.
  - Resume action: inspect the exact provider-core subagent/Grok process IDs and then inspect wrapper output persistence.
  - Expected signal: PIDs 35706/35707/35713 exit and a non-empty completed JSON review is recoverable.
  - Fallback: if no completed JSON is recoverable, record the run as incomplete and rerun the exact wrapper with durable output capture.

- First mandated Grok wrapper invocation exceeded the outer Consuelo call window; its process later exited but no structured output/log directory was recoverable (`trc_793f397604ff`, poll `trc_825bf305ebd8`). Per fail-closed rules, that review is incomplete and is being rerun with durable task-local capture.

- Start: 2026-07-23T03:27:38.856388+00:00
  - Wait reason: allow the cancelled Grok provider session and steering cooldown to clear before the corrected packet-based retry.
  - Duration: 60 seconds.
  - Resume action: start the exact mandated wrapper through the durable capture runner, then poll `grok-status.json`.
  - Expected signal: wrapper status `completed`, exit code 0, and non-empty structured review JSON.
  - Fallback: if the corrected retry is cancelled or incomplete again, record Grok as an external provider blocker with all traces and stop before merge.

- Corrected Grok run completed (`trc_564843999b41`) but its provider stdout hit an 8,028-character transport cap and ended mid-CR-002 without a closing JSON fence (`trc_05c6d33081bf`). Per fail-closed rules, the structured review is incomplete. Two visible findings were independently verified as valid: environment mutation output was not structurally allowlisted, and detect version parser throws escaped the typed error channel. A focused red/green repair cycle is in progress before a compact-output Grok retry.

## Grok finding repair cycle

- First visible Grok findings were verified before modification:
  - CR-001: `environment.set` returned generic parsed output, allowing a provider field named `value` to escape structural secrecy guarantees.
  - CR-002: `detect()` called `version.parse` outside a typed failure boundary, allowing parser throws to become Effect defects.
- Focused red: 2 failures / 18 passes (`trc_2c106f2a9c16`).
- Implemented structural environment-set normalization to `{ name, scopes, updated }` and wrapped version parsing in sanitized `MALFORMED_OUTPUT` conversion (`trc_f3d0f1178e09`).
- Focused green, provider ESLint, and typed compile: 20/20 (`trc_bc9956fe5c07`).
- Final targeted suite after fixes: 39/39; lint, typed compile, OS syntax, and manifest drift all green (`trc_9aa6473ec7d3`).
- Post-fix workspace review: zero findings (`trc_8b64fdeeacd2`).
- Post-fix verify against `origin/main`: passed and publish-valid (`trc_90d9f7fdd712`).
