# Rename Settings surface to Configuration

branch: `task/os/rename-settings-surface-to-configuration`
stream: `stream/os`
started: 2026-07-16

## acceptance criteria

- [ ] Make `/configuration` the canonical workspace control-plane page and launcher destination.
- [ ] Make `/gateway/configuration/snapshot` and `/gateway/configuration/overlay` the canonical private API routes.
- [ ] Keep `/settings` and `/gateway/settings/*` only as explicit compatibility aliases so existing installations do not break.
- [ ] Use Configuration in user-facing headings, titles, navigation, help text, route descriptors, and architecture documentation.
- [ ] Preserve the hardened public-shell/private-data boundary, signed authorization, Effect service boundary, overlay persistence, audit records, and workflow enforcement from PR #1528.
- [ ] Keep Environments, Secrets, browser-session issuance, and cloud credential custody outside this task.
- [ ] Update focused route, launcher, shell, publisher, adapter, Hono, and integration contracts.

## plan

1. Read the merged hardening implementation from the task worktree and map every canonical and compatibility surface.
2. Update focused tests first to require Configuration routes and legacy Settings aliases; run them red.
3. Implement the narrow route/product vocabulary migration without changing domain behavior.
4. Run focused tests, signed edge contracts, syntax/type checks, browser rendering, strict review, and full verify.
5. Push the task branch, merge it into `stream/os`, and clean up the worktree.

## Test-first contract

- Behavior under test: the launcher links to `/configuration`; the public shell identifies itself as Configuration and calls `/gateway/configuration/*`; edge and local Hono routing expose canonical Configuration routes; legacy Settings routes remain compatible aliases; published snapshots use the canonical Configuration route and storage identity.
- Existing local pattern: the merged Settings hardening tests in `packages/os/tests/settings-*.test.ts`, route seed contracts, publisher contracts, and workspace edge integration contracts.
- New or changed tests: launcher onboarding, Settings/Configuration shell, gateway endpoints, local Hono routes, route policies, adapter registry, edge route seed, edge integration, publisher, and CLI compatibility tests.
- Focused red command: `bun --cwd packages/os test tests/launcher-onboarding.test.ts tests/settings-site.test.ts tests/settings-sites-gateway-endpoints.test.ts tests/settings-hono-routes.test.ts tests/consuelo-sites-settings-adapter.test.ts tests/consuelo-sites-gateway.test.ts`.
- Expected red failure: the launcher still points at `/settings`, the shell still uses Settings copy and `/gateway/settings/*`, and canonical Configuration routes are absent.
- No-test waiver: none; this changes public routes and authorization contracts.

## current status

- Task worktree created from `origin/stream/os` at `ba90501b88`.
- Discovery confirmed Settings remains the canonical route vocabulary despite the launcher link label already saying Configuration.
- Production code has not been edited yet.

## key decisions

- `/configuration` is canonical everywhere visible to users and clients.
- `/settings` remains a compatibility alias, not a second product name.
- The migration must preserve old route behavior rather than introduce a breaking removal.
- Internal filenames may remain `settings-*` in this focused task where renaming them adds no product value; route contracts, service descriptors, copy, and canonical storage identity must use Configuration.

## issues and recovery

- `task.start` repeatedly failed because GitHub returned `503 Service Unavailable` while resolving `refs/heads/main`.
- Following the engineering recovery policy, a task worktree was created directly from `origin/stream/os`, then registered with `task.init`. All subsequent edits remain scoped to this task branch and worktree.
- The workspace filesystem write tool requires a taskSession, which the fallback `task.init` path does not issue. Scoped `code.call` edits with an explicit task worktree are used until normal lifecycle tooling recovers.

## notes for ko

- This task corrects the naming mistake immediately after the Settings hardening merge. It does not begin the Environments or Secrets product stack.

## workspace-owned: files read

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/senior-engineer.md`

## validation update — 2026-07-16

- Red proof: 7 focused test files failed with 18 expected failures because Configuration routes, shell copy, gateway capabilities, adapter registrations, and CLI command were absent.
- Canonical public route is now `/configuration`; `/settings` is a 308 compatibility redirect.
- Canonical private routes are `/gateway/configuration/snapshot` and `/gateway/configuration/overlay`; legacy Settings routes remain signed compatibility aliases with their legacy scopes.
- Canonical Sites identity and storage are `configuration` and `sites/configuration/index.html`.
- Focused Configuration, overlay, Hono, launcher, Sites, workflow, and compatibility suite passed: 13 files, 76 tests.
- Signed edge route, publisher, and gateway contracts passed with the contract flag enabled: 3 files, 20 tests.

## files changed

- `packages/os/SCRIPTS.md`
- `packages/os/docs/workspace-control-plane-contract.md`
- `packages/os/scripts/lib/consuelo-sites-settings-adapter.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/launcher-onboarding.ts`
- `packages/os/scripts/lib/settings-control-plane.ts`
- `packages/os/scripts/lib/settings-gateway.ts`
- `packages/os/scripts/lib/settings-materialization.ts`
- `packages/os/scripts/lib/settings-overlay-command.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/settings-sites-gateway-endpoints.ts`
- `packages/os/scripts/lib/settings-snapshot.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/trace-sites-gateway-contract.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/server/app.ts`
- `packages/os/scripts/server/route-policies.ts`
- `packages/os/scripts/server/routes/settings.ts`
- `packages/os/skills/sites/SKILL.md`
- `packages/os/tests/consuelo-sites-gateway.test.ts`
- `packages/os/tests/consuelo-sites-settings-adapter.test.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`
- `packages/os/tests/launcher-onboarding.test.ts`
- `packages/os/tests/local-os-server-hono-architecture.test.ts`
- `packages/os/tests/settings-cli.test.ts`
- `packages/os/tests/settings-gateway.test.ts`
- `packages/os/tests/settings-hono-routes.test.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/settings-sites-gateway-endpoints.test.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`


## boundary

- Internal legacy module filenames and exported Settings aliases remain for source compatibility. User-facing routes, labels, service descriptors, storage identity, and canonical exports use Configuration.


## final publish validation — 2026-07-18

- Dangerous-literal preflight passed for all 12 changed test files.
- Formal verify gate passed against `origin/stream/os`: strict review, package test selection, and database guard all passed.
- Publish-valid stamp written to `.task/os/rename-settings-surface-to-configuration/verify.json`.
- Desktop browser proof previously confirmed the canonical title, navigation, and heading are `Configuration`.
- Remaining lifecycle steps: push task commit, merge task into `stream/os`, verify PR state, then finish the task worktree.

- Tooling gap: the task was created through `task.init` during the earlier GitHub outage, so no `taskSession` exists; `task.start`, typed GitHub reads, and `task:push` still cannot reach `api.github.com`. Git transport to `github.com` works, so the existing task branch is being published with narrowly scoped Git commands while preserving the normal author and committer identities.
