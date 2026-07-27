# address late distribution sync review findings

branch: `task/os-distribution/address-late-distribution-sync-review-findings`
stream: `stream/os-distribution`
pr: https://github.com/consuelohq/opensaas/pull/1671
source review: https://github.com/consuelohq/opensaas/pull/1670
started: 2026-07-27

## acceptance criteria

- [x] Remove the committed scratch dump and prevent root `.tmp-*` artifacts from being tracked.
- [x] Bound macOS Unix-socket connection establishment without weakening endpoint ownership, permissions, or I/O deadlines.
- [x] Keep the HTTP server available when the optional macOS lifecycle endpoint cannot start, and close the endpoint on termination signals.
- [x] Make native lifecycle operation locking fail fast, make lost worker claims observable, and redact CLI errors.
- [x] Keep lightweight preference, node, and diagnostics mutations out of lifecycle progress projection.
- [x] Correct macOS menu, documentation, response decoding, secret filtering, and review-requested test quality issues.
- [x] Preserve existing lifecycle/distribution behavior under focused Swift and TypeScript contracts.
- [ ] Complete GitHub CI and CodeRabbit review, disposition all late #1670 findings, and merge only into `stream/os-distribution`.

## implementation

- Deleted the accidentally committed `.tmp-native-lock-failures.txt` and added root `/.tmp-*` ignore coverage.
- Reworked native operation state locking to recover one stale lock but fail immediately on a live lock instead of blocking the event loop for five seconds.
- Changed detached worker execution to return an explicit claim result; the CLI now exits non-zero when a superseded worker loses authority.
- Exported and reused the native-operation redaction helper so parse/claim failures cannot expose tokens or local user paths.
- Added lightweight mutation acknowledgements for notification, channel, default-node, and diagnostics requests so status does not falsely report update/repair progress.
- Exported an injectable `startLocalOsServer`; optional lifecycle endpoint startup failures are logged but do not take down HTTP, and SIGINT/SIGTERM close an active endpoint.
- Bounded macOS socket connection with nonblocking connect, `poll`, and `SO_ERROR` verification while retaining owner-only socket validation, SIGPIPE suppression, and read/write deadlines.
- Removed the duplicate Refresh action, cached menu presentation state, and made command mapping exhaustive with offline guards only on mutations.
- Discriminated lifecycle response envelopes before decoding so unsupported snapshot schema errors are preserved rather than masked as operation acknowledgements.
- Unified Swift secret-field matching between workspace decoding and diagnostics redaction.
- Corrected macOS artifact instructions to distinguish a local app from a downloaded tarball and removed named-device language.
- Replaced the unconditional two-second Swift contract delay with deterministic signaling, normalized touched test names/temp roots, and routed enriched client metadata through the actual client.
- Added local server startup contracts and expanded endpoint, operation, macOS, lifecycle, runtime-bundle, and Swift regressions.

## TDD and validation

- RED trace `trc_61faa63f5035`: reproduced false lightweight progress, 5.07-second live-lock contention, lost-claim ambiguity, missing redaction export, absent fail-soft server helper, and socket/UI/docs/artifact hygiene failures.
- Initial implementation trace `trc_085e1d219f4b`: 110/111 TypeScript tests passed; exposed one server assertion and a malformed intermediate Swift safety refactor.
- Focused GREEN trace `trc_b47e377b6075`: seven TypeScript suites, 105 tests passed; expanded Swift contract executable passed; generated `.build` removed afterward.
- Final focused regression trace `trc_5f5733765104`: endpoint, operation, and server contracts 31/31 passed after repository error-handling compliance fix.
- Strict review initially found one `ERROR_HANDLING` blocker in the lightweight helper, trace `trc_0d6cebf7750f`; fixed with explicit non-Error normalization while preserving original Error propagation.
- Final strict review: 0 owned, pre-existing, or blocking issues, trace `trc_93fc0cb6df7f`.
- Full repository verify: passed and publish-valid, trace `trc_11d74dc37ca9`.

## late #1670 finding dispositions

- Valid and fixed in this PR: committed debug dump, downloaded-artifact docs, named-device docs, bounded socket connect, duplicate Refresh, false lightweight progress, synchronous lock contention, silent lost claims, unsafe CLI errors, optional endpoint startup coupling/signal cleanup, missing endpoint test imports, and the review's test quality/model decoding/secret predicate nitpicks.
- Already fixed before the late review landed: worker tests seed the required queued claim; PR #1670 already runs native lifecycle operation coverage in CI.
- `SO_NOSIGPIPE` was already present; the valid missing portion of that comment was the connection-establishment deadline.

## route failures and recovery

- `task.start` rejected the literal stream branch in `startFrom`; retried with the typed `stream` enum.
- A discovery batch did not propagate the top-level task session to child calls; retried with `taskSession` embedded in each child.
- The advertised `find` route was absent from the active OS manifest; used task-scoped `code.call` search.
- `git.diff` initially failed with `EISDIR` because Swift generated `.build/debug`; removed only the generated build tree and retried successfully.
- No native Git, legacy workspace connector, alternate computer, provider substitution, or Consuelo OS install/update/reset/restart/uninstall was used.

## review status

- Workspace strict review: clean.
- Full verify: publish-valid.
- CodeRabbit: pending on PR #1671.
- Grok: intentionally deferred because Ko reported the provider is rate-limited for the week; Ko will request an independent review manually after the stream work.

## remaining

- Publish the verified branch.
- Request CodeRabbit and post the corrective summary.
- Reply to all 13 late inline comments and the top-level late review on PR #1670.
- Resolve any new PR #1671 findings, wait for required CI, merge PR #1671 into `stream/os-distribution`, and verify stream ancestry.
