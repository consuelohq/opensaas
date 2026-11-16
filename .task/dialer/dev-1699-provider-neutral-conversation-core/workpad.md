# DEV-1699 provider-neutral conversation core

branch: `task/dialer/dev-1699-provider-neutral-conversation-core`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2796
started: 2026-11-13

## acceptance criteria

- [x] Pure authenticated timeline/card/policy contracts, replay ports and meaningful adversarial tests.
- [x] Dependency-free package build/typecheck, Nx workspace graph and CI lane wiring.
- [ ] Strict review, formal verify and task-only source publication; downstream integration remains open.

## plan

1. Audit existing core/analytics, freeze contracts, write red tests.
2. Implement pure reducers/ports, validate package exports and CI classification.
3. Run strict review/formal verify and publish task-only for coordinator integration.

## files changed

- `packages/conversation/package.json`
- `packages/conversation/project.json`
- `packages/conversation/README.md`
- `packages/conversation/src/cards.ts`
- `packages/conversation/src/index.ts`
- `packages/conversation/src/policy.ts`
- `packages/conversation/src/ports.ts`
- `packages/conversation/src/timeline.ts`
- `packages/conversation/src/validation.ts`
- `packages/conversation/tests/conversation.test.ts`
- `packages/conversation/tsconfig.json`

## key decisions

- See scoped evidence and handoff below.

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Scope and Test-first contract

Own dependency-free packages/conversation contracts/reducers/ports, export/build wiring and focused CI classification. No provider, server media or UI changes. Baseline main 1d31f05f. consuelo-core is OS registry; analytics aggregates legacy text without scope/revisions: new package has a distinct boundary.

Behavior under test: authenticated workspace/call/generation/participant scope, cursor/epoch continuity, revision/finality and duplicate/gap replay; immutable approved cards, evidence/base revision/worker generation/policy/expiry validation; explicit independent admission, end/revoke/delete fences; deterministic virtual clock.
Existing local pattern: Bun contract tests and standalone tsc package scripts. New test packages/conversation/tests/conversation.test.ts.
Focused red command: bun test packages/conversation/tests/conversation.test.ts.
Expected red: missing ../src/index.ts before implementation. No-test waiver: none; core is pure, no service-backed/provider behavior is claimed.
Acceptance: adversarial contract tests, source dependency audit, package build/typecheck and Nx graph, strict review/full verify; source PR only, integration/release remain DEV-1700..1707.

- 2026-11-13 20:18:45 append: `.task/dialer/dev-1699-provider-neutral-conversation-core/workpad.md`

## workspace-owned: files changed

- `packages/conversation/package.json`
- `packages/conversation/project.json`
- `packages/conversation/README.md`
- `packages/conversation/src/cards.ts`
- `packages/conversation/src/index.ts`
- `packages/conversation/src/policy.ts`
- `packages/conversation/src/ports.ts`
- `packages/conversation/src/timeline.ts`
- `packages/conversation/src/validation.ts`
- `packages/conversation/tests/conversation.test.ts`
- `packages/conversation/tsconfig.json`

## workspace-owned: activity log

- 2026-11-13 20:18:45 fs.write: `.task/dialer/dev-1699-provider-neutral-conversation-core/workpad.md`
- 2026-11-13 20:19:59 write: `packages/conversation/tests/conversation.test.ts`
- 2026-11-13 20:19:59 fs.write: `packages/conversation/tests/conversation.test.ts`
- 2026-11-13 20:22:58 apply-patch: `packages/conversation/src/types.ts`
- 2026-11-13 20:23:06 write: `packages/conversation/src/validation.ts`
- 2026-11-13 20:23:06 fs.write: `packages/conversation/src/validation.ts`
- 2026-11-13 20:23:06 write: `packages/conversation/src/timeline.ts`
- 2026-11-13 20:23:06 fs.write: `packages/conversation/src/timeline.ts`
- 2026-11-13 20:23:06 write: `packages/conversation/src/policy.ts`
- 2026-11-13 20:23:06 fs.write: `packages/conversation/src/policy.ts`
- 2026-11-13 20:23:07 write: `packages/conversation/src/cards.ts`
- 2026-11-13 20:23:07 fs.write: `packages/conversation/src/cards.ts`
- 2026-11-13 20:23:07 write: `packages/conversation/src/ports.ts`
- 2026-11-13 20:23:07 fs.write: `packages/conversation/src/ports.ts`
- 2026-11-13 20:23:13 write: `packages/conversation/src/index.ts`
- 2026-11-13 20:23:13 fs.write: `packages/conversation/src/index.ts`
- 2026-11-13 20:23:14 write: `packages/conversation/package.json`
- 2026-11-13 20:23:14 fs.write: `packages/conversation/package.json`
- 2026-11-13 20:23:14 write: `packages/conversation/tsconfig.json`
- 2026-11-13 20:23:14 fs.write: `packages/conversation/tsconfig.json`
- 2026-11-13 20:23:14 write: `packages/conversation/project.json`
- 2026-11-13 20:23:14 fs.write: `packages/conversation/project.json`
- 2026-11-13 20:23:25 apply-patch: `.prettierrc`
- 2026-11-13 20:23:25 apply-patch: `.prettierignore`
- 2026-11-13 20:23:25 apply-patch: `packages/conversation/tsconfig.lib.json`
- 2026-11-13 20:23:25 apply-patch: `packages/conversation/src/lib/conversation.ts`
- 2026-11-13 20:23:42 apply-patch: `packages/conversation/src/validation.ts`
- 2026-11-13 20:24:44 apply-patch: `packages/conversation/src/timeline.ts`
- 2026-11-13 20:24:44 apply-patch: `packages/conversation/src/cards.ts`
- 2026-11-13 20:24:44 apply-patch: `packages/os/tests/ci-plan.test.ts`
- 2026-11-13 20:25:20 append: `packages/conversation/tests/conversation.test.ts`
- 2026-11-13 20:25:20 fs.write: `packages/conversation/tests/conversation.test.ts`
- 2026-11-13 20:25:45 apply-patch: `packages/conversation/src/timeline.ts`
- 2026-11-13 20:25:45 apply-patch: `packages/os/scripts/ci-plan.ts`
- 2026-11-13 20:25:45 apply-patch: `package.json`
- 2026-11-13 20:25:45 apply-patch: `.github/workflows/consuelo-ci.yaml`
- 2026-11-13 20:26:57 apply-patch: `packages/conversation/src/types.ts`
- 2026-11-13 20:26:57 apply-patch: `packages/conversation/src/validation.ts`
- 2026-11-13 20:26:57 apply-patch: `packages/conversation/tests/conversation.test.ts`
- 2026-11-13 20:27:17 apply-patch: `packages/conversation/src/validation.ts`
- 2026-11-13 20:28:17 write: `packages/conversation/README.md`
- 2026-11-13 20:28:17 fs.write: `packages/conversation/README.md`
- 2026-11-13 20:30:20 fs.write: `packages/conversation/tests/conversation.test.ts`
- 2026-11-13 20:32:27 fs.write: `.task/dialer/dev-1699-provider-neutral-conversation-core/workpad.md`

## Validation checkpoint

Original red trc_28ef5532cc6b: missing index module. New boundary red trc_d588aef90aec: terminal at capacity/conflicting leg bindings; fixed and green46 tests/127 assertions trc_a4cda80aba95 and trc_529b2b28464f. CI routing red3 trc_b1c06f1136c5, green15 trc_9bfff60942fb. tsc typecheck/build, clean Node ESM smoke, frozen lockfile-only install and Nx show project graph all pass. No network/provider/runtime behavior claimed.

Package generated with installed @nx/js library generator (dry-run trc_96ed57a7d101, real trc_1d5e0659f0ad). Removed only unused generated formatter/helper scaffolding. Root source already uses Bun1.3.14; added workspace registration and generated lock via bun install --lockfile-only --ignore-scripts, avoiding shared node_modules changes. Link-workspace-packages skill read; no consumer imports/deps added in this task. Core has zero runtime imports outside its own modules.

API sourceVersion is a mandatory CardPatch origin revision, added to frozen packet; transcript packet unchanged. Schema/migration, pure proof limits and consumer instructions in packages/conversation/README.md. Protocol bounds deliberately reject capacity without silent eviction; terminal facts still admitted. No automatic checkpoint/compaction, provider adapter, outbox implementation, approved pack, selector, UI or carrier acceptance here.

Status facade returned primary checkout despite taskSession; code.call/git.diff correctly target isolated worktree. Scoped status must use code.call until facade is fixed. task.pr MUST use taskOnly:true per coordinator; root owns PR retarget/integration/main/release.

## workspace-owned: validation evidence

- 2026-11-13 20:29:40 `review.run`: passed — OK
- 2026-11-13 20:30:05 `verify`: passed — OK
- 2026-11-13 20:30:20 append: `packages/conversation/tests/conversation.test.ts`
- 2026-11-13 20:31:03 apply-patch: `packages/conversation/src/types.ts`
- 2026-11-13 20:31:03 apply-patch: `packages/conversation/src/cards.ts`
- 2026-11-13 20:31:03 apply-patch: `packages/conversation/tests/conversation.test.ts`
- 2026-11-13 20:31:39 `review.run`: passed — OK
- 2026-11-13 20:32:12 `verify`: passed — OK

## Final source handoff checkpoint

47 core tests / 128 assertions pass (trc_b739e11d3c2f); source-version host pinning red trc_25a5c4cbfbff then green. CardContext requires sourceVersions for manual/rules/selector; transcript packet unchanged. Package typecheck/build pass trc_87305be636e9. Public package import via an isolated /tmp Bun consumer succeeded trc_459c3a043768; temporary consumer removed. Initial audit hit an empty generated directory (EISDIR), corrected filter and dependency audit passed: no external source imports/dependencies. No shared node_modules mutations.

Final strict review trc_3fb39e8e94fe: zero issues. Formal full verify trc_5cc3ed4891b6: passed, publishValid:true against origin/main; registry suites include CI planner15 and local OS server review20. Formal review reported zero affected product suites, so explicit core47 focused execution supplies that behavior proof. Nx graph validation trc_696372ba78e2 and frozen lockfile install trc_529b2b28464f pass. No tests waived, no provider calls/inference, no production changes. Exact-head remote CI/integration remains coordinator-owned.

Files owned: packages/conversation/**, root workspace registration/bun.lock, .github/workflows/consuelo-ci.yaml + packages/os/scripts/ci-plan.ts + focused CI-plan regression, scoped task metadata/workpad. No server/media/UI consumer changes. No persistent process started beyond managed task tmux and completed verify workers. Temporary /tmp consumer cleaned; ignored dist is reproducible. Root will verify pushed remote SHA/recovery, then archive this worktree. Leave DEV-1699/1645 open for required integration/release.

- 2026-11-13 20:32:27 append: `.task/dialer/dev-1699-provider-neutral-conversation-core/workpad.md`
