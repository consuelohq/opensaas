# broaden social persona beyond agents

branch: `task/workspace-agents/broaden-social-persona-beyond-agents`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1537/broaden-social-persona-beyond-agents
github pr: https://github.com/consuelohq/opensaas/pull/1537
started: 2026-07-20

## acceptance criteria

- [x] Reframe Ko's central public identity as a philosopher-CEO whose interests include history, power, politics through business, technology, human behavior, and first principles.
- [x] Keep agents and the future of work as one credible subject lane rather than the entire persona.
- [x] Define a varied profile mix across broad human ideas, history/politics, founder thinking, and Consuelo/product proof.
- [x] Explain how broad-reach posts, authority-building posts, and bottom-of-funnel business posts work together.
- [x] Preserve the existing voice, TikTok perception engine, distribution doctrine, and product-second principle.
- [x] Add guidance for evaluating solid profile-texture posts that are useful even when they are not definitive 10/10 worldview posts.
- [x] Validate Markdown structure, required new anchors, balanced fences, and the existing no-em-dash voice rule.

## plan

1. Inspect the existing persona source and prior social-persona context.
2. Add the broader identity, content portfolio, history/politics, and funnel doctrine near the top of `persona.md`.
3. Adjust agent-heavy examples and the closing summary so the document consistently reflects the broader identity.
4. Run lightweight Markdown and content-contract validation, inspect the diff, review, and verify.
5. Push the task to the existing review PR and promote it to `stream/workspace-agents`.

## discovery

- `persona.md` is the sole source of truth for Ko's reusable social strategy.
- Prior context confirms the file was intentionally created as a persona-first, product-second operating manual.
- Current wording correctly said Ko should not be reduced to an agent-workspace founder, but its examples and closing package still over-indexed on agents and the future of work.
- Semantic `explore` returned irrelevant code paths because the repository index does not meaningfully index this root Markdown file. Direct task-scoped reading established the source of truth.
- Ko's clarified direction: philosopher-CEO at the center; history, power, technology, business, human behavior, and first principles as recurring subjects; politics mainly when it intersects with business; Consuelo appears often enough to convert attention, without dominating the profile.

## Test-first contract

### Behavior under test

Future agents reading `persona.md` should understand the broader central identity, maintain profile variation, use history and politics with discipline, and connect broad attention to Consuelo through bottom-of-funnel proof.

### Existing pattern

The original persona task used lightweight Markdown validation for required anchors, balanced fences, and prohibited dash characters.

### Intended validation

- Assert the document contains the new identity, content portfolio, history/politics, funnel, and profile-texture sections.
- Assert agent language remains present as one lane while the final package names the broader worldview.
- Check balanced Markdown fences and absence of em/en dash characters.
- Run strict review and full verify.

### No-test waiver

This is doctrine-only Markdown with no executable behavior. Unit tests would add no meaningful protection. Static content-contract checks plus semantic diff review are the appropriate validation.

## current status

- Persona doctrine update is complete and focused validation passed.
- Strict no-test review reported 0 issues in the change.
- Full verify is blocked by unrelated existing API test failures and missing Twenty ESLint rule files in the current checkout.
- Ready to push when the repository gate accepts the documented docs-only waiver or Ko explicitly approves the gate override.

## files changed

- `.task/workspace-agents/broaden-social-persona-beyond-agents/workpad.md`
- `persona.md`

## workspace-owned: files changed

- `.task/workspace-agents/broaden-social-persona-beyond-agents/workpad.md`
- `persona.md`

## workspace-owned: activity log

- 2026-07-20 19:51:48 fs.write: `.task/workspace-agents/broaden-social-persona-beyond-agents/workpad.md`
- Applied two anchored patches to `persona.md`.
- Inspected the working-tree diff.
- Ran semantic exploration and rejected unrelated indexed code results.
- Read `persona.md` and the task workpad through task-scoped `fs.read`.
- Searched prior context for the original persona task and Grok analysis handoff.

## workspace-owned: validation evidence

- Content contract passed: all required new anchors present, Markdown fences balanced, no em/en dash characters, old agent-only closing removed; trace `trc_6424f8f9deb2`.
- Working-tree diff inspected: `persona.md` has 197 additions and 13 deletions, plus task metadata.
- Strict no-test review reported 0 issues in this change and 23 unrelated pre-existing lint/type findings; trace `trc_2a77a128065f`.
- Full verify identified only `persona.md` as the product change, then failed because the review gate ran unrelated API suites with 53 existing failures and could not load missing `packages/twenty-eslint-rules` files; trace `trc_800ba5468b5f`.

## key decisions

- "Philosopher king" is an internal direction, not a public title. The profile should earn that impression through repeated observations.
- The business posts should feel like consequences and proof of Ko's worldview.
- Variation is strategic: broad human posts create reach, history/politics create depth, founder posts establish judgment, and product posts convert interest.

## notes for ko

- The existing therapist post is a useful example of profile texture: broadly legible and human, while leaving room for sharper history, business, and product posts around it.
- A stronger edit should preserve the visual turn while replacing the generic closing with a line about how comparison copies directions that only made sense from someone else's starting point.

## improvements noticed

- The root-doctrine test selector appears to map `persona.md` into unrelated API suites. A docs-only validation path would reduce false blockers.

## issues and recovery

- `explore` produced irrelevant code results for a root Markdown doctrine file. Direct file reading and saved context supplied the required evidence.
- Full verify selected unrelated API tests for the root doctrine file and failed on pre-existing suites: `subscription.spec.ts`, `local-presence.spec.ts`, and `ghl.spec.ts`. The changed Markdown passed its focused contract.

---

## publish checklist

```bash
bun run task:push -- --message "docs(persona): broaden Ko's public identity" --changed
bun run task:pr
bun run task:finish
```
- 2026-07-20 19:51:48 write: `.task/workspace-agents/broaden-social-persona-beyond-agents/workpad.md`
