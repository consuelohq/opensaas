# build vercel provider adapter

branch: `task/os-provider-tools/build-vercel-provider-adapter`
stream: `stream/os-provider-tools`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1590/build-vercel-provider-adapter
github pr: https://github.com/consuelohq/opensaas/pull/1590
started: 2026-07-23
base SHA: `11e1e998178b397148f5456bf3a7b2c7d636d958`
task session: `tsk_e398fbe000ba`

## acceptance criteria

- [x] Add a canonical Vercel adapter beneath the deployment-provider tool package without central manifest registration.
- [x] Detect the installed Vercel CLI/version and return typed missing/incompatible CLI failures.
- [x] Report authentication and linked team/project/scope without reading credentials or token files.
- [x] Support explicit project linking, deployment list/status/log inspection, preview/production deploy semantics, supported redeploy/promote behavior, environment-name/scope management, read-only project/domain configuration, and a raw argv escape hatch.
- [x] Normalize provider output, bound logs/results, redact credential-bearing URL query parameters, and fail typed on output drift rather than guessing.
- [x] Keep all process execution argv-based and injection-resistant.
- [x] Add deterministic fixtures and behavioral tests covering every Worker 10 required test category.
- [x] Document operation schemas, CLI commands, approval/consequence metadata, Vercel limitations, live read-only validation checklist, and proposed Worker 12 manifest/search metadata.
- [x] Repair the Consuelo OS `task.push --task-session` compatibility path so the facade-selected task session resolves the correct task worktree.
- [ ] Pass focused tests, broader OS validation, CodeRabbit, Grok 4.5 review, and disposition every substantive finding on GitHub.
- [ ] Merge task PR into `stream/os-provider-tools` only; do not promote the stream to `main`.

## plan

1. Map Worker 08 provider-core contracts and Worker 26 package layout from the synchronized stream.
2. Define the Vercel operation/result schemas and deterministic CLI fixture runner.
3. Write focused behavioral tests first and confirm the expected red failure.
4. Implement the smallest adapter surface that satisfies the tests and Worker 10 scope.
5. Run focused green tests, type/static checks, workspace review, and full verify against `origin/stream/os-provider-tools`.
6. Publish the task PR, request and process CodeRabbit, run the required Grok review, post all structured evidence/dispositions, and merge task to stream.

## Test-first contract

- Behavior under test: Vercel CLI-backed provider operations expose stable typed results and approval metadata while preserving auth secrecy, argv integrity, bounded output, URL/token redaction, and output-drift failure.
- Existing local pattern to follow: Worker 08 Effect provider core and canonical `packages/os/tools/<domain>/` package organization.
- New or changed tests: Vercel handler/adapter tests and deterministic CLI output fixtures under the canonical deployment-provider package.
- Focused red command: `bun run --cwd packages/os test -- tools/deployment-provider/vercel.test.ts`.
- Expected red failure: Vitest cannot resolve `./vercel` because the Vercel adapter has not been implemented.
- No-test waiver: none; this is provider behavior and requires test-first coverage.

### Publish-route repair test contract

- Behavior under test: `task-push.js` accepts `--task-session <id>`, selects the matching active task metadata, and no longer fails with `unknown flag: --task-session` when invoked through the Consuelo OS facade.
- Existing local pattern to follow: `task-selection.js` centralizes active-task selectors for area, branch, and PR; task lifecycle tests use Vitest and direct helper/process assertions.
- New or changed tests: extend task-selector coverage for session parsing/matching and add a task-push CLI parser regression that invokes `--task-session ... --help`.
- Focused red command: `bun --cwd packages/workspace test -- task-selector-pr-ref.test.js task-push-session.test.ts`.
- Expected red failure: the selector has no `taskSession` field and `task-push.js` exits with `unknown flag: --task-session`.
- No-test waiver: none; this is lifecycle routing behavior and requires an executable regression test.

### Grok finding repair test contract

- Behavior under test: deploy/redeploy accept real multi-URL Vercel success output, explicitly use `--no-wait` when returning `QUEUED`, and logs.read returns bounded partial entries with truncation metadata when the live stream reaches the caller timeout.
- Existing local pattern to follow: Vercel fixture-driven adapter tests plus provider-core typed result normalization.
- New or changed tests: multi-URL mutation success, zero-URL fail-closed, exact `--no-wait` argv, partial timeout log success, and empty timeout log failure.
- Focused red command: `bun run --cwd packages/os test -- tools/deployment-provider/vercel.test.ts`.
- Expected red failure: mutation parsing rejects more than one URL, argv lacks `--no-wait`, and logs.read returns TIMEOUT instead of partial entries.
- No-test waiver: none; all three findings affect launch-critical provider behavior.

### Final Grok finding repair test contract

- Behavior under test: Vercel environment set/delete require one explicit environment (`production`, `preview`, or `development`) with scope-specific approval consequences, and promotion receives a process timeout longer than the CLI's documented three-minute wait.
- Existing local pattern to follow: input-aware provider policies, command-builder validation mapped to `MALFORMED_OUTPUT`, and exact fake-process request assertions.
- New or changed tests: missing/invalid environment scope fails before process execution; valid production policies name production; promote argv includes `--timeout 3m` and the process request uses a 195000 ms default.
- Focused red command: `bun run --cwd packages/os test -- tools/deployment-provider/vercel.test.ts`.
- Expected red failure: missing scope currently emits an all-environments command, approval consequences are generic, and promote inherits the 120000 ms service timeout.
- No-test waiver: none; both findings can mutate customer-facing production state.

### Post-fix Grok finding repair test contract

- Behavior under test: truncated/timed-out Vercel NDJSON logs preserve complete entries while ignoring only incomplete boundary fragments; deployment listing returns an opaque next cursor and accepts that cursor on the next call; URL list handles remain valid inputs to deployment inspection.
- Existing local pattern to follow: fail-closed table/NDJSON parsers, provider-opaque base64url cursors, and fixture-driven list-to-status workflows.
- New or changed tests: trailing timeout fragment, leading byte-tail fragment, invalid middle NDJSON failure, deployment pagination footer encoding/decoding, and list URL passed directly to inspect.
- Focused red command: `bun run --cwd packages/os test -- tools/deployment-provider/vercel.test.ts`.
- Expected red failure: boundary fragments currently cause `MALFORMED_OUTPUT`, deployment list omits the footer cursor, and cursor input is forwarded without decoding.
- No-test waiver: none; logs and pagination are required Worker 10 read paths.

## current status

- CURRENT-HEAD REVIEWS PENDING: Worker 09's Railway stream changes and Worker 10's Vercel/task-session changes are reconciled in two-parent merge commit `2abab0cc998e69e8e7c2206d4ecdc8b371ed2cb4`. Combined review and full verify are clean; GitHub CI, CodeRabbit, and Grok must complete on the reconciled head before stream merge.

## files changed

- `.task/os-provider-tools/build-vercel-provider-adapter/workpad.md`
- `packages/os/.tmp-merge-worker10` (deleted)
- `packages/os/.tmp-reviews/build-vercel-provider-adapter` (deleted)
- `packages/os/tools/deployment-provider/fixtures/vercel.ts`
- `packages/os/tools/deployment-provider/index.ts`
- `packages/os/tools/deployment-provider/process.ts`
- `packages/os/tools/deployment-provider/schema.ts`
- `packages/os/tools/deployment-provider/service.ts`
- `packages/os/tools/deployment-provider/types.ts`
- `packages/os/tools/deployment-provider/vercel.md`
- `packages/os/tools/deployment-provider/vercel.test.ts`
- `packages/os/tools/deployment-provider/vercel.ts`
- `packages/workspace/scripts/lib/task-selection.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/tests/task-push-session.test.ts`
- `packages/workspace/tests/task-selector-pr-ref.test.js`

## workspace-owned: files changed

- `.task/os-provider-tools/build-vercel-provider-adapter/workpad.md`
- `packages/os/.tmp-merge-worker10` (deleted)
- `packages/os/.tmp-reviews/build-vercel-provider-adapter` (deleted)
- `packages/os/tools/deployment-provider/fixtures/vercel.ts`
- `packages/os/tools/deployment-provider/index.ts`
- `packages/os/tools/deployment-provider/process.ts`
- `packages/os/tools/deployment-provider/schema.ts`
- `packages/os/tools/deployment-provider/service.ts`
- `packages/os/tools/deployment-provider/types.ts`
- `packages/os/tools/deployment-provider/vercel.md`
- `packages/os/tools/deployment-provider/vercel.test.ts`
- `packages/os/tools/deployment-provider/vercel.ts`
- `packages/workspace/scripts/lib/task-selection.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/tests/task-push-session.test.ts`
- `packages/workspace/tests/task-selector-pr-ref.test.js`

## workspace-owned: activity log

- 2026-07-23 15:41:10 fs.write: `.task/os-provider-tools/build-vercel-provider-adapter/workpad.md`
- 2026-07-23 15:45:15 fs.write: `packages/os/tools/deployment-provider/vercel.test.ts`
- 2026-07-23 15:46:01 fs.write: `packages/os/tools/deployment-provider/schema.ts`
- 2026-07-23 15:47:45 fs.write: `packages/os/tools/deployment-provider/vercel.ts`
- 2026-07-23 15:49:13 fs.write: `packages/os/tools/deployment-provider/fixtures/vercel.ts`
- 2026-07-23 15:50:11 fs.write: `packages/os/tools/deployment-provider/vercel.md`
- 2026-07-23 16:01:08 fs.write: `packages/os/tools/deployment-provider/index.ts`
- 2026-07-23 18:04:35 fs.trash: `packages/os/.tmp-merge-worker10`
- 2026-07-23 18:04:39 fs.trash: `packages/os/.tmp-reviews/build-vercel-provider-adapter`
- managed by workspace tooling

## workspace-owned: validation evidence

- 2026-07-23 16:28:26 `verify`: passed — OK
- `trc_f2595b8f341c`: Grok finding repair red, 11 pass / 2 expected failures at multi-URL deploy and timed-out partial logs.
- `trc_245c2d26fb53`: installed Vercel CLI 50.1.3 confirms deploy/redeploy `--no-wait` and five-minute live log streaming semantics.
- `trc_5c19a8dade6d`: Grok finding repair focused green, 13/13.
- `trc_6c66257124f3`: provider core + Vercel 39/39, lifecycle 21/21, OS syntax gate pass.
- `trc_b7862a463cb2`: provider package TypeScript compiler pass after forwarding the partial-result hook through the adapter definition helper.
- `trc_263d97c1b71d`: installed Vercel CLI 50.1.3 confirms omitted env scope targets all/multiple environments and promote defaults to a three-minute wait.
- `trc_9c361b42f5d9`: final Grok repair red, 12 pass / 3 expected failures for promotion timeout, env validation, and scope-specific policy.
- `trc_8e0c56c87c32`: final Grok repair focused green, 15/15.
- `trc_58dc0cdd217d`: provider core + Vercel 41/41, lifecycle 21/21, OS syntax gate pass.
- `trc_033ad9e383ca`: provider package TypeScript compiler pass.
- `trc_55a1f5ccb41a`: final strict changed-file review passed with zero findings.
- `trc_35c0b28c7ea2`: final full verify passed publish-valid with zero review/database findings.
- `trc_6b6fab23d7cf`: installed Vercel CLI 50.1.3 confirms redeploy has no `--yes`, while inspect/redeploy accept URL or deployment ID and list exposes `--next <MS>`.
- `trc_bb035da701fa`: installed Vercel CLI source confirms deployment list emits a next-page command containing `--next ${pagination.next}`.
- `trc_7fe1f3bdaa86`: read-only live list validation stopped at typed unauthenticated CLI output; no provider mutation occurred.
- `trc_2ba86e3e77fa`: post-fix Grok repair red, 14 pass / 3 expected failures for cursor handling and truncated NDJSON boundaries.
- `trc_a069c0541c10`: post-fix focused green, 17/17.
- `trc_9841ec1a055a`: provider core + Vercel 43/43, lifecycle 21/21, OS syntax gate pass.
- `trc_b09c5e77d5d5`: provider package TypeScript compiler pass.
- `trc_09c748b37d03`: strict changed-file review passed with zero findings.
- `trc_a1eb1f1c1c1a`: full verify passed publish-valid with zero review/database findings.
- 2026-07-23 17:01:31 `review.run`: passed — OK
- 2026-07-23 17:01:43 `verify`: passed — OK
- 2026-07-23 17:14:42 `review.run`: passed — OK
- 2026-07-23 17:14:53 `verify`: passed — OK
- 2026-07-23 17:29:55 `review.run`: passed — OK
- 2026-07-23 17:30:10 `verify`: passed — OK
- 2026-07-23 18:05:23 `review.run`: passed — OK
- 2026-07-23 18:05:34 `verify`: passed — OK

## key decisions

- Use the installed Vercel CLI as the sole authenticated authority; never inspect Vercel token files.
- Keep manifest registration out of scope for Worker 12.
- Automated tests use deterministic fixtures only; no Ko or real-user Vercel credentials.
- Repair the existing facade/script contract in place: retain facade session injection, teach the shared task selector to match `meta.taskSession`, and make `task-push.js` select the resolved worktree.

## notes for ko

- No lifecycle command will be run on the Mac Mini or MacBook Air. Live validation will stop at a safe read-only checklist.
- Ko explicitly approved the narrow lifecycle repair in this task so future agents can publish through the same session-scoped route.

## improvements noticed

- `review.run --all` scales poorly because it executes three Git line-range queries for every repository JavaScript/TypeScript file. Changed-file review is the correct task gate; broad behavior belongs in `verify`.
- The generic `status` facade ignores task-session routing when invoked from root; session-required task tools provide reliable worktree evidence.

## issues and recovery

- Initial `os.get_steering()` returned `GET_STEERING_RATE_LIMITED` instead of the full steering document. Trace not provided by the direct tool response. The suggested `refresh_steering` recovery was attempted through `os.call` and rejected as `UNKNOWN_TOOL_SCOPE`; bootstrap continued through the documented repo skills and OS facade only.
- Unscoped bootstrap `fs.read` failed with `AMBIGUOUS_TASK_SELECTION`; recovered by selecting an existing OS-managed provider-core branch for read-only policy/brief reads before the new task existed. Trace IDs: `trc_94f1952e5443`, `trc_6533df4c554b`.
- First `stream.sync` failed on a transient worktree `index.lock` (`trc_41d01c95dd4e`). OS `code.call` inspection found no lock owner and the file had disappeared (`trc_37394fe9941d`); retry succeeded (`trc_6b670760ecfa`).
- First task-scoped `batch` failed to propagate top-level `taskSession`; child `status` inspected root `main` and child `fs.read` returned `AMBIGUOUS_TASK_SELECTION` (`trc_0305e37b6d31`). Recovery: use direct calls with top-level `taskSession` and do not branch-thread task operations.
- Initial real compiler pass found a new generic operation-index error and an existing Buffer generic inference incompatibility (`trc_6a287ee62446`). Recovery: handle `detect` outside command-operation indexing and annotate bounded buffers explicitly; rerun passed (`trc_d4847d405577`).
- First read-only adapter detect harness used relative imports from the temporary code runner and failed module resolution (`trc_367eb8557d7b`). Recovery: import from the task worktree absolute cwd; detect passed (`trc_d0f93bd2a7ab`).
- Fixture directory write initially failed because the parent did not exist (`trc_bdb8629b2c01`). Recovery: retry with `mkdirs: true` succeeded (`trc_93abfbcfec7a`).
- The first full OS test run passed all behavioral tests but failed the generated tool-package contract because `deployment-provider` lacked an `index.ts` export for its existing empty `toolSchemas` contribution (`trc_b1e734f7a636`). A direct test-file filter correctly found no persistent generated file (`trc_768aecedc9fe`). Recovery: add the canonical package index export and rerun the authoritative full command; 189/189 tests passed.
- Generic `status` ignored the task session and reported root `main` (`trc_76b5360d0666`); task evidence now uses session-required `git.diff`, `review.run`, and `verify`.
- Strict `review.run --all` exceeded the tool timeout and backend retries left three duplicate scans in this task worktree. Inspection showed the all-files path issuing repeated Git queries rather than a product failure (`trc_593c191c42e1`, `trc_94062830a11d`, `trc_97fe1c4a1956`). The six task-specific wrapper/child processes were terminated cleanly without force (`trc_aadac973aac6`), then changed-file strict review passed with zero findings (`trc_b81e3cb48af7`).
- The full package test/verify path rewrote an unrelated facade snapshot from repository-wide generated ordering. A cross-branch `fs.read` recovery attempt correctly failed because task-session branch overrides are forbidden (`trc_eb3cd45ba044`). Recovery: reverse only the observed generated snapshot hunks through task-scoped code edits (`trc_4e20906b7eee`, `trc_cd49bdb8c33c`) and confirm the snapshot is absent from the final task diff (`trc_9b22ced77c26`).
- Durable publish failed with the exact task session because the facade forwarded `--task-session` to `task-push.js`, which rejects that flag (`trc_67f59a8688ca`). Exact branch-only realignment was then rejected by the facade with `TASK_SESSION_REQUIRED` (`trc_93a04ea4bfa4`). No prior recovery exists in task memory (`trc_e5bcdc3385c3`). Repairing lifecycle tooling exceeds Worker 10 ownership, so no native Git or direct file-write bypass was used. The blocker and all evidence are durable at https://github.com/consuelohq/opensaas/pull/1590#issuecomment-5060656223 (`trc_5496d85f3c0c`).
- Ko then expanded scope to repair that route. TDD red reproduced missing CLI parsing, selector parsing, and active-task matching (`trc_52dd8ebc4725`); the minimal session-selector implementation passed focused tests 5/5 (`trc_15ce81d33b9a`) and adjacent lifecycle tests 21/21 (`trc_621b283bb1f9`).
- A broader ad hoc lifecycle run exposed three pre-existing hook-dispatcher expectation failures unrelated to task selection (`trc_182bfe3bfcda`); no hook files were changed. The authoritative verify gate passed publish-valid with zero review/database findings (`trc_0b7837621685`).
- The first post-repair typed `task.push` retry still invoked the root/main copy of `packages/workspace/scripts/task-push.js`, so the old parser rejected `--task-session` before the task-branch fix could publish itself (`trc_9eb018fb7ac2`). Recovery: invoke the verified task-worktree copy once through OS `code.call`; this preserves the existing publisher, verification checks, GitHub API path, authorship, and scoped metadata while resolving the self-hosting bootstrap problem.
- The first `code.call` bootstrap ran with the task worktree as repository root; active-task enumeration correctly excluded that root and returned no matching candidate (`trc_37e8f255382f`). Recovery: execute the task-worktree script path with the main repository as discovery cwd so the normal selector can resolve the preserved task worktree.
- Grok outer execution timed out while the bounded subprocess remained active, and backend retry behavior created one duplicate run. The newer duplicate was terminated cleanly while preserving the original bounded wrapper (`trc_717c21f8da30`, `trc_498dec7c9ccd`).

### wait plan: Grok completion

- Wait reason: the original bounded Grok 4.5 review subprocess is still running after the outer response timeout.
- Duration: poll every 30 seconds for up to 12 minutes.
- Resume action: inspect the original Grok process tree and `packages/os/.tmp-reviews/build-vercel-provider-adapter/grok-output.json` immediately after each wake.
- Expected signal: original process exits and the output file contains a non-empty valid JSON review object.
- Fallback: if the process exceeds its 900000 ms wrapper bound or output is empty/invalid, record the run as failed closed and rerun once with corrected transport.
- Observed result: after the 30-second wake, the original process had exited but `grok-output.json` was zero bytes (`trc_68982a91d19a`, `trc_ee3b93e6f647`). The run is failed closed. Rerun once with wrapper stdout/stderr redirected directly to task-local temporary files so outer response timeouts cannot discard the structured result.
- The corrected Grok run completed successfully (`trc_8d466a85f5b9`), but Grok's own JSON `text` field compacted the structured review at roughly 8 KB, cutting off CR-002 and any later fields. The retained OS stdout log is complete for the provider response but confirms the provider response itself is truncated. This review remains incomplete and therefore fails closed. Recovery: run a compact review using the same evidence, requiring a complete JSON object below 7 KB with concise findings and all mandatory fields.
- The compact recovery also hit Grok's fixed 8028-character provider-output ceiling (`trc_3db60b5d12d0`, `trc_9fc5dd7754a7`). Across the retained portions, three findings were concrete and independently verified against source and Vercel CLI 50.1.3: multi-URL mutation parsing, `QUEUED` without `--no-wait`, and timed-out log streams discarding partial output. All three are fixed with regression coverage. A final post-fix Grok review is required to return a complete approval object before merge.
- The first combined implementation patch was rejected atomically because a documentation hunk had moved (`trc_231d9193b109`); split anchored patches succeeded with no partial state.
- The first ad hoc TypeScript compiler attempt used a missing `bun` type library (`trc_4aedf1b783c8`); the corrected Node-types run then exposed one real helper typing gap plus pre-existing strict redaction diagnostics (`trc_b2a0e79f6965`). The helper now forwards `acceptPartialResult`; the provider compile profile passes (`trc_b7862a463cb2`).
- After all external reviews were posted, PR #1590 became `DIRTY` because Worker 09 merged Railway PR #1591 into the same stream. `task.ensureSynced` identified the advanced stream and prescribed `stream.sync` (`trc_b5db0ad55a32`). The first sync call exposed a facade/script mismatch for optional `--repo` (`trc_91480064373b`); retry without that field succeeded (`trc_205bf463c82b`).
- The conflict is substantive but bounded to `deployment-provider/schema.ts`, `service.ts`, and `types.ts`. Three-way inspection against original base `11e1e998` and current stream `42cb80d0` confirmed additive provider contracts (`trc_aa6cf303b0c3`, `trc_ac23a7af4a52`). Recovery: assemble the exact stream-plus-task tree locally, preserve both providers' semantics, validate, then create a two-parent GitHub API merge commit on the task branch.
- Worker 09's disjoint Railway files were copied from the assigned stream into the validation tree; shared core files were manually combined. Combined Railway/Vercel/provider-core tests passed 74/74, lifecycle tests 21/21, syntax passed (`trc_237b9c60fa3f`), and combined provider TypeScript compilation passed (`trc_015b0ab83881`).
- Railway's provider-neutral redeploy input makes `deploymentId` optional, while Vercel requires it. A focused red test reproduced a service-only Vercel redeploy reaching the process layer (`trc_92cbe4aab845`); Vercel now throws typed `ProviderInputError` before argv construction, and focused green passed 18/18 (`trc_7ad38c94b6fc`).
- Temporary merge and prior review directories were removed after their evidence was posted (`trc_b18d75458158`, `trc_2791ab3b30c7`).
- Final combined strict review covered 25 source/test files across `consuelo-os` and `openworkspace` with zero findings (`trc_d837c7e09ee1`). Full verify covered the exact stream-plus-task tree and passed publish-valid with zero review/database findings (`trc_dfbb85edbce5`).
- The reconciled remote task commit was assembled from the current stream tree and the 20 scoped PR files, with parents `2e7c78a3` and `42cb80d0`; GitHub task head is now `2abab0cc998e69e8e7c2206d4ecdc8b371ed2cb4` (`trc_cc37112742d5`). GitHub reports no merge conflict; current-head checks are running (`trc_7e86439e16e9`).

## Grok finding dispositions

- Multi-URL deploy/redeploy parsing: **fixed**. The adapter prefers the last `*.vercel.app` URL, falls back to a non-Vercel-dashboard URL, and fails only when no deployment URL exists. Added multi-URL success and zero-URL failure tests.
- Mutation status semantics: **fixed**. Deploy and redeploy now pass Vercel CLI 50.1.3 `--no-wait`, so normalized `QUEUED` status matches actual command behavior. Catalog and documentation updated.
- Live logs timeout behavior: **fixed**. The provider core supports adapter-approved partial results; Vercel logs accept a timed-out result only when stdout contains entries, return `truncated: true`, and retain typed `TIMEOUT` for empty streams.
- Environment mutation scope: **fixed**. Vercel set/delete require `production`, `preview`, or `development`, reject omitted/invalid scope before process execution, and publish scope-specific approval consequences.
- Promotion timeout: **fixed**. Promote now passes CLI `--timeout 3m` and carries a 195000 ms command-level process timeout, leaving a 15-second local grace period before termination.
- Truncated NDJSON boundaries: **fixed**. Timed-out or byte-truncated log streams may discard only unparseable first/last fragments; valid complete entries are returned with `truncated: true`, while invalid middle records and streams with no complete entry remain `MALFORMED_OUTPUT`.
- Redeploy `--yes`: **rejected**. Vercel CLI 50.1.3 exposes only `--no-wait` and `--target` for redeploy; adding `--yes` would be an unsupported command-line flag.
- Deployment list identity and pagination: **partially fixed / partially rejected**. URL identity is retained because Vercel officially accepts `url|deploymentId` for inspect/redeploy/promote. Pagination now parses Vercel's next-page footer, returns an opaque `vercel:<base64url>` cursor, and decodes it only when constructing the next `--next` argument.

---

## publish checklist

- [x] focused red recorded
- [x] focused green recorded
- [x] broader validation recorded
- [x] task pushed
- [ ] CodeRabbit requested and dispositioned
- [ ] Grok review posted and dispositioned
- [x] temporary review directory removed
- [ ] task PR merged to stream

- 2026-07-23 15:41:10 write: `.task/os-provider-tools/build-vercel-provider-adapter/workpad.md`

## workspace-owned: files read

- `packages/os/.tmp-reviews/build-vercel-provider-adapter/grok-approval-schema-prompt.md`
- `packages/os/.tmp-reviews/build-vercel-provider-adapter/grok-approval-serialization-prompt.md`
- `packages/os/.tmp-reviews/build-vercel-provider-adapter/grok-compact-prompt.md`
- `packages/os/.tmp-reviews/build-vercel-provider-adapter/grok-final-compact-prompt.md`
- `packages/os/.tmp-reviews/build-vercel-provider-adapter/grok-prompt.md`
- `packages/os/package.json`
- `packages/os/plans/consuelo-os-foundation/workers/grok-review-template.md`
- `packages/os/scripts/subagent.ts`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tools/deployment-provider/errors.ts`
- `packages/os/tools/deployment-provider/fixtures/vercel.ts`
- `packages/os/tools/deployment-provider/handler.test.ts`
- `packages/os/tools/deployment-provider/handler.ts`
- `packages/os/tools/deployment-provider/index.ts`
- `packages/os/tools/deployment-provider/manifest.ts`
- `packages/os/tools/deployment-provider/process.ts`
- `packages/os/tools/deployment-provider/redaction.ts`
- `packages/os/tools/deployment-provider/schema.ts`
- `packages/os/tools/deployment-provider/service.ts`
- `packages/os/tools/deployment-provider/testing.ts`
- `packages/os/tools/deployment-provider/types.ts`
- `packages/os/tools/deployment-provider/vercel.md`
- `packages/os/tools/deployment-provider/vercel.test.ts`
- `packages/os/tools/deployment-provider/vercel.ts`
- `packages/os/tools/tool-package-contract.test.ts`
- `packages/workspace/package.json`
- `packages/workspace/scripts/lib/task-selection.js`
- `packages/workspace/scripts/lib/verification.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/task-pr.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/tests/task-selector-pr-ref.test.js`

- 2026-07-23 18:05:07 apply-patch: `.task/os-provider-tools/build-vercel-provider-adapter/workpad.md`

- 2026-07-23 18:06:34 apply-patch: `.task/os-provider-tools/build-vercel-provider-adapter/workpad.md`