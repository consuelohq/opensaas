# Worker 24: Distribution Integration And Rehearsal

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` in full and the completed outputs from workers 01-07, 25-27, and 30. This task owns the shared distribution integration surfaces that adapter workers must not edit independently.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Mission

Integrate and prove the complete OS distribution lifecycle before native platform shells depend on it: build, publish, install, activate, update, report, migrate managed components, rollback, repair, prune, uninstall, and reinstall.

## Integration ownership

This task owns final reconciliation of:

- bootstrap and installer entrypoints;
- root/package release scripts;
- shared runtime-bundle and channel schemas;
- GitHub release workflows and environment protections;
- runtime path resolution;
- installer and updater diagnostics;
- canonical tool/skill/package manifests;
- package ordering and generated-runtime-bundle/manifest checks;
- portable SQLite/native-library resolution;
- stale release and cache pruning.

Do not absorb provider, web-auth, or native-app work.

## Required cleanup

- Remove or migrate stale competing distribution manifests after proving no active consumer remains.
- Eliminate customer-runtime assumptions about a specific Homebrew SQLite path or developer machine PATH.
- Ensure Bun's executable path is resolved and persisted for non-interactive services.
- Ensure the shipped runtime bundle includes every runtime directory required by current OS behavior, not only the narrow legacy Dockerfile copy list.
- Enforce the flattened product root: new installs activate path-neutral bundles at `~/.consuelo/runtime/releases/<bundle-id>/`; `~/.consuelo/os/` is accepted only as legacy migration input and is never recreated as the final package root.
- Resolve canonical tool package source and generator dependencies from the active immutable runtime release. Never materialize `packages/os/tools/` into the user-owned `~/.consuelo/tools/` namespace.
- Preserve user-owned tools during install, update, repair, rollback, and migration even when their IDs overlap canonical source-package directory names such as `github`, `http`, `memory`, or `subagent`.
- Remove `packages/os/tooling` after Worker 26's consumer proof; do not leave a competing manifest authority.
- Preserve user-owned `~/Consuelo` content and steering without creating hidden editable duplicates.
- Complete the `consuelo` OS lifecycle and `consuelo-dialer` split from Worker 30 without removing dialer behavior.
- Stop installing `decision.md`; preserve a user-modified copy according to the managed-component migration contract.
- Make installed skills and update summaries available to steering through one canonical registry.
- Perform the approved clean cutover without deprecated aliases, path shims, duplicate manifests, or compatibility dispatch. Update every consumer/test and delete superseded sources in the same release.
- Consolidate restart around Worker 04's typed adapter over `consuelo-reload.js` and watchdog behavior. Remove duplicated `server.js` restart orchestration only after characterization/parity tests pass.
- Preserve existing steering, install-state, skills-registry, MCP-gateway, security-gateway, reload, watchdog, and product-server tests as regression contracts; change only assertions tied to an explicit approved behavior change.

## Rehearsal matrix

Use disposable homes and temporary release infrastructure where possible. Test:

1. Empty host, no Bun.
2. Empty host, existing Bun in a non-default path.
3. Existing legacy `~/.consuelo/os` layout.
4. Existing flattened `~/.consuelo/` layout.
4a. Clean install proves no `~/.consuelo/os/` directory is created and the active release resolves through `~/.consuelo/runtime/current`.
5. User-modified managed skill/tool/site.
6. Unmodified managed component eligible for automatic update.
7. Interrupted download.
8. Invalid digest/signature.
9. Interrupted activation.
10. Failed health check and automatic rollback.
11. Explicit rollback.
12. Retention pruning.
13. Uninstall preserving user-owned data by default.
14. Full purge with explicit confirmation.
15. Reinstall after either uninstall mode.
16. Update count surfaced in steering without loading full release notes.
17. Update skips OAuth, workspace naming, skill selection, and agent onboarding.
18. `consuelo restart` restarts only Consuelo-owned services and health-gates completion.
18a. Restart preserves reply-safe detachment, launchd/direct modes, conflicting-label cleanup, kill escalation, and rate-limited watchdog behavior.
19. Notification off/snooze persistence and steering behavior.
20. Same-account second-node continuity using Worker 25's registry without replacing the home/default route.
21. Visible user steering and modified user-owned tool/skill preservation.
22. Canonical tool-package source remains under `runtime/releases/<bundle-id>` while a user-owned tool with an overlapping source-package name survives install, update, repair, and rollback unchanged.

Use the PTY harness for interactive flows. The OCI clean-host CI lane plus macOS and Windows runners are mandatory. Local Docker/Apple `container` use is optional, and Ko's active machines are never the worker's test environment.

## Internal-host policy

- Mac Mini is the always-on dev node, but do not mutate it without Ko's explicit approval.
- MacBook Air is the preferred destructive canary/beta acceptance host when online.
- Neither host identity may be hard-coded in product code.
- Open PRs do not deploy to either host.

## Acceptance gates

- One command installs on a clean supported Mac without prior Bun configuration.
- One lifecycle command reports current version/channel/update count.
- Update activates atomically and health-gates success.
- Rollback restores the previous working release.
- Promotion changes protected release refs/metadata only and preserves runtime-bundle digest.
- Automatic versioning is a no-op when the runtime closure is unchanged and allocates exactly one idempotent SemVer when it changes.
- Uninstall/reinstall leaves no orphan service or tunnel processes.
- Managed user modifications survive normal update.
- Canonical source packages never compete with or overwrite user-owned tools under `~/.consuelo/tools/`.
- Diagnostics are useful and redacted.
- Current full OS tests plus the new distribution E2E suite pass.

## Completion report

Provide the exact rehearsal matrix with pass/fail evidence, runtime-bundle/channel identifiers, remaining platform gaps, migrated/deleted legacy surfaces, and commands Ko can use for the first controlled Mac Mini dev adoption after approval.
