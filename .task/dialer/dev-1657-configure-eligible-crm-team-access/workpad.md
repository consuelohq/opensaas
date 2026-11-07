# DEV-1657 configure eligible CRM team access

branch: `task/dialer/dev-1657-configure-eligible-crm-team-access`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2785
started: 2026-11-07

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

## Test-first contract and accepted scope
Ko approved all larger-model prerequisites before Luna. Own actual eligible CRM member directory and authorized in-app purchased-seat assignment/revocation/routing membership, with clear named members/roles/status/capacity. Plan/quantity/purchases stay in signed Stripe flow; no real invites, paid changes, calls or keys. Do not create fictional teams. Other agents/shared stream exist; preserve their edits. Parent device PR2782 is in exact-head CI; start current main bb4c24a for read-only design, integrate merged device source before implementing shared embed/runtime files. Shared stream divergence is recorded in QA0/device workpads; scoped main-based releases only.
Behavior: only authenticated location admin can manage colleagues; directory is scoped to real authorized company/location install; stale/revoked/failed directory cannot grant arbitrary IDs; actual paid quantity and concurrent assignments enforce capacity; removed reps cannot start new work and active/unknown owners remain protected. Show honest unavailable/reauth states rather than fabricating invites or membership. Browser/HTTP/Postgres tests use synthetic identities and fake providers; production readback later is read-only.
Existing pattern: lead-connector application/provider+tokens, commercial application/updateTeam and signed native purchase SQL, inbound routing/capacity authority locks, embed settings pages. Red tests required before implementation, including permission/cross-tenant/capacity-race/revocation and readable UI. No-test waiver:none. Plan: audit actual provider API/scopes and current authorization/projections, choose atomic normalized contracts, red, implement SDK+server+UI, service-backed tests+fullgates, scoped release and Linear evidence, then frozen Luna lane handoff.

- 2026-11-07 00:07:15 append: `.task/dialer/dev-1657-configure-eligible-crm-team-access/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-07 00:07:15 fs.write: `.task/dialer/dev-1657-configure-eligible-crm-team-access/workpad.md`
- 2026-11-07 00:10:45 fs.write: `.task/dialer/dev-1657-configure-eligible-crm-team-access/workpad.md`

## Design research before implementation
Official current HighLevel Users API: https://marketplace.gohighlevel.com/docs/ghl/users/search-users/index.html GET/users/search Version:v3, users.readonly, companyId required plus locationId filter, skip/limit, users.roles.type/role/locationIds/restrictSubAccount and deleted. Deprecated GET/users/ must not be the new integration. SDK constants alreadyv3. Persistent install.workspaceId is company binding; do not assume locationId==workspaceId. Validate exact installationId/locationId on directory requests and derive companyId from that bound installation, never body. No provider email/phone copying needed: normalize id/name/role/eligibility only; filter location access, deleted and malformed roles; bounded complete pagination and fresh actor-admin validation. Missing scope/provider failure→truthful unavailable/reauthorize, not fabricated members or arbitrary-ID fallback.
Proposed atomic server boundary: new GETteam snapshot plus revision-fenced PATCHteam delegate on existing commercial route. Fresh normalized directory/digest outside DB transaction; compare submitted revision and directory digest before grant. Under workspace billing lock and purchase row lock, then inbound authority lock, validate signed paid capacity/currentplan, update seat access and chosen existing routing queues; register missing capacity asaway. Stripe remains sole plan/quantity owner. Revocation withdraws readiness but retains active/unknownowner for reconciliation; local inactiveaccess blocks new outbound/readiness without preventing own snapshot/end/wrap-up. No cross-system atomic CRM claim; make refresh/revocation timing explicit. CRM manages roles/invitations; UI assigns existing purchased access, names/roles/capacity, actual routing queues and CRMstaff setup guidance. Need inspect current native row locks/routing queue on-client contract before finalizing. DevicePR is not yet merged; no team source edits made.

- 2026-11-07 00:10:45 append: `.task/dialer/dev-1657-configure-eligible-crm-team-access/workpad.md`

Focused red: bun test packages/lead-connector/src/application.contract.test.ts --test-name-pattern "bound CRM staff directory". Expected missing directory contract, then normalized scope/privacy/pagination assertions.

## Implementation and first enabled run
SDK scoped directory red missing-export then three privacy/scope/pagination tests green. Added real PostgreSQL team service and six service-backed cases. First required lane failed8 (7 historical forward-only fixture markers/counts, 1 missing command-settlement evidence in the new unknown-owner test). Retained first failure at /var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/consuelo-qa-db-failure-i5Qt1e/database-suites.log. Corrected fixtures only, and made reconciliation test prove rejection before known command settlement. Next required lane95/95 zero skips; larger smoke including1/2/5/20 distinct HTTP actors clean. Live read-only provider check revealed location-filtered search omits unrestricted agency admin and empty results omitcount. Added company-credential scoped search + explicit location/unrestricted-role filtering; live normalized result1admin/1eligible, no contacts/PII exposed. No migration applied live, calls, readiness, paid changes or invitations. Team UI/controller now wired; final tests/review pending.

## workspace-owned: validation evidence

- 2026-11-07 00:53:35 `review.run`: passed — OK
- 2026-11-07 00:56:31 `review.run`: passed — OK
- 2026-11-07 00:59:57 `review.run`: passed — OK
- 2026-11-07 01:01:41 `review.run`: passed — OK
- 2026-11-07 01:02:52 `verify`: passed — OK
