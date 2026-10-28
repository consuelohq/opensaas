# improve tracing cost light mode and session palette

branch: `task/os/improve-tracing-cost-light-mode-and-session-palette`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2203/improve-tracing-cost-light-mode-and-session-palette
github pr: https://github.com/consuelohq/opensaas/pull/2203
started: 2026-08-26

## acceptance criteria

- [x] Remove the redundant Status column/cell from the main tracing table while preserving status/error semantics, status filtering, and error coloring.
- [x] Replace hard-coded `$0.0000` history cost with a non-zero token-based estimate whenever a trace has measurable token usage; retain `—` only when there is no token/cost basis.
- [x] Prefer an explicit model found in safe structured trace payload metadata, then tool/provider defaults, then a documented Sol-equivalent fallback. Unknown model metadata must not collapse cost to zero.
- [x] Keep pricing explicitly approximate for ChatGPT-web traces and model-aware when local Codex/Claude/OpenCode traces expose model metadata; do not claim provider-billed cost unless it is actually recorded.
- [x] Preserve the current dark tracing visual hierarchy and add system-driven light mode using the existing Consuelo launcher paper/ink/muted palette.
- [x] Expand deterministic Session coloring from 5 tones to at least 12 stable presets, with light-mode-adjusted tones that remain legible and preserve session identity/hierarchy.
- [x] Rebuild the shipped tracing runtime, pass focused tracing/redaction/runtime tests, inspect the final diff, then pass strict review and full verify.

## plan

1. Reuse the existing trace-cost analytics model-resolution/pricing semantics and the launcher light/dark palette instead of inventing a parallel visual or pricing system.
2. Add focused regression tests first for cost estimation/fallback, model detection, Status-column removal, system light-mode CSS, and the expanded deterministic session palette.
3. Run the focused tests RED before production edits.
4. Implement cost estimation at the server-side history projection boundary and table/theme/session-color changes in the OS-owned inspector source.
5. Rebuild the canonical tracing runtime and run focused + security/redaction/runtime regression suites GREEN.
6. Verify rendered tracing in dark and light system modes, inspect the diff, run strict review/full verify, then publish to the normal OS stream review surface.

## current status

- Implementation and verification are complete. Status is no longer a visible column; status/filter/error semantics remain available. Cost now uses recorded tokens and safe model/provider metadata, with a Sol-equivalent estimate instead of a misleading zero. Historical rows with stale `$0.0000` can be re-estimated client-side. Tracing follows the system light/dark preference with the launcher palette and keeps Tool/Session/Cost visually stronger than secondary columns. Session identity now hashes deterministically across 15 paired dark/light tones. The generated tracing runtime is rebuilt and the task is ready to publish to the normal OS stream review surface.

## files changed

- `packages/os/scripts/lib/trace-cost-estimator.ts` — token/model/provider-aware estimated-cost helper with explicit Sol-equivalent fallback semantics.
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts` — computes redacted history cost metadata instead of hard-coding zero.
- `packages/os/scripts/lib/trace-site-inspector/session-colors.ts` — 15 deterministic dark/light session tone pairs.
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts` — removes visible Status cells, preserves hidden status semantics, applies paired session tones, and re-estimates stale historical costs.
- `packages/os/scripts/lib/observability-traces-site.ts` — 11-column table layout plus system light/dark tracing theme built from launcher colors.
- `packages/os/assets/vendor/observability-traces-v38/inspector.js` — rebuilt canonical browser runtime.
- `packages/os/tests/trace-history-redaction.test.ts`, `trace-site-inspector-interactions.test.ts`, `observability-traces-site.test.ts` — focused regressions.
- `packages/workspace/test-selection.rules.json`, `test-selection.registry.json`, and `tests/test-selection.test.js` — map the new estimator into the existing exclusive Trace inspector test contract instead of falling through to the unrelated broad OS package suite.
- `packages/documentation/src/content/docs/observe/traces.mdx` — documents cost as an estimate and the fallback behavior.
- task-scoped `.task/os/improve-tracing-cost-light-mode-and-session-palette/**` metadata.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-26 05:38:31 `review.run`: passed — OK
- 2026-08-26 05:39:09 `review.run`: passed — OK
- 2026-08-26 05:43:10 `verify`: failed — COMMAND_FAILED
- 2026-08-26 05:49:05 `verify`: passed — OK
- 2026-08-26 05:49:34 `review.run`: passed — OK

## key decisions

- Keep status data/filtering; remove only its redundant visible table column.
- Treat displayed cost as an estimate unless an actual persisted cost ever becomes available. Use recorded token counts first and the existing ~4 chars/token historical fallback only when token columns are absent.
- Model resolution order: structured trace model metadata -> model-like value in already-sanitized payloads -> tool/provider default -> Sol-equivalent fallback. This adds no new secret-bearing payload surface.
- Use Consuelo's existing light launcher palette (`#f4efe7` paper-family, `#29251f` ink, `#756d63` muted) and preserve the current dark palette under `prefers-color-scheme: dark`.
- Session colors remain deterministic by session string/hash; expanding the preset ring changes variety, not randomness.

## notes for ko

- Pricing is moderately advanced rather than a single flat multiplier. It trusts recorded input/output tokens, preserves an exact recorded total when only total tokens exist, detects `model`/`provider` from safe structured metadata and sanitized text, understands the existing Codex aliases, and records which pricing source/rate model was used. ChatGPT Web and any unknown model currently use the Sol-equivalent baseline; Claude/OpenCode model identity can be detected now, but provider-specific rates are intentionally not invented until a rate is registered.
- Cost is explicitly an observability estimate, not a provider-billing claim. A trace with no usable token/payload basis shows `—`, never a fake zero.
- The first five dark session tones are unchanged; ten additional tones increase concurrent-worker separation. Each session hashes to a stable tone, so scrolling/reloading does not randomly recolor a worker.
- Browser visual proof is currently blocked because another active agent owns the shared Chrome profile SingletonLock. I did not close that browser and risk disrupting the other task. Generated HTML/CSS/runtime contracts cover both system modes, and the preview fixture was generated successfully for a later visual pass.

## improvements noticed

- none yet

## issues and recovery

- Canonical `session.start({kind: "task"})` again rejected the outer facade timeout as an unexpected constructor field (`trc_39fbc86328fe`); the documented `task.start` compatibility alias created task session `tsk_4d48dbe21130` successfully.
- One batched source search referenced a nonexistent test filename and stopped that batch (`trc_1e1ce845bb3e`); recovered by searching the test directory for `sanitizeTraceHistoryRowForTest`, which resolved the owning tests without mutation.
- A follow-up `fs.list` pattern used a glob-shaped value where the tool expected regex and failed (`trc_53373f65c69d`); recovered with semantic/exact `fs.search` instead.
- Initial workpad patch used the wrong facade field name (`patch` instead of `patchText`) and was rejected before mutation (`trc_4c36d8fb2429`); retried with the typed schema field.
- A combined implementation patch missed a moved hunk in `virtual-list-browser.ts` (`trc_83d2ae759821`); split source patches applied cleanly afterward.
- The first static preview generator imported the tracing module relative to `/tmp` and failed (`trc_359dbc4d16fd`); retry used the task worktree's absolute file URL and produced `/tmp/consuelo-trace-theme-preview.html` with 15 sample sessions and no Status header (`trc_3e86e7bcbe92`).
- Visual browser attempts were blocked by the shared profile SingletonLock (`trc_61844fc4e495`, `trc_a57c25fda374`). Per browser concurrency safety, the other agent's browser was left untouched.
- Two initial outer `verify` calls surfaced an OS facade `ExceptionGroup`. A bounded diagnostic verify then showed the new estimator was not yet included in the existing exclusive `trace-site-pagination` selector, so selection fell through to the broad OS package suite (`trc_ad362b5b780e`).
- The broad package failure was proven pre-existing: an isolated exact `origin/main` archive reproduced `405 pass / 309 fail` in `facade.test.ts` (`trc_cefd374baa77`). One task diagnostic had caused Vitest to write snapshot updates; those were immediately restored and confirmed clean (`trc_881c0852bad4`).
- Added the estimator to the existing Trace selector with a RED selector regression (`trc_aaabcdc22f37`, then `trc_b86f211f7a24` while the generated registry was stale), regenerated the registry with exactly one corresponding source-path addition, then passed the targeted selector test (`trc_e40718515ebd`) and all 46 selector tests (`trc_f5bd027ccbb5`). Final outer verify passed publish-valid (`trc_143ee5e8594c`).

## validation evidence

- Focused TDD RED: trace history still returned `$0.0000`, Status/header/theme assertions failed, and the session palette module did not exist (`trc_df5e97f3f13e`).
- Focused tracing GREEN after implementation: 27 tests, 0 failures, 218 assertions (`trc_6c68e8f0d9a2`).
- Expanded tracing/security/runtime GREEN: 61 tests, 0 failures, 335 assertions across inspector interactions/ownership, observability site, history redaction, gateway live endpoints, and runtime-bundle assets (`trc_97eb9b4b5d2a`).
- Cost allocation/model-text regression went RED when estimated splits exceeded a recorded total (`trc_28f01f256496`), then GREEN after exact-total allocation and sanitized plaintext model/provider detection (`trc_b7841d77436`).
- Canonical tracing browser runtime rebuilt successfully after the final estimator changes (`trc_213ddeb20d58`).
- Full workspace test-selection suite: 46/46 passing (`trc_f5bd027ccbb5`).
- Final strict review: 0 issues, 0 blockers, 0 documentation opportunities (`trc_1a38e6533395`).
- Full verify: `passed: true`, `publishValid: true`, DB gate clean (`trc_143ee5e8594c`).

## Test-first contract

behavior under test: the tracing table omits the visible Status column, reports a non-zero estimated cost for traces with token usage, uses safe model-aware pricing with a Sol-equivalent fallback, follows the user's system light/dark mode while preserving information hierarchy, and maps sessions through a stable >=12-color preset palette.
existing local pattern: `trace-site-inspector-interactions.test.ts` owns formatter/model behavior; `observability-traces-site.test.ts` owns generated HTML/CSS/runtime contracts; `trace-history-redaction.test.ts` owns the sanitized server-side history boundary.
new or changed tests: add cost/model estimation assertions at the history boundary, table/header/grid and light-theme contracts in the observability site test, and deterministic expanded session-palette assertions against the OS-owned virtual-list source/helper.
focused red command: `bun test packages/os/tests/trace-history-redaction.test.ts packages/os/tests/trace-site-inspector-interactions.test.ts packages/os/tests/observability-traces-site.test.ts`
expected red failure: history still returns `$0.0000`, generated header/grid still contains Status, no tracing light-mode token override exists, and the session palette contains only five colors.
no-test waiver: not applicable.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `areas/consuelo-design/AGENTS.md`
- `packages/consuelo-design/design-system/manifest.json`
- `packages/consuelo-website/DESIGN.md`
- `packages/consuelo-website/src/styles/tokens.css`
- `packages/documentation/src/content/docs/observe/traces.mdx`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/trace-cost-estimator.ts`
- `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- `packages/os/scripts/lib/trace-site-inspector/model.ts`
- `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/trace-history-redaction.test.ts`
- `packages/os/tests/trace-site-inspector-interactions.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`
- `scripts/operator/trace-costs.ts`
- `scripts/operator/trace-pricing-registry.json`

- 2026-08-26 05:50:06 apply-patch: `.task/os/improve-tracing-cost-light-mode-and-session-palette/workpad.md`