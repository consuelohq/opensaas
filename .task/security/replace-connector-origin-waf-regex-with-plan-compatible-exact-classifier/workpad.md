# replace connector origin WAF regex with plan compatible exact classifier

branch: `task/security/replace-connector-origin-waf-regex-with-plan-compatible-exact-classifier`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1463/replace-connector-origin-waf-regex-with-plan-compatible-exact-classifier
github pr: https://github.com/consuelohq/opensaas/pull/1463
started: 2026-07-13

## acceptance criteria

- [x] Generate a Cloudflare custom-rule expression for the canonical `c-<32 lowercase hex>.<baseDomain>` hostname class without `matches` or any regex-only function/operator.
- [x] Preserve the exact lowercase hexadecimal digest constraint, exact total hostname length, prefix, and base-domain suffix within Cloudflare's 4,096-character rule-expression limit.
- [x] Use one shared classifier helper in both normal WAF provisioning and the one-time managed-rule migration.
- [x] Retain local TypeScript regex recognition for runtime validation; only the Cloudflare Rules expression changes.
- [x] Add focused tests for the compact exact classifier and reject arbitrary 32-character labels, uppercase/non-hex digest characters, wrong lengths, wrong prefixes, nested labels, and wrong domains.
- [x] Migrate either retired nested-origin fragments or the previously generated regex fragment to the new plan-compatible fragment.
- [ ] Update Cloudflare provisioning and migration contract fixtures, pass focused/adjacent tests, strict review, full verify, release, and guarded live migration.

## plan

1. Add red expectations for a plan-compatible exact Rules expression and absence of `matches`.
2. Add a shared expression builder using `starts_with`, `ends_with`, `len`, `substring`, and `remove_bytes` against the lowercase hexadecimal byte set.
3. Replace provisioning and migration regex fragments with the shared expression.
4. Run focused hostname, provisioning, and migration tests plus OS type checks.
5. Run strict review/full verify, publish through `stream/security`, release, and rerun the guarded WAF migration.

## discovery

- Production run `29275473655` reached the atomic ruleset update but Cloudflare rejected `matches` at two rule expressions because the zone lacks the Business/WAF Advanced entitlement.
- Cloudflare's Rules language documents `starts_with`, `ends_with`, `len`, `substring`, logical `and`, and string inline-set membership; `matches` is the restricted operator.
- Current shared hostname module already owns the canonical digest length and local regex validation. Provisioning and migration each build their own regex-based WAF fragment from that module.
- Cloudflare limits a complete rule expression to 4,096 characters, so 32 separate inline-set checks are too costly inside the existing managed rules. The compact exact predicate removes all lowercase hexadecimal bytes from the fixed 32-byte digest substring and requires the remainder length to be zero.
- The WAF class is routing policy; signed connector HMAC remains the authorization boundary.

## test-first contract

- Behavior: generated Cloudflare expression classifies exactly the same lowercase canonical hostname language as `^c-[0-9a-f]{32}\\.<baseDomain>$` without using regex operators.
- Existing pattern: `connector-origin-hostname.test.ts` owns canonical class behavior; provisioning and migration tests assert exact managed-rule fragments.
- Changed tests: shared expression output and adversarial class cases; provisioning contains the shared expression and no `matches`; migration accepts both retired nested-origin and regex fragments, emits the plan-compatible fragment, and remains idempotent.
- Focused red command: `bun --cwd packages/os vitest run tests/connector-origin-hostname.test.ts tests/cloudflare-provisioning-contract.test.ts tests/managed-os-mcp-origin-class-migration.test.ts`.
- Expected red result: new helper/imports do not exist and existing fixtures still expect `http.host matches`.

## current status

- Task started from current `main`. Production failure, official Rules-language capabilities, and all regex call sites are identified. No production source edit has been made.
- Implemented one shared plan-compatible classifier using exact prefix, suffix, length, and lowercase-hex byte elimination. Provisioning and migration now consume the same helper; local runtime validation retains the JavaScript regex.
- Migration recognizes both the retired nested-origin fragment and the previously generated regex fragment, then emits only the plan-compatible expression.
- Focused hostname, provisioning, and migration suites pass all 52 tests. OS syntax/type checks pass.
- Generated expression evidence: classifier 173 characters, allow rule 853, block rule 864; both are below Cloudflare's 4,096-character ceiling and contain no regex operator.
- Strict review passed with zero findings. Full verification passed and wrote a publish-valid stamp.

## files changed

- `packages/os/scripts/lib/connector-origin-hostname.ts`
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`
- `packages/os/tests/connector-origin-hostname.test.ts`
- `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-13 18:52:46 `review.run`: passed — OK
- 2026-07-13 18:53:36 `verify`: passed — OK

## key decisions

- Do not weaken the class to prefix/suffix/length alone; enforce every digest byte as lowercase hexadecimal using `remove_bytes` over the fixed digest substring.
- Keep the local JavaScript regex helper because it is not subject to Cloudflare plan entitlements and remains the clearest runtime validator.
- Generate the Cloudflare expression centrally so provisioning and migration cannot drift.

## notes for ko

- No dashboard action or plan upgrade is needed. Leave the current WAF rules and legacy DNS unchanged while this plan-compatible repair is released.

## improvements noticed

- none yet

## issues and recovery

- The whole-ruleset update path is valid, but the submitted regex operator is not entitled on the current zone plan. This task replaces only that expression primitive.
- The first post-implementation diagnostic used a relative dynamic import from the code-runner temp directory and failed module resolution. It was rerun with absolute file URLs and returned the expected production expression lengths.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/connector-origin-hostname.ts`
- `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`
- `packages/os/tests/cloudflare-provisioning-contract.test.ts`
- `packages/os/tests/connector-origin-hostname.test.ts`
- `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`

- 2026-07-13 18:49:56 apply-patch: `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`
- 2026-07-13 18:51:06 apply-patch: `packages/os/tests/cloudflare-provisioning-contract.test.ts`

- 2026-07-13 18:52:12 apply-patch: `.task/security/replace-connector-origin-waf-regex-with-plan-compatible-exact-classifier/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/replace-connector-origin-waf-regex-with-plan-compatible-exact-classifier/current.json`, `.task/security/replace-connector-origin-waf-regex-with-plan-compatible-exact-classifier/evidence-log.json`, `.task/security/replace-connector-origin-waf-regex-with-plan-compatible-exact-classifier/read-log.json`, `.task/security/replace-connector-origin-waf-regex-with-plan-compatible-exact-classifier/session.json`, `.task/security/replace-connector-origin-waf-regex-with-plan-compatible-exact-classifier/workpad.md`, `.task/tasks/security/replace-connector-origin-waf-regex-with-plan-compatible-exact-classifier.json`, `packages/os/scripts/lib/connector-origin-hostname.ts`, `packages/os/scripts/lib/managed-os-mcp-origin-class-migration.ts`, `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`, `packages/os/tests/cloudflare-provisioning-contract.test.ts`, `packages/os/tests/connector-origin-hostname.test.ts`, `packages/os/tests/managed-os-mcp-origin-class-migration.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

- 2026-07-13 18:53:54 apply-patch: `.task/security/replace-connector-origin-waf-regex-with-plan-compatible-exact-classifier/workpad.md`