## Summary

Implements Worker 11's customer-facing Cloudflare/Wrangler deployment-provider adapter for `stream/os-foundation-two`.

This change intentionally uses the customer's installed `wrangler` CLI and auth context. It does **not** import or invoke Consuelo platform Cloudflare provisioning, WAF migrations, route registries, connector tunnels, production account/zone identifiers, or release credentials.

### Changed

- Added `cloudflareDeploymentProviderAdapter` over the shared Worker 08 provider contract.
- Added explicit `worker:<name>`, `pages:<project>`, and `worker:<name>:<version-id>` references so mutations never select Consuelo resources implicitly.
- Normalized Wrangler 4 detect/version, auth/account context, Pages project discovery, Worker/Pages deployment listing, Worker version status, bounded logs, Worker/Pages deploys, Worker rollback/redeploy, secret-name discovery, secret updates, and approved raw passthrough.
- Added a bounded Node-compatible runner for log tails and stdin-only secret writes; it uses argv arrays with `shell: false` and redacts known secret material on failure.
- Added behavioral, runner, security-boundary, and runtime-bundle tests.
- Classified the two customer adapter files as `customer-provider` in the runtime bundle while keeping Consuelo operator Cloudflare modules excluded.

## Scope boundary

In scope: customer Wrangler operations through the shared provider-neutral contract.

Out of scope: device-authority release, workspace-edge deployment/migrations, WAF/DNS/connector/tunnel provisioning, production Cloudflare identifiers or credentials, public tool registration, and live `consuelo-os-dev` lifecycle mutation.

The reserved `CLOUDFLARE_OS_TEST_API_TOKEN` and authenticated environment lifecycle belong to Worker 17. This task performed only a safe local detect/auth read: Wrangler `4.74.0` was detected and the unauthenticated context normalized to typed `UNAUTHENTICATED` without returning credentials.

## Provider limitations for Worker 12

- `project.list` returns Pages projects only; Wrangler 4.74.0 has no stable Worker application-list command.
- Worker version status and rollback/redeploy are supported. Pages has no stable deployment-view or redeploy command, so those target-specific requests fail closed.
- General route/domain inspection is not advertised because current Wrangler has no stable general routes command.
- Worker 08 has no `environment.delete` operation. Secret deletion remains available only through the approved raw escape hatch (`secret delete` / `pages secret delete`) until the shared contract grows that operation.
- Worker 12 owns public tool manifests, search registration, and user-facing limitation messaging.

## TDD and validation

Red was established before production implementation: the focused suite failed before collection because `./cloudflare` did not exist.

Green validation:

- Cloudflare adapter suite: **14/14 passed**.
- Cloudflare + shared provider-core suites: **40/40 passed**.
- Runtime-bundle suite: **16/16 passed**.
- Direct TypeScript check of both new modules: passed.
- Package syntax check: passed.
- Strict repository review: **0 local findings, 0 pre-existing findings**.
- Full task verify: passed, database-risk scan clean, publish-valid stamp created.
- Disposable customer runtime archive: built and verified; **369 files**, valid embedded manifest.
- Archive inspection: both customer adapter files present; operator Cloudflare configs/provisioning modules absent.

Representative commands:

```text
bunx vitest run packages/os/tools/deployment-provider/cloudflare.test.ts packages/os/tools/deployment-provider/handler.test.ts
bunx vitest run packages/os/tests/distribution/runtime-bundle.test.ts
bunx tsc --noEmit --skipLibCheck --moduleResolution bundler --module esnext --target es2022 --types node packages/os/tools/deployment-provider/cloudflare.ts packages/os/tools/deployment-provider/cloudflare-runner.ts
bun run --cwd packages/os typecheck
bun packages/os/scripts/build-runtime-bundle.ts build ...
bun packages/os/scripts/build-runtime-bundle.ts verify --archive ...
```

## Route/tool failure and recovery record

The assigned brief requires the original failure and every recovery attempt to be durable on the PR. No failure was bypassed with native Git, unscoped shell, another computer, provider substitution, or the legacy workspace connector.

1. Steering `fs.read` was called with unsupported options and no selected task, producing `AMBIGUOUS_TASK_SELECTION` (`trc_e04bfc61d687`). Recovered by inspecting the tool contract and using OS-mediated absolute `mac.read`.
2. Steering `fs.read` with branch `main` failed because `main` is not a live task branch (`trc_95b085267bdb`). Recovered with OS-mediated absolute read.
3. Literal `$CONSUELO_HOME` through `mac.read` produced ENOENT (`trc_340ef5b6f76a`). Resolved the absolute `/Users/kokayi/.consuelo` path and read it.
4. GitHub branch compare returned 404 because assigned `stream/os-foundation-two` did not exist (`trc_29c2594302a9`). Verified the plan assignment and initialized the stream through typed `stream.create`.
5. Pre-task `fs.search` calls hit active-task ambiguity (`trc_3575b523db7a`, `trc_ee9356cea79d`). Recovered with OS-mediated read-only search.
6. Incorrect `gh` facade actions failed (`trc_9008a9a80c26`, `trc_0a28ef7154ab`). Recovered with the supported typed `github` operations.
7. `task.start({ createStream: true })` omitted `--create-stream` and failed (`trc_48212e4cc3e0`). Two scoped CLI attempts were correctly rejected before a managed task existed (`trc_642f67f42fa3`, `trc_ee82b57746b6`). Final recovery used typed `stream.create` (`trc_047cf3e246d2`) and then `task.start` (`trc_44fca5b3fa72`).
8. Initial workpad overwrite omitted `force` and was rejected (`trc_2a9ab1bd4548`). Retried with explicit overwrite; no product file was affected.
9. Typed GitHub PR diff invoked unsupported `gh pr diff --stat` (`trc_1b9bd536e606`); sibling file packets were empty (`trc_9d595e9e949d`, `trc_0056257a5b53`). Sibling comparison was nonessential, so implementation proceeded from the committed Worker 08 contract and Worker 11 brief.
10. The first red-run wrapper shadowed Node's `process` binding and failed before Vitest (`trc_6ca513c314b6`). Retried with a corrected variable; the intended missing-module red was recorded (`trc_37274af046af`).
11. The first green run exposed two over-specified test assertions and a Bun-global portability defect (`trc_b4826c6498ad`). Corrected the output contracts, replaced Bun spawn with argv-safe `node:child_process.spawn`, and reached 14/14 green (`trc_4f74f6275b96`).
12. A diagnostic import resolved relative to the temporary wrapper and failed (`trc_48dff36bd136`). Retried with the explicit managed task-worktree module path; runner behavior reproduced (`trc_6b1c76197758`, `trc_128ac29051ba`).
13. Standalone `runtime-bundle:verify` failed because `--archive` is mandatory (`trc_3a1e6c1ebff0`). Recovered with the documented build-then-verify sequence (`trc_6c2ec6345047`).
14. Strict review found three async error-handling violations (`trc_01ebb5eb7f33`). Added cleanup and cause-preserving error paths, reran tests/typechecks (`trc_5e9cd733ee90`), and strict review passed with zero findings (`trc_ca9954c8af1d`).
15. Generic `task.push` forwarded `--task-session` to the drifted workspace script, which rejected the flag (`trc_e22a7e8083cc`). Diagnosis showed the OS-native task-push accepts the required selector (`trc_aa9cc1148d8e`). Recovered through the exact OS-native lifecycle command inside the managed task worktree; commit `b1b1f5af` pushed (`trc_3b68e6e596ef`).
16. The first exact Grok wrapper outlived the outer tool-call window and later ended `Cancelled` with exit code 1 and no structured review (run `trc_7b2e452b758a`). It failed closed. The recovery removed redundant inline diff duplication while preserving the exact published diff/context in adjacent workspace files.
17. A polling diagnostic was rejected as read-mode mutation when the subagent wrote task evidence (`trc_435022c0e9d4`). Subsequent inspection used scoped edit mode.
18. Typed `task.call` returned HTTP 403 `UNKNOWN_TOOL_SCOPE` because it was advertised but absent from the generated manifest. The identical wrapper command was launched through detached task-scoped `code.call` instead (`trc_49ec2ae5590a`).
19. Long polling calls exceeded the outer OS window while the detached wrapper remained active. Short deterministic inspections later established successful completion: trace `trc_59594addcd3a`, stop reason `EndTurn`, exit code 0.
20. Direct nested parsing failed because the wrapper compacted/truncated provider JSON (`trc_cd27e030f456`); the preserved log was also truncated after the final message (`trc_aad6c2193c70`). The exact valid provider `text` prefix before `stopReason` was decoded and its structured review parsed without reconstructing truncated reasoning (`trc_226ff5af1dbe`).
21. Final metadata push used a relative `--files` path while launched with `--cwd packages/os`, so it resolved under `packages/os/.task` and failed ENOENT (`trc_096df0731c2e`). No commit was created. Recovery: retry with the absolute workpad path.

## Review status

- CI: **43 checks complete** — 27 passed, 16 skipped, 0 pending/failing/other. PR state is `CLEAN` and `MERGEABLE`.
- CodeRabbit: requested; configured path filters excluded all 11 changed files. No findings were emitted.
- Grok 4.5: **approved / high confidence / 0 findings**.
  - Full structured review: https://github.com/consuelohq/opensaas/pull/1591#issuecomment-5060868682
  - Top-level summary: https://github.com/consuelohq/opensaas/pull/1591#issuecomment-5060868948
  - Finding disposition: https://github.com/consuelohq/opensaas/pull/1591#issuecomment-5060869180
- Submitted reviews: 0; inline review comments: 0. No fixes were required after external review.

## Foundation-plan impact

This supplies the Cloudflare sibling to the shared provider core while preserving the customer/operator security boundary. Worker 12 can later register one provider-neutral deployment surface without exposing Consuelo's own Cloudflare control-plane resources. Worker 17 retains ownership of authenticated nonproduction lifecycle coverage.
