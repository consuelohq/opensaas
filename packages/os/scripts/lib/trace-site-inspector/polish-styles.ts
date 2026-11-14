/**
 * Responsive Tracing refinements layered after the byte-verified v38 shell.
 * Keep all 12 trace columns on large viewports; progressively hide secondary
 * columns when the *table pane* gets narrow, including when the inspector opens.
 */
export const TRACE_POLISH_STYLE = `<style id="consuelo-trace-polish">
#tbmLiveTraceModal .trxShell .trxTablePane {
  container-type: inline-size;
  container-name: trace-grid;
}
#tbmLiveTraceModal .trxShell .trxTableScroll {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  overflow-x: hidden !important;
}
#tbmLiveTraceModal .trxShell .trxTable,
#tbmLiveTraceModal .trxShell .trxHead,
#tbmLiveTraceModal .trxShell .trxRow,
#tbmLiveTraceModal .trxShell .trxSkeletonRows,
#tbmLiveTraceModal .trxShell .trxSkeletonRow,
#tbmLiveTraceModal .trxShell [data-trace-virtual-content] {
  box-sizing: border-box !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
}
/* v38's closed-shell rule has an extra class and otherwise forces 1620px. */
#tbmLiveTraceModal .trxShell.closed .trxTable,
#tbmLiveTraceModal .trxShell.closed .trxHead,
#tbmLiveTraceModal .trxShell.closed .trxRow {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
}
#tbmLiveTraceModal .trxShell .trxHead,
#tbmLiveTraceModal .trxShell .trxRow,
#tbmLiveTraceModal .trxShell .trxSkeletonRow {
  display: grid !important;
  grid-template-columns:
    26px 86px 122px 68px 62px
    minmax(130px,1.4fr) minmax(100px,1fr) minmax(90px,1fr)
    105px 113px 66px 78px !important;
}
#tbmLiveTraceModal .trxShell .trxRow {
  background: transparent !important;
}
#tbmLiveTraceModal .trxShell .trxHead > div,
#tbmLiveTraceModal .trxShell .trxRow > div {
  min-width: 0 !important;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
#tbmLiveTraceModal .trxShell .trxRow [data-trace-session-filter] {
  cursor: pointer;
  text-underline-offset: 3px;
}
#tbmLiveTraceModal .trxShell .trxRow [data-trace-session-filter]:is(:hover,:focus-visible) {
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb,var(--branch-color-light,var(--ti-gold)) 40%,transparent);
}
#tbmLiveTraceModal .trxFooterFilterActions {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-self: start;
  min-width: 0;
}
#tbmLiveTraceModal .trxFooterFilterActions [data-trace-active-session] {
  min-width: 0;
  max-width: min(35vw, 320px);
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--ti-gold);
  font: inherit;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 4px;
}
#tbmLiveTraceModal .trxFooterFilterActions [data-trace-active-session]:hover {
  color: var(--ti-text);
}
#tbmLiveTraceModal .trxFooterFilterActions [data-trace-active-session][hidden] {display:none!important}
#tbmLiveTraceModal .trxFooter[data-trace-virtual-footer] > .trxFooterFilterActions {justify-self:start}
/* Only text lifts. Never paint the whole row or add hover borders. */
#tbmLiveTraceModal .trxShell .trxRow:is(:hover,.selected) > div,
#tbmLiveTraceModal .tiInspector .tiPeer:is(:hover,.active) .tiPeerMain b {
  transform: translateY(-.7px) scale(1.025) !important;
  transform-origin: left center;
  filter: brightness(1.3) !important;
}
@media (prefers-color-scheme: light) {
  #tbmLiveTraceModal .trxShell .trxRow:is(:hover,.selected) > div,
  #tbmLiveTraceModal .tiInspector .tiPeer:is(:hover,.active) .tiPeerMain b {
    filter: brightness(.75) !important;
  }
}
@media (prefers-reduced-motion:reduce) {
  #tbmLiveTraceModal .trxShell .trxRow > div,
  #tbmLiveTraceModal .trxShell .trxRow:is(:hover,.selected) > div,
  #tbmLiveTraceModal .tiInspector .tiPeerMain b,
  #tbmLiveTraceModal .tiInspector .tiPeer:is(:hover,.active) .tiPeerMain b {
    transform: none !important;
    transition: none !important;
  }
}
/* The inset dividers belong inside the tool-call inspector, not the table. */
#tbmLiveTraceModal .tiInspector .tiPeer + .tiPeer::before {
  content: "";
  position: absolute;
  top: 0;
  left: 14%;
  right: 14%;
  height: 1px;
  background: color-mix(in srgb,var(--ti-line) 52%,transparent);
  pointer-events: none;
}
#tbmLiveTraceModal .tiInspector .tiReading + .tiReading {
  position: relative;
  padding-top: 14px;
}
#tbmLiveTraceModal .tiInspector .tiReading + .tiReading::before {
  content: "";
  position: absolute;
  top: 0;
  left: 14%;
  right: 14%;
  height: 1px;
  background: color-mix(in srgb,var(--ti-line) 65%,transparent);
  pointer-events: none;
}
/* The main list hides its auxiliary rail when the inner inspector is open. */
#tbmLiveTraceModal .trxShell:not(.closed) [data-trace-virtual-list] {scrollbar-width:none!important}
#tbmLiveTraceModal .trxShell:not(.closed) [data-trace-virtual-list]::-webkit-scrollbar {display:none!important}
#tbmLiveTraceModal [data-trace-virtual-list],
#tbmLiveTraceModal .tiPeerList,
#tbmLiveTraceModal .tiPreview,
#tbmLiveTraceModal .trxHoverCard {
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb,var(--ti-muted) 30%,transparent) transparent;
}
#tbmLiveTraceModal .tiPeerList::-webkit-scrollbar,
#tbmLiveTraceModal .tiPreview::-webkit-scrollbar,
#tbmLiveTraceModal [data-trace-virtual-list]::-webkit-scrollbar {width: 6px;height: 6px}
#tbmLiveTraceModal .tiPeerList::-webkit-scrollbar-thumb,
#tbmLiveTraceModal .tiPreview::-webkit-scrollbar-thumb,
#tbmLiveTraceModal [data-trace-virtual-list]::-webkit-scrollbar-thumb {
  background: color-mix(in srgb,var(--ti-muted) 30%,transparent);
  border-radius: 999px;
}
#tbmLiveTraceModal .tiPeerList::-webkit-scrollbar-track,
#tbmLiveTraceModal .tiPreview::-webkit-scrollbar-track,
#tbmLiveTraceModal [data-trace-virtual-list]::-webkit-scrollbar-track {background:transparent}
/* A skill call reads like a brief, not an unstructured transport envelope. */
#tbmLiveTraceModal .tiSkillOverview {min-width:0;max-width:74ch}
#tbmLiveTraceModal .tiSkillEyebrow {
  margin:0 0 6px;
  color:var(--ti-muted);
  font-size:10px;
  font-weight:600;
  letter-spacing:.08em;
  text-transform:uppercase;
}
#tbmLiveTraceModal .tiSkillOverview h4 {
  margin:0 0 10px;
  color:var(--ti-text);
  font-size:19px;
  font-weight:650;
}
#tbmLiveTraceModal .tiSkillPurpose {margin:0 0 16px;color:var(--ti-text);line-height:1.6}
#tbmLiveTraceModal .tiSkillOverview h5 {font-size:12px;font-weight:600;color:var(--ti-muted);margin:18px 0 7px}
#tbmLiveTraceModal .tiSkillOverview ul {margin:0 0 20px;padding-left:18px;line-height:1.65}
#tbmLiveTraceModal .tiSkillOverview li {margin:5px 0}
#tbmLiveTraceModal .tiSkillFull > summary {cursor:pointer;color:var(--ti-gold);font-size:13px;padding:8px 0}
#tbmLiveTraceModal .tiSkillFull > .tiMarkdown {padding:4px 0 12px}
@container trace-grid (max-width: 1150px) {
  #tbmLiveTraceModal .trxShell .trxHead,
  #tbmLiveTraceModal .trxShell .trxRow,
  #tbmLiveTraceModal .trxShell .trxSkeletonRow {
    grid-template-columns: 26px 86px 122px 68px 62px minmax(120px,1.4fr) minmax(85px,1fr) minmax(85px,1fr) 66px 78px !important;
  }
  #tbmLiveTraceModal .trxHead > div:nth-child(9),
  #tbmLiveTraceModal .trxHead > div:nth-child(10),
  #tbmLiveTraceModal .trxRow > div:nth-child(9),
  #tbmLiveTraceModal .trxRow > div:nth-child(10) {display:none!important}
}
@container trace-grid (max-width: 790px) {
  #tbmLiveTraceModal .trxShell .trxHead,
  #tbmLiveTraceModal .trxShell .trxRow,
  #tbmLiveTraceModal .trxShell .trxSkeletonRow {
    grid-template-columns: 24px 80px 115px minmax(120px,1.3fr) minmax(85px,1fr) minmax(85px,1fr) 64px 76px !important;
  }
  #tbmLiveTraceModal .trxHead > div:nth-child(4),
  #tbmLiveTraceModal .trxHead > div:nth-child(5),
  #tbmLiveTraceModal .trxRow > div:nth-child(4),
  #tbmLiveTraceModal .trxRow > div:nth-child(5) {display:none!important}
}
@container trace-grid (max-width: 560px) {
  #tbmLiveTraceModal .trxShell .trxHead,
  #tbmLiveTraceModal .trxShell .trxRow,
  #tbmLiveTraceModal .trxShell .trxSkeletonRow {
    grid-template-columns: 58px 100px minmax(70px,1fr) 60px 68px !important;
  }
  #tbmLiveTraceModal .trxHead > div:nth-child(1),
  #tbmLiveTraceModal .trxHead > div:nth-child(7),
  #tbmLiveTraceModal .trxHead > div:nth-child(8),
  #tbmLiveTraceModal .trxRow > div:nth-child(1),
  #tbmLiveTraceModal .trxRow > div:nth-child(7),
  #tbmLiveTraceModal .trxRow > div:nth-child(8) {display:none!important}
}
</style>`;
