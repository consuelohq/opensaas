# cloudflare provider

branch: `task/os-foundation-two/cloudflare-provider`
stream: `stream/os-foundation-two`
task session: `tsk_308cb0c69b5e`
pr: https://github.com/consuelohq/opensaas/pull/1591
started: 2026-07-23
assigned environment: local customer Wrangler CLI context; reserved live Cloudflare lane is `consuelo-os-dev` and remains unavailable until Worker 17

## objective

Implement Worker 11's customer-facing Cloudflare/Wrangler deployment-provider adapter. It must use the customer's installed CLI context, expose only provider-neutral deployment operations, and remain structurally separate from Consuelo platform provisioning, WAF migrations, route registries, connector tunnels, production account/zone identifiers, and release credentials.

## acceptance criteria

- [x] A Cloudflare adapter implements the shared Worker 08 deployment-provider contract for stable Wrangler capabilities.
- [x] Detect/version and auth/account context are normalized without returning tokens.
- [x] Projects/Workers/Pages applications are listed only where Wrangler exposes stable commands, with no Consuelo defaults.
- [x] Deployment/version status and bounded logs are normalized where supported.
- [x] Worker or Pages deployment requires explicit approval and exact customer-selected config/project context.
- [x] Secret/environment operations list names/presence only and set/delete without reading secret values.
- [x] Routes/domains are read-only where stable CLI support exists.
- [x] Raw passthrough retains shared approval, argv safety, timeout, and redaction protections.
- [x] Known Consuelo operator commands, config paths, modules, account/zone IDs, and platform credentials are rejected structurally and behaviorally.
- [x] Runtime-bundle classification proves the customer adapter is shippable while Consuelo operator provisioning remains excluded.
- [ ] Focused adapter, security-boundary, and regression suites pass; CI, CodeRabbit, and Grok findings are fully disposed.

## scope boundaries

In scope:
- Cloudflare adapter implementation under `packages/os/tools/deployment-provider/`.
- Adapter-focused tests, fixtures, security-boundary tests, and runtime-bundle classification proof.
- Stable CLI command mapping and limitations handoff for Worker 12.

Out of scope:
- Editing Cloudflare Worker applications or central tool manifests.
- Consuelo device-authority release, workspace-edge deploy/migrations, WAF migration, DNS/connector provisioning, route registries, or tunnel-token creation.
- Consuelo production account/zone IDs, production tokens, or release credentials.
- Live Cloudflare resource mutation; the dedicated `CLOUDFLARE_OS_TEST_API_TOKEN` is reserved for Worker 17 and is not currently available.
- Installing, updating, resetting, restarting, or uninstalling Consuelo OS on Ko's Mac Mini or MacBook Air.
- Promoting the assigned stream to `main` or starting Worker 12.

## plan

1. Map the shared provider contract, Wrangler command surface, sibling adapter conventions, runtime-bundle classifier, and operator boundaries.
2. Write failing behavioral tests for adapter behavior and structural exclusion, then record focused red evidence.
3. Implement the smallest stable Wrangler adapter without importing or invoking Consuelo operator modules.
4. Run focused tests, provider-core regressions, runtime-bundle classification, typecheck, review, and task verification.
5. Push the task PR, request CodeRabbit, run/post the mandated Grok review, fix valid findings, rerun validation, and post dispositions.
6. Merge only into `stream/os-foundation-two` and record Worker 12 handoff metadata/limitations.

## TDD contract

- Required: behavioral tests before production implementation.
- No product implementation edit occurred before the red run.
- Red established on 2026-07-23: the focused suite failed because `./cloudflare` did not exist; trace `trc_37274af046af`.

## current status

- Exact task session is active on PR 1591.
- Implementation and local validation are complete. Strict review and full verify are green; PR publication and external reviews are next.
- Worker 11 brief re-read after initial infrastructure discovery clarified the strict customer/provider boundary.
- Existing Consuelo Cloudflare platform modules are evidence for forbidden imports/commands, not implementation dependencies.

## discovery evidence

- Shared provider core: `packages/os/tools/deployment-provider/{types,schema,errors,service,process,redaction,testing}.ts`; trace `trc_62e6002a5fe3`.
- Worker 11 hard boundary and capabilities confirmed; trace `trc_886d4494bdf0`.
- Environment registry reserves `consuelo-os-dev`, `CLOUDFLARE_OS_TEST_API_TOKEN`, and run-scoped test prefixes for Worker 17; it forbids production fixtures; trace `trc_da4818e79c51`.
- Existing Consuelo platform Cloudflare modules/configs were inspected only to define rejection boundaries; traces `trc_42f57f905bcc`, `trc_65052211cef2`.
- Installed Wrangler 4.74.0 command/help and bundled source confirmed JSON whoami, Pages project/deployment, Worker deployments/versions/rollback, tails, and secret commands; no stable general routes command; traces `trc_123a8cc316a1`, `trc_36ab6cdee18f`, `trc_3ce2321100de`, `trc_51b9d4909c5b`.
- Sibling provider PRs are open on `stream/os-provider-tools`, but the GitHub facade currently reports empty file packets; traces `trc_3fd1307be1dd`, `trc_9f7dcc5932de`, `trc_9d595e9e949d`, `trc_0056257a5b53`.

## files changed

- `.task/os-foundation-two/cloudflare-provider/workpad.md`
- `packages/os/tools/deployment-provider/cloudflare-runner.ts`
- `packages/os/tools/deployment-provider/cloudflare.test.ts`
- `packages/os/tools/deployment-provider/cloudflare.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`

## workspace-owned: files changed

- `.task/os-foundation-two/cloudflare-provider/workpad.md`
- `packages/os/tools/deployment-provider/cloudflare-runner.ts`
- `packages/os/tools/deployment-provider/cloudflare.test.ts`
- `packages/os/tools/deployment-provider/cloudflare.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`

## workspace-owned: activity log

- 2026-07-23 15:48:57 fs.write: `.task/os-foundation-two/cloudflare-provider/workpad.md`
- 2026-07-23 15:53:28 fs.write: `packages/os/tools/deployment-provider/cloudflare.test.ts`
- 2026-07-23 15:54:44 fs.write: `packages/os/tools/deployment-provider/cloudflare-runner.ts`
- 2026-07-23 15:55:37 fs.write: `packages/os/tools/deployment-provider/cloudflare.ts`
- 2026-07-23 15:57:15 fs.write: `packages/os/tools/deployment-provider/cloudflare-runner.ts`
- 2026-07-23: confirmed the live Cloudflare token/lifecycle belongs to Worker 17, not this worker.
- 2026-07-23: corrected initial over-broad workpad scope after re-reading Worker 11's strict customer/provider boundary.
- 2026-07-23: mapped provider core and existing Cloudflare platform modules.
- 2026-07-23: read steering, plan, environment registry, Worker 11 brief, Grok template, engineering/task instructions, and repository standards.
- 2026-07-23: recovered the missing assigned stream through typed `stream.create`, then created exact task session and PR.
- 2026-07-23: verified current `main` and prerequisite provider-core promotion.

## workspace-owned: validation evidence

- RED: `bunx vitest run packages/os/tools/deployment-provider/cloudflare.test.ts` failed before collection with `Cannot find module './cloudflare'`; 1 failed suite, 0 tests; trace `trc_37274af046af`.
- GREEN focused: Cloudflare adapter suite 14/14 passed; trace `trc_4f74f6275b96`.
- GREEN regressions: Cloudflare + provider core 40/40 passed; runtime-bundle suite 16/16 passed; trace `trc_de8c1b7816fd`.
- GREEN syntax/type: package syntax check passed and direct TypeScript check of both new modules passed; traces `trc_3a1e6c1ebff0`, `trc_6c2ec6345047`.
- GREEN archive: disposable customer archive built and verified (369 files, valid embedded manifest); adapter and runner present, operator Cloudflare paths absent; traces `trc_6c2ec6345047`, `trc_7092853e0419`.
- GREEN safe local read: adapter detected Wrangler 4.74.0; unauthenticated local context normalized to typed `UNAUTHENTICATED`; no credential value returned; trace `trc_470758b26f2d`.
- 2026-07-23 15:59:26 `review.run`: passed — OK
- 2026-07-23 16:00:04 `review.run`: passed — OK
- 2026-07-23 16:00:13 `verify`: passed — OK

## key decisions

- Implement a pure Wrangler adapter over the shared provider process service; do not import `packages/os/scripts/lib/*cloudflare*` platform modules.
- Never default to Consuelo account, zone, Worker, Pages project, hostname, or config paths.
- Require explicit customer-selected config/project context for mutations.
- Treat unsupported/unstable Wrangler surfaces as explicit missing capabilities rather than approximating with Consuelo APIs.
- Use fake CLI/process fixtures for deterministic tests. Live mutation is excluded because the reserved credential is unavailable and assigned downstream.

## Worker 12 handoff and limitations

- References are explicit: `worker:<name>`, `pages:<project>`, and Worker versions as `worker:<name>:<version-id>`.
- Worker deploys require a caller-selected Wrangler config path in `source`; Pages deploys require a caller-selected output directory.
- Wrangler 4.74.0 exposes stable Pages project listing but no stable Worker application-list command, so `project.list` returns Pages projects only.
- Worker version status and rollback/redeploy are supported. Pages has no stable deployment-view or redeploy command, so those target-specific requests fail closed.
- General route/domain inspection is not advertised because current Wrangler has no stable general routes command.
- Worker 08 has no `environment.delete` operation. Deletion remains available only through the approved/raw Wrangler escape hatch (`secret delete` or `pages secret delete`) until the shared contract grows that operation.
- Worker 12 owns public tool manifests, search registration, and user-facing limitation messaging.
- Worker 17 owns authenticated `consuelo-os-dev` lifecycle tests; this worker performed only safe local detect/auth reads.

## notes for ko

- No Consuelo OS installation or machine service action will be performed. Any real-machine requirement will stop at a human checkpoint with the exact command and expected result.

## improvements noticed

- `task.start({ createStream: true })` accepted the field but omitted `--create-stream`; typed `stream.create` worked.
- `tools.search` did not list the invokable `stream.create` tool.
- Typed `github pr.diff` appends unsupported `gh pr diff --stat`; sibling `pr.files` packets also incorrectly report zero files.

## issues and recovery

1. Steering `fs.read` used unsupported options/no selected task: `trc_e04bfc61d687`. Recovered with OS-mediated absolute `mac.read`.
2. Steering `fs.read` with branch `main` failed because `main` is not a live task branch: `trc_95b085267bdb`. Recovered with OS-mediated absolute read.
3. Literal `$CONSUELO_HOME` through `mac.read` produced ENOENT: `trc_340ef5b6f76a`. Resolved the absolute path and read it.
4. GitHub compare returned 404 because assigned stream did not exist: `trc_29c2594302a9`. Verified lifecycle and created the stream through typed OS tooling.
5. Pre-task `fs.search` calls hit active-task ambiguity: `trc_3575b523db7a`, `trc_ee9356cea79d`. Recovered with OS-mediated read-only search.
6. Incorrect `gh` facade actions failed: `trc_9008a9a80c26`, `trc_0a28ef7154ab`. Recovered with supported typed `github` operations.
7. `task.start` omitted requested create-stream flag: `trc_48212e4cc3e0`. Two scoped CLI recovery attempts were correctly rejected before a managed task existed: `trc_642f67f42fa3`, `trc_ee82b57746b6`. Final recovery used typed `stream.create` (`trc_047cf3e246d2`) then `task.start` (`trc_44fca5b3fa72`).
8. Initial workpad overwrite omitted `force`: `trc_2a9ab1bd4548`. Retried with explicit overwrite; no product file was affected.
9. Typed GitHub PR diff failed because the facade invokes unsupported `--stat`: `trc_1b9bd536e606`. Raw GitHub API recovery produced empty facade packets (`trc_9d595e9e949d`, `trc_0056257a5b53`); sibling code comparison remains nonessential and will use scoped branch/API inspection only if needed.
10. Initial red-run wrapper shadowed Node's `process` binding and failed before Vitest: `trc_6ca513c314b6`. Retried with a corrected child variable; the intended missing-module red result was recorded in `trc_37274af046af`.
11. First green run had three failures: two over-specified assertions and a Bun-global portability defect (`trc_b4826c6498ad`). Corrected the output contracts, reproduced the runner, replaced Bun spawn with argv-safe `node:child_process.spawn`, and reached 14/14 green (`trc_4f74f6275b96`).
12. A diagnostic import resolved relative to the temporary code-call wrapper and failed (`trc_48dff36bd136`). Retried with the explicit task-worktree module path; runner behavior reproduced successfully (`trc_6b1c76197758`, `trc_128ac29051ba`).
13. Standalone `runtime-bundle:verify` failed because `--archive` is mandatory (`trc_3a1e6c1ebff0`). Recovered through the documented build-then-verify sequence using a disposable `/tmp` archive; both steps passed (`trc_6c2ec6345047`).
14. Strict review initially found three local async error-handling violations (`trc_01ebb5eb7f33`). Added cleanup/cause-preserving error paths, reran 40 provider tests and direct TypeScript checks (`trc_5e9cd733ee90`), then strict review passed with zero findings (`trc_ca9954c8af1d`).

---

## publish checklist

- [x] Focused red evidence recorded before product edit.
- [x] Focused and provider-core regression suites green.
- [x] Runtime-bundle customer/operator boundary proven.
- [x] `review.run` and `verify` green.
- [ ] Task changes pushed and PR body current.
- [ ] CodeRabbit requested and all substantive findings disposed.
- [ ] Grok prompt rendered, exact wrapper invoked, structured review/findings/summary posted, dispositions recorded, tmp review folder removed.
- [ ] Task PR merged only into `stream/os-foundation-two`.

- 2026-07-23 15:48:57 write: `.task/os-foundation-two/cloudflare-provider/workpad.md`

- 2026-07-23 15:53:28 write: `packages/os/tools/deployment-provider/cloudflare.test.ts`

- 2026-07-23 15:54:44 write: `packages/os/tools/deployment-provider/cloudflare-runner.ts`

- 2026-07-23 15:55:37 write: `packages/os/tools/deployment-provider/cloudflare.ts`

## workspace-owned: files read

- `packages/os/scripts/build-runtime-bundle.ts`
- `packages/os/tools/deployment-provider/cloudflare-runner.ts`
- `packages/os/tools/deployment-provider/cloudflare.test.ts`
