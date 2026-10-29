export const TRACE_INSPECTOR_READING_STYLE = `<style id="consuelo-trace-inspector-reading">

.trxShell .tiInspector {
  opacity: 1 !important;
  animation: none !important;
  --ti-text: var(--trace-cream, #eee9dc);
  --ti-muted: #706757;
  --ti-faint: #756d62;
  --ti-reading-code: 'Courier New', Courier, monospace;
  container-type: inline-size;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif !important;
  font-size: 14px;
  line-height: 1.5;
}
.trxShell .tiInspector button,
.trxShell .tiInspector input,
.trxShell .tiInspector select {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif !important;
}
.tiInspector .tiToolbar { padding: 12px 18px; gap: 12px; align-items: center; }
.tiInspector .tiToolbarIdentity { gap: 8px; }
.tiInspector .tiHeaderMetrics { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; font-size: 12px; color: var(--ti-muted); }
.tiBranchIdentity { min-width: 0; max-width: min(480px, 52cqw); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ti-gold); font-weight: 600; }
.tiLoadedCount, .tiFailureCount { white-space: nowrap; font-variant-numeric: tabular-nums; }
.tiFailureCount.has-failures { color: var(--ti-red); }
.tiUsageDetails { position: relative; }
.tiUsageDetails summary { cursor: pointer; white-space: nowrap; }
.tiUsageDetails > div { position: absolute; z-index: 10; top: calc(100% + 10px); right: 0; width: 240px; padding: 14px; background: var(--ti-panel-raised); border: 1px solid var(--ti-line); border-radius: 8px; box-shadow: 0 12px 28px #0007; }
.tiUsageDetails > div > span { display: flex; justify-content: space-between; margin-bottom: 6px; }
.tiUsageDetails small { display: block; margin-top: 10px; color: var(--ti-muted); line-height: 1.5; }
.tiInspector .tiSelectedMeta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; font: inherit; color: var(--ti-muted); font-variant-numeric: tabular-nums; }
.tiInspector .tiSelectedMeta strong { color: var(--ti-text); font-size: 16px; font-weight: 650; }
.tiInspector .tiSelectedMeta > span { font: inherit; font-size: 13px; }
.tiInspector .tiSelectedMeta .tiCallStatus { color: var(--ti-green); font-size: 19px; line-height: 1; }
.tiInspector .tiSelectedMeta .tiCallStatus.error { color: var(--ti-red); }
.tiSelectedStatus { color: var(--ti-green); }
.tiCallStatus.error ~ .tiSelectedStatus { color: var(--ti-red); }
.tiInspector .tiToolbarActions { flex: none; gap: 6px; }
.tiInspector .tiModeSwitch { border: 0; background: transparent; gap: 2px; }
.tiInspector .tiModeSwitch button { color: var(--ti-muted); border-radius: 5px; font-size: 12px; }
.tiInspector .tiModeSwitch button.active { background: var(--ti-panel-raised); color: var(--ti-text); box-shadow: none; }
.tiInspector .tiIconButton { color: var(--ti-muted); font-size: 16px; }
.tiInspector .tiInspectorBody { grid-template-columns: 264px minmax(0, 1fr); transition: none; }
.tiInspector.is-call-rail-collapsed .tiInspectorBody { grid-template-columns: 0 minmax(0, 1fr); }
.tiInspector .tiSidebar { border-right-color: rgba(232,224,202,.09); }
.tiInspector .tiCallSearch { margin: 12px 10px 8px; border-color: transparent; background: var(--ti-panel-raised); }
.tiInspector .tiCallSearch input { font-size: 13px; }
.tiInspector .tiPeer { position: relative; grid-template-columns: 8px minmax(0,1fr) auto; gap: 4px 9px; min-height: 60px; padding: 10px 12px; border-bottom: 0; overflow: hidden; }
.tiInspector .tiPeerMain { grid-column: 2; grid-row: 1 / 3; }
.tiInspector .tiPeerMain b { font-size: 13px; font-weight: 600; }
.tiInspector .tiPeerMain small, .tiInspector .tiPeerTokens, .tiInspector .tiPeerDuration { font-family: inherit; font-size: 12px; color: var(--ti-muted); }
.tiInspector .tiPeerTokens { grid-column: 3; grid-row: 1; }
.tiInspector .tiPeerDuration { grid-column: 3; grid-row: 2; justify-self: end; }
.tiInspector .tiPeer.active { background: rgba(215,181,109,.1); box-shadow: inset 2px 0 var(--ti-gold); }
.tiInspector .tiPeerChild { padding-left: 26px; }
.tiPeerMeter { position: absolute; left: 0; bottom: 0; height: 2px; max-width: 100%; background: var(--ti-green); opacity: .18; pointer-events: none; }
.tiPeer:has(.tiPeerStatus.error) .tiPeerMeter { background: var(--ti-red); }
.tiInspector .tiPreview { overflow-x: hidden; }
.tiInspector .tiContent { padding: 0 20px 24px; }
.tiInspector .tiSection { margin: 0; border: 0; border-radius: 0; background: transparent; overflow: visible; }
.tiInspector .tiSection > header { min-height: 46px; padding: 0; gap: 12px; background: var(--ti-bg); border-bottom: 1px solid var(--ti-line); }
.tiInspector .tiReading > header { position: sticky; top: 0; z-index: 3; }
.tiInspector .tiSection > header h3 { font-size: 14px; }
.tiInspector .tiSection > header > button { border: 0; background: transparent; color: var(--ti-muted); font-size: 12px; }
.tiReadingTabs { display: flex; gap: 24px; align-self: stretch; }
.tiReadingTabs button { position: relative; padding: 12px 0; border: 0; background: transparent; color: var(--ti-muted); font-size: 14px; cursor: pointer; }
.tiReadingTabs button[aria-selected="true"] { color: var(--ti-text); }
.tiReadingTabs button[aria-selected="true"]::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 2px; background: var(--ti-gold); }
.tiInspector button:focus-visible, .tiInspector select:focus-visible, .tiObject summary:focus-visible { outline: 2px solid var(--ti-gold); outline-offset: 3px; }
.tiInspector .tiSectionBody { min-width: 0; padding: 14px 0; overflow: visible; }
.tiFields { margin: 0; }
.tiField { display: grid; grid-template-columns: minmax(90px, 140px) minmax(0, 1fr); gap: 8px 16px; padding: 7px 0; min-width: 0; }
.tiField dt { color: var(--ti-muted); font-size: 13px; overflow-wrap: anywhere; }
.tiField dd { margin: 0; min-width: 0; }
.tiField.tiLongField { grid-template-columns: minmax(0, 1fr); padding: 12px 0; gap: 7px; }
.tiLongField > dt { font-weight: 600; color: var(--ti-text); }
.trxShell .tiInspector .tiCodeValue,
.trxShell .tiInspector .tiRawJson {
  font-family: var(--ti-reading-code) !important;
  font-size: 14px !important;
  line-height: 1.6 !important;
  font-weight: 400;
  font-variant-numeric: lining-nums tabular-nums;
  font-feature-settings: "zero" 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: normal;
  max-width: 100%;
  margin: 0;
  padding: 0;
  overflow: auto;
  color: var(--ti-text);
  tab-size: 2;
}
.trxShell .tiInspector .tiTextValue,
.trxShell .tiInspector .tiWorkpadValue { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif !important; font-size: 15px; line-height: 1.65; color: var(--ti-text); white-space: pre-wrap; overflow-wrap: anywhere; word-break: normal; margin: 0; }
.tiInspector .tiObject { min-width: 0; }
.tiObject > summary { color: var(--ti-muted); cursor: pointer; font-size: 12px; padding: 2px 0 8px; }
.tiObject > .tiFields { padding-left: 12px; }
.tiInspector .tiEmptyValue { margin: 0; padding: 12px 0; color: var(--ti-muted); font-size: 14px; }
.tiCallError { padding: 14px 0 12px; color: var(--ti-red); border-bottom: 1px solid rgba(239,118,95,.2); }
.tiCallError strong { font-size: 12px; }
.tiCallError p { margin: 5px 0 0; font-size: 14px; overflow-wrap: anywhere; white-space: pre-wrap; }
.tiMobileCalls { display: none; }
#tbmLiveTraceModal .tiInspector .tiInspectorBody { min-width: 0 !important; min-height: 0 !important; overflow: hidden !important; }
/* Bound the old visual shell's viewport-sized preview to its actual grid column. */
#tbmLiveTraceModal .tiInspector .tiPreview { width: 100% !important; max-width: 100% !important; min-width: 0 !important; height: 100% !important; max-height: 100% !important; min-height: 0 !important; padding: 0 !important; margin: 0 !important; display: block !important; }
#tbmLiveTraceModal .tiInspector .tiContent { width: 100% !important; max-width: 100% !important; min-width: 0 !important; margin: 0 !important; padding: 0 20px 24px !important; box-sizing: border-box !important; }
#tbmLiveTraceModal .tiInspector .tiReadingTabs button { font-size: 14px !important; font-weight: 500; }
#tbmLiveTraceModal .tiInspector .tiPeerMain b { color: var(--ti-text) !important; }
@media (prefers-color-scheme: dark) {
  .trxShell .tiInspector { --ti-muted: #b4ada0; --ti-faint: #a59d8e; }
}
@container (max-width: 820px) {
  .tiInspector .tiInspectorBody { grid-template-columns: 220px minmax(0, 1fr); }
  .tiInspector.is-call-rail-collapsed .tiInspectorBody { grid-template-columns: 0 minmax(0, 1fr); }
  .tiInspector .tiToolbar { flex-wrap: wrap; }
  .tiInspector .tiToolbarIdentity { flex-basis: 100%; }
  .tiInspector .tiToolbarActions { margin-left: auto; }
  .tiBranchIdentity { max-width: 100%; }
  #tbmLiveTraceModal .tiInspector .tiContent { padding-inline: 16px !important; }
}
@container (max-width: 560px) {
  .tiInspector .tiInspectorBody, .tiInspector.is-call-rail-collapsed .tiInspectorBody { display: block; }
  .tiInspector .tiSidebar, .tiInspector [data-ti-call-rail] { display: none; }
  .tiInspector .tiPreview { height: 100%; }
  .tiInspector .tiToolbar { padding: 10px 12px; gap: 8px; }
  .tiInspector .tiSelectedMeta { gap: 4px 10px; }
  .tiInspector .tiSelectedMeta strong { font-size: 15px; }
  #tbmLiveTraceModal .tiInspector .tiContent { padding-inline: 12px !important; }
  .tiMobileCalls { display: grid; gap: 4px; margin: 12px; color: var(--ti-muted); font-size: 12px; }
  .tiMobileCalls select { min-width: 0; width: 100%; padding: 8px; color: var(--ti-text); background: var(--ti-panel); border: 1px solid var(--ti-line); border-radius: 5px; font-size: 13px; }
  .tiField { grid-template-columns: minmax(75px, 110px) minmax(0,1fr); gap: 8px 12px; }
  .tiField.tiLongField { grid-template-columns: minmax(0,1fr); }
  .tiReadingTabs { gap: 24px; }
  .tiUsageDetails > div { right: auto; left: 0; }
}


/* One continuous reading page with semantic content ahead of diagnostics. */
.tiInspector .tiInspectorBody { grid-template-columns: 360px minmax(0, 1fr); }
.tiInspector .tiToolbarIdentity { display: flex; flex-direction: column; gap: 5px; }
.tiInspector .tiSelectedMeta strong { font-size: 17px; }
.tiInspector .tiHeaderMetrics { font-size: 12px; }
.tiInspector .tiReading { margin-bottom: 18px; }
.tiInspector .tiReading > header { position: static; min-height: 40px; border-bottom-color: var(--ti-line); }
.tiInspector .tiReading > header h3 { font-size: 13px; font-weight: 600; color: var(--ti-muted); }
.tiInspector .tiReading > .tiSectionBody { padding-block: 10px; }
.tiInspector .tiPeerMain b { font-size: 14px; }
.tiInspector .tiPeer { gap: 4px 12px; padding: 10px 14px; }
.tiDiagnostics { margin: 22px 0; border-top: 1px solid var(--ti-line); padding-top: 14px; }
.tiDiagnostics > summary { cursor: pointer; color: var(--ti-muted); font-size: 13px; }
.tiResultList { display: grid; gap: 16px; }
.tiResultCard { min-width: 0; padding: 0 0 12px; border-bottom: 1px solid var(--ti-line); }
.tiResultCard:last-child { border-bottom: 0; }
.tiResultCard h4 { margin: 4px 0 8px; font-size: 14px; font-weight: 600; overflow-wrap: anywhere; color: var(--ti-text); }
.tiResultCard .tiField { padding-block: 4px; }
.tiResultCard .tiField.tiLongField { padding-block: 6px; }
.tiValueList { margin: 0; padding-left: 20px; }
.tiValueList li { margin-bottom: 6px; overflow-wrap: anywhere; }
.tiFileTargets { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.tiFileTargets li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; min-width: 0; }
.tiFileTargets code { font-family: var(--ti-reading-code); font-size: 14px; overflow-wrap: anywhere; color: var(--ti-text); }
.tiFileTargets small { color: var(--ti-muted); font-size: 12px; }
.trxShell .tiInspector .tiMarkdown, .trxShell .tiInspector .tiMarkdown h1,
.trxShell .tiInspector .tiMarkdown h2, .trxShell .tiInspector .tiMarkdown h3,
.trxShell .tiInspector .tiMarkdown h4 { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif !important; }
.tiMarkdown { font-size: 15px; line-height: 1.65; overflow-wrap: anywhere; color: var(--ti-text); }
.tiMarkdown h1, .tiMarkdown h2, .tiMarkdown h3, .tiMarkdown h4 { line-height: 1.3; margin: 22px 0 10px; font-weight: 600; color: var(--ti-text); }
.tiMarkdown h1 { font-size: 24px; }
.tiMarkdown h2 { font-size: 21px; }
.tiMarkdown h3 { font-size: 18px; }
.tiMarkdown h4 { font-size: 16px; }
.tiMarkdown > :first-child { margin-top: 0; }
.tiMarkdown p { margin: 10px 0; }
.tiMarkdown ul, .tiMarkdown ol { margin: 10px 0; padding-left: 22px; }
.tiMarkdown li { margin: 5px 0; }
.tiMarkdown a { color: var(--ti-gold); text-decoration: underline; text-underline-offset: 3px; }
.tiMarkdown code { font-family: var(--ti-reading-code); font-size: .93em; overflow-wrap: anywhere; }
.tiMarkdown pre { margin-block: 14px !important; padding: 12px !important; background: var(--ti-panel-raised); border-radius: 5px; }
.tiMarkdown blockquote { margin: 12px 0; padding-left: 14px; border-left: 2px solid var(--ti-line); color: var(--ti-muted); }
.tiMarkdown hr { border: 0; border-top: 1px solid var(--ti-line); margin: 20px 0; }
.tiMarkdownTable { max-width: 100%; overflow: auto; }
.tiMarkdown table { width: 100%; border-collapse: collapse; }
.tiMarkdown td, .tiMarkdown th { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--ti-line); }
@container (max-width: 1000px) {
  .tiInspector .tiInspectorBody { grid-template-columns: 300px minmax(0,1fr); }
  .tiInspector.is-call-rail-collapsed .tiInspectorBody { grid-template-columns: 0 minmax(0,1fr); }
}
@container (max-width: 660px) {
  .tiInspector .tiInspectorBody, .tiInspector.is-call-rail-collapsed .tiInspectorBody { display: block; }
  .tiInspector .tiSidebar, .tiInspector [data-ti-call-rail] { display: none; }
  .tiMobileCalls { display: grid; gap: 4px; margin: 12px; color: var(--ti-muted); font-size: 12px; }
  .tiMobileCalls select { min-width: 0; width: 100%; padding: 8px; color: var(--ti-text); background: var(--ti-panel); border: 1px solid var(--ti-line); border-radius: 5px; font-size: 13px; }
}

/* Selection is carried by typography, without painted row blocks. */
#tbmLiveTraceModal .trxShell .trxRow.selected,
#tbmLiveTraceModal .trxShell .trxRow:hover { background: transparent !important; box-shadow: none !important; }
#tbmLiveTraceModal .tiInspector .tiPeer.active,
#tbmLiveTraceModal .tiInspector .tiPeer:hover { background: transparent !important; box-shadow: none !important; }
#tbmLiveTraceModal .trxRow > div,
#tbmLiveTraceModal .tiPeerMain b { display: inline-block; transition: transform 120ms ease, filter 120ms ease; }
#tbmLiveTraceModal .trxRow:is(:hover,.selected) > div,
#tbmLiveTraceModal .tiPeer:is(:hover,.active) .tiPeerMain b { transform: translateY(-.5px); filter: brightness(1.12); }
#tbmLiveTraceModal .tiPeer.active .tiPeerMain b { font-weight: 650; }
#tbmLiveTraceModal .trxFilterSection,
#tbmLiveTraceModal .trxFilterHeader,
#tbmLiveTraceModal .trxFilterPanel > footer { border: 0 !important; box-shadow: none !important; }
#tbmLiveTraceModal .trxFilterPanel > footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
#tbmLiveTraceModal .trxFilterPanel [data-trace-filter-close] { margin-left: auto; width: 28px; height: 28px; font-size: 20px; line-height: 1; }
.tiTimestamp { font: inherit; color: inherit; font-variant-numeric: tabular-nums; }
@media (prefers-color-scheme: light) {
  #tbmLiveTraceModal .trxRow:is(:hover,.selected) > div,
  #tbmLiveTraceModal .tiPeer:is(:hover,.active) .tiPeerMain b { filter: brightness(.9); }
}
@media (prefers-reduced-motion: reduce) {
  #tbmLiveTraceModal .trxRow > div, #tbmLiveTraceModal .tiPeerMain b { transition: none; transform: none !important; }
}

/* A continuous table and reading surface; spacing and type carry the hierarchy. */
#tbmLiveTraceModal .trxShell .trxTable { width: 100% !important; padding: 0 !important; box-sizing: border-box !important; }
#tbmLiveTraceModal .trxShell .trxHead,
#tbmLiveTraceModal .trxShell .trxRow { width: 100% !important; border: 0 !important; box-shadow: none !important; }
#tbmLiveTraceModal .trxShell .trxHead { background: var(--trace-bg) !important; }
#tbmLiveTraceModal .trxShell .trxRow:not(:focus-visible) { outline: none !important; }
#tbmLiveTraceModal .trxShell .trxRow:focus-visible { outline: 2px solid var(--ti-blue); outline-offset: -2px; }
#tbmLiveTraceModal .trxShell .trxRow.is-error > div:not(.trxBranch),
#tbmLiveTraceModal .trxShell .trxRow.is-error > div:not(.trxBranch) * { color: var(--ti-red) !important; text-shadow: none !important; }
#tbmLiveTraceModal .trxShell .trxTablePane { border: 0 !important; }
#tbmLiveTraceModal .trxShell .trxRailInner { padding: 0 !important; gap: 0 !important; }
#tbmLiveTraceModal .trxShell .tiDivider {
  width: 10px !important; min-width: 10px !important; margin-inline: -5px !important;
  border: 0 !important; background: transparent !important;
}
#tbmLiveTraceModal .trxShell .tiDivider::before { display: none !important; }
#tbmLiveTraceModal .trxShell .tiDivider::after { left: 4px; width: 2px; }
#tbmLiveTraceModal .tiInspector .tiToolbar,
#tbmLiveTraceModal .tiInspector .tiSidebar,
#tbmLiveTraceModal .tiInspector .tiPeer,
#tbmLiveTraceModal .tiInspector .tiSection > header,
#tbmLiveTraceModal .tiInspector .tiResultCard,
#tbmLiveTraceModal .tiInspector .tiDiagnostics,
#tbmLiveTraceModal .tiInspector .tiCallError { border: 0 !important; box-shadow: none !important; }
#tbmLiveTraceModal .tiInspector .tiPeerMeter { display: none; }
#tbmLiveTraceModal .tiInspector .tiReading { margin-bottom: 22px; }
#tbmLiveTraceModal .tiInspector .tiReading > header h3 { font-size: 15px; }
</style>`;
