# add consuelo design landing page skill

branch: `task/os/add-consuelo-design-landing-page-skill`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/532/add-consuelo-design-landing-page-skill
github pr: https://github.com/consuelohq/opensaas/pull/532
started: 2026-05-23

## acceptance criteria

- [x] Add a focused OS skill for Consuelo Design landing page and campaign brief drafts.
- [x] Reuse the existing Consuelo Design and Open Design workflow instead of copying or rewriting the design system.
- [x] Persist draft outputs as OS artifacts and return structured artifact references.
- [x] Require approval before publishing or replacing customer-facing pages.
- [x] Add focused tests for happy path, approval gate, and capability/failure behavior.
- [x] Validate against origin/stream/os because this task started from stream.

## plan

1. Read Consuelo Design operator files and current OS skill/artifact runtime patterns.
2. Identify the smallest integration path for a design draft skill and runner.
3. Implement manifest, runner, and tests using existing OS patterns.
4. Inspect diff, run focused tests/checks, then review/verify against origin/stream/os.
5. Push and promote through task PR into the stream OS PR.

## current status

- Implemented and validated. Ready to push/promote.

## files changed

- packages/os/scripts/design/consuelo-design-landing-page.ts
- packages/os/scripts/os.ts
- packages/os/skills/consuelo-design-landing-page/skill.json
- packages/os/tests/consuelo-design-landing-page.test.ts
- packages/os/tooling/tool-manifest.json
- .task/os/add-consuelo-design-landing-page-skill/workpad.md
- .task/os/add-consuelo-design-landing-page-skill/verify.json
- .task/tasks/os/add-consuelo-design-landing-page-skill.json
- legacy root .task pointer deletions from task metadata transition

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-05-23 11:04:30 `checkFiles`: passed — OK
- 2026-05-23 11:07:02 `review.run`: passed — OK
- 2026-05-23 11:07:18 `checkFiles`: passed — OK
- 2026-05-23 11:08:11 `verify`: passed — OK

## key decisions

- Use stream/os as the base per Ko approval and the unshipped OS stream.
- Keep publishing/replacement blocked unless explicit approval plumbing exists.
- The skill uses packages/os/scripts/consuelo-design.ts generate website --dry-run --json to reuse the existing Consuelo Design/Open Design workflow without starting a live design UI during OS skill execution.
- The first slice produces draft work-order artifacts only; live publish remains future approval-gated work.

## notes for ko

- Planning found task 11 is specifically landing-page/campaign-brief drafts through Consuelo Design.

## improvements noticed

- git.diff did not show untracked files before publish; used task-local git status and git diff --stat to verify new files.

## issues and recovery

- 2026-05-23: code.run workpad write was blocked by the platform safety wrapper; recovered by reading and patching the generated workpad.
- 2026-05-23: direct fs.write failed because the task bootstrap already created the workpad; fs.patch then rejected multiline content without content-file, so recovered with scoped task.exec python write.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```
