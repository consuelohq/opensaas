# diagnose installer launcher freshness

branch: `task/os/diagnose-installer-launcher-freshness`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/1179
started: 2026-06-23

taskSession: `tsk_445ec5e95029`

## acceptance criteria

- [x] Explain why `mac-air-test.consuelohq.com` still serves the old launcher.
- [x] Make stale hosted-source reuse instructions explicit with the full refresh command.
- [x] Prevent the installer from silently opening a stale workspace-host launcher when the local generated launcher is newer than the edge snapshot.
- [x] Add focused regression coverage.
- [x] Validate focused tests and gates.

## evidence

- Current `origin/main` tarball contains the new OS launcher markers: `buildMarkdownLink`, `https://sites.consuelohq.com/gtm`, and `WRITING:`. Evidence trace: `trc_a4f73e379aea`.
- `https://install.consuelohq.com/os` serves bootstrap defaulting to `https://github.com/consuelohq/opensaas/archive/refs/heads/main.tar.gz`. Evidence trace: `trc_a4f73e379aea`.
- Timeline explains the first-install confusion: launcher fix landed in `stream/os` at `2026-06-22T17:28:56-04:00`; `stream/os` did not merge to `main` until `2026-06-22T19:04:17-04:00`. Hosted bootstrap downloads `main`, not `stream/os`. Evidence trace: `trc_a4f73e379aea`.
- `https://mac-air-test.consuelohq.com/` currently returns `x-consuelo-edge-cache-authority: sites-snapshot`, `x-consuelo-site-version: sha256-15c3f6f5c611b43c`, and old UI markers (`support@consuelohq.com`, no GTM/Writing). Evidence trace: `trc_b8f54125eac7`; no-cache recheck: `trc_075c605cd773`.
- Current local generator output from `packages/os/scripts/os.ts sites refresh` hashes to `sha256-9e61d3fc2011bc4b` and has new UI markers. Evidence trace: `trc_9330060bdd46`.

## conclusion

Two freshness bugs existed:

1. Hosted source reuse was too easy to miss. Bootstrap reused `${TMPDIR}/consuelo-os-source` and only said `(pass --refresh-source to refresh it)`, instead of giving the full hosted install command.
2. The public workspace hostname is a Cloudflare `sites-snapshot` route. Public install does not mutate R2/D1 directly, so a workspace hostname can serve an older seeded/static snapshot even when local install source and local `sites/index.html` are current.

## implementation

- `packages/os/scripts/bootstrap.sh`
  - Replaced stale-source fallback copy with:
    - `Using existing Consuelo OS source: $REPO_DIR`
    - `To refresh source, run: $HOSTED_INSTALL_COMMAND_WITH_ARGS --yes --refresh-source`
  - Added local launcher version calculation from `$OS_HOME/sites/index.html` using the same `sha256-<first16>` version convention as the edge publisher.
  - Added workspace launcher header probing for `x-consuelo-site-version` with `cache-control: no-cache`.
  - If the workspace-host launcher version is missing or differs from the local Sites version, the interactive installer opens the local launcher path instead and prints a warning to stderr.

- `packages/os/tests/bootstrap-source.test.ts`
  - Added coverage for the full refresh command.
  - Added coverage for launcher freshness guards and stale workspace-host warning text.

## validation evidence

- Red focused test before patch failed on missing full refresh command and missing launcher freshness functions: `trc_64cc8716516c`.
- Green syntax + focused bootstrap test: `bash -n packages/os/scripts/bootstrap.sh` and `bun --cwd packages/os test tests/bootstrap-source.test.ts` passed, 7 tests: `trc_8be20e28a74e`.
- Green broader focused tests: `bun --cwd packages/os test tests/bootstrap-source.test.ts tests/sites-cli.test.ts` passed, 14 tests; command output captured in conversation.
- Type/syntax: `bun run --cwd packages/os typecheck` passed: `trc_6df913449554`.
- Review gate passed with 0 issues: `trc_8536a958a8fc`.
- Verify gate passed and wrote publish-valid stamp: `trc_de5eadfa8f24`.

## remaining production action

This code prevents future interactive installs from opening a known-stale workspace hostname. It does not rewrite the already stale `mac-air-test.consuelohq.com` R2/D1 snapshot. Updating that host requires an operator-side workspace-edge snapshot republish or control-plane seed refresh.

- 2026-06-23 03:09:23 write: `.task/os/diagnose-installer-launcher-freshness/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-23 03:09:23 fs.write: `.task/os/diagnose-installer-launcher-freshness/workpad.md`
