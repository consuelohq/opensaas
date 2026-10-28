# Worker 05: Retention, Automatic Rollback, Uninstall, and Development Reset

## Dependencies

Begin after Worker 04 is integrated. Use its lifecycle services and Worker 01's failure harness.

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` in full and read the repo/OS skills. Start from `stream/os-distribution`. Do not revert other work.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Objective

Finish lifecycle safety and eliminate release-folder accumulation while providing a clean internal reset path and a customer-safe uninstall.

## Required behavior

### Rollback

- Maintain atomic `current` and `previous` references.
- Mark a runtime bundle known-good only after bounded health acceptance.
- Automatically restore previous on failed post-activation acceptance.
- Restart only Consuelo-owned services after rollback.
- Preserve failed-version diagnostics without retaining the full failed tree indefinitely.
- Provide explicit `consuelo rollback` with dry-run/JSON output.

### Retention

- Keep current, previous, pinned, and content bases needed by unresolved merges.
- Remove every other runtime release safely.
- Apply count and TTL limits to temporary/test homes and development slots.
- Never delete through an untrusted symlink.
- Refuse pruning when references are inconsistent.

### Uninstall

- Stop and remove only Consuelo-owned launchd/systemd/Windows service entries.
- Remove runtime, generated service files, generated Caddy/tunnel files, and caches according to explicit options.
- Preserve workspace membership, user-owned visible content, and optionally node identity by default.
- Provide `--remove-node`, `--remove-user-content`, and development-only `dev reset` as separate explicit choices.
- Never remove arbitrary provider CLI credentials.

## Owned files

- Rollback, retention, uninstall, and reset services under lifecycle/platform boundaries.
- CLI wiring for rollback/uninstall/dev reset.
- Platform-neutral tests and macOS service cleanup tests.
- Migration from the current accumulating release layout.

## Forbidden scope

- Do not use broad `rm -rf ~/.consuelo` as normal uninstall behavior.
- Do not delete Artifacts, Projects, Sites, Skills, or Tools without explicit user intent.
- Do not unregister cloud workspace membership silently.
- Do not rely on Git.

## Required tests

- Health failure restores previous.
- Crash between link creation and switch is recoverable.
- Current/previous/pinned survive pruning.
- Malicious symlink cannot escape Consuelo directories.
- Default uninstall preserves user content and membership.
- Full reset requires explicit development command.
- Reinstall after uninstall works cleanly.
- Repeated updates do not grow release count without bound.

## Live validation

Use isolated homes and CI runners first. Do not uninstall Ko's active OS. Produce an exact rehearsal command for Ko to run later on the Mac Mini or MacBook Air.

## Completion output

Report retention invariants, uninstall option matrix, rollback evidence, migration behavior, and the exact command that would clean the current development installation after approval.
