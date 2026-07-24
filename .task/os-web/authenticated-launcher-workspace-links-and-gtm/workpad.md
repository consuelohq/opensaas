# authenticated launcher workspace links and gtm

branch: `task/os-web/authenticated-launcher-workspace-links-and-gtm`
stream: `stream/os-web`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1641/authenticated-launcher-workspace-links-and-gtm
github pr: https://github.com/consuelohq/opensaas/pull/1641
started: 2026-07-24

## acceptance criteria

- [x] Derive launcher and every product URL from authenticated workspace membership/route state, including `internal.consuelohq.com` only when the resolved workspace is `internal`.
- [x] Serve protected workspace-local GTM at `https://<workspace>.consuelohq.com/gtm`; never fall back to `app.consuelohq.com`, `sites.consuelohq.com`, a test host, or a hard-coded internal host.
- [x] Preserve the existing universal-login handoff and host-scoped workspace session so launcher-to-GTM navigation requires no second Google login.
- [x] Keep launcher and `/gtm` protected while pre-auth output remains static and sanitized.
- [x] Define tenant-safe launcher/GTM cache keys that cannot cross workspace boundaries.
- [x] Register the literal `/gtm` route before parameter/catch-all routes and preserve all existing site routes.
- [x] Return a clear redacted unavailable-node response without leaking connector topology or secrets.
- [x] Prove internal/customer URL generation, auth, handoff, cache isolation, route ordering, and route stability with failing-first behavioral tests and browser/screenshot evidence if visible UI changes.
- [ ] Complete focused and broad validation, CI, CodeRabbit, Grok 4.5 review, finding dispositions, and merge PR #1641 into `stream/os-web` only.

## plan

1. Inventory launcher generation, sites registry, snapshot publication/cache behavior, workspace-edge routes, GTM targets, and every hard-coded product/workspace host.
2. Verify the Worker 14 authentication/session contracts and literal route ordering, then select the narrow owned implementation boundary.
3. Add focused behavioral tests first and capture the intended red failures for URL derivation, protected `/gtm`, session reuse, cache isolation, unavailable-node redaction, and route ordering.
4. Implement typed authenticated-workspace URL generation plus the smallest workspace-edge/registry/snapshot changes needed for `/gtm`.
5. Run the focused green tests, existing site/auth/gateway regressions, typecheck/build/Wrangler dry-runs, and browser/screenshot proof if launcher output changes.
6. Run workspace review and publish verification against `origin/stream/os-web`, push the task PR, request CodeRabbit, and run the prescribed Grok 4.5 wrapper.
7. Post all review evidence and dispositions to GitHub, remove temporary review artifacts, merge the task PR into `stream/os-web`, and stop without promoting the stream to main or mutating either real Mac.

## current status

- Task session `tsk_6075fdb62048` is active on PR #1641 from synchronized `stream/os-web`.
- Mandatory plan, environment registry, Worker 15 brief, Grok template, repository steering, coding standards, OS guidance, task skill, and senior-engineer skill are read in full.
- Discovery confirms the launcher hard-codes `sites.consuelohq.com`, while the workspace edge already has host-scoped route lookup, workspace-session handoff, connector proxying, and redacted failures. No separate GTM server or handler exists in the repository.
- The focused red run is captured at `trc_4ac9a94d01c7`: 32 tests executed, 25 passed, and 7 failed for the intended missing contracts (workspace-derived launcher links, invalid global-host rejection, protected private launcher serving, `/gtm` seed policy/order, and clear unavailable-node copy). The existing authenticated `/gtm` proxy and unauthenticated universal-login redirect already passed with a supplied route.
- Production implementation is complete for the owned boundary. Focused green validation is `trc_c3426030e571` (32/32), initial integration validation is `trc_5abe9619dd21` (46/46), and final owned-lane validation is `trc_9bc0637b3678` (73/73 plus syntax and generated-manifest checks).
- A package-wide `bun test` attempt (`trc_55d4db33b39c`) executed 2,039 tests with 1,793 passing, but failed the isolated-worktree lane because generated runtime manifests were absent and environment-dependent suites cascaded. The run also appended snapshots before `code.call` correctly rejected mutation in verify mode. The accidental snapshot append was removed through task-scoped `code.call` (`trc_690df261bc0a`) and the file is clean (`trc_e89c5b871422`). Correct generated-artifact and workspace-edge validation lanes are being resolved next.
- The repository's exact OS CI contract and manifest-current gate pass (`trc_157ecc9980d0`, 44/44). The exact Sites/Gateway CI lane passes (`trc_64c37c49e8bd`, 17/17; Cloudflare contract was also explicitly enabled and passed in `trc_d7bb9b131547`, 27/27). Wrangler workspace-edge deploy dry-run passes with the expected D1, R2, and Durable Object bindings (`trc_25dca636a430`). Strict workspace review is clean with zero findings (`trc_22aef9979eea`).
- No screenshot was required: the visual layout and rendered copy are unchanged; only authenticated href derivation and route/auth behavior changed. Browser-equivalent Request/Response contracts cover session handoff, redirect, proxy, cache, and redaction behavior.

## Test-first contract

- Behavior under test: authenticated workspace state produces canonical workspace-local product links; `/gtm` is a literal protected workspace-edge route that reuses the existing host session, isolates cache entries by workspace, and fails redacted when its selected node is unavailable.
- Existing local pattern to follow: `launcher-onboarding.test.ts`, `workspace-edge-route-seed-contract.test.ts`, `cloudflare-edge-router.test.ts`, Worker 14 universal-login/session tests, and the current typed registry/snapshot builders.
- New or changed tests: launcher URL generation for `internal.consuelohq.com` and an arbitrary customer host; rejection of `app.consuelohq.com` and `sites.consuelohq.com` fallbacks; a literal `/gtm` route targeting the authenticated workspace connector with `workspace-session`; route order before wildcard; host-session reuse without an OS token; cross-workspace route-cache isolation; and a redacted unavailable-node response.
- Focused red command: `bun test packages/os/tests/launcher-onboarding.test.ts packages/os/tests/workspace-edge-route-seed-contract.test.ts packages/os/tests/cloudflare-edge-router.test.ts` through task-scoped `code.call` with `tddPhase: red`.
- Expected red failure: the launcher item builder has no authenticated-workspace hostname input and the route seed has no protected literal `/gtm` connector route.
- No-test waiver: none.

## files changed

- `packages/os/scripts/lib/launcher-onboarding.ts` — workspace-derived product links and reserved global-host rejection.
- `packages/os/scripts/lib/sites.ts` — forwards authenticated/configured workspace hostname into launcher materialization.
- `packages/os/scripts/lib/workspace-edge-route-seed.ts` — protected private launcher plus literal protected `/gtm` connector route before fallback routes.
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts` — serves authorized private launcher snapshots and returns clear redacted unavailable-node copy.
- `packages/os/cloudflare/workspace-edge/README.md` — documents the protected launcher, `/gtm`, and private cache policy.
- Launcher, Sites CLI, route seed, edge router, and Sites/Gateway integration tests — failing-first coverage for internal/customer routing, auth handoff, cache isolation, route order, and redaction.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-24 17:04:58 `review.run`: passed — OK
- 2026-07-24 17:05:36 `review.run`: passed — OK

## key decisions

- The approved foundation plan and Worker 15 brief are authoritative over stale repository notes that still name `consuelo.consuelohq.com`; `internal.consuelohq.com` may appear only as the result of resolving the authenticated `internal` workspace.
- Work stays in Stream C / `stream/os-web`, uses deterministic local/browser-compatible fixtures and GitHub CI, and does not mutate production Cloudflare resources or either real Mac.
- `/gtm` reuses the existing `os-connector` target kind but requires `workspace-session`, while `/mcp` retains its existing required/signed connector contract. This gives browser users the authenticated workspace handoff, preserves tenant routing, and reuses the existing fail-closed redacted connector-unavailable behavior without inventing a public GTM service.

## notes for ko

- No install, update, reset, restart, or uninstall command will run on the Mac Mini or MacBook Air. Any live acceptance point will be returned as an exact human-run command with expected results.

## improvements noticed

- Pre-task `fs.read` currently routes through active-task selection despite being advertised as session-optional, which prevents mandatory bootstrap reads when multiple worktrees exist.
- `stream.sync` advertises a `repo` field through the facade schema, but the backing script rejects `--repo`.

## issues and recovery

- Bootstrap repository reads failed first with `AMBIGUOUS_TASK_SELECTION` (`trc_f96dc2ddbb64`), then with `no active task found for branch main` (`trc_2592f2f3143e`), and again with ambiguous selection using the documented multi-file shape (`trc_d8a1e6a76e33`). Recovery: used the typed GitHub raw route with explicit audit reasons to obtain the brief and bootstrap context, then reread every mandatory file in full through direct task-scoped `fs.read` after `task.start`. No native filesystem, legacy connector, or unscoped shell was used.
- The first stream synchronization call included the facade-advertised `repo` input and failed because the script does not support `--repo` (`trc_36bb519e6bc1`). Recovery: retried the same typed `stream.sync` route with only `area` and `stream`; it merged current `main`, verified, and pushed `stream/os-web` successfully (`trc_f6cdd03ac22e`).
- `decideNext` did not see exploration performed inside `batch` and failed with `no explore state found` (`trc_d12fb646a328`). Recovery: reran one focused direct task-scoped `explore` call, after which `decideNext` succeeded (`trc_4477864c51f4`).
- A task-scoped outer `batch` failed to propagate `tsk_6075fdb62048` into five child `fs.search` calls and returned `AMBIGUOUS_TASK_SELECTION` (`trc_87a3c46272fd`; children `trc_8cbebf68a3d4`, `trc_fac2307a6776`, `trc_37a330039565`, `trc_91dd761d3e12`, `trc_3c1474c0aaaa`). Recovery: use direct task-scoped `fs.search` calls for this inventory and avoid claiming batch task inheritance until the facade is repaired.
- A direct launcher search used `maxResults: 220`, exceeding the typed limit of 200 (`trc_3cb44df15b65`). Recovery: retried with 200 and completed the inventory.
- The first GTM implementation search included nonexistent top-level `apps` and `src` paths (`trc_b46bf6e44a5c`). Recovery: retried against the existing `packages` tree (`trc_8372d126a76f`), confirming no separate GTM handler exists.
- The first caller search used `runLauncherOnboarding(` as an unescaped regular expression and failed with an unclosed group (`trc_cb29f8c37d60`). Recovery: retried with the literal symbol name; because the search index returned no matches despite the known module (`trc_45241476e5c3`), direct task-scoped reads of `launcher-onboarding.ts`, `sites.ts`, and `os.ts` established the call path.
- A discovery read included the nonexistent `packages/os/scripts/lib/onboard.ts` (`trc_d9725eae40d4`). Recovery: the same scoped read returned the valid launcher and OS files, and subsequent direct reads established `sites.ts` as the actual caller.
- Two guessed test paths, `workspace-cloudflare-d1-route-registry.test.ts` and `sites-materialization.test.ts`, did not exist (`trc_47403451fac0`). Recovery: used the existing `workspace-edge-route-seed-contract.test.ts`, `cloudflare-edge-router.test.ts`, `workspace-hostname-edge-router.test.ts`, and `sites-cli.test.ts` contracts instead.
- The first focused test invocation used an obsolete `code.call` shape and failed schema validation (`trc_0b293c638827`). `tools.search` confirmed the current `language`/`mode`/`code` contract (`trc_9c6c6e771f44`). The catalog also advertised `task.call`, but that route was absent from the generated MCP manifest and returned `UNKNOWN_TOOL_SCOPE`. Recovery: reran the exact focused command through correctly shaped task-scoped `code.call`; the intentional red result is `trc_4ac9a94d01c7`.
- The first combined production patch did not apply because the launcher type/context differed from the earlier excerpt. Recovery: reread the exact edit spans and applied smaller anchored patches; no partial production mutation occurred before the corrected patches.
- Task-scoped `status` ignored the task session and reported repository `main` (`trc_898a6a2472f8`). Recovery: use task-aware `git.diff`, task lifecycle, and scoped filesystem calls for worktree truth.
- The package-wide `bun test` lane failed in the isolated task worktree (`trc_55d4db33b39c`) because legacy/environment-dependent suites expected generated or local runtime state unavailable in this lane, causing 102 failures after 1,793 passes. It also generated an unrelated facade snapshot append before the verify mutation guard stopped the command. Recovery: removed only the appended lines through scoped `code.call` (`trc_690df261bc0a`), verified zero remaining snapshot diff (`trc_e89c5b871422`), inspected the repository CI workflow, and ran its actual OS and Sites/Gateway contract lanes successfully (`trc_157ecc9980d0`, `trc_64c37c49e8bd`) plus the broader owned edge suite (`trc_9bc0637b3678`) and Wrangler dry-run (`trc_25dca636a430`).
- The first broader edge integration run found one stale assertion that the root launcher remained public (`trc_95a0f651d7e5`; 26/27 passed). Recovery: updated that approved regression contract to `workspace-session`/`private-preview`, added `/gtm` integration/order assertions, and reran green (`trc_d7bb9b131547`, 27/27).

---

## publish checklist

```bash
bun run task:push -- --message "type(os-web): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/plans/consuelo-os-foundation/environment-registry.md`
- `packages/os/plans/consuelo-os-foundation/plan.md`
- `packages/os/plans/consuelo-os-foundation/workers/15-launcher-gtm-routing.md`
- `packages/os/plans/consuelo-os-foundation/workers/grok-review-template.md`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/workspace/senior-engineer.md`

- 2026-07-24 17:03:30 apply-patch: `.task/os-web/authenticated-launcher-workspace-links-and-gtm/workpad.md`
- 2026-07-24 17:04:06 apply-patch: `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

- 2026-07-24 17:05:09 apply-patch: `packages/os/cloudflare/workspace-edge/README.md`

- 2026-07-24 17:05:56 apply-patch: `.task/os-web/authenticated-launcher-workspace-links-and-gtm/workpad.md`