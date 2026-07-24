export const TRACE_SITE_ASSET_VERSION = '2026-07-23.1';

export const TRACE_SITE_CSS = `
:root {
  color-scheme: dark;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #101010;
  color: #f2eee6;
}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; background: #101010; }
button { font: inherit; }
.trace-app { max-width: 1500px; margin: 0 auto; padding: 22px; }
.trace-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 18px; }
.trace-header h1 { margin: 0 0 5px; font-size: clamp(24px, 3vw, 36px); letter-spacing: -0.035em; }
.trace-header p { margin: 0; color: #aaa298; }
.trace-node { min-width: 220px; border: 1px solid #38342f; border-radius: 10px; padding: 10px 12px; background: #171614; }
.trace-node span { display: block; color: #8f887f; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
.trace-node code { display: block; margin-top: 4px; overflow-wrap: anywhere; color: #e8e0d5; }
.trace-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; border-top: 1px solid #34312d; border-bottom: 1px solid #34312d; }
.trace-state { display: flex; align-items: center; gap: 9px; min-width: 0; color: #bcb4aa; }
.trace-state-dot { width: 8px; height: 8px; border-radius: 999px; background: #8b837a; flex: 0 0 auto; }
[data-trace-state="healthy"] .trace-state-dot { background: #62bf7c; }
[data-trace-state="loading"] .trace-state-dot,
[data-trace-state="reconnecting"] .trace-state-dot { background: #d2a34c; animation: trace-pulse 1.2s ease-in-out infinite; }
[data-trace-state="offline"] .trace-state-dot,
[data-trace-state="error"] .trace-state-dot { background: #db7168; }
.trace-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.trace-button { border: 1px solid #454039; border-radius: 7px; background: #1b1917; color: #eee7de; padding: 7px 10px; cursor: pointer; }
.trace-button:hover, .trace-button:focus-visible { border-color: #888077; outline: none; }
.trace-button:disabled { opacity: .45; cursor: default; }
.trace-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 440px); gap: 14px; margin-top: 14px; align-items: start; }
.trace-table-panel, .trace-inspector { border: 1px solid #34312d; border-radius: 10px; background: #151412; overflow: hidden; }
.trace-table-wrap { overflow: auto; max-height: calc(100vh - 205px); }
.trace-table { width: 100%; min-width: 980px; border-collapse: collapse; }
.trace-table th { position: sticky; top: 0; z-index: 1; background: #1b1917; color: #938b82; text-transform: uppercase; letter-spacing: .055em; font-size: 10px; }
.trace-table th, .trace-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #292622; vertical-align: top; }
.trace-table td { font-family: "SFMono-Regular", Consolas, monospace; font-size: 11px; color: #d8d1c8; }
.trace-table tr { cursor: pointer; }
.trace-table tbody tr:hover { background: #201e1b; }
.trace-table tbody tr[aria-selected="true"] { background: #29251f; box-shadow: inset 3px 0 #c69952; }
.trace-cell-clip { max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.trace-status-success { color: #70c989; }
.trace-status-error { color: #e17b72; }
.trace-empty { padding: 42px 18px; text-align: center; color: #9a9288; }
.trace-inspector { position: sticky; top: 14px; max-height: calc(100vh - 42px); display: flex; flex-direction: column; }
.trace-inspector[hidden] { display: none; }
.trace-inspector.is-fullscreen { position: fixed; inset: 12px; z-index: 20; max-height: none; width: auto; }
.trace-inspector-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 12px; border-bottom: 1px solid #34312d; }
.trace-inspector-header h2 { margin: 0; font-size: 15px; }
.trace-inspector-header code { display: block; margin-top: 4px; color: #918980; font-size: 11px; overflow-wrap: anywhere; }
.trace-inspector-actions { display: flex; gap: 6px; }
.trace-inspector-body { overflow: auto; padding: 12px; }
.trace-inspector.is-collapsed .trace-inspector-body { display: none; }
.trace-detail-grid { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 7px 10px; margin: 0 0 14px; }
.trace-detail-grid dt { color: #8f877d; }
.trace-detail-grid dd { margin: 0; overflow-wrap: anywhere; }
.trace-detail { margin-top: 12px; }
.trace-detail h3 { margin: 0 0 7px; font-size: 12px; color: #bcb3a9; }
.trace-detail pre { margin: 0; padding: 10px; border-radius: 7px; background: #0e0e0d; border: 1px solid #2d2925; color: #d8d1c8; white-space: pre-wrap; overflow-wrap: anywhere; font: 11px/1.45 "SFMono-Regular", Consolas, monospace; }
.trace-footer { display: flex; justify-content: space-between; gap: 10px; align-items: center; padding: 10px 12px; color: #8f877d; font-size: 11px; }
@keyframes trace-pulse { 50% { opacity: .35; transform: scale(.8); } }
@media (max-width: 980px) {
  .trace-app { padding: 14px; }
  .trace-header { flex-direction: column; }
  .trace-node { width: 100%; }
  .trace-layout { grid-template-columns: 1fr; }
  .trace-table-wrap { max-height: 58vh; }
  .trace-inspector { position: relative; top: auto; max-height: none; }
}
@media (max-width: 600px) {
  .trace-toolbar { align-items: flex-start; }
  .trace-actions { width: 100%; }
  .trace-button { flex: 1 1 auto; }
  .trace-inspector.is-fullscreen { inset: 4px; }
}
`;

export const TRACE_SITE_JAVASCRIPT = `
(() => {
  const root = document.querySelector('[data-trace-app]');
  if (!root) return;
  const workspaceId = root.dataset.workspaceId || 'workspace-unknown';
  const nodeId = root.dataset.nodeId || 'node-unselected';
  const storageKey = 'consuelo:traces:view:' + workspaceId + ':' + nodeId;
  const MAX_ROWS = 200;
  const PAGE_SIZE = 100;
  const tableBody = root.querySelector('[data-trace-rows]');
  const stateLabel = root.querySelector('[data-trace-state-label]');
  const countLabel = root.querySelector('[data-trace-count]');
  const inspector = root.querySelector('[data-trace-inspector]');
  const inspectorTitle = root.querySelector('[data-inspector-title]');
  const inspectorId = root.querySelector('[data-inspector-id]');
  const inspectorBody = root.querySelector('[data-inspector-body]');
  const olderButton = root.querySelector('[data-action="older"]');
  const refreshButton = root.querySelector('[data-action="refresh"]');
  const collapseButton = root.querySelector('[data-action="collapse"]');
  const fullscreenButton = root.querySelector('[data-action="fullscreen"]');
  const closeButton = root.querySelector('[data-action="close"]');
  let rows = [];
  let olderCursor = null;
  let newerCursor = 'latest';
  let polling = false;
  let reconnectFailures = 0;
  let view = { selectedId: null, open: false, collapsed: false, fullscreen: false };

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    view = {
      selectedId: typeof saved.selectedId === 'string' ? saved.selectedId : null,
      open: saved.open === true,
      collapsed: saved.collapsed === true,
      fullscreen: saved.fullscreen === true,
    };
  } catch {}

  function persistView() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        selectedId: view.selectedId,
        open: view.open,
        collapsed: view.collapsed,
        fullscreen: view.fullscreen,
      }));
    } catch {}
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }

  function value(value, fallback) {
    return value === undefined || value === null || value === '' ? fallback : value;
  }

  function safeJson(valueToFormat) {
    if (typeof valueToFormat === 'string') {
      try { return JSON.stringify(JSON.parse(valueToFormat), null, 2); }
      catch { return valueToFormat; }
    }
    try { return JSON.stringify(valueToFormat == null ? {} : valueToFormat, null, 2); }
    catch { return String(valueToFormat == null ? '' : valueToFormat); }
  }

  function setState(kind, message) {
    root.dataset.traceState = kind;
    stateLabel.textContent = message;
  }

  function errorFromPayload(payload, status) {
    const error = payload && payload.error ? payload.error : {};
    const exception = new Error(error.message || ('Trace request failed with ' + status));
    exception.code = error.code || 'TRACE_REQUEST_FAILED';
    exception.status = status;
    return exception;
  }

  async function requestJson(path) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });
    let payload = null;
    try { payload = await response.json(); } catch {}
    if (!response.ok || !payload || payload.ok === false) {
      throw errorFromPayload(payload, response.status);
    }
    return payload;
  }

  function historyPath(direction, cursor) {
    const query = new URLSearchParams({
      direction,
      cursor: cursor || 'latest',
      limit: String(PAGE_SIZE),
      sourceMode: 'local-networked',
      includeRawPayload: 'true',
    });
    return '/gateway/traces/recent?' + query.toString();
  }

  function rowIdentity(row) {
    return String(value(row.recordId, value(row.id, value(row.traceId, 'trace-unknown'))));
  }

  function mergeRows(nextRows, placement) {
    const merged = placement === 'append' ? rows.concat(nextRows) : nextRows.concat(rows);
    const seen = new Set();
    rows = merged.filter((row) => {
      const key = rowIdentity(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, MAX_ROWS);
  }

  function formatTime(input) {
    if (!input) return '';
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? String(input) : date.toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  function compact(input) {
    const string = typeof input === 'string' ? input : safeJson(input);
    return string.replace(/\\s+/g, ' ').trim();
  }

  function renderRows() {
    countLabel.textContent = rows.length + (rows.length === 1 ? ' trace' : ' traces');
    olderButton.disabled = !olderCursor;
    if (!rows.length) {
      tableBody.innerHTML = '<tr><td colspan="8" class="trace-empty">No traces are available for this workspace and node.</td></tr>';
      renderInspector();
      return;
    }
    tableBody.innerHTML = rows.map((row) => {
      const id = rowIdentity(row);
      const selected = view.selectedId === id;
      const ok = row.ok === true || row.status === 'success' || row.status === 'ok';
      return '<tr tabindex="0" data-trace-id="' + escapeHtml(id) + '" aria-selected="' + selected + '">' +
        '<td>' + escapeHtml(formatTime(value(row.startTime, row.time))) + '</td>' +
        '<td class="trace-cell-clip" title="' + escapeHtml(value(row.name, row.traceName)) + '">' + escapeHtml(value(row.name, row.traceName)) + '</td>' +
        '<td>' + escapeHtml(value(row.latency, String(value(row.durationMs, 0)) + 'ms')) + '</td>' +
        '<td>' + escapeHtml(value(row.tokens, value(row.totalTokens, 0))) + '</td>' +
        '<td class="trace-cell-clip" title="' + escapeHtml(row.branch) + '">' + escapeHtml(row.branch) + '</td>' +
        '<td class="trace-cell-clip" title="' + escapeHtml(compact(row.input)) + '">' + escapeHtml(compact(row.input)) + '</td>' +
        '<td class="trace-cell-clip" title="' + escapeHtml(compact(row.output)) + '">' + escapeHtml(compact(row.output)) + '</td>' +
        '<td class="' + (ok ? 'trace-status-success' : 'trace-status-error') + '">' + escapeHtml(value(row.code, row.status)) + '</td>' +
      '</tr>';
    }).join('');
    tableBody.querySelectorAll('[data-trace-id]').forEach((element) => {
      const select = () => selectRow(element.getAttribute('data-trace-id'));
      element.addEventListener('click', select);
      element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); }
      });
    });
    renderInspector();
  }

  function selectRow(id) {
    view.selectedId = id;
    view.open = true;
    persistView();
    renderRows();
  }

  function renderInspector() {
    const selected = rows.find((row) => rowIdentity(row) === view.selectedId);
    if (!view.open || !selected) {
      inspector.hidden = true;
      return;
    }
    inspector.hidden = false;
    inspector.classList.toggle('is-collapsed', view.collapsed);
    inspector.classList.toggle('is-fullscreen', view.fullscreen);
    collapseButton.textContent = view.collapsed ? 'Expand' : 'Collapse';
    fullscreenButton.textContent = view.fullscreen ? 'Exit full screen' : 'Full screen';
    inspectorTitle.textContent = value(selected.name, selected.traceName);
    inspectorId.textContent = value(selected.traceId, rowIdentity(selected));
    const details = [
      ['Status', value(selected.code, selected.status)],
      ['Time', value(selected.startTime, selected.time)],
      ['Duration', value(selected.latency, String(value(selected.durationMs, 0)) + 'ms')],
      ['Tokens', value(selected.tokens, 0)],
      ['Branch', value(selected.branch, '')],
      ['Task session', value(selected.taskSession, '')],
    ];
    inspectorBody.innerHTML = '<dl class="trace-detail-grid">' + details.map((entry) =>
      '<dt>' + escapeHtml(entry[0]) + '</dt><dd>' + escapeHtml(entry[1]) + '</dd>'
    ).join('') + '</dl>' +
      '<section class="trace-detail"><h3>Summary</h3><pre>' + escapeHtml(value(selected.summary, selected.output)) + '</pre></section>' +
      '<section class="trace-detail"><h3>Input</h3><pre>' + escapeHtml(safeJson(value(selected.resolvedInputObj, selected.inputObj))) + '</pre></section>' +
      '<section class="trace-detail"><h3>Output</h3><pre>' + escapeHtml(safeJson(selected.outputObj)) + '</pre></section>' +
      (selected.batchResultsJson ? '<section class="trace-detail"><h3>Batch results</h3><pre>' + escapeHtml(safeJson(selected.batchResultsJson)) + '</pre></section>' : '') +
      (selected.rawStderr ? '<section class="trace-detail"><h3>Diagnostics</h3><pre>' + escapeHtml(selected.rawStderr) + '</pre></section>' : '');
  }

  function handleFailure(error, duringPoll) {
    const code = error && error.code ? error.code : 'TRACE_REQUEST_FAILED';
    if (code === 'WORKSPACE_NODE_OFFLINE' || code === 'WORKSPACE_NODE_MISMATCH' || code === 'WORKSPACE_NODE_REQUIRED') {
      setState('offline', code === 'WORKSPACE_NODE_OFFLINE' ? 'Selected node is offline. No fallback was used.' : 'Selected node is unavailable for this local runtime.');
      return;
    }
    reconnectFailures += 1;
    setState(duringPoll && reconnectFailures < 3 ? 'reconnecting' : 'error', duringPoll && reconnectFailures < 3 ? 'Connection interrupted. Reconnecting…' : 'Trace data is unavailable.');
  }

  async function loadInitial() {
    setState('loading', 'Loading traces for the selected workspace and node…');
    refreshButton.disabled = true;
    try {
      const payload = await requestJson(historyPath('older', 'latest'));
      const data = payload.data || {};
      rows = Array.isArray(data.rows) ? data.rows.slice(0, MAX_ROWS) : [];
      olderCursor = data.nextCursor || null;
      if (rows.length) newerCursor = 'id:' + rowIdentity(rows[0]);
      else {
        const anchor = await requestJson(historyPath('newer', 'latest'));
        newerCursor = (anchor.data && anchor.data.nextCursor) || 'latest';
      }
      reconnectFailures = 0;
      setState(rows.length ? 'healthy' : 'empty', rows.length ? 'Live trace history connected.' : 'No traces have been recorded for this node.');
      renderRows();
    } catch (error /* browser runtime unknown */) {
      rows = [];
      renderRows();
      handleFailure(error, false);
    } finally {
      refreshButton.disabled = false;
    }
  }

  async function pollNewer() {
    if (polling || root.dataset.traceState === 'offline') return;
    polling = true;
    try {
      const payload = await requestJson(historyPath('newer', newerCursor));
      const data = payload.data || {};
      const additions = Array.isArray(data.rows) ? data.rows : [];
      newerCursor = data.nextCursor || newerCursor;
      if (additions.length) mergeRows(additions, 'prepend');
      reconnectFailures = 0;
      setState(rows.length ? 'healthy' : 'empty', rows.length ? 'Live trace history connected.' : 'No traces have been recorded for this node.');
      renderRows();
    } catch (error /* browser runtime unknown */) {
      handleFailure(error, true);
    } finally {
      polling = false;
    }
  }

  async function loadOlder() {
    if (!olderCursor) return;
    olderButton.disabled = true;
    try {
      const payload = await requestJson(historyPath('older', olderCursor));
      const data = payload.data || {};
      mergeRows(Array.isArray(data.rows) ? data.rows : [], 'append');
      olderCursor = data.nextCursor || null;
      renderRows();
    } catch (error /* browser runtime unknown */) {
      handleFailure(error, false);
    } finally {
      olderButton.disabled = !olderCursor;
    }
  }

  refreshButton.addEventListener('click', loadInitial);
  olderButton.addEventListener('click', loadOlder);
  collapseButton.addEventListener('click', () => { view.collapsed = !view.collapsed; persistView(); renderInspector(); });
  fullscreenButton.addEventListener('click', () => { view.fullscreen = !view.fullscreen; persistView(); renderInspector(); });
  closeButton.addEventListener('click', () => { view.open = false; persistView(); renderInspector(); });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && view.open) { view.fullscreen = false; view.open = false; persistView(); renderInspector(); }
  });

  loadInitial();
  window.setInterval(pollNewer, 2500);
})();
`;

export type TraceSiteRenderOptions = {
  workspaceId?: string;
  workspaceHost?: string;
  nodeId?: string;
  assetMode?: 'hono' | 'inline';
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

export function renderTraceSite(options: TraceSiteRenderOptions = {}): string {
  const workspaceId = escapeHtml(options.workspaceId ?? 'workspace-unknown');
  const workspaceHost = escapeHtml(options.workspaceHost ?? 'local workspace');
  const nodeId = escapeHtml(options.nodeId ?? 'node-unselected');
  const inline = options.assetMode === 'inline';
  const styles = inline
    ? `<style>${TRACE_SITE_CSS}</style>`
    : `<link rel="stylesheet" href="/traces/assets/trace.css?v=${TRACE_SITE_ASSET_VERSION}">`;
  const script = inline
    ? `<script>${TRACE_SITE_JAVASCRIPT}</script>`
    : `<script defer src="/traces/assets/trace.js?v=${TRACE_SITE_ASSET_VERSION}"></script>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>Traces · Consuelo OS</title>
  ${styles}
</head>
<body>
  <main class="trace-app" data-trace-app data-workspace-id="${workspaceId}" data-workspace-host="${workspaceHost}" data-node-id="${nodeId}" data-trace-state="loading">
    <header class="trace-header">
      <div><h1>Traces</h1><p>Workspace-scoped execution history from the selected Consuelo OS node.</p></div>
      <div class="trace-node"><span>Selected node</span><code>${nodeId}</code></div>
    </header>
    <section class="trace-toolbar" aria-live="polite">
      <div class="trace-state"><span class="trace-state-dot" aria-hidden="true"></span><span data-trace-state-label>Loading traces…</span></div>
      <div class="trace-actions">
        <button class="trace-button" type="button" data-action="older">Load older</button>
        <button class="trace-button" type="button" data-action="refresh">Refresh</button>
      </div>
    </section>
    <div class="trace-layout">
      <section class="trace-table-panel" aria-label="Trace history">
        <div class="trace-table-wrap">
          <table class="trace-table" data-trace-table>
            <thead><tr><th>Time</th><th>Tool</th><th>Latency</th><th>Tokens</th><th>Branch</th><th>Input</th><th>Output</th><th>Status</th></tr></thead>
            <tbody data-trace-rows><tr><td colspan="8" class="trace-empty">Loading trace history…</td></tr></tbody>
          </table>
        </div>
        <footer class="trace-footer"><span data-trace-count>0 traces</span><span>${workspaceHost}</span></footer>
      </section>
      <aside class="trace-inspector" data-trace-inspector hidden>
        <header class="trace-inspector-header">
          <div><h2 data-inspector-title>Trace detail</h2><code data-inspector-id></code></div>
          <div class="trace-inspector-actions">
            <button class="trace-button" type="button" data-action="collapse">Collapse</button>
            <button class="trace-button" type="button" data-action="fullscreen">Full screen</button>
            <button class="trace-button" type="button" data-action="close" aria-label="Close trace detail">Close</button>
          </div>
        </header>
        <div class="trace-inspector-body" data-inspector-body></div>
      </aside>
    </div>
  </main>
  ${script}
</body>
</html>`;
}
