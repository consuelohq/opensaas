# Define workspace control-plane contract

branch: `task/os/define-workspace-control-plane-contract`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1527/define-workspace-control-plane-contract
github pr: https://github.com/consuelohq/opensaas/pull/1527
started: 2026-07-16

## acceptance criteria

- [x] Define the canonical workspace route and launcher information architecture, with Configuration last.
- [x] Separate the public launcher/static shell from authenticated private control-plane data.
- [x] Define the browser-session exchange and signed edge-to-node request boundary without adding Better Auth.
- [x] Define node roles, node locations, environment records, credential references, credential sources, and runtime injection.
- [x] Define Effect service boundaries and typed failure ownership for control-plane behavior.
- [x] Record the shipped Settings implementation as a baseline to audit rather than an assumed finished system.
- [x] Define security invariants, audit requirements, explicit non-goals, and the follow-on PR dependency map.
- [x] Keep this PR contract-only with no runtime behavior changes.

## plan

1. Inspect the current launcher, Settings shell, overlay storage, gateway routes, edge route registry, device authority, tests, and existing Effect patterns.
2. Write one canonical OS-owned control-plane contract under `packages/os/docs`.
3. Record current implementation evidence and gaps so the hardening task has an executable handoff.
4. Run Markdown/content checks, inspect the diff, run strict review and verify, then merge into `stream/os`.

## test-first contract

- Behavior under test: none; this PR defines architecture and sequencing but does not change runtime behavior.
- Existing local pattern: OS architecture and release contracts under `packages/os/docs`.
- New or changed tests: none.
- No-test waiver: docs-only contract. Validation is Markdown/content inspection, link/path validation, strict review, and the workspace verify gate.

## current status

- Discovery complete.
- Canonical contract drafted from current code and approved product decisions.
- No production code has been edited.

## files changed

- `.task/os/define-workspace-control-plane-contract/workpad.md`
- `packages/os/docs/workspace-control-plane-contract.md`

## workspace-owned: files changed

- `.task/os/define-workspace-control-plane-contract/workpad.md`
- `packages/os/docs/workspace-control-plane-contract.md`

## workspace-owned: activity log

- 2026-07-16 15:55:31 fs.write: `.task/os/define-workspace-control-plane-contract/workpad.md`
- 2026-07-16 15:56:33 fs.write: `packages/os/docs/workspace-control-plane-contract.md`
- 2026-07-16 21:15:27 fs.write: `.task/os/define-workspace-control-plane-contract/workpad.md`

## workspace-owned: validation evidence

- 2026-07-16 15:57:32 `review.run`: passed — OK
- 2026-07-16 21:15:12 `verify`: failed — COMMAND_FAILED

## key decisions

- `/tools`, `/environments`, and `/secrets` are canonical workspace configuration routes; `/settings` remains a compatibility surface during migration.
- Configuration is the final launcher section.
- Public shells contain no private workspace snapshot; authenticated APIs provide private state.
- Better Auth is out of scope. OS needs a workspace browser-session and visibility/configuration layer over its existing authorization protocol.
- Consuelo owns environment policy and credential references, not necessarily the underlying secret value.
- Bun Secrets is one native-device adapter behind an OS-owned credential-source contract.
- Native credentials are node-local. Cross-node access uses independently authorized external providers; the home node is not a raw-secret relay.
- Consuelo Cloud credential custody is deferred to DEV-1581.

## notes for ko

- PR 1 will branch only after this contract merges to the refreshed `stream/os`.
- The existing Settings overlay and edge routes are useful foundations, but private embedded snapshots, fail-open scope defaults, workflow toggle mismatch, synchronous persistence, and concurrency behavior must be corrected before Environments or Secrets build on them.

## improvements noticed

- The current route seed marks every static Settings snapshot public.
- The hosted Settings UI silently falls back to an embedded snapshot when gateway hydration fails.
- Missing settings gateway scope headers default to read and write capabilities.
- Workflow disables are stored and displayed but do not currently affect workflow routing.

## issues and recovery

- Initial engineering-guide read was ambiguous because many worktrees were active. Started the approved task and reread the guide through its task session.

---

## publish checklist

```bash
bun run task:push -- --message "docs(os): define workspace control-plane contract" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/workspace/senior-engineer.md`
- `packages/os/scripts/lib/settings-snapshot.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/settings-gateway.ts`
- `packages/os/scripts/lib/manifest-overlay.ts`
- `packages/os/scripts/lib/settings-sites-gateway-endpoints.ts`
- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/lib/launcher-onboarding.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/server/routes/settings.ts`
- `packages/os/scripts/server/route-policies.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/health.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/device.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/scripts/lib/code-call/service.ts`
- `packages/os/scripts/lib/local-agent-connectivity.ts`
- `packages/os/docs/runtime-surfaces.md`
- `packages/os/docs/security-tightening-evidence.md`

- 2026-07-16 15:55:31 write: `.task/os/define-workspace-control-plane-contract/workpad.md`

- 2026-07-16 15:56:33 write: `packages/os/docs/workspace-control-plane-contract.md`

## workspace-owned: test selection

- changed files: `.task/os/define-workspace-control-plane-contract/current.json`, `.task/os/define-workspace-control-plane-contract/evidence-log.json`, `.task/os/define-workspace-control-plane-contract/read-log.json`, `.task/os/define-workspace-control-plane-contract/session.json`, `.task/os/define-workspace-control-plane-contract/workpad.md`, `.task/tasks/os/define-workspace-control-plane-contract.json`, `packages/os/docs/workspace-control-plane-contract.md`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed files are docs or task metadata

## validation update — 2026-07-16

- Contract content/fence validation passed.
- Strict scoped review against `origin/stream/os` passed with zero findings.
- Full `verify` could not produce a publish-valid stamp because unrelated repository baseline checks failed: three API suites outside `packages/os`, missing `packages/twenty-eslint-rules` in the task worktree, and pre-existing Twenty SDK lint/typecheck findings. Test selection correctly selected zero suites because this change is docs/task metadata only.
- Publishing uses the documented approval override for a docs-only architecture contract; no runtime behavior is being waived.

- 2026-07-16 21:15:27 append: `.task/os/define-workspace-control-plane-contract/workpad.md`
