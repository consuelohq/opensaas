# Use compact OS installer banner

## Acceptance criteria

- Public bootstrap dependency banner prints `CONSUELO  OS`, not `C O N S U E L O  O S`.
- Source contracts reject both letter-spaced banner forms.
- Hosted installer Worker is redeployed and verified live.

## Test-first contract

Behavior under test:
- `packages/os/scripts/bootstrap.sh` contains `CONSUELO  OS`.
- `bootstrap.sh` does not contain `C O N S U E L O  O S` or `C O N S U E L O   O S`.

Existing pattern:
- `packages/os/tests/bootstrap-source.test.ts` already protects the bootstrap dependency banner source.

Focused red command:
- `bun --cwd packages/os test tests/bootstrap-source.test.ts`

Expected red failure before implementation:
- Source contract expects compact banner but bootstrap still contains `C O N S U E L O  O S`.

## Validation evidence

- Red: `bun --cwd packages/os test tests/bootstrap-source.test.ts` failed because bootstrap did not contain `CONSUELO  OS`.
- Green: `bun --cwd packages/os test tests/bootstrap-source.test.ts` passed, 8 tests.
- Green: `bash -n packages/os/scripts/bootstrap.sh` passed.
- Green: `bun run os:release-install -- --dry-run` passed. New bootstrap SHA: `4d110380f0b0b849fcfe30e7976806bb9da8d409a7de0ee8e6719159c08a67ba`.

## workspace-owned: validation evidence

- Red: `bun --cwd packages/os test tests/bootstrap-source.test.ts` failed because bootstrap did not contain `CONSUELO  OS`.
- Green: `bun --cwd packages/os test tests/bootstrap-source.test.ts` passed, 8 tests.
- Green: `bash -n packages/os/scripts/bootstrap.sh` passed.
- Green: `bun run os:release-install -- --dry-run` passed. New bootstrap SHA: `4d110380f0b0b849fcfe30e7976806bb9da8d409a7de0ee8e6719159c08a67ba`.
- 2026-06-23 06:45:02 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/use-compact-os-installer-banner/current.json`, `.task/security/use-compact-os-installer-banner/session.json`, `.task/security/use-compact-os-installer-banner/workpad.md`, `.task/tasks/security/use-compact-os-installer-banner.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/tests/bootstrap-source.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
