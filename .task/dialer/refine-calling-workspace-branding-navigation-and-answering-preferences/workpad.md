# Refine calling workspace branding, navigation and answering preferences

branch: `task/dialer/refine-calling-workspace-branding-navigation-and-answering-preferences`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2716
started: 2026-10-30

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

## Test-first contract

Behavior: answering preferences survive repeated loading/loaded snapshot redraws and navigation until the rep explicitly changes them; server health/assignment authority remains authoritative. Use the website’s actual Consuelo mark and typography, white/gray/black themes, a stable-height scrollable panel, active-only call status, and dedicated settings/history/phone/team/billing/Mercury pages. Plan footer says Starter/Professional/Agency/Enterprise and opens combined billing/minutes; Learn more goes to docs. Avoid raw provider/contact/user IDs and nested management disclosures. Preserve the small purchase-code disclosure. Checkout remains billing-agent-owned and opens its final external Stripe destination.

Existing patterns: workspace-dom.test.ts, calling-workspace tests, history/commercial view tests, trusted parent protocol, host lifecycle tests. New regressions first: two consecutive checkbox redraws (value='on' must not mutate baseline defaults and clear checks); preferences across temporary render states; dedicated page navigation and plan label; no raw IDs; stable sizing/theme bridge; actual build responsive/browser tests.

Expected red: generic input draft restore assigns checkbox.value and changes defaultValue, so the second refresh drops the checked state. Current shell has a fake C mark, blue palette, fixed open nested settings details, raw history/rep IDs and content-driven height changes.

Ownership: lead-connector embed UI/host/assets and narrow supporting APIs only when needed. No duplicate billing backend, no new subagents, no call/readiness activation/payment/number purchase. Billing owner chat01a1844e-7fab-7c22-95dc-d81c21a63daf notified about direct Stripe requirement. Preserve parallel edits; no shared force pushes or resets. Research browser endpoint configuration and existing Mercury script storage before changing either. Do not pretend missing APIs save uploaded scripts.

- 2026-10-30 23:26:43 append: `.task/dialer/refine-calling-workspace-branding-navigation-and-answering-preferences/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-30 23:26:43 fs.write: `.task/dialer/refine-calling-workspace-branding-navigation-and-answering-preferences/workpad.md`

## workspace-owned: validation evidence

- 2026-10-30 23:51:25 `review.run`: passed — OK
- 2026-10-30 23:52:36 `review.run`: passed — OK
- 2026-10-30 23:54:02 `verify`: passed — OK
- 2026-10-30 23:56:22 `verify`: passed — OK

## Implementation and focused evidence
- Linear DEV-1649, PR2716. Canonical website logo, matching licensed local fonts; monochrome themes; stable pages and compact host.
- Checkbox regression reproduced: restoring .value mutated defaultValue on checkbox; fixed and tested four consecutive redraws. UI endpoint choices survive navigation; active server state still owns actual readiness.
- Dedicated Team, Numbers, combined Plan/Billing, History/details, Appearance, Mercury library. No duplicated usage section or embedded subscription configuration.
- Script API: authenticated workspace identity only, 100KB plaintext/Markdown, optimistic revisions, own/admin edits, forward-only migration015.
- Isolated PostgreSQL script proof: persistence across service recreation, tenant/author isolation, concurrent update fencing, admin edits, no raw owner projection (14 assertions).
- Safe browser fixture: six views remain720px; repeated polling retains phone choice; script import/save/read; human CRM name in history; system/light/dark;375x812,568x320,667x375 no horizontal overflow; no JS errors or unhandled network/effects.
- Deployed billing runtime is separate and must be preserved. Backend/endpoint configuration is coordinated with that owner; no real call or readiness activation in this pass.

- Main promotion is held until the deployed billing source is integrated or the billing owner confirms a coordinated candidate: consuelo-production-release.yaml automatically redeploys the Dialer on matching main changes. Do not overwrite its separate current runtime with this main-based branch.
- Additional fixes found in browser work: SVG icon targets now resolve parent actions, file-picker values are never assigned during snapshots, and page scrolling survives refresh.
- Final focused totals:436 unit/contracts pass; isolated PostgreSQL upgrade+scripts2 pass,29 assertions; local lab rollback/replay/Redis cleanup passed.
