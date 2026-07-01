# fix os installer domain

branch: `task/os/fix-os-installer-domain`
stream: `stream/os`
taskSession: `tsk_d660ef6921e0`
task PR: https://github.com/consuelohq/opensaas/pull/699
Graphite task PR: https://app.graphite.com/github/pr/consuelohq/opensaas/699/fix-os-installer-domain
started: 2026-06-02

## acceptance criteria

- [x] Replace user-facing OS hosted installer domain with `install.consuelohq.com`.
- [x] Update bootstrap script rerun hints and help output.
- [x] Update OS README/SCRIPTS deployment notes.
- [x] Search for stale installer hostname references and confirm no installer-facing stale references remain.
- [x] Preserve `GET /os` route behavior and avoid unrelated domain changes.
- [x] Validate shell syntax, help/dry-run, and focused grep checks.
- [ ] Push with `fix(os): correct hosted installer domain` and promote to stream review PR.

## plan

1. Use context/explore to confirm this is a follow-up to the prior OS bootstrap installer work.
2. Search current task worktree for wrong domain strings and read the relevant files.
3. Apply minimal string/domain patches only where references are installer-facing.
4. Validate shell syntax, help output, dry-run behavior, and absence of stale installer domain strings.
5. Inspect diff, update workpad, push, and promote through `task.pr`.

## test-first contract

Behavior under test:
- Hosted installer command and bootstrap rerun hints should use `https://install.consuelohq.com/os`.
- Docs should instruct operators to map `install.consuelohq.com`.
- The route path remains `/os`.

Existing local pattern:
- Prior bootstrap task used shell syntax checks, bootstrap help/dry-run, route smoke, and grep guards.

Focused red command before implementation:
- Grep relevant OS/bootstrap paths for the stale hosted installer hostname.

Expected red failure:
- The grep should find stale hosted installer references in bootstrap/docs/workpad history before the fix.

No-test waiver:
- No new unit test is needed; this is a string/domain correction. Validation replaces it with focused grep checks, shell syntax, and bootstrap help/dry-run smoke.

## red evidence

Red grep found stale hosted installer references in:

- `packages/os/SCRIPTS.md`
- `packages/os/README.md`
- `packages/os/scripts/bootstrap.sh`
- `.task/os/os-bootstrap-installer/workpad.md`
- `.task/os/os-bootstrap-installer/publish-update.md`
- `.task/os/fix-os-installer-domain/workpad.md`

The same sweep found unrelated generic `consuelo.com` examples in `packages/twenty-server/src/engine/core-modules/open-api/utils/base-schema.utils.ts`; those are not OS installer references and were intentionally left unchanged for this focused task.

## implementation

Updated the hosted OS installer hostname to `install.consuelohq.com` in:

- `packages/os/scripts/bootstrap.sh`
- `packages/os/README.md`
- `packages/os/SCRIPTS.md`
- `.task/os/os-bootstrap-installer/workpad.md`
- `.task/os/os-bootstrap-installer/publish-update.md`

No route code changed. `GET /os` remains the hosted route path.

## validation

Passed:

```bash
bash -n packages/os/scripts/bootstrap.sh
bash packages/os/scripts/bootstrap.sh --help | grep -F 'https://install.consuelohq.com/os'
bash packages/os/scripts/bootstrap.sh --dry-run > /tmp/domain-dry-run.out
! grep -F '<stale-host>' /tmp/domain-dry-run.out
! grep -R '<stale-host>' packages/os packages/twenty-server .task/os/os-bootstrap-installer .task/os/fix-os-installer-domain
grep -R 'install.consuelohq.com' packages/os .task/os/os-bootstrap-installer .task/os/fix-os-installer-domain
```

The dry-run also exercised the LaunchAgent dry-run path through the bootstrap.

## notes for Ko

- This task fixes the OS installer hostname only.
- It does not change unrelated OpenAPI example values that still use the generic older domain. That can be a separate brand-domain cleanup if desired.
- Production still needs DNS/Railway mapping for `install.consuelohq.com` to the app service preserving `/os`.

- 2026-06-02 15:13:30 write: `.task/os/fix-os-installer-domain/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-02 15:13:30 fs.write: `.task/os/fix-os-installer-domain/workpad.md`

## workspace-owned: validation evidence

- 2026-06-02 15:19:33 `review.run`: passed — OK
- 2026-06-02 15:19:34 `review.run`: passed — OK
- 2026-06-02 15:19:34 `review.run`: passed — OK
- 2026-06-02 15:19:34 `review.run`: passed — OK
- 2026-06-02 15:21:58 `verify`: failed — COMMAND_FAILED

## workspace-owned: test selection

- changed files: none
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none

## publish-gate note

`review.run` timed out. Retrying through the CLI wrapper with `bun run review -- --base origin/stream/os --no-tests` also timed out.

`verify` with `base=origin/stream/os`, `noReview=true`, and `noDb=true` still ran the review/test-selection wrapper and failed before writing a publish-valid stamp:

```text
review stderr: unknown flag: --summary-json
test-selection stderr: Module not found "packages/workspace/scripts/test-selection.js"
db guard: pass, 0 risks, 0 findings
```

This is a wrapper/tooling failure, not a domain-change failure. Focused validation for this string-only task passed and is recorded above.
