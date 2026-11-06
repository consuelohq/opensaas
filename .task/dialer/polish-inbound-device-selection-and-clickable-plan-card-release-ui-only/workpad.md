# Polish inbound device selection and clickable plan card; release UI only

branch: `task/dialer/polish-inbound-device-selection-and-clickable-plan-card-release-ui-only`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2776
started: 2026-11-06

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract — 2026-11-05 (DEV-1676 follow-up)
Behavior: inbound Web/Cell phone remains a single radio selection. The unselected device has transparent background, no border and quiet text; selected device has the brighter neutral-gray background, no border, and brighter text; hovering any enabled row shows a pointer, light background/text feedback, and selecting via label/text works. Disabled rows remain non-interactive and semantically disabled. Remove the 'An additional number slot is $X/month. Included slots follow your plan.' caption from Call from > Add a number. On Settings, make the entire YOUR PLAN/Starter/Manage plan background one semantic button targeting workspace-billing, without nested buttons. Only 'Manage plan' (and arrow) changes on hover; card background/title/label stays visually unchanged.
Existing local pattern: packages/lead-connector/src/embed/inbound-operator-view.ts renders label around exclusive radio; workspace-theme.css has both base :has(:checked) rules and late overrides; workspace-pages.ts renders .settings-plan section containing nested Manage plan button and optional number caption. internal-main.ts delegates [data-action] clicks. Tests: compact-workspace-polish.test.ts and commercial-ui.acceptance.test.ts.
New/changed tests: add focused regression checks for device row CSS interaction states and whole-plan button event structure; verify no embedded clickable children and correct nav target; verify additional number price caption absent from numbers Call from view. Test first (red), then implement.
Focused red: bun test packages/lead-connector/src/embed/compact-workspace-polish.test.ts packages/lead-connector/src/embed/commercial-ui.acceptance.test.ts
Expected red: inactive device still soft gray, selected transparent, plan is a section with nested button, redundant number slot caption still rendered.
Scope: only LeadConnector embedded UI/theme/tests. No browser visual QA (user explicitly wants to do that), no live calls, phone provision, billing changes, Railway service deployment, credentials, or other agents' task files. Build, package tests, typecheck, strict review, formal verify, and main-only release. Cloudflare UI-only deployment via existing verified Github workflow; verify exact public assets and Worker version, keep Marketplace assets untouched if identical.

- 2026-11-06 04:00:09 append: `.task/dialer/polish-inbound-device-selection-and-clickable-plan-card-release-ui-only/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-06 04:00:09 fs.write: `.task/dialer/polish-inbound-device-selection-and-clickable-plan-card-release-ui-only/workpad.md`
- 2026-11-06 04:00:21 apply-patch: `packages/lead-connector/src/embed/compact-workspace-polish.test.ts`
- 2026-11-06 04:00:32 apply-patch: `packages/lead-connector/src/embed/workspace-theme.css`
- 2026-11-06 04:01:02 apply-patch: `packages/lead-connector/src/embed/compact-workspace-polish.test.ts`
- 2026-11-06 04:01:14 apply-patch: `packages/lead-connector/src/embed/workspace-theme.css`
- 2026-11-06 04:01:44 fs.write: `.task/dialer/polish-inbound-device-selection-and-clickable-plan-card-release-ui-only/workpad.md`

## workspace-owned: validation evidence

- 2026-11-06 04:01:34 `review.run`: passed — OK
- 2026-11-06 04:01:56 `verify`: passed — OK

## Implementation and checks — 2026-11-05 ET
- Test-first red: three compact-workspace cases failed against original main source (inactive device gray / active transparent, plan was a section with nested Manage plan button, extra number-slot price caption). Another red regression caught invalid heading/div inside plan button.
- UI code changes only: packages/lead-connector/src/embed/workspace-theme.css, workspace-pages.ts, compact-workspace-polish.test.ts. Inactive Web / Cell phone transparent, selected var(--soft), borderless; pointer and hover feedback; disabled rows excluded.
- Settings plan is one semantic button type=button, data-action=workspace-billing, only span descendants. Hover keeps card appearance stable and brightens only Manage plan text/arrow; accessible focus-visible outline.
- Removed Call from > Add a number redundant 'An additional number slot is $X/month. Included slots follow your plan.' caption; catalog pricing/billing untouched.
- Focused 18 tests pass; complete LeadConnector 252 tests / 1957 expectations pass, no failures, typecheck and embed build pass, git diff --check clean. Strict review.run against origin/main reports 0 issues/blockers, 0 failed suites.
- User requests no visual QA and will inspect production personally. No browser/image generation, live calls, number purchases or billing changes.
- Next: verify, push, task PR #2776 main-only, exact-SHA CI, exact-head merge; require Railway skipped and UI Worker-only job. Verify build hashes/public health/artifact, record DEV-1676; unchanged Marketplace launcher assets need no re-publish.

- 2026-11-06 04:01:44 append: `.task/dialer/polish-inbound-device-selection-and-clickable-plan-card-release-ui-only/workpad.md`
