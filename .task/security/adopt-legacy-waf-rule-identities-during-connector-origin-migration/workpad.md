# adopt legacy WAF rule identities during connector-origin migration

branch: `task/security/adopt-legacy-waf-rule-identities-during-connector-origin-migration`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1457/adopt-legacy-waf-rule-identities-during-connector-origin-migration
github pr: https://github.com/consuelohq/opensaas/pull/1457
started: 2026-07-13

## acceptance criteria

- [x] Adopt each legacy managed OS MCP WAF rule when its canonical `ref` is absent but exactly one rule has the canonical description and expected action.
- [x] Prefer canonical `ref` identity and fail closed when ref/description candidates are missing, duplicated, conflicting, or have the wrong action.
- [x] PATCH the adopted rule with the canonical `ref` and canonical connector-origin expression while preserving description, action parameters, enabled state, and unrelated expression logic.
- [x] Preserve idempotence for already-canonical live rules and verify canonical refs after writes.
- [x] Add focused regression coverage for legacy adoption and ambiguity/security failure paths.
- [ ] Pass focused tests, strict review, full verify, merge through `stream/security`, rerun the guarded production migration, and verify live WAF behavior.

## plan

1. Reproduce the production failure with fixtures whose live rules have legacy refs but canonical descriptions.
2. Add a fail-closed identity resolver that prefers canonical refs and otherwise adopts one exact description/action match.
3. PATCH adopted rules with canonical refs and verify the reread by canonical ref.
4. Run focused and adjacent tests, inspect the diff, run strict review and full verify, then publish through the security stream.
5. Dispatch the guarded production migration again and validate the signed-edge, OAuth, MCP, and ChatGPT acceptance path before removing legacy DNS.

## discovery

- Production run `29272234834` proved the dedicated token can read the custom ruleset, then failed before writes because no rule matched canonical ref `consuelo-os-mcp-provider-allow`.
- The normal provisioning reconciler already treats exact canonical description as the legacy identity fallback, but the one-time migration only accepts canonical refs.
- Canonical descriptions/actions are `Allow/skip trusted OS MCP provider traffic` / `skip` and `Block untrusted OS MCP traffic` / `block`.
- Scope is limited to the migration helper and its focused unit tests; the production workflow interface remains unchanged.

## test-first contract

- Behavior under test: legacy rules with noncanonical refs but exact canonical descriptions and expected actions are adopted, rewritten with canonical refs, and post-write verified; ambiguous or action-mismatched candidates fail before PATCH.
- Existing local pattern: `workspace-cloudflare-provisioning.ts` prefers canonical ref then exact description during managed-rule reconciliation.
- New or changed tests: legacy-ref adoption/preservation, conflicting ref-vs-description identity, duplicate description candidates, and wrong-action rejection.
- Focused red command: `bun --cwd packages/os vitest run tests/managed-os-mcp-origin-class-migration.test.ts`.
- Expected red failure: the current migration throws `expected exactly one Cloudflare rule with ref ...` for legacy refs and therefore never emits canonical refs in PATCH bodies.

## current status

- Task started from `main` after production run `29272234834` exposed the legacy-rule identity gap.
- Red test reproduced the production failure: 4 new regression cases failed while the 7 existing migration cases remained green. Legacy rules failed on exact-ref lookup; conflict and wrong-action cases were not detected before mutation planning.
- Implemented exact legacy adoption by canonical description plus expected action, canonical-ref promotion in PATCH bodies, identity-only migration, and strict canonical-ref verification after writes.
- Focused and adjacent suites pass: 12 migration tests plus 21 Cloudflare provisioning contract tests (33 total). OS script syntax checks pass.
- Strict review passed with zero findings. Full verification passed and wrote a publish-valid stamp.

## files changed

- `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`
- `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-13 18:03:01 `review.run`: passed — OK
- 2026-07-13 18:03:12 `verify`: passed — OK

## key decisions

- Reuse the provisioning system's exact-description legacy adoption pattern, but strengthen it for migration with expected-action checks and ambiguity detection.
- Never identify a rule by expression fragment alone; expression shape remains a second fail-closed validation after identity is established.
- A canonical ref match wins only when no different rule claims the canonical description; that split identity is treated as a conflict and fails before writes.
- A ref-only adoption counts as `migrated`, ensuring rules that already have the canonical expression still receive durable canonical identities.

## notes for ko

- Leave the Cloudflare rules unchanged while this task runs; the failed migration made no WAF write and the legacy DNS record remains intact.

## improvements noticed

- none yet

## issues and recovery

- The first production run with the dedicated WAF token failed safely because live rule refs predate the canonical refs. This task repairs that migration assumption rather than editing the rules manually.
- The first syntax-check command used invalid Bun argument ordering and printed help with exit 0. It was discarded and rerun correctly as `bun run --cwd packages/os typecheck`, which passed.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/workspace/senior-engineer.md`

- 2026-07-13 17:58:53 apply-patch: `.task/security/adopt-legacy-waf-rule-identities-during-connector-origin-migration/workpad.md`
- 2026-07-13 17:59:40 apply-patch: `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`

- 2026-07-13 18:00:31 apply-patch: `.task/security/adopt-legacy-waf-rule-identities-during-connector-origin-migration/workpad.md`
- 2026-07-13 18:00:54 apply-patch: `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`
- 2026-07-13 18:01:21 apply-patch: `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`

- 2026-07-13 18:02:37 apply-patch: `.task/security/adopt-legacy-waf-rule-identities-during-connector-origin-migration/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/adopt-legacy-waf-rule-identities-during-connector-origin-migration/current.json`, `.task/security/adopt-legacy-waf-rule-identities-during-connector-origin-migration/evidence-log.json`, `.task/security/adopt-legacy-waf-rule-identities-during-connector-origin-migration/read-log.json`, `.task/security/adopt-legacy-waf-rule-identities-during-connector-origin-migration/session.json`, `.task/security/adopt-legacy-waf-rule-identities-during-connector-origin-migration/workpad.md`, `.task/tasks/security/adopt-legacy-waf-rule-identities-during-connector-origin-migration.json`, `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`, `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

- 2026-07-13 18:03:22 apply-patch: `.task/security/adopt-legacy-waf-rule-identities-during-connector-origin-migration/workpad.md`