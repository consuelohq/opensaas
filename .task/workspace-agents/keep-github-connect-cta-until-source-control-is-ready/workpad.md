# keep GitHub connect CTA until source control is ready

branch: `task/workspace-agents/keep-github-connect-cta-until-source-control-is-ready`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/2292
started: 2026-08-29

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: a source-control snapshot that has repository records but no ready GitHub connection must keep the primary CTA as `Connect GitHub` and must not claim `GitHub connected`; `Manage GitHub access` is shown only when at least one repository is actually ready.
existing local pattern: `renderSourceControl(snapshot)` derives the source-control summary and primary GitHub CTA from the private snapshot; repository rows already expose `ready` separately from repository existence.
new or changed tests: extend `packages/os/tests/settings-site.test.ts` with a rendered-script contract that derives connected/manage state from repository readiness rather than repository count.
focused red command: `bun test packages/os/tests/settings-site.test.ts`
expected red failure: current client script uses `currentSourceControl.repositories.length` for both the connected summary and Manage GitHub access CTA, so a legacy unready repo is mislabeled as connected/manageable.
no-test waiver: not applicable.

## live evidence

Production smoke on 0.1.91 showed one legacy repository row (`consuelohq/opensaas`) with `NOT CONFIGURED` / `Reconnect GitHub` while the same section rendered `GitHub connected · 1 repository selected` and `Manage GitHub access`. Normal Connect endpoint itself reached the correct GitHub OAuth PKCE URL; GitHub then blocked authorization with its own billing-payment error.

- 2026-08-29 06:40:52 append: `.task/workspace-agents/keep-github-connect-cta-until-source-control-is-ready/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 06:40:52 fs.write: `.task/workspace-agents/keep-github-connect-cta-until-source-control-is-ready/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/tests/settings-site.test.ts`

- 2026-08-29 06:41:24 apply-patch: `packages/os/scripts/lib/settings-site.ts`

## workspace-owned: validation evidence

- 2026-08-29 06:41:59 `review.run`: passed — OK
- 2026-08-29 06:42:37 `verify`: passed — OK
