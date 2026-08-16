import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PRIVATE_WORKSPACE_SESSION_RECOVERY_JAVASCRIPT } from './private-workspace-session-recovery';
import {
  renderWorkspaceChromeBar,
  workspaceChromeClientScript,
  workspaceRouteSwitcherStyles,
  type WorkspaceChromeOptions,
} from './workspace-chrome';

const canonicalAssetDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../assets/vendor/observability-traces-v38',
);

const canonicalAsset = (name: string): string =>
  fs.readFileSync(path.join(canonicalAssetDir, name), 'utf8');

const productionHistoryTransport = `<script id="consuelo-trace-history-transport">
(()=>{const historyRoute='/gateway/traces/recent';const snapshotRoute='/trace-burn-intelligence/live-traces.json';const snapshotUrl=historyRoute+'?direction=older&cursor=latest&limit=100&site=trace-burn-intelligence&sourceMode=local-networked&includeRawPayload=true';const allowed=(url)=>url===snapshotRoute||url===historyRoute||url.startsWith(historyRoute+'?');window.__consueloTraceHistoryTransport={fetchJson(url){if(!allowed(url))return Promise.reject(new Error('Trace history route is not allowed.'));const requestUrl=url===snapshotRoute?snapshotUrl:url;return fetch(requestUrl,{cache:'no-store',credentials:'same-origin',headers:{accept:'application/json'}}).then(response=>response.json().then(payload=>{if(!response.ok||payload?.ok===false)throw new Error(payload?.error?.message||'Trace history request failed.');return url===snapshotRoute?(payload?.data??{rows:[],failures:[]}):payload;}));}};})();
</script>`;

const workspaceNavigation = `<script id="consuelo-trace-workspace-navigation">
${workspaceChromeClientScript().replaceAll('</script', '<\/script')}
</script>`;

const workspaceRouteStyle = `<style id="consuelo-workspace-route-switcher">
${workspaceRouteSwitcherStyles().replaceAll('</style', '<\/style')}
</style>`;

const nodeObservabilityStyle = `<style id="consuelo-trace-node-observability">
#tbmLiveTraceModal .trxNode{min-width:0;display:flex;flex-direction:column;gap:2px;overflow:hidden}
#tbmLiveTraceModal .trxNodeName{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d8d0c1}
#tbmLiveTraceModal .trxNodeRoute{display:block;font:10px/1.1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#918a7f;text-transform:uppercase;letter-spacing:.04em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media(min-width:761px){
  #tbmLiveTraceModal .trxTable{min-width:2160px!important}
  #tbmLiveTraceModal .trxHead,#tbmLiveTraceModal .trxRow{min-width:2160px!important;grid-template-columns:34px 112px 176px 82px 82px minmax(360px,1.1fr) minmax(350px,.96fr) minmax(350px,.96fr) 150px 180px 78px 92px!important}
  #tbmLiveTraceModal .trxSkeletonRows{min-width:2160px!important}
  #tbmLiveTraceModal .trxSkeletonRow{grid-template-columns:34px 112px 176px 82px 82px minmax(360px,1.1fr) minmax(350px,.96fr) minmax(350px,.96fr) 150px 180px 78px 92px!important}
}
@media(max-width:760px){
  #tbmLiveTraceModal.open .trxTable,#tbmLiveTraceModal.open .trxHead,#tbmLiveTraceModal.open .trxRow{min-width:1760px!important}
  #tbmLiveTraceModal.open .trxHead,#tbmLiveTraceModal.open .trxRow{grid-template-columns:34px 140px 156px 82px 76px minmax(280px,1fr) minmax(270px,.9fr) minmax(270px,.9fr) 140px 150px 70px 86px!important}
  #tbmLiveTraceModal .trxSkeletonRows,#tbmLiveTraceModal .trxSkeletonRow{min-width:1760px!important}
  #tbmLiveTraceModal .trxSkeletonRow{grid-template-columns:34px 140px 156px 82px 76px minmax(280px,1fr) minmax(270px,.9fr) minmax(270px,.9fr) 140px 150px 70px 86px!important}
}
</style>`;

const traceWorkspaceIntegrationStyle = `<style id="consuelo-trace-workspace-integration">
#tbmLiveTraceModal[aria-hidden="false"]{display:flex!important;align-items:center!important;justify-content:center!important;padding:14px!important;overflow:hidden!important}
#tbmLiveTraceModal[aria-hidden="false"] .trxShell{width:calc(100vw - 28px)!important;max-width:none!important;height:calc(100dvh - 28px)!important;max-height:none!important;margin:0!important;grid-template-rows:38px minmax(0,1fr)!important}
#tbmLiveTraceModal .trxChrome[data-workspace-chrome]{position:relative!important;z-index:200!important;overflow:visible!important}
#tbmLiveTraceModal .trxChrome[data-workspace-chrome] .workspace-route-control{overflow:visible!important}
#tbmLiveTraceModal .workspace-route-menu{z-index:220!important}
#tbmLiveTraceModal .trxBody{min-width:0!important;min-height:0!important;overflow:hidden!important}
#tbmLiveTraceModal .trxTablePane{min-width:0!important;max-width:100%!important;min-height:0!important;overflow:hidden!important}
#tbmLiveTraceModal .trxTableScroll{width:100%!important;max-width:100%!important;min-width:0!important;overflow:auto!important;overscroll-behavior:contain!important;scroll-padding-inline-end:18px!important}
#tbmLiveTraceModal .trxTable{width:max-content!important;max-width:none!important;padding-right:18px!important;box-sizing:content-box!important}
#tbmLiveTraceModal .trxHead,#tbmLiveTraceModal .trxRow{grid-template-columns:34px 112px 176px 82px 82px minmax(360px,1.1fr) minmax(350px,.96fr) minmax(350px,.96fr) 150px 180px 78px 92px!important}
#tbmLiveTraceModal .trxHead{align-items:center!important}
@media(max-width:760px){#tbmLiveTraceModal[aria-hidden="false"]{padding:0!important;align-items:stretch!important;justify-content:stretch!important}#tbmLiveTraceModal[aria-hidden="false"] .trxShell{width:100%!important;max-width:100%!important;height:100dvh!important;max-height:100dvh!important;margin:0!important;border-radius:0!important;border:0!important;grid-template-rows:38px minmax(0,1fr)!important}#tbmLiveTraceModal .trxBody{grid-row:2!important}#tbmLiveTraceModal .trxTable,#tbmLiveTraceModal .trxHead,#tbmLiveTraceModal .trxRow{min-width:1620px!important}#tbmLiveTraceModal .trxHead,#tbmLiveTraceModal .trxRow{min-width:1620px!important;grid-template-columns:34px 108px 150px 78px 76px 260px 240px 240px 140px 140px 70px 84px!important}#tbmLiveTraceModal .trxHead{height:34px!important;min-height:34px!important}#tbmLiveTraceModal .trxHead>div{height:34px!important;min-height:34px!important;padding:0 10px!important;display:flex!important;align-items:center!important}#tbmLiveTraceModal .trxHead>div:nth-child(2){font-size:13px!important;line-height:1.1!important}#tbmLiveTraceModal[aria-hidden="false"] .trxShell:not(.closed) .trxTablePane{width:100%!important;max-width:100%!important;min-width:0!important}#tbmLiveTraceModal[aria-hidden="false"] .trxShell:not(.closed) .trxResizer{display:none!important}#tbmLiveTraceModal[aria-hidden="false"] .trxShell:not(.closed) .trxRail{display:block!important;position:fixed!important;inset:auto 0 0!important;width:100vw!important;max-width:100vw!important;height:min(82dvh,760px)!important;max-height:calc(100dvh - 56px)!important;z-index:10020!important;border:1px solid rgba(243,234,211,.18)!important;border-bottom:0!important;border-radius:22px 22px 0 0!important;background:#080706!important;box-shadow:0 -24px 80px #000000c7!important;transform:none!important;translate:none!important;overflow:hidden!important}#tbmLiveTraceModal[aria-hidden="false"] .trxShell:not(.closed) .trxRailInner{height:100%!important;max-width:100vw!important;min-width:0!important;overflow-x:hidden!important;overflow-y:auto!important;padding-top:28px!important}#tbmLiveTraceModal[aria-hidden="false"] .trxShell:not(.closed) .tiInspector{width:100%!important;max-width:100%!important;margin:0!important}}
</style>`;

const privateWorkspaceSessionRecovery = `<script id="consuelo-private-workspace-session-recovery">
${PRIVATE_WORKSPACE_SESSION_RECOVERY_JAVASCRIPT.replaceAll('</script', '<\\/script')}
</script>`;

function replaceExactlyOnce(
  html: string,
  pattern: RegExp,
  replacement: string,
  label: string,
): string {
  const matches = html.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)) ?? [];
  if (matches.length !== 1) {
    throw new Error(`Canonical Trace Burn template expected exactly one ${label}; found ${matches.length}.`);
  }
  return html.replace(pattern, () => replacement);
}

function inlineStyle(html: string, sourceHref: string, id: string, css: string): string {
  return replaceExactlyOnce(
    html,
    new RegExp(`<link\\s+rel=["']stylesheet["']\\s+href=["']${escapeRegExp(sourceHref)}["']\\s*\\/?>(?:</link>)?`, 'i'),
    `<style id="${id}">${css.replaceAll('</style', '<\\/style')}</style>`,
    sourceHref,
  );
}

function inlineScript(
  html: string,
  sourceSrc: string,
  id: string,
  javascript: string,
  module = false,
): string {
  const type = module ? ' type="module"' : '';
  return replaceExactlyOnce(
    html,
    new RegExp(`<script(?:\\s+type=["']module["'])?\\s+src=["']${escapeRegExp(sourceSrc)}["']\\s*><\\/script>`, 'i'),
    `<script id="${id}"${type}>${javascript.replaceAll('</script', '<\\/script')}</script>`,
    sourceSrc,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const OBSERVABILITY_TRACES_CLIENT_SCRIPT = String.raw`
    (function mountObservabilityTraces() {
      const root = document.querySelector('[data-observability-app]') || document.body;
      const feedUrl = root.dataset.feedUrl || '/gateway/traces/recent';
      const summaryUrl = root.dataset.summaryUrl || '/gateway/traces/summary';
      const eventsUrl = root.dataset.eventsUrl || '/gateway/traces/events';
      const TRACE_PREFETCH_KEY = 'consuelo:tracing-prefetch:v1';
      const TRACE_PREFETCH_MAX_AGE_MS = 20000;
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
      const readPrefetchedTraceFeed = () => {
        try {
          const raw = sessionStorage.getItem(TRACE_PREFETCH_KEY);
          sessionStorage.removeItem(TRACE_PREFETCH_KEY);
          if (!raw) return null;
          const cached = JSON.parse(raw);
          if (!cached || typeof cached !== 'object') return null;
          if (Date.now() - Number(cached.savedAt || 0) > TRACE_PREFETCH_MAX_AGE_MS) return null;
          if (!cached.payload || typeof cached.payload !== 'object') return null;
          const feed = normalizeGatewayFeed(cached.payload, {});
          return Array.isArray(feed.rows) && feed.rows.length ? feed : null;
        } catch {
          try { sessionStorage.removeItem(TRACE_PREFETCH_KEY); } catch {}
          return null;
        }
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
      const prefetchedFeed = readPrefetchedTraceFeed();
      let state = createState(prefetchedFeed || fallbackFeed);
      if (prefetchedFeed) state.liveState = 'prefetched';
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

export function buildObservabilityTracesSite(
  chromeOptions: WorkspaceChromeOptions = {},
): string {
  let html = canonicalAsset('template.html');

  html = inlineStyle(
    html,
    '/trace-burn-intelligence/_astro/index@_@astro.footerclock.css',
    'trace-burn-v38-base',
    canonicalAsset('base.css'),
  );
  html = inlineStyle(
    html,
    '/trace-burn-intelligence/_astro/trace-mobile-scroll-fix-v9.css',
    'trace-burn-v38-mobile',
    canonicalAsset('mobile.css'),
  );
  html = inlineStyle(
    html,
    '/trace-burn-intelligence/_astro/trace-inspector-v38.css',
    'trace-burn-v38-inspector',
    canonicalAsset('inspector.css'),
  );

  html = replaceExactlyOnce(
    html,
    /<\/head>/i,
    `${nodeObservabilityStyle}${traceWorkspaceIntegrationStyle}${workspaceRouteStyle}${privateWorkspaceSessionRecovery}</head>`,
    'document head close',
  );

  html = replaceExactlyOnce(
    html,
    /<div class="trxChrome">\s*<div class="trxDots">[\s\S]*?<div class="trxChromeActions">[\s\S]*?<\/div>\s*<\/div>\s*<div class="trxBody">/i,
    `${renderWorkspaceChromeBar('tracing', 'Tracing', chromeOptions)} <div class="trxBody">`,
    'workspace chrome',
  );

  html = replaceExactlyOnce(
    html,
    /<div class="trxHead"><div><\/div><div>Time<\/div><div>Tool<\/div><div>Latency<\/div><div>Tokens<\/div><div>Branch<\/div><div>Input<\/div><div>Output<\/div><div>Trace<\/div><div>Status<\/div><div>Cost<\/div><\/div>/i,
    '<div class="trxHead"><div></div><div>Time</div><div>Tool</div><div>Latency</div><div>Tokens</div><div>Branch</div><div>Input</div><div>Output</div><div>Node</div><div>Trace</div><div>Status</div><div>Cost</div></div>',
    'trace table header',
  );

  html = inlineScript(
    html,
    '/trace-burn-intelligence/_astro/trace-table-overview-v22.js',
    'trace-burn-v38-table-overview',
    canonicalAsset('table-overview.js'),
    true,
  );
  html = inlineScript(
    html,
    '/trace-burn-intelligence/_astro/vendor-gsap-3.15.0.min.js',
    'trace-burn-v38-gsap',
    canonicalAsset('gsap.js'),
  );
  html = inlineScript(
    html,
    '/trace-burn-intelligence/_astro/trace-gsap-scroll-v6.js',
    'trace-burn-v38-scroll',
    canonicalAsset('scroll.js'),
  );
  html = inlineScript(
    html,
    '/trace-burn-intelligence/_astro/trace-inspector-v38.js',
    'trace-burn-v38-inspector-runtime',
    canonicalAsset('inspector.js'),
    true,
  );

  html = replaceExactlyOnce(
    html,
    /<script\s+id=["']consuelo-trace-history-transport["'][^>]*>[\s\S]*?<\/script>/i,
    productionHistoryTransport,
    'trusted trace history transport',
  );

  html = replaceExactlyOnce(
    html,
    /<\/body>/i,
    `${workspaceNavigation}</body>`,
    'document body close',
  );

  return html;
}
