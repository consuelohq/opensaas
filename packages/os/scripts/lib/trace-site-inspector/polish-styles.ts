export const TRACE_POLISH_STYLE = `<style id="consuelo-trace-polish">

/* The neutral surfaces deliberately follow ChatGPT's quiet charcoal/gray
   hierarchy. Existing sage, ochre, rust and session hues retain meaning. */
:root {
  --trace-bg:#fafafa;
  --trace-panel:#f1f1f1;
  --trace-panel-2:#fafafa;
  --trace-cream:#202020;
  --trace-row-text:#343434;
  --trace-muted:#717171;
  --trace-line:rgba(32,32,32,.09);
  --trace-line-strong:rgba(32,32,32,.15);
  --trace-hover:transparent;
  --trace-selected:transparent;
  --trace-inspector-bg:#f0f0f0;
  --trace-input-surface:#ececec;
  --ti-bg:#f0f0f0;
  --ti-panel:#f0f0f0;
  --ti-panel-raised:#eaeaea;
  --ti-line:rgba(32,32,32,.09);
  --ti-line-strong:rgba(32,32,32,.13);
  --ti-text:#222222;
  --ti-muted:#686868;
  --ti-faint:#888888;
}
@media (prefers-color-scheme:dark) {
  :root {
    --trace-bg:#212121;
    --trace-panel:#2b2b2b;
    --trace-panel-2:#212121;
    --trace-cream:#f5f5f5;
    --trace-row-text:#d6d6d6;
    --trace-muted:#acacac;
    --trace-line:rgba(255,255,255,.075);
    --trace-line-strong:rgba(255,255,255,.13);
    --trace-hover:transparent;
    --trace-selected:transparent;
    --trace-inspector-bg:#2b2b2b;
    --trace-input-surface:#353535;
    --ti-bg:#2b2b2b;
    --ti-panel:#2b2b2b;
    --ti-panel-raised:#303030;
    --ti-line:rgba(255,255,255,.09);
    --ti-line-strong:rgba(255,255,255,.14);
    --ti-text:#f1f1f1;
    --ti-muted:#b2b2b2;
    --ti-faint:#909090;
  }
}
html, body {background:var(--trace-bg)!important;color:var(--trace-cream)!important}
#tbmLiveTraceModal .trxShell,
#tbmLiveTraceModal .trxBody,
#tbmLiveTraceModal .trxTablePane {
  background:var(--trace-bg)!important;
  color:var(--trace-row-text)!important;
}
#tbmLiveTraceModal .trxChrome,
#tbmLiveTraceModal .trxToolbar,
#tbmLiveTraceModal .trxFooter,
#tbmLiveTraceModal .trxHead {
  background:var(--trace-bg)!important;
  border-color:transparent!important;
  color:var(--trace-muted)!important;
  box-shadow:none!important;
}
#tbmLiveTraceModal .trxChrome {border-bottom:0!important}
#tbmLiveTraceModal .trxFooter {border-top:0!important}
#tbmLiveTraceModal .trxHead {border-bottom:0!important}
#tbmLiveTraceModal .trxRow,
#tbmLiveTraceModal .trxRow:hover,
#tbmLiveTraceModal .trxRow.selected {
  background:transparent!important;
  box-shadow:none!important;
  border-color:transparent!important;
}
#tbmLiveTraceModal .trxToolName {color:var(--trace-cream)!important}
#tbmLiveTraceModal .trxJson,
#tbmLiveTraceModal .trxLatency,
#tbmLiveTraceModal .trxTokens {color:var(--trace-muted)!important}
#tbmLiveTraceModal .trxRow [data-trace-tooltip],
#tbmLiveTraceModal .trxInputCell,
#tbmLiveTraceModal .trxOutputCell {cursor:pointer!important}
#tbmLiveTraceModal .trxHead>div:nth-child(2) {font-size:inherit!important}
/* The old mobile stylesheet creates a second Time via ::before. */
#tbmLiveTraceModal .trxHead>div:nth-child(2)::before {content:none!important;display:none!important}
#tbmLiveTraceModal .trxHoverCard {
  max-width:min(380px,calc(100vw - 24px));
  padding:10px 12px;
  border:0!important;
  border-radius:9px;
  background:var(--trace-inspector-bg)!important;
  color:var(--ti-text)!important;
  box-shadow:0 8px 28px #0003;
  white-space:normal!important;
  overflow-wrap:anywhere;
}
/* Stable Session identity remains visible; clicking its text filters. */
#tbmLiveTraceModal .trxRow [data-trace-session-filter] {
  cursor:pointer;
  text-underline-offset:3px;
}
#tbmLiveTraceModal .trxRow [data-trace-session-filter]:is(:hover,:focus-visible) {
  text-decoration:underline;
  text-decoration-color:color-mix(in srgb,var(--branch-color-light,var(--ti-text)) 42%,transparent);
}
/* Keep the main reading window through Output visible before horizontal scroll.
   The virtualized content must expand with the header on wide monitors. */
#tbmLiveTraceModal .trxShell .trxTablePane {
  min-width:0!important;
  max-width:100%!important;
}
#tbmLiveTraceModal .trxShell .trxTableScroll {
  width:100%!important;
  min-width:0!important;
  max-width:100%!important;
  overflow-x:auto!important;
  overflow-y:auto!important;
  overscroll-behavior:contain;
  scrollbar-width:thin;
  scrollbar-color:color-mix(in srgb,var(--trace-muted) 25%,transparent) transparent;
}
#tbmLiveTraceModal .trxShell .trxTable,
#tbmLiveTraceModal .trxShell.closed .trxTable {
  box-sizing:border-box!important;
  width:max(100%,1924px)!important;
  min-width:1924px!important;
  max-width:none!important;
  padding-right:0!important;
}
#tbmLiveTraceModal .trxShell .trxHead,
#tbmLiveTraceModal .trxShell .trxRow,
#tbmLiveTraceModal .trxShell .trxSkeletonRow,
#tbmLiveTraceModal .trxShell.closed .trxHead,
#tbmLiveTraceModal .trxShell.closed .trxRow {
  display:grid!important;
  box-sizing:border-box!important;
  width:100%!important;
  min-width:1924px!important;
  max-width:none!important;
  grid-template-columns:24px 94px 156px 80px 92px minmax(455px,1.6fr) minmax(290px,.95fr) minmax(285px,.95fr) 136px 140px 78px 94px!important;
}
#tbmLiveTraceModal .trxShell .trxSkeletonRows,
#tbmLiveTraceModal .trxShell [data-trace-virtual-content] {
  box-sizing:border-box!important;
  width:100%!important;
  min-width:1924px!important;
  max-width:none!important;
}
#tbmLiveTraceModal .trxShell .trxRow {padding-inline:0!important}
#tbmLiveTraceModal .trxShell .trxRow > div,
#tbmLiveTraceModal .trxShell .trxHead > div {
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
#tbmLiveTraceModal .trxShell .trxTokens,
#tbmLiveTraceModal .trxShell .trxLatency,
#tbmLiveTraceModal .trxShell .trxCost {
  font-variant-numeric:tabular-nums;
}
/* Only text changes on hover. Approximately 25% less lift than previous. */
#tbmLiveTraceModal .trxShell .trxRow:is(:hover,.selected) > div,
#tbmLiveTraceModal .tiInspector .tiPeer:is(:hover,.active) .tiPeerMain b {
  transform:translateY(-.5px) scale(1.018)!important;
  transform-origin:left center;
  filter:brightness(1.225)!important;
}
html.trace-keyboard-navigation #tbmLiveTraceModal .trxShell .trxRow:hover:not(.selected) > div {
  transform:none!important;
  filter:none!important;
}
@media(prefers-color-scheme:light) {
  #tbmLiveTraceModal .trxShell .trxRow:is(:hover,.selected) > div,
  #tbmLiveTraceModal .tiInspector .tiPeer:is(:hover,.active) .tiPeerMain b {
    filter:brightness(.83)!important;
  }
}
@media(prefers-reduced-motion:reduce) {
  #tbmLiveTraceModal .trxShell .trxRow > div,
  #tbmLiveTraceModal .trxShell .trxRow:is(:hover,.selected) > div,
  #tbmLiveTraceModal .tiInspector .tiPeerMain b,
  #tbmLiveTraceModal .tiInspector .tiPeer:is(:hover,.active) .tiPeerMain b {
    transform:none!important;
    transition:none!important;
  }
}
/* The inspector is a distinct, single-tone surface—not a second black page.
   Avoid the previous warm gold selection line while keeping clear text focus. */
#tbmLiveTraceModal .tiInspector,
#tbmLiveTraceModal .tiInspectorBody,
#tbmLiveTraceModal .tiPreview,
#tbmLiveTraceModal .tiPeerList,
#tbmLiveTraceModal .tiSidebar,
#tbmLiveTraceModal .tiToolbar,
#tbmLiveTraceModal .tiContent,
#tbmLiveTraceModal .tiModeSwitch {
  background:var(--trace-inspector-bg)!important;
  color:var(--ti-text)!important;
}
#tbmLiveTraceModal .tiToolbar {border-bottom:0!important;box-shadow:none!important}
#tbmLiveTraceModal .tiInspector .tiPeer,
#tbmLiveTraceModal .tiInspector .tiPeer:is(.active,:hover,:focus,:focus-visible) {
  background:transparent!important;
  box-shadow:none!important;
  border-color:transparent!important;
  outline:none!important;
}
#tbmLiveTraceModal .tiInspector .tiPeer:focus-visible .tiPeerMain b {
  text-decoration:underline;
  text-decoration-color:var(--ti-muted);
  text-underline-offset:3px;
}
/* Start the quiet divider near the left text gutter and end before the right. */
#tbmLiveTraceModal .tiInspector .tiPeer + .tiPeer {position:relative}
#tbmLiveTraceModal .tiInspector .tiPeer + .tiPeer::before,
#tbmLiveTraceModal .tiInspector .tiReading + .tiReading::before {
  content:"";
  position:absolute;
  top:0;
  left:12px;
  right:26%;
  height:1px;
  background:var(--ti-line);
  pointer-events:none;
}
#tbmLiveTraceModal .tiInspector .tiReading + .tiReading {
  position:relative;
  padding-top:14px;
}
/* Flat text controls rather than small misaligned outlined pills. */
#tbmLiveTraceModal .trxFooter button,
#tbmLiveTraceModal .trxFilterPanel button,
#tbmLiveTraceModal .trxFilterHeaderActions button,
#tbmLiveTraceModal .trxTablePane [data-trace-scroll-top] {
  appearance:none!important;
  border:0!important;
  box-shadow:none!important;
  background:transparent!important;
  color:var(--trace-muted)!important;
  cursor:pointer;
  border-radius:0!important;
}
#tbmLiveTraceModal .trxFooter button:hover,
#tbmLiveTraceModal .trxFilterPanel button:hover {
  color:var(--trace-cream)!important;
}
#tbmLiveTraceModal .trxFilterPanel {
  background:var(--trace-inspector-bg)!important;
  border-color:transparent!important;
  box-shadow:12px 0 32px #0002!important;
}
#tbmLiveTraceModal .trxFilterPanel .trxFilterHeader {
  border-color:transparent!important;
  background:transparent!important;
}
#tbmLiveTraceModal .trxFilterSearch,
#tbmLiveTraceModal .trxSearch,
#tbmLiveTraceModal .tiCallSearch {
  border:0!important;
  box-shadow:none!important;
  border-radius:8px!important;
  background:var(--trace-input-surface)!important;
}
#tbmLiveTraceModal .trxFilterSearch input,
#tbmLiveTraceModal .trxSearch input,
#tbmLiveTraceModal .tiCallSearch input {
  border:0!important;
  background:transparent!important;
  outline:none!important;
  color:var(--ti-text)!important;
}
#tbmLiveTraceModal .trxFilterSearch:focus-within,
#tbmLiveTraceModal .trxSearch:focus-within,
#tbmLiveTraceModal .tiCallSearch:focus-within {
  box-shadow:0 0 0 1px var(--trace-line-strong)!important;
}
#tbmLiveTraceModal button:focus-visible,
#tbmLiveTraceModal [role=button]:focus-visible {
  outline:1px solid var(--trace-muted);
  outline-offset:2px;
}
#tbmLiveTraceModal .trxFooterFilterActions {
  display:flex;
  align-items:center;
  gap:10px;
  justify-self:start;
  min-width:0;
}
#tbmLiveTraceModal .trxFooterFilterActions [data-trace-active-session] {
  min-width:0;
  max-width:min(35vw,320px);
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  padding:4px;
}
/* Low-contrast platform scrollbars, never an extra left-side rail. */
#tbmLiveTraceModal .trxShell:not(.closed) [data-trace-virtual-list] {scrollbar-width:none!important}
#tbmLiveTraceModal .trxShell:not(.closed) [data-trace-virtual-list]::-webkit-scrollbar {display:none!important}
#tbmLiveTraceModal .tiPeerList,
#tbmLiveTraceModal .tiPreview,
#tbmLiveTraceModal .trxHoverCard {
  scrollbar-width:thin;
  scrollbar-color:color-mix(in srgb,var(--ti-muted) 24%,transparent) transparent;
}
#tbmLiveTraceModal .tiPeerList::-webkit-scrollbar,
#tbmLiveTraceModal .tiPreview::-webkit-scrollbar,
#tbmLiveTraceModal .trxTableScroll::-webkit-scrollbar {width:6px;height:6px}
#tbmLiveTraceModal .tiPeerList::-webkit-scrollbar-thumb,
#tbmLiveTraceModal .tiPreview::-webkit-scrollbar-thumb,
#tbmLiveTraceModal .trxTableScroll::-webkit-scrollbar-thumb {
  border-radius:999px;
  background:color-mix(in srgb,var(--ti-muted) 28%,transparent);
}
/* Keep previously approved concise SKILL.md reading view. */
#tbmLiveTraceModal .tiSkillOverview {min-width:0;max-width:74ch}
#tbmLiveTraceModal .tiSkillEyebrow {margin:0 0 6px;color:var(--ti-muted);font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
#tbmLiveTraceModal .tiSkillOverview h4 {margin:0 0 10px;color:var(--ti-text);font-size:19px;font-weight:650}
#tbmLiveTraceModal .tiSkillPurpose {margin:0 0 16px;color:var(--ti-text);line-height:1.6}
#tbmLiveTraceModal .tiSkillOverview h5 {font-size:12px;font-weight:600;color:var(--ti-muted);margin:18px 0 7px}
#tbmLiveTraceModal .tiSkillOverview ul {margin:0 0 20px;padding-left:18px;line-height:1.65}
#tbmLiveTraceModal .tiSkillOverview li {margin:5px 0}
#tbmLiveTraceModal .tiSkillFull>summary {cursor:pointer;color:var(--ti-gold);font-size:13px;padding:8px 0}
#tbmLiveTraceModal .tiSkillFull>.tiMarkdown {padding:4px 0 12px}
/* Smaller laptops: keep Session comfortable and Input readable before scroll. */
@media(max-width:1300px) and (min-width:1021px) {
  #tbmLiveTraceModal .trxShell .trxTable,
  #tbmLiveTraceModal .trxShell.closed .trxTable {
    width:max(100%,1780px)!important;
    min-width:1780px!important;
  }
  #tbmLiveTraceModal .trxShell .trxHead,
  #tbmLiveTraceModal .trxShell .trxRow,
  #tbmLiveTraceModal .trxShell .trxSkeletonRow,
  #tbmLiveTraceModal .trxShell.closed .trxHead,
  #tbmLiveTraceModal .trxShell.closed .trxRow {
    min-width:1780px!important;
    grid-template-columns:24px 88px 144px 78px 86px minmax(326px,1.2fr) minmax(290px,1fr) minmax(280px,1fr) 136px 148px 82px 98px!important;
  }
  #tbmLiveTraceModal .trxShell .trxSkeletonRows,
  #tbmLiveTraceModal .trxShell [data-trace-virtual-content] {min-width:1780px!important}
}
/* Tablets: no horizontal gymnastics; keep Time, Tool, Session and Input. */
@media(max-width:1020px) {
  #tbmLiveTraceModal .trxShell .trxTable,
  #tbmLiveTraceModal .trxShell.closed .trxTable,
  #tbmLiveTraceModal .trxShell .trxHead,
  #tbmLiveTraceModal .trxShell .trxRow,
  #tbmLiveTraceModal .trxShell .trxSkeletonRow,
  #tbmLiveTraceModal .trxShell.closed .trxHead,
  #tbmLiveTraceModal .trxShell.closed .trxRow,
  #tbmLiveTraceModal .trxShell .trxSkeletonRows,
  #tbmLiveTraceModal .trxShell [data-trace-virtual-content] {
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
  }
  #tbmLiveTraceModal .trxShell .trxTableScroll {
    overflow-x:hidden!important;
  }
  #tbmLiveTraceModal .trxShell .trxHead,
  #tbmLiveTraceModal .trxShell .trxRow,
  #tbmLiveTraceModal .trxShell .trxSkeletonRow,
  #tbmLiveTraceModal .trxShell.closed .trxHead,
  #tbmLiveTraceModal .trxShell.closed .trxRow {
    grid-template-columns:88px 150px minmax(260px,1fr) minmax(170px,1fr)!important;
  }
  #tbmLiveTraceModal .trxHead>div:nth-child(1),
  #tbmLiveTraceModal .trxHead>div:nth-child(4),
  #tbmLiveTraceModal .trxHead>div:nth-child(5),
  #tbmLiveTraceModal .trxHead>div:nth-child(8),
  #tbmLiveTraceModal .trxHead>div:nth-child(9),
  #tbmLiveTraceModal .trxHead>div:nth-child(10),
  #tbmLiveTraceModal .trxHead>div:nth-child(11),
  #tbmLiveTraceModal .trxHead>div:nth-child(12),
  #tbmLiveTraceModal .trxRow>div:nth-child(1),
  #tbmLiveTraceModal .trxRow>div:nth-child(4),
  #tbmLiveTraceModal .trxRow>div:nth-child(5),
  #tbmLiveTraceModal .trxRow>div:nth-child(8),
  #tbmLiveTraceModal .trxRow>div:nth-child(9),
  #tbmLiveTraceModal .trxRow>div:nth-child(10),
  #tbmLiveTraceModal .trxRow>div:nth-child(11),
  #tbmLiveTraceModal .trxRow>div:nth-child(12) {display:none!important}
}
/* Phones: make Session actually readable. No second Time or Status/Cost. */
@media(max-width:600px) {
  #tbmLiveTraceModal .trxShell .trxHead,
  #tbmLiveTraceModal .trxShell .trxRow,
  #tbmLiveTraceModal .trxShell .trxSkeletonRow,
  #tbmLiveTraceModal .trxShell.closed .trxHead,
  #tbmLiveTraceModal .trxShell.closed .trxRow {
    grid-template-columns:72px 124px minmax(0,1fr)!important;
  }
  #tbmLiveTraceModal .trxHead>div:nth-child(7),
  #tbmLiveTraceModal .trxRow>div:nth-child(7) {display:none!important}
  #tbmLiveTraceModal .trxHead>div {padding-inline:6px!important}
  #tbmLiveTraceModal .trxRow>div {padding-inline:6px!important}
  #tbmLiveTraceModal .trxRow .trxStart {font-variant-numeric:tabular-nums}
  #tbmLiveTraceModal .trxFooter {padding-inline:12px!important}
}
</style>`;
