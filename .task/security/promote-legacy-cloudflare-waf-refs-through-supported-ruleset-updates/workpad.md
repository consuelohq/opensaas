# promote legacy Cloudflare WAF refs through supported ruleset updates

branch: `task/security/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1459/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates
github pr: https://github.com/consuelohq/opensaas/pull/1459
started: 2026-07-13

## acceptance criteria

- [x] Use a whole-ruleset `PUT` when a managed rule needs canonical-ref promotion.
- [x] Preserve ruleset metadata, rule count, rule order, and every unrelated rule's writable definition and ID.
- [x] Recreate only legacy managed entries at their existing positions, without carrying their old IDs.
- [x] Apply expression changes in the same atomic ruleset version and preserve managed rule behavior.
- [x] Reread and compare the complete ordered writable ruleset projection.
- [x] Keep individual rule `PATCH` for canonical rules that only need expression changes.
- [ ] Add focused regression coverage and pass review, verification, release, and live migration.

## plan

1. Reproduce the ref-promotion failure as a focused test.
2. Parse the complete ruleset metadata and writable rule definitions.
3. Build one ordered ruleset update body, preserving IDs except for legacy managed entries.
4. Verify the complete reread, then run focused and repository gates.
5. Merge, release, and rerun the guarded production migration.

## current status

- Task started from repaired `main`. The live API failure and Cloudflare update schemas are understood; production source is unchanged.
- Focused red test reproduced the missing behavior: 10 existing cases passed and 3 new cases failed. Legacy identity promotion still issued individual `PATCH` calls instead of one ruleset `PUT`, and no complete ordered-projection verification existed.
- Implemented atomic whole-ruleset replacement for legacy identities, complete writable-rule projection, response-field filtering, and ordered post-write verification. Canonical expression-only changes retain the individual PATCH path.
- Focused migration suite passes all 13 tests.
- Focused plus adjacent Cloudflare provisioning suites pass all 34 tests. OS script syntax/type checks pass.
- Strict review passed with zero findings. Full verification passed and wrote a publish-valid stamp.

## discovery

- Run `29274013722` reached the migration with a valid token and exact legacy-rule identity, then Cloudflare rejected ref promotion through individual rule PATCH with code `20142`.
- Cloudflare exposes whole-ruleset PUT and includes an ordered `rules` array in the update body; the operation creates a new ruleset version.
- Request rule definitions accept optional `id` and `ref`. Response-only `last_updated`, `version`, and `categories` must not be copied into the request.
- The repo currently has no whole-ruleset update helper.

## test-first contract

- Behavior: legacy managed entries trigger one whole-ruleset PUT; unrelated rules retain order, IDs, and writable definitions; only legacy managed entries omit old IDs and receive canonical refs.
- Existing pattern: the focused migration suite uses an in-memory Cloudflare fetch fixture and exact request assertions.
- Coverage: empty/noncanonical ref adoption, metadata preservation, no individual PATCH during promotion, full reread drift rejection, and retained PATCH behavior for canonical expression-only updates.
- Red command: `bun --cwd packages/os vitest run tests/managed-os-mcp-origin-class-migration.test.ts`.
- Expected red result: current code emits individual PATCH calls and no whole-ruleset PUT.

## files changed

- `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`
- `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-13 18:31:47 `review.run`: passed — OK
- 2026-07-13 18:32:08 `verify`: passed — OK

## key decisions

- Reserve whole-ruleset PUT for identity promotion; keep the narrower PATCH path for canonical refs.
- Require complete ordered writable-projection verification after PUT.
- Omit old IDs only for managed entries being replaced under canonical refs.

## notes for ko

- No dashboard action is needed. Leave WAF rules and legacy DNS unchanged during this repair.

## improvements noticed

- none yet

## issues and recovery

- Individual rule PATCH cannot promote the live empty ref. Recovery is an atomic ruleset-version update.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`
- `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`

- 2026-07-13 18:25:45 apply-patch: `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`
- 2026-07-13 18:25:58 apply-patch: `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`
- 2026-07-13 18:26:25 apply-patch: `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`
- 2026-07-13 18:26:40 apply-patch: `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`
- 2026-07-13 18:27:31 apply-patch: `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`

- 2026-07-13 18:28:02 apply-patch: `.task/security/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates/workpad.md`
- 2026-07-13 18:28:37 apply-patch: `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`
- 2026-07-13 18:28:55 apply-patch: `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`
- 2026-07-13 18:29:07 apply-patch: `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`
- 2026-07-13 18:29:20 apply-patch: `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`

- 2026-07-13 18:30:04 apply-patch: `.task/security/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates/workpad.md`
- 2026-07-13 18:30:45 apply-patch: `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`

- 2026-07-13 18:31:06 apply-patch: `.task/security/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates/current.json`, `.task/security/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates/evidence-log.json`, `.task/security/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates/read-log.json`, `.task/security/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates/session.json`, `.task/security/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates/workpad.md`, `.task/tasks/security/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates.json`, `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`, `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

- 2026-07-13 18:32:17 apply-patch: `.task/security/promote-legacy-cloudflare-waf-refs-through-supported-ruleset-updates/workpad.md`