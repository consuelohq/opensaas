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

## current status

- READY TO PUBLISH: Ko explicitly expanded Worker 10 scope; `task.push --task-session` now parses and resolves the exact active task, focused lifecycle tests pass, strict review is clean, and verify is publish-valid.

## files changed

- `.task/os-provider-tools/build-vercel-provider-adapter/workpad.md`
- `packages/os/tools/deployment-provider/fixtures/vercel.ts`
- `packages/os/tools/deployment-provider/index.ts`
- `packages/os/tools/deployment-provider/process.ts`
- `packages/os/tools/deployment-provider/schema.ts`
- `packages/os/tools/deployment-provider/service.ts`
- `packages/os/tools/deployment-provider/types.ts`
- `packages/os/tools/deployment-provider/vercel.md`
- `packages/os/tools/deployment-provider/vercel.test.ts`
- `packages/os/tools/deployment-provider/vercel.ts`

## workspace-owned: files changed

- `.task/os-provider-tools/build-vercel-provider-adapter/workpad.md`
- `packages/os/tools/deployment-provider/fixtures/vercel.ts`
- `packages/os/tools/deployment-provider/index.ts`
- `packages/os/tools/deployment-provider/process.ts`
- `packages/os/tools/deployment-provider/schema.ts`
- `packages/os/tools/deployment-provider/service.ts`
- `packages/os/tools/deployment-provider/types.ts`
- `packages/os/tools/deployment-provider/vercel.md`
- `packages/os/tools/deployment-provider/vercel.test.ts`
- `packages/os/tools/deployment-provider/vercel.ts`

## workspace-owned: activity log

- 2026-07-23 15:41:10 fs.write: `.task/os-provider-tools/build-vercel-provider-adapter/workpad.md`
- 2026-07-23 15:45:15 fs.write: `packages/os/tools/deployment-provider/vercel.test.ts`
- 2026-07-23 15:46:01 fs.write: `packages/os/tools/deployment-provider/schema.ts`
- 2026-07-23 15:47:45 fs.write: `packages/os/tools/deployment-provider/vercel.ts`
- 2026-07-23 15:49:13 fs.write: `packages/os/tools/deployment-provider/fixtures/vercel.ts`
- 2026-07-23 15:50:11 fs.write: `packages/os/tools/deployment-provider/vercel.md`
- 2026-07-23 16:01:08 fs.write: `packages/os/tools/deployment-provider/index.ts`
- managed by workspace tooling

## workspace-owned: validation evidence

- `trc_e3848ff0402d`: focused red failed at module resolution as expected.
- `trc_747d4aa77aab`: focused Vercel suite green, 11/11.
- `trc_e9d0341affb8`: Vercel plus provider-core regression suite green, 37/37.
- `trc_d4847d405577`: real TypeScript compiler pass green for the provider package.
- `trc_fe1f0cad3c8d`: repository syntax gate green.
- `trc_d0f93bd2a7ab`: read-only adapter detect returned installed Vercel CLI 50.1.3. The ad-hoc harness emitted an existing Effect 3.21.3/3.22.0 dependency-dedupe warning but returned the expected typed detection result.
- 2026-07-23 15:58:43 `review.run`: passed — OK
- 2026-07-23 15:58:43 `review.run`: passed — OK
- 2026-07-23 15:58:43 `review.run`: passed — OK
- 2026-07-23 15:58:54 `review.run`: passed — OK
- 2026-07-23 16:02:28 `review.run`: passed — OK
- 2026-07-23 16:02:40 `verify`: passed — OK
- `trc_e5cddc63b4ab`: full task-aware verification passed and was publish-valid with zero review or database findings.
- `trc_7d2bd805e79d`: final provider TypeScript compile and OS syntax gate passed after the package index fix.
- `trc_c81a9eccc456`: final strict changed-file review passed with zero findings.
- 2026-07-23 16:04:54 `verify`: passed — OK
- 2026-07-23 16:28:03 `checkFiles`: passed — OK
- 2026-07-23 16:28:16 `review.run`: passed — OK
- 2026-07-23 16:28:26 `verify`: passed — OK

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

---

## publish checklist

- [x] focused red recorded
- [x] focused green recorded
- [x] broader validation recorded
- [ ] task pushed
- [ ] CodeRabbit requested and dispositioned
- [ ] Grok review posted and dispositioned
- [ ] temporary review directory removed
- [ ] task PR merged to stream

- 2026-07-23 15:41:10 write: `.task/os-provider-tools/build-vercel-provider-adapter/workpad.md`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tools/deployment-provider/errors.ts`
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
- `packages/os/tools/tool-package-contract.test.ts`
- `packages/workspace/package.json`
- `packages/workspace/scripts/lib/task-selection.js`
- `packages/workspace/scripts/lib/verification.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/senior-engineer.md`

- 2026-07-23 16:28:50 apply-patch: `.task/os-provider-tools/build-vercel-provider-adapter/workpad.md`

- 2026-07-23 16:29:14 apply-patch: `.task/os-provider-tools/build-vercel-provider-adapter/workpad.md`

- 2026-07-23 16:29:31 apply-patch: `.task/os-provider-tools/build-vercel-provider-adapter/workpad.md`