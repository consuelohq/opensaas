# close Bun hoisting dependency gaps

branch: `task/twenty-migration/close-bun-hoisting-dependency-gaps`
stream: `stream/twenty-migration`
pr: https://github.com/consuelohq/opensaas/pull/2507
started: 2026-09-21

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
bun run task:push -- --message "type(twenty-migration): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
- A clean Bun-owned CI runner must execute the same Consuelo verification and dialer gates as local development without relying on historical Yarn hoisting.
- Every package must directly declare the runtime/tooling packages it imports or invokes in its own package-manager boundary.
- GitHub workflow policy tests must describe the Bun CI setup that now intentionally installs root, workspace-toolchain, and OS graphs separately where required.

existing local pattern:
- packages/os, packages/workspace, and the root workspace are independent Bun install boundaries.
- packages/cli and dialer release packages are root workspaces and must declare their direct workspace/runtime dependencies.
- The prior clean-runner repair fixed workspace yaml and dialer Sentry resolution; GitHub now reaches deeper registry/typecheck phases.

new or changed tests:
- Extend package-boundary/Bun migration contracts to require direct declarations for newly exposed clean-runner dependencies.
- Update the GitHub workflow policy test to the final Bun-neutral CI setup contract.
- Add or update focused tests for OS wrangler resolution and CLI direct workspace dependencies where an existing contract surface exists.
- Re-run the exact CI registry suites and dialer typecheck sequence that failed remotely.

focused red evidence:
- Stream PR #1991 head 235054b4 clean Linux CI:
  - verify: Workspace Edge release dry-run fails because wrangler is not found.
  - verify: GitHub workflow policy test still asserts the pre-M6 setup boundary.
  - verify: @consuelo/cli package test cannot resolve @consuelo/analytics from CLI analytics command.
  - dialer: tests are 224/224 green, then release typecheck fails because bun-types cannot be resolved in one package.
- Additional registry failures, if any, will be enumerated from the same persisted GitHub job log before editing.

expected red failure:
- Focused reproductions should fail on the same undeclared-package/tool assumptions rather than product logic.

no-test waiver: not applicable.

- 2026-09-21 04:53:44 append: `.task/twenty-migration/close-bun-hoisting-dependency-gaps/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-21 04:53:44 fs.write: `.task/twenty-migration/close-bun-hoisting-dependency-gaps/workpad.md`
- 2026-09-21 05:00:37 fs.write: `.task/twenty-migration/close-bun-hoisting-dependency-gaps/workpad.md`
- 2026-09-21 05:03:00 fs.write: `.task/twenty-migration/close-bun-hoisting-dependency-gaps/workpad.md`

## workspace-owned: files read

- `packages/analytics/package.json`
- `packages/cli/package.json`
- `packages/cli/src/auth.ts`
- `packages/cli/src/commands/analytics.ts`
- `packages/cli/src/commands/call.ts`
- `packages/cli/src/commands/calls.ts`
- `packages/cli/src/commands/coach.ts`
- `packages/cli/src/commands/contacts.ts`
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/commands/login.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/sentry.ts`
- `packages/cli/tests/legacy-platform-removal.test.ts`
- `packages/coaching/package.json`
- `packages/contacts/package.json`
- `packages/dialer-server/package.json`
- `packages/dialer-server/tsconfig.json`
- `packages/lead-connector/package.json`
- `packages/lead-connector/tsconfig.json`
- `packages/logger/package.json`
- `packages/os/package.json`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/tests/github-workflow-policy.test.js`

## CI closure implementation and GREEN evidence

Remote failure inventory from stream PR #1991 head 235054b4 contained exactly three verify registry failures plus one dialer typecheck failure:
- Workspace Edge release dry-run: `wrangler: command not found`.
- GitHub workflow policy: stale assertion still expected the removed Yarn install action.
- @consuelo/cli package test: source CLI help eagerly traversed unbuilt sibling package entries.
- Dialer CI: dialer tests passed 224/224, then typecheck failed on `bun-types`.

Fixes:
- packages/os now directly declares Wrangler and its independent Bun lock was regenerated.
- dialer-server and lead-connector tsconfigs now reference `types: ["bun"]`, matching their declared `@types/bun` package.
- LeadConnector now directly declares jsdom + @types/jsdom because its included test sources are part of strict typecheck.
- GitHub workflow policy tests now assert the Bun-owned CI setup, workspace-toolchain install, and root-Bun exclusion for OS-only lanes.
- CLI source startup no longer eagerly loads init/login/coach/analytics sibling implementations. Auth logging is optional and runtime-loaded so an unbuilt logger package cannot block auth tests or CLI startup.
- Root and OS Bun lockfiles were regenerated/frozen after manifest changes.

Clean-room evidence without inherited node_modules/dist:
- root `bun install --frozen-lockfile --ignore-scripts`: passed.
- `bun packages/cli/src/index.ts --help`: passed with full Consuelo command surface.
- CLI package tests: 10/10 passed.
- logger build: passed.
- dialer, dialer-server, lead-connector typechecks: all passed.
- LeadConnector initially exposed missing jsdom types in this clean environment; after direct devDependency repair, the same sequence passed end to end.

Exact remote-failure replay on task state:
- Workspace Edge Wrangler dry-run: passed.
- GitHub workflow policy: 8/8 passed.
- CLI package tests: 10/10 passed.
- @consuelo/dialer: 224/224 passed.
- dialer-server: 171 passed, 1 intentional skip, 0 failed.
- LeadConnector: 122/122 passed.
- logger build + all three release typechecks: passed.
- M6 Bun migration regression: 8/8 passed.

Next: strict review, canonical verify, then publish into stream and require fresh GitHub CI before main merge.

- 2026-09-21 05:00:37 append: `.task/twenty-migration/close-bun-hoisting-dependency-gaps/workpad.md`

## workspace-owned: validation evidence

- 2026-09-21 05:00:56 `review.run`: passed — OK
- 2026-09-21 05:01:10 apply-patch: `packages/cli/src/index.ts`
- 2026-09-21 05:02:14 `review.run`: passed — OK
- 2026-09-21 05:02:52 `verify`: passed — OK

## Final publish gate — GREEN

- Focused post-review repair: CLI 10/10, GitHub workflow policy 8/8, M6 Bun regression 8/8, git diff check passed.
- Strict review: 0 blocking findings.
- Canonical verify: passed=true, publishValid=true; DB guard passed with 0 risks/findings.
- No user-visible CLI command surface changed; the docs opportunity is therefore non-blocking/no-op for this dependency-loading repair.

Next: push PR #2507, promote into stream/twenty-migration, then require fresh stream CI (especially Consuelo / verify and Consuelo / dialer) before merging PR #1991 to main.

- 2026-09-21 05:03:00 append: `.task/twenty-migration/close-bun-hoisting-dependency-gaps/workpad.md`
