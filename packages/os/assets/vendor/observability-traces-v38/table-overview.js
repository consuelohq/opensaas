(() => {
  window.__traceOverviewLoaded = true;
  window.__traceOverviewStats = { version: 'v22', purpose: 'keyed-render-no-rails' };
  const style = document.createElement('style');
  style.id = 'trace-overview-polish-v22';
  style.textContent = `
#tbmLiveTraceModal .trxBranch,
#tbmLiveTraceModal .trxNestedRow .trxBranch {
  border-left: 0 !important;
  box-shadow: none !important;
  color: var(--branch-color, #d8d0c0) !important;
  font-weight: 560 !important;
  padding-left: 8px !important;
}
#tbmLiveTraceModal .trxBranch[style*="--branch-color:"] {
  text-shadow: 0 0 14px color-mix(in srgb, var(--branch-color) 18%, transparent) !important;
}
#tbmLiveTraceModal .trxRow.selected {
  box-shadow: none !important;
  background: rgba(198, 161, 91, .15) !important;
  outline: 1px solid rgba(198, 161, 91, .24) !important;
  outline-offset: -1px !important;
}
#tbmLiveTraceModal .trxNestedRow {
  box-shadow: inset 0 1px rgba(243, 234, 211, .055) !important;
}
#tbmLiveTraceModal .trxNestedConnector::before,
#tbmLiveTraceModal .trxNestedConnector::after,
#tbmLiveTraceModal .trxNestedRow .trxNestedConnector::before,
#tbmLiveTraceModal .trxNestedRow .trxNestedConnector::after,
#tbmLiveTraceModal .trxNestedToolCell .trxNestedConnector::before,
#tbmLiveTraceModal .trxNestedToolCell .trxNestedConnector::after {
  content: none !important;
  display: none !important;
  border: 0 !important;
}
#tbmLiveTraceModal .trxNestedConnector {
  position: static !important;
  width: auto !important;
  color: rgba(155, 167, 126, .78) !important;
  padding-inline: 0 4px !important;
}
#tbmLiveTraceModal .lfStep.active {
  box-shadow: none !important;
  background: color-mix(in srgb, var(--branch-color, #c6a15b) 18%, transparent) !important;
  outline: 1px solid color-mix(in srgb, var(--branch-color, #c6a15b) 24%, transparent) !important;
  outline-offset: -1px !important;
}
#tbmLiveTraceModal .lfThreadRail,
#tbmLiveTraceModal .lfTyped,
#tbmLiveTraceModal .lfSection,
#tbmLiveTraceModal .lfStep,
#tbmLiveTraceModal .lfOpNode,
#tbmLiveTraceModal .lfDetailSummary,
#tbmLiveTraceModal .lfImportant {
  border-left: 0 !important;
}
#tbmLiveTraceModal .lfOpDetail {
  display: grid !important;
  gap: 10px !important;
  min-height: 0 !important;
}
#tbmLiveTraceModal .lfDetailSummary {
  border: 1px solid rgba(243, 234, 211, .12) !important;
  background: rgba(243, 234, 211, .045) !important;
  border-radius: 8px !important;
  padding: 12px !important;
}
#tbmLiveTraceModal .lfDetailSummary .lfSummaryTool {
  color: var(--trace-amber) !important;
  font: 700 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace !important;
  margin-bottom: 7px !important;
}
#tbmLiveTraceModal .lfDetailSummary p {
  margin: 0 !important;
  color: #e6dccb !important;
  font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace !important;
  overflow-wrap: anywhere !important;
}
#tbmLiveTraceModal .lfFacts {
  display: grid !important;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)) !important;
  gap: 8px !important;
  padding: 10px !important;
}
#tbmLiveTraceModal .lfFacts div {
  min-width: 0 !important;
  border: 1px solid rgba(243, 234, 211, .08) !important;
  border-radius: 6px !important;
  padding: 8px !important;
  background: rgba(8, 7, 6, .42) !important;
}
#tbmLiveTraceModal .lfFacts span {
  display: block !important;
  color: var(--trace-muted) !important;
  font: 700 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace !important;
  text-transform: uppercase !important;
  margin-bottom: 5px !important;
}
#tbmLiveTraceModal .lfFacts b {
  display: block !important;
  color: #e5dccb !important;
  font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace !important;
  overflow-wrap: anywhere !important;
}
#tbmLiveTraceModal .lfRawDetails {
  min-height: 0 !important;
  overflow: visible !important;
}
#tbmLiveTraceModal .lfRawDetails > summary {
  cursor: pointer !important;
  color: var(--trace-muted) !important;
  font: 700 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace !important;
  padding: 9px 2px !important;
}
#tbmLiveTraceModal .lfSection {
  border: 1px solid rgba(243, 234, 211, .11) !important;
  border-radius: 8px !important;
  background: rgba(8, 7, 6, .34) !important;
  overflow: hidden !important;
}
#tbmLiveTraceModal .lfSectionHead {
  position: static !important;
  background: rgba(243, 234, 211, .045) !important;
  border-bottom: 1px solid rgba(243, 234, 211, .09) !important;
}
#tbmLiveTraceModal .lfKvTable {
  display: block !important;
}
#tbmLiveTraceModal .lfPath {
  display: none !important;
}
#tbmLiveTraceModal .lfRawBlock {
  margin: 0 !important;
  max-height: 260px !important;
  overflow: auto !important;
  white-space: pre-wrap !important;
  word-break: break-word !important;
  color: #d9d0bf !important;
  padding: 12px !important;
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace !important;
  background: transparent !important;
}
@media (max-width: 760px) {
  #tbmLiveTraceModal .trxRow.selected { outline-width: 1px !important; }
  #tbmLiveTraceModal .lfRawBlock { max-height: 220px !important; }
}
`;
  document.head.appendChild(style);
})();
