# integrate provider manifest discovery approvals and runtime bundles

branch: `task/os-provider-tools/integrate-provider-manifest-discovery-approvals-and-runtime-bundles`
stream: `stream/os-provider-tools`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1602/integrate-provider-manifest-discovery-approvals-and-runtime-bundles
github pr: https://github.com/consuelohq/opensaas/pull/1602
started: 2026-07-23
base stream SHA: `689c892332049d5db2ba8b01ade5d76f9fb65d53`
task session: `tsk_e782b1f08285`
assigned worker: `12-provider-integration`

## acceptance criteria

- [x] Expose Railway, Vercel, and Cloudflare through one coherent customer-facing deployment contract without duplicate full surfaces or compatibility aliases.
- [x] Register the canonical public operations for detect, context, list, status, logs, deploy, environment, and raw behavior with explicit provider selection.
- [x] Keep provider deployment tools non-core and generated from Worker 26's canonical tool-package authority.
- [x] Update schemas, generated manifests, and generated client types without hand-editing generated authority.
- [x] Make natural-language deployment, log, and environment intents discover the correct canonical provider tools with useful synonyms and ranking.
- [x] Return capability-aware missing-CLI and unauthenticated guidance without extracting provider credentials.
- [x] Preserve the approval boundary: read operations do not require write approval; deploy, redeploy, and environment mutation require the intended local approval/scope.
- [x] Never return environment secret values or expose representative provider tokens in traces or generated artifacts.
- [x] Remove superseded provider names after proving no runtime, test, documentation, or generated references remain; no aliases or duplicate dispatch were added.
- [x] Prove the customer runtime bundle includes Railway, Vercel, and Cloudflare adapters while excluding Consuelo operator-only modules.
- [ ] Pass focused behavior tests, generated drift checks, provider regression tests, broader OS validation, CI, CodeRabbit, and the required Grok 4.5 review with every finding disposition recorded on GitHub.
- [ ] Merge only task PR #1602 into `stream/os-provider-tools`; do not promote the stream to `main` and do not start downstream workers.

## plan

1. Inventory the integrated Railway, Vercel, and Cloudflare adapters plus their current public IDs, schemas, approval metadata, search cards, generated manifests/client output, and runtime-bundle classification.
2. Select one canonical deployment naming model from current architecture evidence and record the cutover map before editing.
3. Add behavior-first tests covering discovery, missing CLI/auth guidance, approval boundaries, secret redaction, superseded-name removal, generated parity, and runtime inclusion/exclusion; run the focused suite red.
4. Implement the smallest integration changes in canonical tool packages and generator/search sources; avoid adapter-internal changes unless a focused integration defect requires them.
5. Regenerate manifests/client types through the existing generator and run the focused suite green, then provider regressions, bundle tests, drift checks, review, and verify against `origin/stream/os-provider-tools`.
6. Push the independently reviewable task PR, request and disposition CodeRabbit, render and run the required Grok review, post all structured review evidence/findings/dispositions, and remove the temporary review directory.
7. Merge the task PR into the provider stream only, verify durable GitHub state, and clean up the task worktree/session.

## Test-first contract

- Behavior under test: provider-neutral discovery and dispatch expose the intended eight deployment capabilities for all three providers; read/write approval policy is correct; missing CLI/auth guidance is actionable; secrets stay redacted; runtime packaging includes customer adapters and excludes operator modules; superseded names disappear completely.
- Existing local pattern to follow: Worker 26 package contribution tests, `tests/facade/facade.test.ts`, provider adapter/core tests, `tools-search-v2.test.ts`, generated manifest drift checks, and `distribution/runtime-bundle.test.ts`.
- New or changed tests: `tools/deployment-provider/facade.test.ts`, the canonical package inventory assertion in `handler.test.ts`, plus pending generated-manifest/search/runtime integration assertions.
- Focused red commands recorded: façade test failed because `./facade` did not exist (`trc_9a0c2992d2d0`); package test failed because the package was still empty/provider-prefixed (`trc_fb1562345ca5`); internal-dispatch metadata test failed because handlers still planned a subprocess (`trc_d8e841df9673`).
- Expected red failures were observed, then the focused façade and package tests passed (`trc_fa916853c3e4`, `trc_4c34c0f1339d`, `trc_6446693c4d72`).
- No-test waiver: none; this is a public behavior and packaging integration task.

## current status

- Provider stream synced from current `main` and now includes Workers 09, 10, and 11.
- Task PR #1602 is isolated from `stream/os-provider-tools` with exact task session `tsk_e782b1f08285`.
- Required plans, environment registry, Worker 12 brief, Grok template, repository guidance, OS task/senior-engineer skills, Worker 26 contract, and complete `packages/os/SCRIPTS.md` have been read.
- The canonical public contract is now eight `deployment.*` methods with explicit `provider: railway | vercel | cloudflare`; the generated full manifest contains 154 tools and the core manifest remains 13 tools.
- Provider execution uses an internal typed dispatcher rather than a façade subprocess. This keeps environment values out of process argv and delegates secret transport to the existing provider stdin boundary.
- Missing-CLI and unauthenticated failures now carry structured, provider-specific recovery guidance; environment values and raw argv are sanitized before trace persistence.
- Generated drift and syntax validation pass (`trc_68487f196d8d`, `trc_da89e2774779`).
- Final isolated validation pass: provider 96/96, manifest 15/15, install-state 20/20, search 5/5, runtime-bundle 17/17, and façade provider safety 2/2 (`trc_347d5a539110`).
- Superseded dotted Railway names have zero references across runtime manifests, generated docs/client, current tests/snapshots, inventory fixtures, and Railway customer docs (`trc_0586d770b775`).
- Strict review passed with zero findings (`trc_6d6f493cda6e`) and full verify against `origin/stream/os-provider-tools` passed (`trc_0fcd21197bbf`). CodeRabbit, Grok, CI, and merge remain.

## files changed

- `.task/os-provider-tools/integrate-provider-manifest-discovery-approvals-and-runtime-bundles/workpad.md`
- `packages/documentation/src/content/docs/connect/apps-and-services/railway.mdx`
- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/manifests/manifest.config.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/tools/deployment-provider/errors.ts`
- `packages/os/tools/deployment-provider/facade.test.ts`
- `packages/os/tools/deployment-provider/facade.ts`
- `packages/os/tools/deployment-provider/handler.test.ts`
- `packages/os/tools/deployment-provider/handler.ts`
- `packages/os/tools/deployment-provider/manifest.ts`
- `packages/os/tools/deployment-provider/schema.ts`
- `packages/os/tools/registry.ts`

## workspace-owned: files changed

- `.task/os-provider-tools/integrate-provider-manifest-discovery-approvals-and-runtime-bundles/workpad.md`
- `packages/documentation/src/content/docs/connect/apps-and-services/railway.mdx`
- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/manifests/manifest.config.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/tools/deployment-provider/errors.ts`
- `packages/os/tools/deployment-provider/facade.test.ts`
- `packages/os/tools/deployment-provider/facade.ts`
- `packages/os/tools/deployment-provider/handler.test.ts`
- `packages/os/tools/deployment-provider/handler.ts`
- `packages/os/tools/deployment-provider/manifest.ts`
- `packages/os/tools/deployment-provider/schema.ts`
- `packages/os/tools/registry.ts`

## workspace-owned: activity log

- 2026-07-23 20:41:13 fs.write: `.task/os-provider-tools/integrate-provider-manifest-discovery-approvals-and-runtime-bundles/workpad.md`
- 2026-07-23 20:45:23 fs.write: `packages/os/tools/deployment-provider/facade.test.ts`
- 2026-07-23 20:46:04 fs.write: `packages/os/tools/deployment-provider/facade.ts`
- 2026-07-23 20:47:41 fs.write: `packages/os/tools/deployment-provider/schema.ts`
- 2026-07-23 20:48:05 fs.write: `packages/os/tools/deployment-provider/handler.ts`
- 2026-07-23 21:11:16 fs.write: `packages/documentation/src/content/docs/connect/apps-and-services/railway.mdx`
- Managed by Consuelo OS task hooks.

## workspace-owned: validation evidence

- TDD red/green behavior, generated drift, provider regression, manifest/install-state, search, runtime-bundle, approval/redaction, strict review, and verify evidence are recorded above.
- 2026-07-23 21:12:13 `review.run`: passed — OK
- 2026-07-23 21:12:29 `verify`: passed — OK

## key decisions

- Final public architecture: one provider-neutral `deployment.*` surface with explicit `provider: railway | vercel | cloudflare`; provider-prefixed public surfaces are not registered.
- Deployment tools are internal façade operations, not script subprocesses. This avoids exposing environment values in argv/command traces while retaining generated tool metadata and client methods.
- Provider tools remain non-core; no bootstrap justification has been identified.
- Real provider mutation and real-Mac lifecycle commands are outside this worker's execution. Live validation will be read-only and credential-safe, with Ko retaining all real-Mac lifecycle checkpoints.
- Validation base is `origin/stream/os-provider-tools` because the task started from the provider stream.

## notes for ko

- No install, update, reset, restart, rollback, or uninstall command will be run on the Mac Mini or MacBook Air.
- No provider secret values will be read into task artifacts, tests, traces, PR comments, or review prompts.
- The task will stop at safe live-read checklists for Railway, Vercel, and Cloudflare; write operations are proved through deterministic tests and approval metadata.

## improvements noticed

- None yet. Any tooling or contract gap found during integration will be recorded here rather than broadened into an unassigned refactor.

## issues and recovery

1. `os.get_steering()` returned `GET_STEERING_RATE_LIMITED` and withheld the full steering document (`Attempt in current window: 3`). This was the only `get_steering` call in this conversation.
2. Recovery attempt: `os.call({ tool: "refresh_steering" ... })` failed with HTTP 403 / `UNKNOWN_TOOL_SCOPE`; the generated OS manifest did not expose that tool.
3. Recovery attempt: initial `fs.read` used unsupported legacy `full/json` fields without an exact task selector and failed `AMBIGUOUS_TASK_SELECTION` (trace `trc_f590aa8a808a`).
4. Recovery attempt: `fs.read` with `branch: main` failed because no active task existed for `main` (trace `trc_ebd71b6ade44`).
5. Recovery attempt: an unsupported `taskWorktree` selector still resolved ambiguously (trace `trc_139c57b5d611`).
6. Recovery: `tools.search` returned the current typed `fs.read`, `task.start`, `stream.sync`, and lifecycle schemas (trace `trc_d471710ddcd1`). Required read-only context was then loaded through an explicit existing branch, followed by creation of the exact Worker 12 task session.
7. Dependency/base issue: `stream/os-provider-tools` was eight commits behind current `main`. `stream.sync` merged and pushed current `main` without code conflicts; stream verification passed its sync gate (trace `trc_b948c5096b1d`).
8. Task route recovery complete: `task.start` created task PR #1602, branch, worktree, and task session `tsk_e782b1f08285` from synced stream SHA `689c892332049d5db2ba8b01ade5d76f9fb65d53` (trace `trc_684ad21b6d39`). Every subsequent task-scoped call uses that exact top-level task session.
9. The full steering payload remains unavailable because the bootstrap endpoint rate-limited and the manifest exposed no refresh tool. Repository/task work continues only through the recovered typed OS manifest and exact task session; this limitation must remain visible on the PR.
10. A batch discovery call did not propagate the outer task session to child `fs.*` steps (`trc_3912a070ed44`; child traces `trc_e821787c9c7a`, `trc_5dd503128678`). Recovery: repeated the reads as direct task-scoped calls (`trc_d09f0c8d4b97`, `trc_7c3f7613c4c1`).
11. One search referenced a nonexistent `packages/os/config` path (`trc_303acde523c5`). Recovery: retried only existing source paths (`trc_cf34969c7bc1`).
12. A broad schema patch failed because its hunk anchors did not match (`trc_992fd86b830a`), and a second signature hunk failed because of escaped generated strings (`trc_55dad15db7dd`). Recovery: read the exact windows and applied three narrow patches (`trc_d98859d6fc35`, `trc_ba0786590fb6`, `trc_714d837b7692`).
13. Two exploratory searches failed safely: one named a nonexistent facade test path (`trc_cfc3d64954db`) and one used an unescaped regex parenthesis (`trc_62241e6e56f0`). Recovery used `fs.list` and a literal `executeTool` search (`trc_498b02605050`, `trc_91a484fd430c`).
14. The combined Vitest lane and later full façade run expose an existing shared-state/code-runner defect: unrelated media timeout/dry-run and nested `code.call` characterizations fail only in multi-surface or Consuelo-runner contexts, while each owned lane and provider-focused façade contract passes in isolation (`trc_33edaf605dc`, `trc_096e566e3f13`, `trc_347d5a539110`). No production contract was weakened to accommodate this harness defect.
15. `git.status` ignored the exact task session and inspected local `main` (`trc_286e66028e00`). Recovery used the task-aware `git.diff`, `review.run`, and `verify` routes (`trc_c7f5d5be96a0`, `trc_6d6f493cda6e`, `trc_0fcd21197bbf`).
16. Snapshot regeneration through the Consuelo code runner failed on unrelated nested code-call tests after updating the intended obsolete snapshots (`trc_147b50217ed7`). The resulting snapshot delta was inspected (`trc_31e8d23ae9b0`); exact legacy names are absent and owned provider assertions remain green.

---

## publish checklist

- [x] Focused red and green evidence recorded.
- [x] Diff self-reviewed and generated artifacts regenerated from source.
- [x] Provider regressions, bundle classification, drift checks, review, and verify pass; isolated CI-equivalent lanes are green.
- [ ] CodeRabbit requested and all actionable findings dispositioned.
- [ ] Grok prompt rendered, wrapper run with exact task session, structured review and inline/top-level comments posted, findings verified/fixed/dispositioned, temporary review files removed.
- [ ] Task PR merged into `stream/os-provider-tools` only.
- [ ] Task worktree/session safely finished after merge proof.

- 2026-07-23 20:41:13 write: `.task/os-provider-tools/integrate-provider-manifest-discovery-approvals-and-runtime-bundles/workpad.md`

- 2026-07-23 20:45:23 write: `packages/os/tools/deployment-provider/facade.test.ts`

- 2026-07-23 20:46:04 write: `packages/os/tools/deployment-provider/facade.ts`

- 2026-07-23 20:46:08 apply-patch: `packages/os/tools/deployment-provider/errors.ts`
- 2026-07-23 20:46:44 apply-patch: `packages/os/tools/deployment-provider/handler.test.ts`

## workspace-owned: files read

- `packages/documentation/src/content/docs/connect/apps-and-services/railway.mdx`
- `packages/os/manifests/manifest.config.ts`
- `packages/os/plans/consuelo-os-foundation/workers/12-provider-integration.md`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tests/tools-search-v2.test.ts`
- `packages/os/tools/deployment-provider/errors.ts`
- `packages/os/tools/deployment-provider/types.ts`
- `packages/os/tools/registry.ts`

- 2026-07-23 21:12:47 apply-patch: `.task/os-provider-tools/integrate-provider-manifest-discovery-approvals-and-runtime-bundles/workpad.md`