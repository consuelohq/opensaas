# fix Bun dialer Docker install scripts

branch: `task/twenty-migration/fix-bun-dialer-docker-install-scripts`
stream: `stream/twenty-migration`
pr: https://github.com/consuelohq/opensaas/pull/2509
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
- The Railway dialer image installs the locked root Bun graph without executing unrelated workspace lifecycle scripts.
- The image still builds logger, dialer, LeadConnector, and dialer-server artifacts in dependency order and produces the same compiled dialer-server runtime.
- The fix must address the clean Linux Docker failure without adding Python/build-essential solely to satisfy an unrelated root package.

existing local pattern:
- packages/dialer-server/Dockerfile copies the root workspace, runs `bun install --frozen-lockfile`, then explicitly builds only logger, dialer, lead-connector, and dialer-server.
- Clean-room M6 validation already proved the relevant release packages build/typecheck from `bun install --frozen-lockfile --ignore-scripts`.
- The root graph also contains unrelated native packages such as isolated-vm whose install script is not needed by the dialer image.

new or changed tests:
- Tighten the existing LeadConnector release-workflow Docker contract to require `bun install --frozen-lockfile --ignore-scripts`.
- Re-run the release-workflow contract.
- Build all four dialer release artifacts after a clean frozen install with scripts ignored.
- If local Docker is available, run the exact `docker build --file packages/dialer-server/Dockerfile ... .` command.

focused red evidence:
- Fresh Consuelo CI workflow run 35563264026 on stream head 8adbd26e:
  - dialer tests: passed;
  - all three release typechecks: passed;
  - all release artifact builds: passed;
  - Railway Docker build failed at Dockerfile line 4 while `bun install --frozen-lockfile` executed the unrelated isolated-vm install script.
  - node-gyp failed because the oven/bun image intentionally has no Python installation.

expected red failure:
- The release-workflow contract does not yet require `--ignore-scripts`; Docker currently executes isolated-vm's irrelevant native install hook.

no-test waiver: not applicable.

- 2026-09-21 05:10:01 append: `.task/twenty-migration/fix-bun-dialer-docker-install-scripts/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-21 05:10:01 fs.write: `.task/twenty-migration/fix-bun-dialer-docker-install-scripts/workpad.md`
- 2026-09-21 05:10:06 apply-patch: `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- 2026-09-21 05:10:17 apply-patch: `packages/dialer-server/Dockerfile`
- 2026-09-21 05:11:17 fs.write: `.task/twenty-migration/fix-bun-dialer-docker-install-scripts/workpad.md`

## GREEN evidence

- Release-workflow Docker contract: 4/4 passed after requiring `bun install --frozen-lockfile --ignore-scripts`.
- Exact local Docker command could not run because this machine has no `docker` binary; remote GitHub CI remains the authoritative Docker engine gate.
- Clean temp reproduction of Docker dependency/build stages with no inherited node_modules/dist:
  - root frozen Bun install with `--ignore-scripts`: passed, 5,096 packages;
  - logger build: passed;
  - dialer build: passed;
  - LeadConnector build + embed build: passed;
  - dialer-server Bun compile: passed (2,309 modules).
- The change does not modify runtime dependencies or dialer behavior; it prevents unrelated root workspace lifecycle scripts from executing in the dialer image build.

Next: strict review + canonical verify, promote PR #2509 into stream, then rerun Consuelo CI and require the Railway Docker step to pass.

- 2026-09-21 05:11:17 append: `.task/twenty-migration/fix-bun-dialer-docker-install-scripts/workpad.md`

## workspace-owned: validation evidence

- 2026-09-21 05:11:29 `review.run`: passed — OK
- 2026-09-21 05:11:38 `verify`: passed — OK
