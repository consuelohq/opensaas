# restore consuelo design orchestration skill

branch: `task/os/restore-consuelo-design-orchestration-skill`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/538/restore-consuelo-design-orchestration-skill
github pr: https://github.com/consuelohq/opensaas/pull/538
started: 2026-05-23

## acceptance criteria

- [x] Restore the prior rich `areas/consuelo-design/AGENTS.md` operating manual from `origin/main` into the OS stream, without losing stream-only facade/tooling boundary updates.
- [x] Add a top-level `consuelo-design` OS skill that is instructional/orchestration-based, not primarily script-backed.
- [x] Move landing-page behavior into a subskill/preset under `consuelo-design`, preserving useful JSON shape, artifact expectations, and approval guardrails.
- [x] Keep the old landing-page skill only as a compatibility/deprecated alias if needed; do not make it the main advertised product skill.
- [x] Preserve design templates/shell rules as references/subskills rather than deterministic scripts.
- [x] Update OS manifest/docs/spec references so task 11 reflects a Consuelo Design skill with landing-page preset/subskill.
- [x] Validate manifest parsing, relevant syntax/docs checks, `consueloDesign.check`, focused skill metadata checks, and review/verify against `origin/stream/os`.

## plan

1. Read current and old Consuelo Design operator files plus current OS skill runtime/manifest patterns.
2. Restore and merge `areas/consuelo-design/AGENTS.md` with full prior content and current facade decisions.
3. Create `packages/os/skills/consuelo-design` with `SKILL.md`, references, and subskill JSON presets.
4. Demote/hide/deprecate `consuelo-design-landing-page` while keeping compatibility where safe.
5. Update manifest/docs/spec references and remove unneeded script-primary wiring where appropriate.
6. Validate, inspect diff, push, and promote into the stream OS PR.

## current status

- Implemented and validated. Ready to push/promote into `stream/os`.

## files changed

- `areas/consuelo-design/AGENTS.md`
- `packages/os/skills/consuelo-design/SKILL.md`
- `packages/os/skills/consuelo-design/skill.json`
- `packages/os/skills/consuelo-design/references/agents.md`
- `packages/os/skills/consuelo-design/subskills/*.json`
- `packages/os/scripts/design/consuelo-design.ts`
- `packages/os/scripts/os.ts`
- `packages/os/skills/consuelo-design-landing-page/skill.json`
- `packages/os/tooling/tool-manifest.json`
- `packages/os/tests/consuelo-design.test.ts`
- `packages/os/docs/skills.md`
- `packages/os/skills.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-05-23 19:48:54 `checkFiles`: passed — OK
- 2026-05-23 19:50:02 `review.run`: passed — OK
- 2026-05-23 19:50:14 `verify`: passed — OK

## key decisions

- Skills should teach tool/script chaining. Workspace tools/scripts remain the deterministic machinery.
- `consuelo-design` is now the product-facing skill; landing-page is a preset/subskill.
- The OS metadata model still requires `script`, so the top-level script is a minimal guide/registry runner, not the main design implementation.
- The old landing-page skill remains as a deprecated compatibility alias so existing calls do not break.

## notes for ko

- Confirmed before task start: `origin/main:areas/consuelo-design/AGENTS.md` has 623 lines, `origin/stream/os` has 151 lines.

## improvements noticed

- The current OS skill metadata requires scripts even for instructional skills. Future work should consider first-class instruction-only skill metadata so guide skills do not need a minimal runner.

## issues and recovery

- 2026-05-23: initial workpad write failed because bootstrap had already created the file; recovered with scoped python replacement.
- 2026-05-23: workspace `git.diff` did not show unstaged/untracked files; recovered with `git add -N` and task-local `git diff --stat origin/stream/os` for diff evidence.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```
