# ship approved os foundation installer runtime and connector

branch: `task/os/ship-approved-os-foundation-installer-runtime-and-connector`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1743/ship-approved-os-foundation-installer-runtime-and-connector
github pr: https://github.com/consuelohq/opensaas/pull/1743
started: 2026-07-29

## acceptance criteria

- [x] Public install remains exactly `curl -fsSL https://install.consuelohq.com/os | bash` and is cwd-independent.
- [x] Fresh local state uses `~/.consuelo` plus the visible `~/Consuelo` tree without hidden mutable source mirrors.
- [x] Selected skills materialize visibly with `SKILL.md`; clean deselection removes them and modified content is preserved for review.
- [x] Native agent configuration uses MCP name `os` and the authenticated public connector URL remains `https://os.consuelohq.com/mcp`.
- [x] Hosted installs resolve a signed immutable runtime, stage dependencies/onboarding before atomic activation, and support rerun updates.
- [x] Hosted release channels and bundles are served from R2 through the Cloudflare installer worker.
- [x] `decision.md` is absent from the installed/runtime surface.
- [ ] Production workflow, release-channel promotion, and live hosted smoke checks complete after merge.

## plan

1. Implement the approved home/runtime/MCP/installer contract.
2. Verify focused installer, lifecycle, managed-component, agent, gateway, and trace surfaces.
3. Address one first review round from CodeRabbit, Codex, and Qodo.
4. Because the first round exceeded ten comments, run one final review round after fixes.
5. Merge through `stream/os`, deploy/promote the signed runtime, and smoke-test the public installer.

## current status

- Implementation and all first-round review fixes are complete.
- Focused regression suite and publish-valid repository verification pass.
- Next: push review fixes and run the required final review round.

## files changed

- `.github/workflows/consuelo-production-release.yaml`
- `packages/os/plans/consuelo-os-foundation/plan.md`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/compact-daemon-output.test.ts`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/lifecycle/release.ts`
- `packages/os/scripts/lib/lifecycle/types.ts`
- `packages/os/scripts/lib/local-agent-connectivity.ts`
- `packages/os/scripts/lib/managed-component-install.ts`
- `packages/os/scripts/lib/managed-components.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/steering/decision.md` (deleted)
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/distribution/lifecycle-contract.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/finish-line-lifecycle-contract.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/installer-local-agent-connectivity.test.ts`
- `packages/os/tests/installer-runtime-dependencies.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/lifecycle-gcp-metadata-release-source.test.ts`
- `packages/os/tests/lifecycle-retention-uninstall.test.ts`
- `packages/os/tests/local-agent-connectivity.test.ts`
- `packages/os/tests/sites-cli.test.ts`
- `packages/os/tests/stream-install-state.test.ts`
- `packages/workspace/scripts/os-release-install.ts`
- `packages/os/tests/hosted-release-worker-contract.test.ts`
- `packages/os/tests/bootstrap-release-verifier-contract.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- `bash -n packages/os/scripts/bootstrap.sh`: passed.
- Focused Vitest run: 137 passed, 7 existing todos.
- Managed-component and local-agent regression rerun: 27 passed.
- `bun run verify -- --base origin/stream/os --json`: publish-valid; static rules, eslint, typecheck, spec compliance, and DB guard passed.
- First review round: CodeRabbit 12 actionables, Codex 3, Qodo 4. All valid findings were fixed; overlapping findings were handled once.

## key decisions

- Hosted release origin and baked trust anchors cannot be overridden unless `CONSUELO_OS_DEV=1`.
- Runtime activation occurs only after dependency installation and onboarding succeed.
- `nightly` remains a supported lifecycle channel and is proxied by the release worker.
- Missing clean managed skills are reinstalled; user files, symlinks, and modified trees are never overwritten.

## notes for ko

- No migration path was added for Ko's reinstall; the final handoff will include a clean uninstall Bun command.
- Mac app and marketplace packaging remain deferred as approved.

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```
