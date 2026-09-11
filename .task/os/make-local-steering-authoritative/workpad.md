# make local steering authoritative

branch: `task/os/make-local-steering-authoritative`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2438/make-local-steering-authoritative
github pr: https://github.com/consuelohq/opensaas/pull/2438
started: 2026-09-10

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/steering/system_prompt.md` (deleted)
- `packages/workspace/STEERING.md` (deleted)

## workspace-owned: files changed

- `packages/os/steering/system_prompt.md` (deleted)
- `packages/workspace/STEERING.md` (deleted)

## workspace-owned: activity log

- 2026-09-10 01:56:22 fs.write: `.task/os/make-local-steering-authoritative/workpad.md`
- 2026-09-10 02:02:23 fs.trash: `packages/os/steering/system_prompt.md`
- 2026-09-10 02:02:24 fs.trash: `packages/workspace/STEERING.md`
- 2026-09-10 02:12:38 fs.write: `.task/os/make-local-steering-authoritative/workpad.md`
- 2026-09-10 02:28:50 fs.write: `.task/os/make-local-steering-authoritative/workpad.md`

## workspace-owned: validation evidence

- 2026-09-10 02:09:26 `review.run`: passed — OK
- 2026-09-10 02:12:52 `review.run`: passed — OK
- 2026-09-10 02:14:34 `verify`: failed — COMMAND_FAILED
- 2026-09-10 02:18:19 `review.run`: passed — OK
- 2026-09-10 02:19:57 `verify`: failed — COMMAND_FAILED
- 2026-09-10 02:22:49 `review.run`: passed — OK
- 2026-09-10 02:24:44 `verify`: failed — COMMAND_FAILED
- 2026-09-10 02:26:36 `review.run`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Acceptance criteria

- [ ] `~/Consuelo/Steering` is the only Markdown steering source loaded by `getSteering()`.
- [ ] `system.md` is the explicit primary steering file; additional user-authored `.md` files load after it in stable filename order.
- [ ] `example-system.md`, legacy `steering.md`, and `decision.md` are excluded from active steering.
- [ ] Steering changes and newly added Markdown files invalidate the node-local snapshot cache on the next read without a service restart or Cloudflare cache.
- [ ] The OpenSaaS repository and distributed runtime no longer contain Ko's live system prompt as `packages/os/steering/system_prompt.md` or a byte-identical Workspace steering copy.
- [ ] Fresh installs seed a small generic user-owned `Steering/system.md` and a generic excluded `example-system.md`; updates preserve user steering and never overwrite it from a bundled prompt.
- [ ] OS release/install paths no longer depend on a bundled steering body.
- [ ] Dialer/project-specific guidance is never copied into global `~/Consuelo/Steering`.
- [ ] Existing live Ko steering is restored from the recoverable trashed `system.md` only after the installed runtime can consume it exactly once.
- [ ] The right project-scoped home for Dialer guidance is resolved separately from global steering; do not invent a `Projects/` convention unless an existing project-context boundary supports it.

## Plan

1. Characterize current steering assembly, seeding, release bundling, raw-steering behavior, and legacy Workspace consumers on the current OS stream.
2. Add focused RED contracts for local-only `system.md`, hot addition/change invalidation, generic seeding/example behavior, and absence of bundled/private steering content.
3. Remove bundled prompt injection and release coupling; make visible `Steering/` authoritative while preserving skill/tool manifest sections.
4. Remove or neutralize repository copies of Ko's prompt and migrate remaining consumers to the local steering boundary or a generic non-private fixture.
5. Prove Dialer is never globally seeded and identify any live/stale writer separately.
6. Run focused GREEN, diff review, strict review, full verify, then publish to `stream/os`.
7. After the corrected runtime is available locally, restore Ko's exact trashed `system.md`, remove the reappeared global Dialer file, and verify `getSteering()` contains the local prompt exactly once and picks up local additions without restart.

## Test-first contract

behavior under test: user steering is local-authoritative: `system.md` plus other visible user Markdown files, with examples/legacy files excluded, no bundled repository prompt injection, and fingerprint-driven hot invalidation.
existing local pattern: `steering-snapshot-cache.ts` already fingerprints visible steering files/directories and caches snapshots locally, but currently scans bundled `packageRoot/steering` first and treats `system_prompt.md` rather than `system.md` as primary. Managed user content currently seeds `system.md` but describes it as an append-only override of bundled steering and generates `example-system.md` from the bundled prompt.
new or changed tests: revise steering snapshot/get-steering contracts to use local `system.md`; add same-process add/change coverage; replace the byte-identical repo steering contract with a no-private-bundled-steering contract; update managed user content/release/distribution tests to require generic seeding and no bundled prompt artifact.
focused red command: run only the preflighted steering/get-steering, managed-user-content, canonical-source, and distribution contracts selected after reading their exact source.
expected red failure: current `getSteering()` still includes `packages/os/steering/system_prompt.md`; current repo contains the same ~59 KB prompt twice; example generation depends on the bundled body; runtime bundling expects a steering directory; local `system.md` is not the declared primary filename.
no-test waiver: not applicable; this is an ownership and runtime-behavior change with direct deterministic contracts.

- 2026-09-10 01:56:22 append: `.task/os/make-local-steering-authoritative/workpad.md`

## workspace-owned: files read

- `areas/dialer/AGENTS.md`
- `packages/documentation/AUTHORING.md`
- `packages/documentation/README.md`
- `packages/documentation/src/content/docs/build/steering/how-steering-works.mdx`
- `packages/documentation/src/content/docs/build/steering/project-steering.mdx`
- `packages/documentation/src/content/docs/build/steering/workspace-steering.mdx`
- `packages/documentation/src/content/docs/start/core-concepts.mdx`
- `packages/documentation/src/content/docs/steering/index.mdx`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/managed-user-content-release.ts`
- `packages/os/scripts/lib/managed-user-content.ts`
- `packages/os/scripts/lib/steering-snapshot-cache.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/distribution/release-publication-preparer.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/lifecycle-retention-uninstall.test.ts`
- `packages/os/tests/managed-user-content.test.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`
- `packages/os/tests/session-integration-guidance.test.ts`
- `packages/os/tests/steering-canonical-source.test.ts`
- `packages/os/tests/test-source-safety.test.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/server.py`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## implementation and validation progress

- Steering snapshot assembly now loads only visible `~/Consuelo/Steering/*.md`, with `system.md` explicitly first and `example-system.md`, `decision.md`, and legacy `steering.md` excluded.
- Removed the repository/runtime `packages/os/steering/system_prompt.md` source and the byte-identical `packages/workspace/STEERING.md` copy.
- Managed user content now seeds a small generic `system.md` once and refreshes a small excluded `example-system.md`; install/update no longer reads or copies a bundled steering body.
- `getRawSteering()` uses the same local-authoritative snapshot as normal steering.
- Runtime bundle no longer requires or ships a steering system prompt; customer-closure distribution test passes without it.
- Product test-source safety no longer derives policy from a user's steering prompt.
- Local snapshot caching remains in-process and fingerprint-based; focused tests prove modifying `system.md` and adding a new Markdown file are visible on the next read without restart.
- Source privacy scan found no remaining distinctive content from Ko's prior prompt under `packages/` after removing the two repository copies.
- Public Steering docs now describe `~/Consuelo/Steering/system.md`, additional Markdown load order, excluded `example-system.md`, local cache invalidation, and the absence of a bundled second prompt. Documentation validate, foundation tests, and build pass.
- Dialer discovery: `areas/dialer/AGENTS.md` is the existing repository-local project/runbook boundary. `packages/os/streams/dialer/AGENTS.md` still ships in the OS runtime and contains complementary product/architecture guidance. Consolidating that content into the area runbook and removing runtime Dialer guidance is intentionally a separate follow-up task; do not promote the earlier stream-only cleanup blindly.

## focused evidence

- Local-authoritative steering/install/release packet: 8 files / 97 tests passed.
- Runtime bundle: 20/20 passed, including real customer closure.
- Workspace server compatibility: 46/46 passed.
- Test selection: 75/75 passed; full task selection no longer falls back to `@consuelo/os package test`.
- OS syntax check passed.
- Documentation: `validate` passed, `test:foundation` 19/19, production build passed.
- Strict review before documentation follow-up: 0 task issues, 0 blockers; one documentation opportunity was addressed by the Steering docs updates.

- 2026-09-10 02:12:38 append: `.task/os/make-local-steering-authoritative/workpad.md`

- 2026-09-10 02:17:49 apply-patch: `packages/workspace/test-selection.rules.json`

- 2026-09-10 02:21:58 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-09-10 02:21:59 apply-patch: `packages/workspace/tests/test-selection.test.js`

- 2026-09-10 02:26:00 apply-patch: `packages/workspace/test-selection.rules.json`

## final validation

- Public documentation follow-up completed: Steering overview, how-it-works, workspace steering, project steering, core concepts, and install guidance now use visible `~/Consuelo/Steering/` ownership. Documentation validate passed, foundation 19/19 passed, and production build passed.
- Test-selection runner issue isolated: `managed-user-content.test.ts` fails only when Vitest is forced through Bun (`bun .../vitest.mjs`) because the Zod named export resolves incorrectly; the supported `bunx vitest` invocation passes 25/25. The focused rule now uses the stable runner without reducing assertions.
- One lifecycle reliability assertion returned `status: null` during a large selected run; the exact test passed immediately on narrow rerun and the final full gate subsequently passed, so it was treated as transient timing rather than a product regression.
- Final test-selection suite: 75/75 passed.
- Final strict review against `origin/stream/os`: 0 task issues, 0 blockers, 0 documentation opportunities.
- Typed `verify` facade returned upstream 502 twice before a result. The exact repository verifier was run through authenticated task `code.call` with its verification-stamp mutation explicitly allowed.
- Final full verifier: passed, publish-valid; review passed; DB guard passed; selected tests passed with zero failed suites. Stamp: `.task/os/make-local-steering-authoritative/verify.json`.

## activation note

- The live installed OS is intentionally not modified yet. Its current runtime still contains the legacy bundled prompt, so restoring Ko's trashed full `system.md` before activating this corrected runtime would recreate duplicate steering.
- After a supported local activation/release contains this change, restore the exact trashed full `system.md`, trash the current tiny local file and reappeared global `dialer-AGENTS.md`, refresh the managed generic example, then verify the local prompt appears exactly once and a newly added Markdown file is visible on the next steering read without restart.

- 2026-09-10 02:28:50 append: `.task/os/make-local-steering-authoritative/workpad.md`
