# Polish trace explorer summaries and scroll behavior

branch: `task/consuelo-design/polish-trace-explorer-summaries-and-scroll-behavior`
stream: `stream/consuelo-design`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1258/polish-trace-explorer-summaries-and-scroll-behavior
github pr: https://github.com/consuelohq/opensaas/pull/1258
started: 2026-06-28

## acceptance criteria

- [x] Locate the real source/generator before substantial changes.
- [x] If no tracked source exists, document the source gap and patch the live ignored archive with backup evidence.
- [x] Make desktop wheel routing mouse-aware for table, sidebar, branch peers, and detail panes.
- [x] Preserve mobile v11 scroll ownership: `.trxTableScroll` owns x/y scroll, Tool pins, Time scrolls away, chrome stays fixed.
- [x] Reduce render flashing by reconciling rows by stable trace/operation key and preserving scroll/selection.
- [x] Improve `code.call` and common tool summaries from existing trace payload fields.
- [x] Make batch parent rollups useful and render unavailable child duration/token telemetry as `—` instead of fake zeroes.
- [x] Apply deterministic branch color variables consistently across table/detail/sidebar surfaces.
- [x] Keep raw payload access in the detail pane.
- [x] Capture browser validation evidence.

## plan

1. Read steering, `CODING-STANDARDS.md`, and task attachment.
2. Start task session `tsk_487d7aac1d99` from `stream/consuelo-design`.
3. Search tracked source/generator paths and live archive references.
4. Patch ignored live archive runtime assets with versioned files and backups.
5. Validate desktop, mobile, batch rendering, and stable render behavior in browser.
6. Record evidence in this workpad and push tracked documentation.

## current status

State: Live Trace Explorer runtime is patched in ignored Open Design archive output. The tracked branch records this workpad/evidence because the runtime files are ignored by `.od`.

Delta:
- Added live archive asset `_astro/trace-table-overview-v21.js`.
- Added live archive asset `_astro/trace-gsap-scroll-v5.js`.
- Updated live archive `index.html` to reference v21/v5.
- Kept prior v20/v4 files intact.
- Created backup directory `_nonrender_backups/trace-polish-20260628005521`.

Evidence:
- Tracked source searches for `tbmLiveTraceModal`, `trace-table-overview`, `live-traces.json`, and `Trace Burn Intelligence` under `packages/consuelo-design` returned no matches.
- `git check-ignore -v` reports the live archive is ignored by `packages/consuelo-design/upstream/open-design/.gitignore:14:.od`.
- `node --check` passed for both new runtime assets.
- Browser validated v21/v5 are loaded by `https://sites.consuelohq.com/tracing`.

Risk:
- No tracked generator/source was found, so the runtime fix is a live ignored archive hotfix. A future tracked generator pass should port these changes into canonical source once that source exists.
- Some upstream tool traces still provide only `command failed` without stderr/data; the frontend now labels those as `failed · no stderr payload` when no better line exists.

Next move:
- Port this runtime behavior into tracked source/generator when one is created or recovered.

## files changed

- `.task/consuelo-design/polish-trace-explorer-summaries-and-scroll-behavior/workpad.md`
- `packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence/_astro/trace-gsap-scroll-v5.js`
- `packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence/_astro/trace-table-overview-v21.js`
- `packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence/index.html`

## workspace-owned: files changed

- `.task/consuelo-design/polish-trace-explorer-summaries-and-scroll-behavior/workpad.md`
- `packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence/_astro/trace-gsap-scroll-v5.js`
- `packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence/_astro/trace-table-overview-v21.js`
- `packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence/index.html`

## workspace-owned: activity log

- `CODING-STANDARDS.md` read fully.
- `explore` found trace-related operator scripts but no Trace Explorer page source/generator.
- `fs.search` under `packages/consuelo-design` found no tracked source matches for the live DOM IDs/artifact names.
- `mac.call` created backups and updated `index.html` references.
- `mac.list` and `mac.read` inspected the ignored live archive.
- `mac.write` wrote v21/v5 runtime assets.
- `task.start` created branch and PR 1258.
- `workspace.get_steering` succeeded before work.
- 2026-06-28 05:12:25 fs.write: `.task/consuelo-design/polish-trace-explorer-summaries-and-scroll-behavior/workpad.md`
- 2026-06-28 05:15:23 fs.write: `.task/consuelo-design/polish-trace-explorer-summaries-and-scroll-behavior/workpad.md`
- Browser validation ran through workspace browser tools.
- Requested `packages/workspace/senior-engineer.md` was missing; `fs.search` found no `senior-engineer` file under `packages`.

## workspace-owned: validation evidence

Syntax:

```bash
node --check packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence/_astro/trace-table-overview-v21.js
node --check packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence/_astro/trace-gsap-scroll-v5.js
```

Result: both passed.

Loaded asset check:

- Browser reported scripts:
  - `https://sites.consuelohq.com/trace-burn-intelligence/_astro/trace-table-overview-v21.js`
  - `https://sites.consuelohq.com/trace-burn-intelligence/_astro/trace-gsap-scroll-v5.js`
- `window.__traceOverviewStats.version === "v21"`
- `window.__traceGsapScroll.mode === "mouse-aware-nested-scroll-v5"` on desktop.

Desktop scroll evidence:

- Table wheel moved `.trxTableScroll.scrollTop` from `0` to `426`.
- Branch peers wheel moved `.lfThreadList.scrollTop` from `0` to `344` while table stayed `426`.
- Detail pane wheel moved `.lfTyped.scrollTop` from `0` to `295` while table stayed `426`.
- Horizontal wheel on `.lfSection.input` moved that card to `scrollLeft=275` while table `scrollLeft` stayed `0`.

Mobile regression evidence:

- iPhone preset viewport: `width=402`, `max-width:760px` matched.
- v5 reported `{ enabled: false, reason: "native-touch", mode: "native-scroll" }`.
- `.trxTableScroll`: `overflow-x:auto`, `overflow-y:auto`, `touch-action: pan-x pan-y`, `scrollTop=420`, `scrollLeft=260`.
- Header rect: `[-260, 38, 1620, 35]`.
- Tool rect: `[0, 38, 176, 34]`.
- Time rect: `[-226, 39, 112, 32]`.

Batch evidence:

- Parent row: `3 ops · 10.8K tok · 6.5s`.
- Children with missing telemetry now render `latency=—`, `tokens=—`.
- Children with telemetry still render values, for example `mac.exec` child `latency=1.62s`, `tokens=182`.

Stable render evidence:

- Simulated render pass with `container.innerHTML = container.innerHTML`.
- Selected key stayed unchanged.
- Selected row DOM node identity stayed unchanged.
- Table scroll stayed `top=360`, `left=180`.
- `window.__traceOverviewStats.lastError === ""`.

Screenshots:

- `/tmp/opensaas-screenshots/tracing-desktop-v21-batch-stable-2026-06-28T05-09-48.png`
- `/tmp/opensaas-screenshots/tracing-mobile-v21-scroll-owner-2026-06-28T05-10-51.png`

## key decisions

- Patched the live ignored archive because no tracked source/generator exists in this worktree.
- Used new versioned archive assets instead of overwriting the old v20/v4 assets.
- Kept raw payload detail sections intact.
- Treated zero duration/token values on nested batch children as unavailable telemetry when no positive child value exists.
- Disabled GSAP wheel smoothing at the mobile breakpoint as well as on coarse pointers, because the browser device wrapper can expose a narrow viewport without a coarse pointer signal.

## notes for ko

- The user-visible route `https://sites.consuelohq.com/tracing` is updated via ignored archive output.
- The canonical source/generator remains missing. The durable fix is to create or recover a tracked source path and port v21/v5 behavior there.
- Error rows with useful stderr/message data now surface meaningful lines like `unknown flag --repo`, syntax errors, merge conflicts, test failures, and missing modules.
- Error rows whose upstream payload omits stderr/data still cannot be made precise by frontend extraction alone.

## improvements noticed

- Several wrapper traces are still payload-poor upstream: `task.pr`, `task.push`, and some `github raw` failures can arrive with only `command failed` and no stderr/data body.
- `code.call` summaries improve substantially when `filesChanged`, `stderr`, and command target fields are populated in the trace payload.

## issues and recovery

- The requested `packages/workspace/senior-engineer.md` context file is absent in this task worktree. I searched for `senior-engineer` under `packages` and found no replacement file.
- A mobile validation pass initially appeared to show GSAP enabled because the shared browser viewport had been reset by a desktop screenshot. Reopening mobile sequentially confirmed the corrected native-touch mode.

---

## publish checklist

```bash
bun run task:push -- --message "fix(consuelo-design): record trace explorer live polish" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-28 05:12:25 write: `.task/consuelo-design/polish-trace-explorer-summaries-and-scroll-behavior/workpad.md`

## final validation addendum

- `review.run --no-tests` was attempted for the task branch and hit workspace transport HTTP 524 after about two minutes, so no review result was returned.
- Narrow tracked-diff verification passed:

```bash
git diff --check
python3 -m json.tool .task/consuelo-design/polish-trace-explorer-summaries-and-scroll-behavior/current.json
python3 -m json.tool .task/consuelo-design/polish-trace-explorer-summaries-and-scroll-behavior/session.json
python3 -m json.tool .task/consuelo-design/polish-trace-explorer-summaries-and-scroll-behavior/read-log.json
python3 -m json.tool .task/consuelo-design/polish-trace-explorer-summaries-and-scroll-behavior/evidence-log.json
python3 -m json.tool .task/tasks/consuelo-design/polish-trace-explorer-summaries-and-scroll-behavior.json
```

Result: `tracked task docs/json verification passed`.

- 2026-06-28 05:15:23 append: `.task/consuelo-design/polish-trace-explorer-summaries-and-scroll-behavior/workpad.md`
