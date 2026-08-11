const OBSERVABILITY_TRACES_CLIENT_SCRIPT = String.raw`
    (function mountObservabilityTraces() {
      const root = document.querySelector('[data-observability-app]') || document.body;
      const feedUrl = root.dataset.feedUrl || '/gateway/traces/recent';
      const summaryUrl = root.dataset.summaryUrl || '/gateway/traces/summary';
      const eventsUrl = root.dataset.eventsUrl || '/gateway/traces/events';
      const fallbackFeed = { meta: { generatedAt: new Date(0).toISOString(), rowCount: 0, failureCount: 0, tokens: 0, cost: 0 }, rows: [], failures: [] };
      const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] || char);
      const first = (...values) => values.find((value) => value !== undefined && value !== null && String(value).length > 0);
      const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
      const pretty = (value) => {
        if (value === null || value === undefined || value === '') return '—';
        if (typeof value === 'string') return value;
        return JSON.stringify(value, null, 2) || String(value);
      };
      const summarize = (value) => {
        if (typeof value === 'string') return value;
        if (!value || typeof value !== 'object') return '';
        return String(first(value.summary, value.command, value.message, value.path, value.input, value.output, value.code, value.error && value.error.message, pretty(value)) || '');
      };
      const formatCompact = (value) => {
        const n = Number(value || 0);
        if (!Number.isFinite(n)) return '0';
        if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(2) + 'M';
        if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(Math.round(n));
      };
      const timeOnly = (value) => {
        const raw = String(value || '');
        const timeMatch = raw.match(/(?:T|\s)(\d{2}:\d{2}:\d{2})(?:\.\d+)?/);
        if (timeMatch) return timeMatch[1];
        const leading = raw.match(/^(\d{2}:\d{2}:\d{2})/);
        if (leading) return leading[1];
        const date = new Date(raw);
        if (!Number.isNaN(date.getTime())) return date.toISOString().slice(11, 19);
        return raw.slice(0, 8);
      };
      const stableTraceKey = (row) => {
        const metadata = row && row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        return String(first(row && row.recordId, metadata.trace_id, metadata.id, metadata.rowid, row && row.traceId, row && row.idempotencyKey, row && row.id, '') || '');
      };
      const normalizeTraceRow = (row) => {
        const metadata = isObject(row.metadata) ? row.metadata : {};
        const input = summarize(first(row.input, row.inputSummary, row.request, row.args, row.resolvedInputObj));
        const output = summarize(first(row.output, row.outputSummary, row.result, row.response, row.error, row.summary));
        const inputTokens = Number(first(row.inputTokens, row.input_tokens, metadata.inputTokens, 0) || 0);
        const outputTokens = Number(first(row.outputTokens, row.output_tokens, metadata.outputTokens, 0) || 0);
        const tokens = Number(first(row.tokens, row.totalTokens, row.total_tokens, inputTokens + outputTokens, 0) || 0);
        const cost = Number(first(row.cost, row.costUsd, row.totalCostUsd, row.total_cost_usd, 0) || 0);
        const status = String(first(row.status, row.success === false ? 'error' : 'success') || 'success');
        return Object.assign({}, row, {
          branch: String(first(row.branch, row.gitBranch, row.taskSession, metadata.branch, 'no-branch') || 'no-branch'),
          name: String(first(row.name, row.traceName, row.toolName, row.tool, 'unknown') || 'unknown'),
          code: String(first(row.code, row.kind, row.capability, '') || ''),
          status: status === 'ok' ? 'success' : status,
          input,
          output,
          tokens,
          cost,
          costLabel: row.costLabel || '$' + cost.toFixed(4),
          latency: String(first(row.latency, row.duration, row.durationMs ? String(row.durationMs) + 'ms' : undefined, row.duration_ms ? String(row.duration_ms) + 'ms' : undefined, '—') || '—'),
          displayTime: timeOnly(first(row.time, row.startTime, row.startedAt, row.started_at, row.timestamp, row.createdAt))
        });
      };
      const traceFeedSignature = (feed) => {
        const meta = feed && feed.meta ? feed.meta : {};
        return [meta.maxRowid || meta.maxCursor || feed.cursor || 0, meta.rowCount || (feed.rows && feed.rows.length) || 0, meta.failureCount || (feed.failures && feed.failures.length) || 0].join(':');
      };
      const normalizeGatewayFeed = (payload, summaryPayload) => {
        const data = payload && payload.data ? payload.data : payload || {};
        const summaryData = summaryPayload && summaryPayload.data ? summaryPayload.data : summaryPayload || {};
        const rows = Array.isArray(data.recentEvents) ? data.recentEvents : Array.isArray(data.events) ? data.events : Array.isArray(data.rows) ? data.rows : Array.isArray(data.traces) ? data.traces : [];
        const summary = data.summary || summaryData.summary || {};
        return {
          cursor: data.cursor || summaryData.cursor || payload.cursor || summaryPayload.cursor || 'cur_000',
          meta: {
            rowCount: summary.calls || rows.length,
            failureCount: summary.errorPressure || rows.filter((row) => row.success === false || row.status === 'error').length,
            tokens: summary.totalTraceBurn || summary.outputTokens || rows.reduce((sum, row) => sum + Number(row.tokens || row.inputTokens || 0) + Number(row.outputTokens || 0), 0),
            cost: summary.totalCostUsd || rows.reduce((sum, row) => sum + Number(row.costUsd || row.cost || 0), 0),
            maxRowid: data.cursor || summaryData.cursor || payload.cursor || summaryPayload.cursor || 'cur_000'
          },
          rows,
          failures: Array.isArray(data.failures) ? data.failures : []
        };
      };
      const createState = (feed) => {
        const rows = (feed.rows || []).map(normalizeTraceRow);
        return { rows, failures: feed.failures || [], meta: feed.meta || {}, filters: { query: '', branch: null, tool: null, status: null }, selectedKey: null, selectedTrace: null, mode: 'list', page: 1, pageSize: 100, cursor: feed.cursor || 'cur_000', feedSignature: traceFeedSignature(Object.assign({}, feed, { rows })) };
      };
      const traceByKey = (rows, key) => rows.find((row) => stableTraceKey(row) === key) || null;
      const selectTraceByKey = (state, key) => {
        const selectedTrace = traceByKey(state.rows, key);
        return Object.assign({}, state, { selectedKey: selectedTrace ? stableTraceKey(selectedTrace) : state.selectedKey, selectedTrace: selectedTrace || state.selectedTrace, mode: selectedTrace ? 'detail' : state.mode });
      };
      const applyFeed = (state, feed) => {
        const rows = (feed.rows || []).map(normalizeTraceRow);
        const selectedTrace = traceByKey(rows, state.selectedKey) || state.selectedTrace;
        return Object.assign({}, state, { rows, failures: feed.failures || [], meta: feed.meta || {}, selectedTrace, selectedKey: selectedTrace ? stableTraceKey(selectedTrace) : state.selectedKey, page: Math.min(state.page, Math.max(1, Math.ceil(rows.length / state.pageSize))), cursor: feed.cursor || state.cursor, feedSignature: traceFeedSignature(Object.assign({}, feed, { rows })) });
      };
      const mergeTrace = (state, row) => {
        const next = normalizeTraceRow(row);
        const key = stableTraceKey(next);
        const existing = state.rows.filter((candidate) => stableTraceKey(candidate) !== key);
        return applyFeed(state, { cursor: next.cursor || state.cursor, meta: state.meta, failures: state.failures, rows: [next].concat(existing).slice(0, 500) });
      };
      const countBy = (rows, key) => {
        const counts = new Map();
        rows.forEach((row) => {
          const value = key === 'branch' ? row.branch : key === 'tool' ? row.name : row.status;
          counts.set(value, (counts.get(value) || 0) + 1);
        });
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
      };
      const filterRows = (rows, filters) => {
        const query = filters.query.trim().toLowerCase();
        return rows.filter((row) => {
          if (filters.branch && row.branch !== filters.branch) return false;
          if (filters.tool && row.name !== filters.tool) return false;
          if (filters.status && row.status !== filters.status) return false;
          if (!query) return true;
          return [row.displayTime, row.name, row.branch, row.status, row.input, row.output, row.summary, stableTraceKey(row)].map((value) => String(value || '').toLowerCase()).join(' ').includes(query);
        });
      };
      const pageRows = (rows, page, pageSize) => rows.slice((page - 1) * pageSize, page * pageSize);
      let state = createState(fallbackFeed);
      const modal = root.querySelector('[data-trace-modal]');
      const shell = root.querySelector('.trace-shell');
      const set = (selector, text) => { const el = root.querySelector(selector); if (el) el.textContent = text; };
      const renderKpis = () => {
        const meta = state.meta || {};
        set('[data-kpi="trace-count"]', String(meta.rowCount || state.rows.length));
        set('[data-kpi="failure-count"]', String(meta.failureCount || state.rows.filter((row) => row.status === 'error').length));
        set('[data-kpi="tokens"]', formatCompact(meta.tokens || state.rows.reduce((sum, row) => sum + Number(row.tokens || 0), 0)));
        set('[data-kpi="cost"]', '$' + Number(meta.cost || state.rows.reduce((sum, row) => sum + Number(row.cost || 0), 0)).toFixed(2));
        set('[data-feed-health]', (state.liveState || 'gateway') + ' · ' + String(meta.rowCount || state.rows.length) + ' traces');
      };
      const renderFilters = () => {
        const container = root.querySelector('[data-filter-list]');
        if (!container) return;
        const branchButtons = countBy(state.rows, 'branch').slice(0, 10).map(([branch, count]) => '<button class="filter-chip" data-filter-branch="' + escapeHtml(branch) + '"><span>' + escapeHtml(branch) + '</span><b>' + count + '</b></button>').join('');
        const toolButtons = countBy(state.rows, 'tool').slice(0, 10).map(([tool, count]) => '<button class="filter-chip" data-filter-tool="' + escapeHtml(tool) + '"><span>' + escapeHtml(tool) + '</span><b>' + count + '</b></button>').join('');
        container.innerHTML = '<p class="eyebrow">Branches / task sessions</p>' + branchButtons + '<p class="eyebrow tools-label">Tools</p>' + toolButtons;
      };
      const renderRows = () => {
        const body = root.querySelector('[data-trace-rows]');
        if (!body) return;
        const filtered = filterRows(state.rows, state.filters);
        const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
        state.page = Math.min(state.page, totalPages);
        const visible = pageRows(filtered, state.page, state.pageSize);
        body.innerHTML = visible.map((row) => {
          const key = stableTraceKey(row);
          return '<button class="trace-row ' + (state.selectedKey === key ? 'selected' : '') + '" data-trace-key="' + escapeHtml(key) + '"><span class="check"></span><span class="mono time">' + escapeHtml(row.displayTime) + '</span><span class="status ' + (row.status === 'error' ? 'error' : 'success') + '">✤</span><span class="tool">' + escapeHtml(row.name) + '</span><span class="branch">' + escapeHtml(row.branch) + '</span><span class="mono input">' + escapeHtml(row.input) + '</span><span class="mono output">' + escapeHtml(row.output || row.summary) + '</span><span class="mono tokens">' + escapeHtml(formatCompact(row.tokens)) + '</span><span class="mono cost">' + escapeHtml(row.costLabel || '$' + Number(row.cost || 0).toFixed(4)) + '</span><span class="mono latency">' + escapeHtml(row.latency) + '</span></button>';
        }).join('') || '<div class="empty-state">No traces match this view.</div>';
        set('[data-trace-count]', String(filtered.length));
        const page = root.querySelector('[data-page-input]');
        if (page) page.value = String(state.page);
        set('[data-page-count]', String(totalPages));
      };
      const renderInspector = () => {
        const rail = root.querySelector('[data-inspector]');
        if (!rail) return;
        if (state.mode === 'filters' || !state.selectedTrace) {
          rail.innerHTML = '<div class="panel-title"><span>Filters</span><h2>Trace scope</h2><p>Click a branch, tool, or status to isolate. The table stays readable.</p></div><div data-filter-list></div>';
          renderFilters();
          return;
        }
        const row = state.selectedTrace;
        rail.innerHTML = '<div class="panel-title"><span>' + escapeHtml(row.status) + '</span><h2>' + escapeHtml(row.name) + '</h2><p>' + escapeHtml(row.displayTime) + ' · ' + escapeHtml(row.code) + '</p></div><div class="trace-detail-tabs"><button class="active">Preview</button><button>Scores</button><button>Log View</button></div><section class="payload"><h3>Input</h3><pre>' + escapeHtml(row.rawResolvedInputJson || row.rawInputJson || pretty(row.inputObj || row.input)) + '</pre></section><section class="payload"><h3>Output</h3><pre>' + escapeHtml(row.rawResultJson || pretty(row.outputObj || row.output)) + '</pre></section><section class="payload"><h3>Metadata</h3><pre>' + escapeHtml(pretty(row.metadata || {})) + '</pre></section>' + (row.rawStderr ? '<section class="payload"><h3>stderr</h3><pre>' + escapeHtml(row.rawStderr) + '</pre></section>' : '');
      };
      const render = () => {
        renderKpis();
        renderRows();
        renderInspector();
        if (shell) {
          shell.dataset.mode = state.mode;
          shell.dataset.mobileDetail = state.mode === 'detail' ? 'true' : 'false';
        }
      };
      const open = () => {
        modal && modal.classList.add('open');
        state.mode = state.selectedTrace ? 'detail' : 'list';
        render();
      };
      const close = () => modal && modal.classList.remove('open');
      function fetchJson(path) {
        return fetch(path, {
          headers: { accept: 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
        }).then(function (response) {
          if (!response.ok) return Promise.reject(new Error('gateway returned ' + response.status));
          return response.json();
        });
      }
      function refresh() {
        const onFailure = function () {
          state.liveState = 'gateway unavailable';
          set('[data-feed-health]', 'gateway unavailable');
          renderRows();
        };
        return fetchJson(feedUrl + (state.cursor ? '?cursor=' + encodeURIComponent(state.cursor) : '')).then(function (recent) {
          return fetchJson(summaryUrl).then(function (summary) {
            return { recent, summary };
          }, function () {
            return { recent, summary: {} };
          });
        }, onFailure).then(function (payload) {
          if (!payload) return;
          const feed = normalizeGatewayFeed(payload.recent, payload.summary);
          const signature = traceFeedSignature(feed);
          if (signature === state.feedSignature) {
            state.meta = feed.meta;
            renderKpis();
            return;
          }
          state = applyFeed(state, feed);
          state.liveState = 'gateway';
          render();
        });
      }
      function connectEvents() {
        if (!window.EventSource) return window.setInterval(refresh, 15000);
        const source = new EventSource(eventsUrl + '?cursor=' + encodeURIComponent(state.cursor || 'cur_000'), { withCredentials: true });
        const handle = (event) => {
          let message = {};
          try { message = event.data ? JSON.parse(event.data) : {}; }
          catch { state.liveState = 'stale'; set('[data-live-state]', 'stale'); return; }
          if (message.cursor) state.cursor = message.cursor;
          if (message.type === 'snapshot' && Array.isArray(message.traces)) state = applyFeed(state, { cursor: message.cursor, meta: state.meta, failures: state.failures, rows: message.traces.concat(state.rows) });
          if (message.type === 'trace' && message.trace) state = mergeTrace(state, message.trace);
          if (message.type === 'state') state.liveState = message.state || 'live';
          if (message.type === 'keepalive') state.liveState = 'live';
          set('[data-live-state]', state.liveState || 'live');
          render();
        };
        source.addEventListener('snapshot', handle);
        source.addEventListener('trace', handle);
        source.addEventListener('keepalive', handle);
        source.addEventListener('state', handle);
        source.onerror = function () { state.liveState = 'stale'; set('[data-live-state]', 'stale'); };
        return source;
      }
      root.querySelectorAll('[data-open-traces]').forEach((button) => button.addEventListener('click', (event) => { event.preventDefault(); open(); }));
      root.querySelector('[data-close-traces]')?.addEventListener('click', close);
      root.querySelector('[data-show-filters]')?.addEventListener('click', () => { state.mode = 'filters'; render(); });
      root.querySelector('[data-next-page]')?.addEventListener('click', () => { state.page += 1; render(); });
      root.querySelector('[data-prev-page]')?.addEventListener('click', () => { state.page = Math.max(1, state.page - 1); render(); });
      root.querySelector('[data-search]')?.addEventListener('input', (event) => { state.filters.query = event.target.value; state.page = 1; render(); });
      root.addEventListener('click', (event) => {
        const target = event.target;
        const row = target.closest && target.closest('[data-trace-key]');
        if (row) { state = selectTraceByKey(state, row.dataset.traceKey || ''); render(); return; }
        const branch = target.closest && target.closest('[data-filter-branch]');
        if (branch) { state.filters.branch = branch.dataset.filterBranch || null; state.page = 1; state.mode = 'list'; render(); return; }
        const tool = target.closest && target.closest('[data-filter-tool]');
        if (tool) { state.filters.tool = tool.dataset.filterTool || null; state.page = 1; state.mode = 'list'; render(); }
      });
      render();
      refresh().then(connectEvents);
    })();
`;

export function buildObservabilityTracesClientScript(): string {
  return OBSERVABILITY_TRACES_CLIENT_SCRIPT;
}

export function buildObservabilityTracesSite(): string {
  return String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Traces - Observability</title>
  <meta name="description" content="Consuelo Observability traces cockpit." />
  <style>
    :root {
      --bg: #050403;
      --panel: #11100d;
      --panel-2: #171510;
      --line: rgba(243, 234, 211, 0.14);
      --text: #f2ead6;
      --muted: #a69b82;
      --amber: #d7b35e;
      --green: #9fb583;
      --red: #d46f52;
      --trace-time-col: 92px;
      color-scheme: dark;
    }
    * { box-sizing: border-box; }
    html { min-height: 100%; background: var(--bg); }
    body.observability-page { margin: 0; min-height: 100vh; background: radial-gradient(circle at 50% -20%, rgba(215,179,94,.12), transparent 34%), var(--bg); color: var(--text); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    button, input { font: inherit; color: inherit; }
    button { cursor: pointer; }
    .dashboard { max-width: 1420px; margin: 0 auto; padding: 28px; }
    .hero { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: end; margin-bottom: 24px; }
    .eyebrow { text-transform: uppercase; letter-spacing: .18em; color: var(--muted); font-weight: 700; font-size: 12px; }
    h1 { margin: 6px 0 10px; font: 700 clamp(38px, 7vw, 96px)/.86 Georgia, serif; letter-spacing: -.06em; }
    .hero p { max-width: 820px; color: var(--muted); line-height: 1.55; }
    .observability-nav { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
    .nav-chip, .live-pill, .chrome-button { border: 1px solid var(--line); background: var(--panel); border-radius: 999px; padding: 10px 14px; color: var(--green); box-shadow: inset 0 1px rgba(255,255,255,.06); text-decoration: none; }
    .nav-chip[aria-current="page"] { color: var(--amber); background: rgba(215,179,94,.08); }
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .card { border: 1px solid var(--line); background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.012)), var(--panel); border-radius: 18px; padding: 18px; min-height: 138px; }
    .card .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .14em; }
    .card strong { display: block; margin-top: 12px; font-size: 34px; letter-spacing: -.05em; }
    .card span:last-child { color: var(--muted); font-size: 12px; }
    .launch-card { margin-top: 14px; border: 1px solid var(--line); border-radius: 20px; background: linear-gradient(135deg, rgba(215,179,94,.09), rgba(159,181,131,.04)), var(--panel); padding: 18px; display: flex; justify-content: space-between; gap: 18px; align-items: center; }
    .launch-card p { color: var(--muted); margin: 4px 0 0; max-width: 720px; line-height: 1.45; }
    .trace-modal { position: fixed; inset: 0; display: none; place-items: center; padding: 24px; background: rgba(0,0,0,.72); z-index: 100; }
    .trace-modal.open { display: grid; }
    .trace-shell { width: min(1180px, 94vw); height: min(720px, 88vh); border: 1px solid var(--line); background: #090806; border-radius: 16px; overflow: hidden; box-shadow: 0 36px 120px rgba(0,0,0,.7); display: grid; grid-template-rows: 42px 58px minmax(0, 1fr) 38px; }
    .trace-chrome { display: grid; grid-template-columns: 120px 1fr auto; align-items: center; border-bottom: 1px solid var(--line); padding: 0 10px; background: #14120e; }
    .dots { display: flex; gap: 8px; }
    .dots span { width: 10px; height: 10px; border-radius: 50%; background: var(--red); }
    .dots span:nth-child(2) { background: var(--amber); }
    .dots span:nth-child(3) { background: #70aa67; }
    .trace-title { text-align: center; color: var(--muted); letter-spacing: .04em; }
    .trace-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) 142px auto; gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--line); }
    .trace-toolbar input, .trace-window { border: 1px solid var(--line); background: #0d0c09; border-radius: 12px; padding: 0 12px; min-width: 0; }
    .trace-window { display: grid; place-items: center; color: var(--amber); }
    .trace-body { min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 38%); }
    .trace-table-wrap { min-width: 0; overflow: auto; border-right: 1px solid var(--line); }
    .trace-table { min-width: 1560px; }
    .trace-head, .trace-row { display: grid; grid-template-columns: 42px var(--trace-time-col) 56px 132px 218px 250px 292px 88px 84px 88px; align-items: center; }
    .trace-head { position: sticky; top: 0; z-index: 2; background: #14120e; color: var(--muted); font-weight: 700; border-bottom: 1px solid var(--line); }
    .trace-head span, .trace-row span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 12px 10px; }
    .trace-row { width: 100%; border: 0; border-bottom: 1px solid rgba(243,234,211,.09); background: transparent; text-align: left; }
    .trace-row:hover, .trace-row.selected { background: rgba(215,179,94,.1); }
    .check { width: 16px; height: 16px; margin-left: 10px; border: 1px solid rgba(243,234,211,.35); border-radius: 4px; padding: 0 !important; }
    .mono { font-variant-numeric: tabular-nums; }
    .tool { color: var(--amber); }
    .status.success { color: var(--green); }
    .status.error { color: var(--red); }
    .trace-rail { min-width: 0; background: #0d0c09; overflow: auto; }
    .trace-inspector { min-height: 100%; padding: 18px; }
    .panel-title span { display: block; color: var(--muted); text-transform: uppercase; letter-spacing: .16em; font-size: 12px; font-weight: 800; }
    .panel-title h2 { margin: 4px 0; font: 800 22px/1 Georgia, serif; }
    .panel-title p { color: var(--muted); margin: 0 0 16px; line-height: 1.4; }
    .filter-chip { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 12px; border: 1px solid var(--line); background: var(--panel); border-radius: 10px; margin-bottom: 8px; padding: 10px 12px; text-align: left; }
    .filter-chip span { overflow-wrap: anywhere; }
    .tools-label { margin-top: 18px; }
    .trace-detail-tabs { display: flex; gap: 18px; margin: 14px 0; border-bottom: 1px solid var(--line); }
    .trace-detail-tabs button { background: none; border: 0; padding: 0 0 10px; color: var(--muted); }
    .trace-detail-tabs .active { color: var(--text); border-bottom: 2px solid var(--amber); }
    .payload { border: 1px solid rgba(243,234,211,.1); background: #12100d; border-radius: 12px; margin-bottom: 12px; overflow: hidden; }
    .payload h3 { margin: 0; padding: 10px 12px; font-size: 13px; background: rgba(255,255,255,.04); }
    .payload pre { margin: 0; padding: 12px; max-height: 260px; overflow: auto; white-space: pre-wrap; color: #e8deca; font-size: 12px; line-height: 1.5; }
    .trace-footer { display: flex; gap: 14px; align-items: center; padding: 0 12px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; }
    .trace-footer input { width: 52px; height: 26px; text-align: center; border: 1px solid var(--line); background: #15130f; border-radius: 8px; }
    .trace-footer button { border: 1px solid var(--line); background: #15130f; border-radius: 8px; width: 28px; height: 26px; }
    .empty-state { padding: 28px; color: var(--muted); }
    @media (max-width: 760px) {
      .dashboard { padding: 18px; }
      .hero { grid-template-columns: 1fr; }
      .kpis { grid-template-columns: 1fr 1fr; }
      .launch-card { align-items: flex-start; flex-direction: column; }
      .trace-modal.open { padding: 0; place-items: stretch; }
      .trace-shell { width: 100vw; height: 100dvh; max-width: none; max-height: none; border-radius: 0; border: 0; grid-template-rows: 42px 58px minmax(0, 1fr) 42px; }
      .trace-body { grid-template-columns: 1fr; }
      .trace-rail { display: none; }
      .trace-shell[data-mobile-detail="true"] .trace-table-wrap { display: none; }
      .trace-shell[data-mobile-detail="true"] .trace-rail { display: block; }
      .trace-toolbar { grid-template-columns: 1fr; }
      .trace-window { min-height: 36px; }
      .trace-footer { overflow: auto; }
    }
  </style>
</head>
<body class="observability-page">
  <main class="dashboard" data-observability-app data-feed-url="/gateway/traces/recent" data-summary-url="/gateway/traces/summary" data-events-url="/gateway/traces/events">
    <section class="hero">
      <div>
        <div class="eyebrow">Observability</div>
        <h1>Traces</h1>
        <p>Live traces are the first Observability module: real trace rows, raw payloads, token burn, failures, and tool pressure in one lightweight OS surface.</p>
        <nav class="observability-nav" aria-label="Observability sections">
          <a class="nav-chip" aria-current="page" href="/observability/traces">Traces</a>
          <span class="nav-chip" aria-disabled="true">Runs</span>
          <span class="nav-chip" aria-disabled="true">Costs</span>
          <span class="nav-chip" aria-disabled="true">Failures</span>
        </nav>
      </div>
      <button class="live-pill" type="button" data-testid="trace-launcher" data-open-traces>● Live traces</button>
    </section>
    <section class="kpis" aria-label="Observability trace summary">
      <article class="card"><span class="label">Trace rows</span><strong data-kpi="trace-count">0</strong><span data-feed-health>waiting for gateway traces</span></article>
      <article class="card"><span class="label">Failures</span><strong data-kpi="failure-count">0</strong><span>from current gateway window</span></article>
      <article class="card"><span class="label">Token burn</span><strong data-kpi="tokens">0</strong><span>input + output tokens</span></article>
      <article class="card"><span class="label">Estimated cost</span><strong data-kpi="cost">$0.00</strong><span>gateway trace estimate</span></article>
    </section>
    <section class="launch-card" aria-label="Current Observability module">
      <div>
        <div class="eyebrow">Current module</div>
        <h2>Live tracing cockpit</h2>
        <p>The broader Observability dashboard can grow here. Today, this launches the polished Traces module while preserving \`/observability\` as the overall surface.</p>
      </div>
      <button class="live-pill" type="button" data-open-traces>Open traces</button>
    </section>
    <section class="trace-modal" data-trace-modal aria-label="Traces">
      <div class="trace-shell" data-mode="list">
        <header class="trace-chrome">
          <div class="dots" aria-hidden="true"><span></span><span></span><span></span></div>
          <div class="trace-title">Traces</div>
          <button class="chrome-button" type="button" data-show-filters>filters</button>
        </header>
        <div class="trace-toolbar">
          <input data-search placeholder="Search traces..." aria-label="Search traces" />
          <div class="trace-window" data-trace-window>gateway</div>
          <button class="chrome-button" type="button" data-close-traces>close</button>
        </div>
        <div class="trace-body">
          <section class="trace-table-wrap" aria-label="Trace table">
            <div class="trace-table">
              <div class="trace-head">
                <span></span><span>Time</span><span>Type</span><span>Tool name</span><span>Branch</span><span>Input</span><span>Output</span><span>Tokens</span><span>Cost</span><span>Latency</span>
              </div>
              <div data-trace-rows><div class="empty-state">Loading gateway traces...</div></div>
            </div>
          </section>
          <aside class="trace-rail" aria-label="Trace details">
            <div class="trace-inspector" data-inspector></div>
          </aside>
        </div>
        <footer class="trace-footer">
          <span><b data-trace-count>0</b> traces</span>
          <span>Rows per page <b>100</b></span>
          <span>Page <input data-page-input value="1" aria-label="Page" /> of <b data-page-count>1</b></span>
          <button type="button" data-prev-page>‹</button>
          <button type="button" data-next-page>›</button>
          <span data-live-state>stale</span>
        </footer>
      </div>
    </section>
  </main>
  <script>
${OBSERVABILITY_TRACES_CLIENT_SCRIPT}
  </script>
</body>
</html>`;
}
