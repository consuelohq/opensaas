# runtime bundle builder

branch: `task/os-distribution/runtime-bundle-builder`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1556/runtime-bundle-builder
github pr: https://github.com/consuelohq/opensaas/pull/1556
started: 2026-07-22
node: `consuelo-mini`
task session: `tsk_a9586916907c`
recovered task HEAD: `ab207ae90904a2a2bf3b3307e82c7471625dbf6a`
stream ref at recovery: `18b2d13081a371c25fef3dfdac77ac10461b0be8`
main ref observed at recovery: `a7a3265b2f54d74ff5416c5a9d92659dde6e8fc3`

## acceptance criteria

- [x] Add a versioned runtime-bundle contract with platform/architecture, source commit, supplied product version, version-neutral release fingerprint, content-addressed bundle ID, files with digest/mode/role, migrations, minimum updater version, signature metadata boundary, and sanitized build provenance.
- [x] Define one explicit customer-runtime allowlist using the approved content roles and reject unclassified, missing required, operator-only, internal-host, absolute-machine-path, manifest/archive-drift, and competing-manifest inputs.
- [x] Preserve customer-facing provider capability while excluding Consuelo operator release, WAF, route seeding, and production-default tooling.
- [x] Produce deterministic ordering and byte-identical output for identical source, fingerprint, supplied version, platform, and inputs.
- [x] Expose a version-neutral fingerprint operation and a direct Bun builder entrypoint without editing shared/root package scripts.
- [x] Prove missing-input, operator-file, digest-drift, deterministic-ordering, fingerprint-stability, version-propagation, manifest parity, and clean-host/runtime parity behavior with test-first coverage.
- [x] Run focused and broader OS validation, build twice and compare outputs, inspect archive inventory, and run the registered distribution lane relevant to this worker.
- [ ] Record CodeRabbit and Grok 4.5 review evidence and dispositions on PR #1556, remove temporary review files, and merge only the task PR into `stream/os-distribution`.

## plan

1. Verify current install-state, Docker, distribution-harness, manifest, provider, and operator-tool boundaries against the recovered task base.
2. Record the executable runtime-bundle policy and first write focused behavioral tests that fail for the missing contract.
3. Implement the smallest cohesive TypeScript contract, allowlist classifier, deterministic builder/archive, verifier, and direct Bun entrypoint needed to satisfy those tests.
4. Run focused green tests, deterministic double-build/archive inspection, existing manifest/package regressions, and the registered clean-host validation path.
5. Self-review, run workspace review and verify, publish to PR #1556, collect CodeRabbit and Grok reviews, fix valid findings, post dispositions, and merge the task PR into the assigned stream only.

## Test-first contract

- Behavior under test: the runtime-bundle builder deterministically classifies and packages only the customer runtime closure, propagates an externally supplied version, exposes a version-neutral release fingerprint, verifies manifest/archive parity, and fails closed on unsafe or ambiguous inputs.
- Existing local pattern to follow: Vitest distribution tests under `packages/os/tests/distribution` and deterministic fixtures under `packages/os/scripts/testing/distribution`.
- New or changed tests: focused runtime-bundle contract/builder tests covering required inputs, operator-only rejection, internal path/host rejection, digest drift, deterministic order/bytes, fingerprint version neutrality, supplied version propagation, manifest parity, conflicting authoritative manifests, and clean-host inventory parity.
- Focused red command: `bun x vitest run tests/distribution/runtime-bundle.test.ts` from `packages/os`, executed through task-scoped `code.call`.
- Expected red failure: `Cannot find module '../../scripts/lib/distribution/runtime-bundle'`, proving the contract was absent before production implementation (`trc_ebb962f8c238`).
- Secondary schema red: the expanded focused suite failed on missing `runtime-bundle.schema.json`; the same run also exposed and then corrected a Node/Vitest harness misuse of the `Bun` global (`trc_f15721bbf749`).
- Focused green command: `bun x vitest run tests/distribution/runtime-bundle.test.ts`.
- Focused green result: the final suite passes 14 tests, covering schema, CLI, version refusal, required inputs, role boundaries, sanitization, source-root boundaries, fingerprint/version behavior, deterministic bytes, archive parity, manifest authority, native dependency staging, and real-repository closure (`trc_4a3f18751f49`).
- No-test waiver: none.

## current status

- Recovered the exact existing Worker 02 task and confirmed it has no product diff against the assigned stream.
- Mandatory plan, environment registry, worker brief, Grok template, repository steering, engineering skill, task skill, AGENTS guidance, coding standards, and workspace script rules are read.
- Implemented the versioned schema, explicit role classifier, deterministic ustar+gzip builder, archive inspector/verifier, version-neutral fingerprint operation, direct Bun CLI, and Docker consumer.
- The customer closure preserves Railway/provider surfaces while excluding operator, Cloudflare administration, test, source-generation, and competing raw tooling-manifest inputs.
- Steering documentation is deterministically sanitized from literal machine paths before hashing and packaging; executable/runtime source still fails closed on machine paths and internal fixture hosts.
- Focused TDD is green at 14/14. Deterministic archive evidence, Apple Container image validation, and the registered distribution/regression suites are complete. Review, publication, and merge remain.

## validation evidence

- Deterministic double build: 327 payload files / 328 archive entries; byte-identical output; release fingerprint `sha256:86d69420ad98ff596f74f92d465501b37cecdd9d1b228d3cb058c792e0eb9c21`; bundle ID `sha256:84f24aa4ef06accacde9de948e37e371e97cf226e9e61bbf42b00d011b8a6572`; archive digest `sha256:78b515b88a771423705541ec5aa56a133611bcf5beec7b6b99b40803cde7be40` (`trc_8bd7751a3e48`).
- Included role counts: runtime 232, managed-tool 20, managed-site-template 23, platform-adapter 8, customer-provider 11, managed-skill 33. Excluded counts: operator-only 45, test-only 210, source-only 16. Forbidden inventory check returned no entries (`trc_8bd7751a3e48`).
- Registered Apple Container clean-host probe passed on Linux/arm64 with Bun 1.3.14 (`trc_774a113d0f0f`).
- Final Apple Container image build and runtime inspection passed from the registered durable worktree lane: Linux/arm64 manifest, 327 files, Railway present, native dependencies installed, and no `/app/operator`, `/app/cloudflare`, or `/app/scripts/testing` (`trc_1659a02dde06`).
- Final focused suite: 14/14 passed (`trc_4a3f18751f49`).
- Final distribution suite: 30 passed, 10 pre-existing TODO contracts. Final regression suite: 93 passed, 5 pre-existing skipped workspace-gateway contracts (`trc_b34856e2cad3`). The process emitted a non-fatal existing trace-persistence warning about unavailable `bun:sqlite`; both commands exited 0.
- Strict workspace review initially found one `ERROR_HANDLING` rule in the CLI dispatcher (`trc_29f5621ef819`). The unnecessary async dispatcher was converted to explicit promise returns without changing CLI errors; focused tests remained 14/14 (`trc_67ace636a08e`) and strict review then passed with zero findings (`trc_72d88b1674e9`).

## files changed

- `.task/os-distribution/runtime-bundle-builder/workpad.md`
- `packages/os/Dockerfile`
- `packages/os/scripts/build-runtime-bundle.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.schema.json`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`

## workspace-owned: files changed

- `.task/os-distribution/runtime-bundle-builder/workpad.md`
- `packages/os/Dockerfile`
- `packages/os/scripts/build-runtime-bundle.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.schema.json`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`

## workspace-owned: activity log

- 2026-07-22 20:20:44 fs.write: `.task/os-distribution/runtime-bundle-builder/workpad.md`
- 2026-07-22 20:23:23 fs.write: `packages/os/tests/distribution/runtime-bundle.test.ts`
- 2026-07-22 20:25:15 fs.write: `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- 2026-07-22 20:26:46 fs.write: `packages/os/scripts/build-runtime-bundle.ts`
- 2026-07-22 20:27:02 fs.write: `packages/os/Dockerfile`
- 2026-07-22 20:27:55 fs.write: `packages/os/scripts/lib/distribution/runtime-bundle.schema.json`
- 2026-07-22 20:36:53 fs.write: `packages/os/Dockerfile`
- Managed by workspace tooling.

## workspace-owned: validation evidence

- Managed by workspace tooling.
- 2026-07-22 20:28:53 `checkFiles`: passed — OK
- 2026-07-22 20:39:42 `review.run`: passed — OK
- 2026-07-22 20:40:12 `review.run`: passed — OK

## key decisions

- Recover PR #1556 and task session `tsk_a9586916907c`; do not create a competing Worker 02 branch or PR.
- Keep all repository and task operations on the Consuelo OS typed facade. No native Git, unscoped shell, legacy workspace connector, alternate machine, or provider substitution is being used.
- The task branch tree is identical to the assigned stream at recovery. `task.ensureSynced` returned `synced: true`; differing refs are retained here as evidence rather than rewritten through an unsupported history operation.
- Worker 26 owns canonical tool-package/manifest consolidation. This task will consume existing manifest surfaces for validation and will not create another tool-manifest authority.
- Worker 24 owns shared/root script wiring. This task will expose a direct Bun entrypoint and document the intended package-script keys without editing shared/root package scripts.
- `packages/os/manifests/tool.manifest.json` is the sole default authoritative customer tool manifest. Callers may declare multiple authoritative paths only for transition validation, and the builder rejects any disagreement. Raw `tooling/**` inputs remain source-only for Worker 26 consolidation.
- Runtime archives use deterministic ustar headers (fixed uid/gid/mtime/owner), deterministic file ordering, canonical JSON, and level-9 gzip. Bundle IDs include allocated version/platform/source metadata; release fingerprints include only the classified runtime closure and policy/schema versions.
- The direct integration surface is `bun packages/os/scripts/build-runtime-bundle.ts <fingerprint|build|verify>`. Worker 24 should wire `runtime-bundle:fingerprint`, `runtime-bundle:build`, and `runtime-bundle:verify` without changing the entrypoint contract.
- Docker builds compile native production dependencies in a disposable `runtime-dependencies` stage. The final image receives only the verified bundle and `node_modules`; compiler, Python, operator, Cloudflare, tests, and raw source-authority inputs do not ship.
- Docker architecture has no `unknown` fallback. The build must receive `TARGETARCH` from BuildKit or the caller; validation supplied `TARGETOS=linux` and `TARGETARCH=arm64` explicitly and verified the manifest values.

## notes for ko

- No real-Mac lifecycle action is part of this task. Any install/update/reset/restart/uninstall checkpoint will stop with an exact human command and expected result.

## improvements noticed

- Task-scoped `batch` did not propagate the outer task session to child `fs.read` and `git.diff` calls in this recovered session. Direct task-scoped calls work correctly; this task will not broaden scope to repair the workspace batch router.
- Task-scoped `status` returned root-main state instead of the recovered task worktree. Task truth is therefore being verified with direct `fs.*`, `git.diff`, `task.ensureSynced`, and task-scoped `code.call` evidence.

## issues and recovery

- Initial pre-task plan reads failed with `AMBIGUOUS_TASK_SELECTION` because multiple active worktrees existed (`trc_03f2f5e25f7c`). Retrying `fs.read` with `branch: main` failed because main has no active task (`trc_1a7bcc9c6b65`). Recovery: confirmed clean root-main sync with typed `status`, then used the typed read-only `mac.read` route for the fixed main-worktree paths (`trc_bb12eabd4716`, `trc_fd4f0f112027`).
- The first task-scoped batch failed to propagate `tsk_a9586916907c`: child file reads returned `AMBIGUOUS_TASK_SELECTION`, and child diffs returned `TASK_SESSION_REQUIRED` (`trc_9978a52f3537`). Recovery: retried each operation as a direct `os.call` with the exact top-level task session; reads and `git.diff` then succeeded (`trc_ce81b2ded61e`, `trc_c87f82bcc800`).
- Direct task-scoped `status` still reported root-main state (`trc_52f47a2fde06`). Recovery: used task-scoped `code.call` for exact branch/ref evidence (`trc_3aa5b24e4236`, `trc_beb007b01ad2`) and the supported `task.ensureSynced` check (`trc_130e51bccfef`).
- A combined `fs.apply_patch` that attempted to delete and re-add the existing Dockerfile failed with `patch target already exists` (`trc_70695b4e4582`). Recovery: applied the source classification hunk separately (`trc_73512e9204ec`) and replaced the Dockerfile through task-scoped `fs.write` (`trc_f1c7cbdad20b`).
- Apple Container received an empty 2-byte context from the recovered `/private/...` task worktree. Absolute and in-place retries reproduced the failure. Recovery used a temporary validation snapshot under the registry-approved `~/Dev/opensaas-worktrees` root, then removed the image and snapshot after each run.
- The first durable-context image build exposed a false positive where source root `/source` matched lockfile text such as `/source-map`. A failing boundary test was added, then source-root matching was tightened (`trc_3e55a970877f`). The next build exposed the legitimate portable shell path `$tmp_dir/source`; exact-root matching is now limited to multi-segment roots while `/Users`, `/home`, Windows user paths, and long source roots remain fail-closed (`trc_27fca717251d`).
- The next image build reached production dependency installation and failed because `tree-sitter-typescript` required Python and a compiler in the slim image. A focused Docker contract was added red (`trc_cb088f96c12c`), then a disposable native dependency stage was implemented and the final image passed (`trc_1659a02dde06`).
- One focused red-run request failed before execution with a transient Consuelo account connection error. Retrying the same task-scoped call produced the expected red test and no route substitution was used.

---

## publish checklist

```bash
bun run task:push -- --message "feat(os-distribution): add deterministic runtime bundle builder" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-22 20:20:44 write: `.task/os-distribution/runtime-bundle-builder/workpad.md`

- 2026-07-22 20:23:23 write: `packages/os/tests/distribution/runtime-bundle.test.ts`

- 2026-07-22 20:25:15 write: `packages/os/scripts/lib/distribution/runtime-bundle.ts`

- 2026-07-22 20:26:18 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`
- 2026-07-22 20:26:18 apply-patch: `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- 2026-07-22 20:26:46 write: `packages/os/scripts/build-runtime-bundle.ts`

- 2026-07-22 20:26:58 apply-patch: `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- 2026-07-22 20:27:02 write: `packages/os/Dockerfile`

- 2026-07-22 20:27:26 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`
- 2026-07-22 20:27:43 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`
- 2026-07-22 20:27:55 write: `packages/os/scripts/lib/distribution/runtime-bundle.schema.json`

- 2026-07-22 20:28:08 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`

## workspace-owned: files read

- `packages/workspace/scripts/task-push.js`
