# address swamp review feedback and canary release

branch: `task/swamp-tools/address-swamp-review-feedback-and-canary-release`
stream: `stream/swamp-tools`
pr: https://github.com/consuelohq/opensaas/pull/2538
started: 2026-09-22

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(swamp-tools): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.github/workflows/consuelo-swamp-compat.yaml`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/scripts/lib/manifest.ts`
- `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`
- `packages/os/scripts/lib/runtime-tool-registry.ts`
- `packages/os/tests/runtime-tool-providers-swamp.test.ts`
- `packages/workspace/tests/github-workflow-policy.test.js`

## Test-first contract

behavior under test: Swamp runtime discovery and execution remain bounded, cache failures without hiding recovered catalogs, preserve provider inputs that collide with facade control names, return TIMEOUT for provider execution timeouts, avoid unnecessary runtime discovery for static tools, and harden the compatibility workflow checkout credentials.
existing local pattern: `packages/os/tests/runtime-tool-providers-swamp.test.ts` provides a real fake CLI process; facade timeout behavior is covered by executor/facade tests; workflow policy tests assert CI security properties.
new or changed tests: extend Swamp provider tests for discovery timeout/buffer/failure caching/partial discovery/control-field collisions/provider TIMEOUT/static fast path; extend workflow policy for `persist-credentials: false`.
focused red command: `bun --cwd packages/os vitest run tests/runtime-tool-providers-swamp.test.ts tests/tool-scope-authorization.test.ts && bun --cwd packages/workspace vitest run tests/github-workflow-policy.test.js`.
expected red failure: new assertions fail against current unbounded discovery, control-field stripping, failure/partial caching, timeout mapping, and checkout credential persistence.
no-test waiver: not applicable.

## Acceptance criteria

- Address all nine inline review comments by underlying issue, documenting any duplicate/invalid finding.
- Add bounded discovery timeout and explicit output buffer.
- Do not cache incomplete model-only discovery when workflow discovery fails.
- Negative-cache discovery failures briefly to avoid per-call subprocess storms while allowing quick recovery.
- Preserve provider schema fields even when names overlap facade controls using a collision-safe provider payload namespace.
- Preserve provider execution `TIMEOUT` semantics.
- Avoid runtime-provider discovery on ordinary static-tool lookup.
- Set checkout `persist-credentials: false` in Swamp compatibility CI.
- Pass focused tests, strict review, canonical verify, merge `stream/swamp-tools` to `main`, then ship/update Canary using the repository’s supported release surface.

- 2026-09-22 20:40:28 append: `.task/swamp-tools/address-swamp-review-feedback-and-canary-release/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-22 20:40:28 fs.write: `.task/swamp-tools/address-swamp-review-feedback-and-canary-release/workpad.md`
- 2026-09-22 20:42:44 apply-patch: `packages/os/tests/runtime-tool-providers-swamp.test.ts`
- 2026-09-22 20:42:44 apply-patch: `packages/workspace/tests/github-workflow-policy.test.js`
- 2026-09-22 20:43:26 apply-patch: `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`
- 2026-09-22 20:43:36 apply-patch: `packages/os/scripts/lib/runtime-tool-registry.ts`
- 2026-09-22 20:43:39 apply-patch: `packages/os/scripts/lib/manifest.ts`
- 2026-09-22 20:43:50 apply-patch: `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`
- 2026-09-22 20:44:00 apply-patch: `packages/os/scripts/lib/facade/executor.ts`
- 2026-09-22 20:44:05 apply-patch: `.github/workflows/consuelo-swamp-compat.yaml`
- 2026-09-22 20:46:58 fs.write: `.task/swamp-tools/address-swamp-review-feedback-and-canary-release/workpad.md`
- 2026-09-22 20:49:22 fs.write: `.task/swamp-tools/address-swamp-review-feedback-and-canary-release/workpad.md`

## workspace-owned: validation evidence

- 2026-09-22 20:44:13 `checkFiles`: passed — OK
- 2026-09-22 20:44:27 apply-patch: `packages/os/tests/runtime-tool-providers-swamp.test.ts`
- 2026-09-22 20:45:38 apply-patch: `packages/os/tests/runtime-tool-providers-swamp.test.ts`
- 2026-09-22 20:46:16 apply-patch: `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`
- 2026-09-22 20:47:15 `review.run`: passed — OK
- 2026-09-22 20:48:59 `verify`: passed — OK

## Review feedback addressed

- Checkout credential persistence: added `persist-credentials: false` and workflow-policy coverage.
- Static lookup performance: bundled/overlay manifest lookup now short-circuits before runtime-provider discovery.
- Runtime timeout semantics: provider runner timeout now returns facade `TIMEOUT` rather than `COMMAND_FAILED`.
- Discovery timeout (duplicate Codex + CodeRabbit findings): every Swamp discovery subprocess has a 2s bound and SIGKILL timeout behavior.
- Discovery output buffer (duplicate CodeRabbit + Codex findings): discovery explicitly permits up to 10 MiB output; regression exceeds Node's default 1 MiB threshold.
- Provider/facade control-name collisions: schema-declared control-like fields are kept in a nested provider payload and no longer alter facade branch/dry-run/timeout/request identity.
- Partial workflow discovery: workflow search/get failure marks discovery incomplete and is not cached.
- Provider outage subprocess storm: provider-unavailable discovery is negative-cached for 15 seconds; incomplete catalogs are not negative-cached.

## Green evidence

- Focused regression set: 5 files / 742 tests passed (`runtime-tool-providers-swamp`, scope auth, manifest overlay, facade, tools.search v3); trace `trc_79584280af8e`.
- GitHub workflow policy: 9/9 passed; trace `trc_a24f681c609e`.
- Workflow security policy: zero findings; trace `trc_5e80b0c81eda`.
- `checkFiles` passed all changed production/test TypeScript and JS files; trace `trc_23b9535f5fbe`.
- Real compatibility smoke passed against current checksum-verified Swamp `20260922.204047.0-sha.4957bcbd`; trace `trc_805d05de9b35`.
- Disposable downloaded Swamp binary/checksum removed again; cleanup trace `trc_7c42ea5a5b92`.

- 2026-09-22 20:46:58 append: `.task/swamp-tools/address-swamp-review-feedback-and-canary-release/workpad.md`

## Final verification

- Strict review: 0 blockers / 0 findings; trace `trc_891253246a75`.
- Canonical verify: `passed: true`, `publishValid: true`; trace `trc_dc3a47918f6d`.

- 2026-09-22 20:49:22 append: `.task/swamp-tools/address-swamp-review-feedback-and-canary-release/workpad.md`
