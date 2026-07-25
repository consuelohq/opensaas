# Authenticated launcher workspace links and GTM

branch: `task/os-web/authenticated-launcher-workspace-links-and-gtm`
stream: `stream/os-web`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1648/authenticated-launcher-workspace-links-and-gtm
github pr: https://github.com/consuelohq/opensaas/pull/1648
started: 2026-07-25

## acceptance criteria

- [ ] Generate launcher product URLs from the authenticated workspace host for `internal` and arbitrary customer workspaces, with no `sites`, `app`, testing, or hard-coded `internal` fallback.
- [ ] Add literal workspace-edge `/gtm` routing ahead of `/`, backed by a workspace-specific GTM snapshot and protected by the existing host-scoped workspace session.
- [ ] Protect the launcher root and `/gtm`; a single consumed handoff/session must open both without a second Google login.
- [ ] Preserve existing product route names, layout, non-GTM site routes, OAuth/connector contracts, and safe unavailable behavior.
- [ ] Prove workspace-specific snapshot/cache isolation and fail closed without leaking topology or secrets.
- [ ] Complete focused and broader validation, CI, CodeRabbit, independent Grok review, finding dispositions, task PR merge into `stream/os-web`, and durable GitHub evidence.

## plan

1. Lock the launcher URL, route order/auth, session reuse, snapshot publication, and cache-isolation behavior in focused tests.
2. Run the focused tests red and retain the expected failures.
3. Implement the smallest typed URL builder, launcher integration, protected `/gtm` snapshot route, and edge session support.
4. Run focused green tests, route/auth regression suites, static checks, diff review, workspace review, and verify.
5. Push the task PR, request CodeRabbit, render/run the committed Grok template, post and disposition every finding, then merge only into `stream/os-web`.

## Test-first contract

- Behavior under test: authenticated workspace hosts own launcher links; `/gtm` is a literal protected workspace route; launcher and GTM reuse one host-scoped session; snapshot/cache identity includes workspace host/id; existing routes remain stable.
- Existing local patterns: `launcher-onboarding.test.ts` for HTML contracts, `workspace-edge-route-seed-contract.test.ts` for route order/targets, `cloudflare-edge-router.test.ts` and `os-universal-login.test.ts` for edge/session behavior, `install-edge-site-publisher.test.ts` for snapshot publication.
- New or changed tests: add internal/customer URL generation and forbidden-fallback assertions; add `/gtm` before `/` with `workspace-session`; add authenticated snapshot serving plus cross-workspace cache-key isolation; add one-session launcher-to-GTM navigation; add GTM snapshot publication and stable existing-route assertions.
- Focused red command: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun x vitest run tests/launcher-onboarding.test.ts tests/workspace-edge-route-seed-contract.test.ts tests/cloudflare-edge-router.test.ts tests/install-edge-site-publisher.test.ts tests/os-universal-login.test.ts` from `packages/os`.
- Expected red failure: renderer has no workspace-host option and still emits `sites.consuelohq.com`; seed/publisher have no `/gtm`; launcher root remains public; edge refuses workspace-session snapshots; session integration cannot open launcher and GTM with one cookie.

## current status

- Local implementation, package validation, structured review, and full task verification are green. Publishing the task PR and starting CI/independent review next.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- Red: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun x vitest run tests/launcher-onboarding.test.ts tests/workspace-edge-route-seed-contract.test.ts tests/cloudflare-edge-router.test.ts tests/install-edge-site-publisher.test.ts tests/os-universal-login.test.ts` — 5 files, 10 expected failures, 35 passes (`trc_31e0f5d4bc03`). Failures map to missing URL builder, legacy launcher links, absent `/gtm` route/snapshot, and workspace-session snapshots returning 503.
- Focused green: the same five-file suite passed 45/45 assertions (`trc_15ccd9100855`).
- Expanded web/edge green: launcher source/generation, install state, publisher, D1 registry, edge router, Sites/Gateway integration, and universal login passed 97/97 assertions across 10 files (`trc_fb28095eb814`). The corrupt managed-component provenance stack printed to stderr is an intentional fail-closed fixture; `install-state.test.ts` passed.
- Static/package checks: OS syntax checks and generated tool-manifest check passed before a separate `check-files` invocation error (`trc_8599c84870f0`); Astro diagnostics passed with 0 errors and only pre-existing hints (`trc_97d1508a2de1`).
- Workspace review: strict review against `stream/os-web` passed with 0 changed-code issues and 0 blocking findings (`trc_c450075575a2`).
- Full verify: passed and publish-valid (`trc_92169e68f840`). The route-seed change was classified as a database-adjacent warning, with no database finding; this task changes the D1 record JSON route map and requires no schema migration.
- 2026-07-25 00:47:04 `review.run`: passed — OK
- 2026-07-25 00:47:14 `verify`: passed — OK

## key decisions

- Worker 15 owns routing and the protected GTM shell, not a GTM product redesign. No existing GTM handler or upstream exists in the repository, so `/gtm` will use a workspace-specific site snapshot rather than an invented `app.consuelohq.com` or connector fallback.
- The authenticated install record already persists `config.workspace.host`; launcher generation will consume that server-resolved value. Browser-only templates use same-origin relative workspace routes.
- Launcher and GTM snapshots use `workspace-session`; existing public product snapshots retain their current auth contracts. Static shells remain `no-store`; versioned cache keys continue to include hostname/path and target version.

## notes for ko

- No production Cloudflare routes, live accounts, or real Macs will be mutated. Worker 17 remains responsible for deployment and live browser acceptance.

## improvements noticed

- The semantic index is stale and still references deleted `packages/workspace/tests/office-theme.test.js`; index refresh belongs outside this product task.

## issues and recovery

- The original task session expired across the conversation interruption. `task.start` recovered the same scoped branch name from fresh `main` and created replacement PR #1648; the superseded PR #1641 must be accounted for on GitHub before closeout.
- First recovery call used the old `task.start` input shape and failed validation; retrying with the current typed `title`/stream lifecycle shape succeeded without branch or shell fallback.
- `explore` initially failed without diagnostics (`trc_6f1a486b658f`); a shorter single-intent retry succeeded (`trc_b329727a6693`).
- The stale index recommended a deleted test path; task-scoped read returned `NOT_FOUND` (`trc_1ac305ba94dc`). Current files and tests are the source of truth.
- An exact search used an unescaped `{` and failed regex parsing (`trc_b1a1ac56aae5`); retrying with stable symbols succeeded.
- A broad GTM search named nonexistent roots and failed (`trc_da6a6eadd9d9`); retrying against the existing `packages` root confirmed there is no GTM implementation beyond legacy links and plan contracts.
- The first red-run attempt used an outdated `code.call` shape and failed typed validation (`trc_072e5f811d3f`); `tools.search` returned the current schema (`trc_c2e899031523`). The advertised scoped `task.call` route then failed because it is absent from the generated manifest (HTTP 403). Recovery: used supported task-worktree-scoped `code.call` with explicit Bash/verify mode and obtained the expected red evidence (`trc_31e0f5d4bc03`).
- Generic `status` ignored the supplied task session and reported the repository `main` worktree (`trc_e6689f660b7f`). Recovery: use task-aware `git.diff` and lifecycle tools with the explicit branch/session; no main-worktree state was used.
- The first expanded suite found two stale integration expectations (`trc_4107275d05fe`): root launcher auth still expected `public`, and the shared publisher fixture omitted `sites/gtm/index.html`. Recovery: updated the integration characterization and fixture, then the expanded suite passed 97/97 (`trc_fb28095eb814`).
- `check-files` first failed because it requires explicit files (`trc_8599c84870f0`), then failed with those files because its controller-root resolver launched `bun run code-call` from a package without that script (`trc_94d8aca04bff`). The script itself confirms this is an orchestration defect. Recovery: retain the successful OS syntax/manifests evidence and run the changed Astro package through its native `astro check`, which passed (`trc_97d1508a2de1`).

---

## publish checklist

```bash
bun run task:push -- --message "type(os-web): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/consuelo-website/package.json`
- `packages/consuelo-website/src/pages/os/launcher.astro`
- `packages/os/SCRIPTS.md`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/docs/workspace-control-plane-contract.md`
- `packages/os/package.json`
- `packages/os/plans/consuelo-os-foundation/environment-registry.md`
- `packages/os/plans/consuelo-os-foundation/plan.md`
- `packages/os/plans/consuelo-os-foundation/workers/13-web-auth-contract.md`
- `packages/os/plans/consuelo-os-foundation/workers/14-universal-login.md`
- `packages/os/plans/consuelo-os-foundation/workers/15-launcher-gtm-routing.md`
- `packages/os/plans/consuelo-os-foundation/workers/17-web-security-e2e.md`
- `packages/os/plans/consuelo-os-foundation/workers/grok-review-template.md`
- `packages/os/scripts/check-files.js`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/launcher-onboarding.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/os.ts`
- `packages/os/skills/senior-engineer/SKILL.md`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/launcher-astro-source.test.ts`
- `packages/os/tests/launcher-onboarding.test.ts`
- `packages/os/tests/sites-cli.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/tests/office-theme.test.js`

- 2026-07-25 00:46:34 apply-patch: `.task/os-web/authenticated-launcher-workspace-links-and-gtm/workpad.md`

- 2026-07-25 00:47:22 apply-patch: `.task/os-web/authenticated-launcher-workspace-links-and-gtm/workpad.md`