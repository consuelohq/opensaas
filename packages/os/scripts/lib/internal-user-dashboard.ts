import {
  INSTALL_DASHBOARD_API_ROUTES,
  installDashboardDiagnosticRoute,
  installDashboardDetailRoute,
  isInstallId,
  type InstallDashboardDeviceSummary,
  type InstallDashboardErrorGroup,
  type InstallDashboardInstallDetail,
  type InstallDashboardInstallSummary,
  type InstallDashboardOverview,
  type InstallDashboardPage,
  type InstallDashboardUserSummary,
  type InstallId,
} from './install-telemetry-contract';
import type { InstallControlPlaneService } from './install-control-plane';
import {
  INTERNAL_DASHBOARD_FIXTURES,
  type InternalDashboardFixtures,
} from './internal-user-dashboard-fixtures';
import {
  renderWorkspaceChromeBar,
  workspaceChromeClientScript,
  workspaceRouteSwitcherStyles,
  workspaceWindowShellStyles,
} from './workspace-chrome';

export { INTERNAL_DASHBOARD_FIXTURES } from './internal-user-dashboard-fixtures';

export const INTERNAL_DASHBOARD_ASSET_VERSION = '2026-08-13.1';

export type InternalDashboardRoute =
  | { kind: 'users'; nav: 'users' }
  | { kind: 'installs'; nav: 'installs' }
  | { kind: 'devices'; nav: 'devices' }
  | { kind: 'errors'; nav: 'errors' }
  | { kind: 'user-detail'; nav: 'users'; id: string }
  | { kind: 'install-detail'; nav: 'installs'; id: string };

export const INTERNAL_DASHBOARD_API_REQUESTS = {
  overview: [
    INSTALL_DASHBOARD_API_ROUTES.overview,
    INSTALL_DASHBOARD_API_ROUTES.users,
    INSTALL_DASHBOARD_API_ROUTES.errors,
  ],
  users: [INSTALL_DASHBOARD_API_ROUTES.users],
  installs: [INSTALL_DASHBOARD_API_ROUTES.installs],
  devices: [INSTALL_DASHBOARD_API_ROUTES.devices],
  errors: [INSTALL_DASHBOARD_API_ROUTES.errors],
  'user-detail': [
    INSTALL_DASHBOARD_API_ROUTES.users,
    INSTALL_DASHBOARD_API_ROUTES.installs,
    INSTALL_DASHBOARD_API_ROUTES.devices,
  ],
} as const;

export function resolveInternalDashboardRoute(pathname: string): InternalDashboardRoute {
  const clean = pathname.split(/[?#]/, 1)[0]?.replace(/\/+$/, '') || '/';
  if (clean === '/' || clean === '/users') return { kind: 'users', nav: 'users' };
  if (clean === '/installs') return { kind: 'installs', nav: 'installs' };
  if (clean === '/devices') return { kind: 'devices', nav: 'devices' };
  if (clean === '/errors') return { kind: 'errors', nav: 'errors' };

  const userMatch = clean.match(/^\/users\/([^/]+)$/);
  if (userMatch?.[1]) {
    return { kind: 'user-detail', nav: 'users', id: decodeURIComponent(userMatch[1]) };
  }

  const installMatch = clean.match(/^\/installs\/([^/]+)$/);
  if (installMatch?.[1]) {
    return { kind: 'install-detail', nav: 'installs', id: decodeURIComponent(installMatch[1]) };
  }

  return { kind: 'users', nav: 'users' };
}

export function internalDashboardRequestsForRoute(route: InternalDashboardRoute): readonly string[] {
  if (route.kind === 'install-detail') {
    return [installDashboardDetailRoute(route.id as InstallId)];
  }
  return INTERNAL_DASHBOARD_API_REQUESTS[route.kind === 'users' ? 'overview' : route.kind];
}

export type InternalDashboardJsonTransport = {
  fetchJson: (path: string) => Promise<unknown>;
};

export function createInternalDashboardFixtureTransport(
  fixtures: InternalDashboardFixtures = INTERNAL_DASHBOARD_FIXTURES,
): InternalDashboardJsonTransport {
  return {
    async fetchJson(path: string): Promise<unknown> {
      const url = new URL(path, 'https://internal.consuelohq.com');
      const route = url.pathname;
      if (route === INSTALL_DASHBOARD_API_ROUTES.overview) return fixtures.overview;
      if (route === INSTALL_DASHBOARD_API_ROUTES.users) return fixtures.users;
      if (route === INSTALL_DASHBOARD_API_ROUTES.installs) return fixtures.installs;
      if (route === INSTALL_DASHBOARD_API_ROUTES.devices) return fixtures.devices;
      if (route === INSTALL_DASHBOARD_API_ROUTES.errors) return fixtures.errors;
      if (route.startsWith(`${INSTALL_DASHBOARD_API_ROUTES.installs}/`)) {
        const installId = decodeURIComponent(route.slice(INSTALL_DASHBOARD_API_ROUTES.installs.length + 1));
        const detail = fixtures.installDetails[installId];
        if (detail) return detail;
      }
      throw new Error(`unsupported internal dashboard fixture route: ${route}`);
    },
  };
}

export const INTERNAL_DASHBOARD_CSS = `
:root {
  color-scheme: dark light;
  --dash-bg: #151515;
  --dash-surface: #1b1b19;
  --dash-surface-2: #20201d;
  --dash-text: #ddd;
  --dash-muted: #a7a39b;
  --dash-faint: #78756f;
  --dash-rule: #444;
  --dash-rule-soft: #302f2c;
  --dash-series: #999;
  --dash-accent: #fc8d62;
  --dash-good: #a8b99a;
  --dash-warn: #d3b47b;
  --dash-bad: #d98b82;
  --dash-link: #e0c1ab;
  --dash-serif: "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  --dash-display: "Bodoni Moda", "Palatino Linotype", Palatino, Georgia, serif;
  --dash-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --dash-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  --site-color-paper: var(--dash-bg);
  --site-color-canvas: #0d0d0c;
  --site-color-ink: var(--dash-text);
  color: var(--dash-text);
  font-family: var(--dash-sans);
}
* { box-sizing: border-box; }
html { min-width: 320px; }
body { min-width: 320px; color: var(--dash-text); }
a { color: inherit; text-decoration-thickness: 1px; text-underline-offset: 4px; }
a:hover { color: var(--dash-link); }
a:focus-visible, button:focus-visible { outline: 2px solid var(--dash-accent); outline-offset: 3px; }
button, input, select { font: inherit; }
code { font-family: var(--dash-mono); overflow-wrap: anywhere; }
.dashboard-shell { width: min(1320px, 100%); margin: 0 auto; padding: 30px 40px 72px; }
.dashboard-masthead { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--dash-rule); }
.dashboard-brand { display: flex; align-items: baseline; gap: 12px; min-width: 0; }
.dashboard-brand a { text-decoration: none; font: 700 12px/1 var(--dash-sans); letter-spacing: .08em; text-transform: uppercase; }
.dashboard-brand span { color: var(--dash-faint); font: 11px/1 var(--dash-mono); letter-spacing: .06em; text-transform: uppercase; }
.dashboard-stamp { color: var(--dash-faint); font: 11px/1.4 var(--dash-mono); text-align: right; }
.dashboard-nav { display: flex; gap: 26px; padding: 17px 0 18px; border-bottom: 1px solid var(--dash-rule-soft); overflow-x: auto; scrollbar-width: none; }
.dashboard-nav::-webkit-scrollbar { display: none; }
.dashboard-nav a { position: relative; flex: 0 0 auto; color: var(--dash-muted); text-decoration: none; font: 11px/1 var(--dash-mono); letter-spacing: .07em; text-transform: uppercase; }
.dashboard-nav a[aria-current="page"] { color: var(--dash-text); }
.dashboard-nav a[aria-current="page"]::after { content: ""; position: absolute; left: 0; right: 0; bottom: -19px; height: 1px; background: var(--dash-accent); }
.dashboard-main { padding-top: clamp(34px, 5vw, 72px); }
.eyebrow { margin: 0 0 14px; color: var(--dash-muted); font: 11px/1.3 var(--dash-mono); letter-spacing: .09em; text-transform: uppercase; }
.finding { max-width: 1000px; margin: 0; font-family: var(--dash-display); font-size: clamp(40px, 6.2vw, 86px); font-weight: 400; line-height: .99; letter-spacing: -.032em; text-wrap: balance; }
.finding-detail { max-width: 820px; margin: 22px 0 0; color: var(--dash-muted); font: 18px/1.55 var(--dash-serif); }
.finding-detail strong { color: var(--dash-text); font-weight: 400; }
.summary-line { display: flex; flex-wrap: wrap; gap: 12px 28px; margin-top: 30px; padding: 15px 0; border-top: 1px solid var(--dash-rule-soft); border-bottom: 1px solid var(--dash-rule-soft); }
.summary-fact { min-width: 130px; }
.summary-fact b { display: block; color: var(--dash-text); font: 28px/1 var(--dash-serif); font-feature-settings: "onum" 1; }
.summary-fact span { display: block; margin-top: 7px; color: var(--dash-faint); font: 10px/1.25 var(--dash-mono); letter-spacing: .06em; text-transform: uppercase; }
.dashboard-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(290px, .9fr); gap: 54px; margin-top: 58px; align-items: start; }
.dashboard-section { min-width: 0; }
.dashboard-section + .dashboard-section { margin-top: 58px; }
.section-rule { border-top: 1px solid var(--dash-rule); padding-top: 18px; }
.section-heading { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 20px; align-items: baseline; margin-bottom: 24px; }
.section-heading h2 { margin: 0; font: 400 clamp(24px, 3vw, 38px)/1.1 var(--dash-serif); letter-spacing: -.018em; }
.section-heading p { margin: 0; max-width: 440px; color: var(--dash-muted); font: 12px/1.5 var(--dash-mono); text-align: right; }
.trend-figure { margin: 0; }
.trend-figure svg { display: block; width: 100%; height: auto; aspect-ratio: 1.5 / 1; overflow: visible; }
.trend-axis { stroke: var(--dash-rule); stroke-width: 1; vector-effect: non-scaling-stroke; }
.trend-reference { stroke: var(--dash-rule); stroke-width: 1; stroke-dasharray: 5 6; opacity: .8; vector-effect: non-scaling-stroke; }
.trend-series-default { fill: none; stroke: var(--dash-series); stroke-width: 1.7; vector-effect: non-scaling-stroke; }
.trend-series-accent { fill: none; stroke: var(--dash-accent); stroke-width: 2; vector-effect: non-scaling-stroke; }
.trend-label, .trend-tick, .trend-reference-label { font-family: var(--dash-sans); font-size: 11px; }
.trend-label { fill: var(--dash-text); }
.trend-label-accent { fill: var(--dash-accent); }
.trend-tick, .trend-reference-label { fill: var(--dash-faint); }
.chart-note { margin: 8px 0 0; color: var(--dash-faint); font: 12px/1.55 var(--dash-serif); }
.activation-table, .data-table { width: 100%; border-collapse: collapse; }
.activation-table th, .activation-table td, .data-table th, .data-table td { padding: 12px 8px 12px 0; border-bottom: 1px solid var(--dash-rule-soft); text-align: left; vertical-align: top; }
.activation-table th, .data-table th { color: var(--dash-faint); font: 10px/1.2 var(--dash-mono); letter-spacing: .065em; text-transform: uppercase; }
.activation-table tbody th { color: var(--dash-text); font: 400 16px/1.3 var(--dash-serif); letter-spacing: 0; text-transform: none; }
.activation-table td, .data-table td { font: 13px/1.45 var(--dash-sans); }
.activation-table td.number, .data-table td.number { text-align: right; padding-right: 0; font-family: var(--dash-serif); font-feature-settings: "onum" 1; }
.activation-rate { color: var(--dash-muted); }
.error-ranking { display: grid; gap: 16px; margin: 0; }
.error-row { display: grid; grid-template-columns: minmax(135px, 1fr) minmax(80px, 1.15fr) 30px; align-items: center; gap: 12px; }
.error-name { min-width: 0; color: var(--dash-muted); font: 10px/1.35 var(--dash-mono); letter-spacing: .025em; overflow-wrap: anywhere; }
.error-track { height: 5px; background: var(--dash-rule-soft); }
.error-fill { display: block; height: 5px; background: var(--dash-series); }
.error-row:first-of-type .error-fill { background: var(--dash-accent); }
.error-count { text-align: right; font: 15px/1 var(--dash-serif); }
.status { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
.status-mark { width: 7px; height: 7px; border-radius: 50%; border: 1px solid currentColor; background: transparent; flex: 0 0 auto; }
.status-text { color: inherit; }
.status-active, .status-completed, .status-installed { color: var(--dash-good); }
.status-authorized, .status-in_progress { color: var(--dash-warn); }
.status-failed, .status-revoked { color: var(--dash-bad); }
.status-degraded, .status-offline { color: var(--dash-warn); }
.status-registered { color: var(--dash-muted); }
.status-active .status-mark, .status-completed .status-mark, .status-installed .status-mark { background: var(--dash-good); }
.status-failed .status-mark, .status-revoked .status-mark { background: var(--dash-bad); }
.data-table-wrap { width: 100%; overflow-x: auto; }
.data-table { min-width: 760px; }
.data-table a { text-decoration-color: var(--dash-rule); }
.primary-cell { min-width: 180px; }
.primary-cell strong { display: block; color: var(--dash-text); font: 400 16px/1.25 var(--dash-serif); }
.primary-cell small, .secondary { display: block; margin-top: 4px; color: var(--dash-faint); font: 10px/1.4 var(--dash-mono); }
.table-empty { padding: 24px 0; color: var(--dash-muted); font-family: var(--dash-serif); }
.mobile-list { display: none; }
.mobile-item { padding: 17px 0; border-bottom: 1px solid var(--dash-rule-soft); }
.mobile-item:first-child { border-top: 1px solid var(--dash-rule-soft); }
.mobile-item-top { display: flex; justify-content: space-between; gap: 16px; align-items: baseline; }
.mobile-item h3 { margin: 0; font: 400 18px/1.25 var(--dash-serif); }
.mobile-item-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 13px; }
.mobile-item-meta span { color: var(--dash-faint); font: 10px/1.4 var(--dash-mono); }
.mobile-item-meta b { display: block; margin-top: 3px; color: var(--dash-text); font-weight: 400; }
.detail-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 28px; align-items: end; }
.detail-header h1 { max-width: 920px; margin: 0; font: 400 clamp(36px, 5vw, 70px)/1 var(--dash-display); letter-spacing: -.03em; overflow-wrap: anywhere; }
.detail-id { color: var(--dash-faint); font: 10px/1.45 var(--dash-mono); text-align: right; max-width: 260px; }
.detail-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; margin-top: 38px; border-top: 1px solid var(--dash-rule); border-bottom: 1px solid var(--dash-rule); }
.detail-fact { padding: 17px 18px 17px 0; }
.detail-fact + .detail-fact { padding-left: 18px; border-left: 1px solid var(--dash-rule-soft); }
.detail-fact span { display: block; color: var(--dash-faint); font: 10px/1.3 var(--dash-mono); text-transform: uppercase; letter-spacing: .055em; }
.detail-fact b, .detail-fact code { display: block; margin-top: 7px; color: var(--dash-text); font: 400 15px/1.4 var(--dash-serif); overflow-wrap: anywhere; }
.detail-layout { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(280px, .75fr); gap: 58px; margin-top: 54px; }
.timeline { list-style: none; margin: 0; padding: 0; }
.timeline li { position: relative; display: grid; grid-template-columns: 110px 14px minmax(0, 1fr); gap: 12px; padding: 0 0 27px; }
.timeline li::after { content: ""; position: absolute; left: 116px; top: 14px; bottom: -1px; width: 1px; background: var(--dash-rule-soft); }
.timeline li:last-child::after { display: none; }
.timeline-time { padding-top: 1px; color: var(--dash-faint); font: 10px/1.35 var(--dash-mono); text-align: right; }
.timeline-mark { position: relative; z-index: 1; width: 9px; height: 9px; margin-top: 3px; border-radius: 50%; border: 1px solid var(--dash-series); background: var(--dash-bg); }
.timeline li[data-outcome="failed"] .timeline-mark { border-color: var(--dash-bad); background: var(--dash-bad); }
.timeline li[data-outcome="succeeded"] .timeline-mark { border-color: var(--dash-good); }
.timeline-copy h3 { margin: 0; font: 400 16px/1.25 var(--dash-serif); }
.timeline-copy p { margin: 5px 0 0; color: var(--dash-muted); font: 11px/1.45 var(--dash-mono); overflow-wrap: anywhere; }
.evidence-list { margin: 0; padding: 0; list-style: none; }
.evidence-list li { padding: 13px 0; border-bottom: 1px solid var(--dash-rule-soft); }
.evidence-list strong { display: block; font: 400 15px/1.3 var(--dash-serif); }
.evidence-list code, .evidence-list span { display: block; margin-top: 5px; color: var(--dash-muted); font: 10px/1.45 var(--dash-mono); }
.back-link { display: inline-block; margin-bottom: 28px; color: var(--dash-muted); font: 10px/1 var(--dash-mono); letter-spacing: .06em; text-transform: uppercase; }
.dashboard-footnote { margin-top: 68px; padding-top: 15px; border-top: 1px solid var(--dash-rule-soft); color: var(--dash-faint); font: 10px/1.5 var(--dash-mono); }
.dashboard-footnote strong { color: var(--dash-muted); font-weight: 400; }
@media (max-width: 960px) {
  .dashboard-shell { padding-inline: 28px; }
  .dashboard-grid, .detail-layout { grid-template-columns: 1fr; gap: 50px; }
  .detail-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .detail-fact:nth-child(3) { border-left: 0; }
  .detail-fact:nth-child(n+3) { border-top: 1px solid var(--dash-rule-soft); }
}
@media (max-width: 760px) {
  .dashboard-shell { padding: 22px 20px 56px; }
  .dashboard-masthead { grid-template-columns: 1fr; gap: 10px; }
  .dashboard-stamp { text-align: left; }
  .dashboard-nav { gap: 22px; }
  .finding { font-size: clamp(39px, 12vw, 62px); }
  .finding-detail { font-size: 17px; }
  .dashboard-grid { margin-top: 46px; }
  .section-heading { grid-template-columns: 1fr; gap: 7px; }
  .section-heading p { text-align: left; }
  .trend-figure { margin-inline: -8px; }
  .data-table-wrap { display: none; }
  .mobile-list { display: block; }
  .detail-header { grid-template-columns: 1fr; align-items: start; }
  .detail-id { text-align: left; max-width: none; }
  .timeline li { grid-template-columns: 76px 14px minmax(0, 1fr); }
  .timeline li::after { left: 82px; }
}
@media (max-width: 420px) {
  .dashboard-shell { padding-inline: 16px; }
  .dashboard-brand { align-items: flex-start; flex-direction: column; gap: 6px; }
  .summary-line { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .summary-fact { min-width: 0; }
  .error-row { grid-template-columns: minmax(110px, 1fr) minmax(52px, .8fr) 24px; gap: 8px; }
  .detail-summary { grid-template-columns: 1fr; }
  .detail-fact + .detail-fact { padding-left: 0; border-left: 0; border-top: 1px solid var(--dash-rule-soft); }
  .mobile-item-meta { grid-template-columns: 1fr; }
  .timeline li { grid-template-columns: 14px minmax(0, 1fr); gap: 11px; }
  .timeline-time { grid-column: 2; grid-row: 1; text-align: left; }
  .timeline-mark { grid-column: 1; grid-row: 1 / span 2; }
  .timeline-copy { grid-column: 2; }
  .timeline li::after { left: 4px; top: 15px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
}
@media (prefers-color-scheme: light) {
  :root {
    --dash-bg: #fffff8;
    --dash-surface: #f7f5ec;
    --dash-surface-2: #efede4;
    --dash-text: #111;
    --dash-muted: #5e5b54;
    --dash-faint: #77736b;
    --dash-rule: #ccc;
    --dash-rule-soft: #e4e0d6;
    --dash-series: #666;
    --dash-accent: #e41a1c;
    --dash-good: #446b4d;
    --dash-warn: #785f2d;
    --dash-bad: #9e3f39;
    --dash-link: #7d302b;
    --site-color-canvas: #e9e4dc;
  }
}
`;

export const INTERNAL_DASHBOARD_JAVASCRIPT = `
(() => {
  const root = document.querySelector('[data-internal-dashboard]');
  if (!root) return;
  root.dataset.enhanced = 'true';
  const generated = root.querySelector('[data-generated-relative]');
  if (generated) {
    const date = new Date(generated.getAttribute('datetime') || '');
    if (!Number.isNaN(date.getTime())) generated.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    const active = root.querySelector('.dashboard-nav a[aria-current="page"]');
    if (active instanceof HTMLElement) { event.preventDefault(); active.focus(); }
  });
})();
`;

export function internalDashboardStyles(): string {
  return `${workspaceWindowShellStyles()}\n${workspaceRouteSwitcherStyles()}\n${INTERNAL_DASHBOARD_CSS}`;
}

export function internalDashboardJavascript(): string {
  return `${workspaceChromeClientScript()}\n${INTERNAL_DASHBOARD_JAVASCRIPT}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

function titleCase(value: string): string {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase());
}

function errorLabel(value: string): string {
  return value.replaceAll('_', ' ');
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, notation: value >= 10_000 ? 'compact' : 'standard' }).format(value);
}

function formatPercent(value: number, base: number): string {
  if (!base) return '0%';
  return `${Math.round((value / base) * 100)}%`;
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: date.getUTCFullYear() === 2026 ? undefined : 'numeric' }).format(date);
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatClock(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(date);
}

function formatDuration(value?: number): string {
  if (value === undefined) return '—';
  if (value >= 60_000) return `${(value / 60_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}s`;
  return `${Math.round(value)}ms`;
}

function statusMarkup(value: string): string {
  const label = titleCase(value);
  const className = value.replace(/[^a-z0-9_]+/gi, '_').toLowerCase();
  return `<span class="status status-${escapeHtml(className)}"><span class="status-mark" aria-hidden="true"></span><span class="status-text">${escapeHtml(label)}</span></span>`;
}

function navMarkup(active: InternalDashboardRoute['nav']): string {
  const item = (href: string, id: InternalDashboardRoute['nav'], label: string): string =>
    `<a href="${href}"${active === id ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<nav class="dashboard-nav" aria-label="Internal dashboard">
    ${item('/users', 'users', 'Users')}
    ${item('/installs', 'installs', 'Installs')}
    ${item('/devices', 'devices', 'Devices')}
    ${item('/errors', 'errors', 'Errors')}
  </nav>`;
}

function trendChart(overview: InstallDashboardOverview): string {
  const rows = overview.trend;
  if (!rows.length) return '<p class="table-empty">No trend data is available.</p>';
  const width = 720;
  const height = 480;
  const margin = { top: 42, right: 108, bottom: 48, left: 48 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const values = rows.flatMap((row) => [row.registeredUsers, row.completedInstalls]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const min = Math.max(0, rawMin - 0.5);
  const max = rawMax + 0.5;
  const span = Math.max(1, max - min);
  const x = (index: number): number => margin.left + (index / Math.max(1, rows.length - 1)) * plotWidth;
  const y = (value: number): number => margin.top + ((max - value) / span) * plotHeight;
  const path = (key: 'registeredUsers' | 'completedInstalls'): string => rows.map((row, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(row[key]).toFixed(1)}`).join(' ');
  const completedAverage = rows.reduce((sum, row) => sum + row.completedInstalls, 0) / rows.length;
  const referenceY = y(completedAverage);
  const last = rows.at(-1)!;
  const lastIndex = rows.length - 1;
  const signups = rows.reduce((sum, row) => sum + row.registeredUsers, 0);
  const completed = rows.reduce((sum, row) => sum + row.completedInstalls, 0);
  const delta = signups - completed;
  const finding = delta > 0
    ? `Thirty-day signup and install trend: ${signups} registrations, ${completed} completed installs; registrations led by ${delta}.`
    : `Thirty-day signup and install trend: ${signups} registrations and ${completed} completed installs moved together.`;

  return `<figure class="trend-figure">
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(finding)}">
      <line class="trend-axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}"></line>
      <line class="trend-axis" x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${margin.left + plotWidth}" y2="${margin.top + plotHeight}"></line>
      <line class="trend-reference" x1="${margin.left}" y1="${referenceY.toFixed(1)}" x2="${margin.left + plotWidth}" y2="${referenceY.toFixed(1)}"></line>
      <text class="trend-reference-label" x="${margin.left + 6}" y="${(referenceY - 7).toFixed(1)}">30d completion avg ${completedAverage.toFixed(1)}/day</text>
      <path class="trend-series-default" d="${path('registeredUsers')}"></path>
      <path class="trend-series-accent" d="${path('completedInstalls')}"></path>
      <text class="trend-label" data-series-label="Registered" x="${(x(lastIndex) + 10).toFixed(1)}" y="${(y(last.registeredUsers) - 7).toFixed(1)}">Registered ${last.registeredUsers}</text>
      <text class="trend-label trend-label-accent" data-series-label="Completed" x="${(x(lastIndex) + 10).toFixed(1)}" y="${(y(last.completedInstalls) + 15).toFixed(1)}">Completed ${last.completedInstalls}</text>
      <text class="trend-tick" x="${margin.left}" y="${height - 17}">${escapeHtml(formatDate(rows[0]!.date))}</text>
      <text class="trend-tick" text-anchor="end" x="${margin.left + plotWidth}" y="${height - 17}">${escapeHtml(formatDate(last.date))}</text>
      <text class="trend-tick" text-anchor="end" x="${margin.left - 9}" y="${margin.top + 4}">${formatNumber(rawMax)}</text>
      <text class="trend-tick" text-anchor="end" x="${margin.left - 9}" y="${margin.top + plotHeight}">${formatNumber(rawMin)}</text>
    </svg>
    <figcaption class="chart-note">Daily registrations and completed installs. The dashed reference is the 30-day completion average; values are directly labeled at the latest point.</figcaption>
  </figure>`;
}

function errorRanking(errors: InstallDashboardErrorGroup[], limit = 5): string {
  const rows = [...errors].sort((a, b) => b.count - a.count).slice(0, limit);
  if (!rows.length) return '<p class="table-empty">No install failures were recorded in this window.</p>';
  const max = Math.max(...rows.map((row) => row.count), 1);
  const summary = rows.map((row) => `${errorLabel(row.errorCode)} ${row.count}`).join(', ');
  return `<figure class="error-ranking" role="img" aria-label="Install failures ranked by error code: ${escapeHtml(summary)}">
    ${rows.map((row) => `<div class="error-row">
      <span class="error-name">${escapeHtml(errorLabel(row.errorCode))}</span>
      <span class="error-track" aria-hidden="true"><span class="error-fill" style="width:${Math.max(4, (row.count / max) * 100).toFixed(1)}%"></span></span>
      <span class="error-count">${formatNumber(row.count)}</span>
    </div>`).join('')}
  </figure>`;
}

function activationTable(overview: InstallDashboardOverview): string {
  const base = overview.activation.registeredUsers;
  const rows = [
    ['Registered', overview.activation.registeredUsers],
    ['Authorized device', overview.activation.authorizedDevices],
    ['Completed install', overview.activation.completedInstalls],
    ['First heartbeat', overview.activation.firstHeartbeats],
    ['Active this week', overview.activation.activeUsers],
  ] as const;
  return `<table class="activation-table" aria-label="Activation progression">
    <thead><tr><th scope="col">Activation progression</th><th scope="col" class="number">People</th><th scope="col" class="number">Of registered</th></tr></thead>
    <tbody>${rows.map(([label, value]) => `<tr><th scope="row">${label}</th><td class="number">${formatNumber(value)}</td><td class="number activation-rate">${formatPercent(value, base)}</td></tr>`).join('')}</tbody>
  </table>`;
}

function userTable(users: InstallDashboardUserSummary[]): string {
  if (!users.length) return '<p class="table-empty">No users match this view.</p>';
  const desktop = `<div class="data-table-wrap"><table class="data-table" aria-label="Recent Consuelo users">
    <thead><tr><th>User</th><th>Activation</th><th class="number">Installs</th><th class="number">Devices</th><th>Joined</th><th>Last seen</th></tr></thead>
    <tbody>${users.map((user) => `<tr>
      <td class="primary-cell"><a href="/users/${encodeURIComponent(user.userId)}"><strong>${escapeHtml(user.displayName ?? user.userId)}</strong></a><small>${escapeHtml(user.email ?? user.userId)}</small></td>
      <td>${statusMarkup(user.activationState)}</td>
      <td class="number">${formatNumber(user.installCount)}</td>
      <td class="number">${formatNumber(user.deviceCount)}</td>
      <td>${escapeHtml(formatDate(user.createdAt))}</td>
      <td>${escapeHtml(formatDateTime(user.lastSeenAt))}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
  const mobile = `<div class="mobile-list" aria-label="Recent Consuelo users">${users.map((user) => `<article class="mobile-item">
    <div class="mobile-item-top"><h3><a href="/users/${encodeURIComponent(user.userId)}">${escapeHtml(user.displayName ?? user.userId)}</a></h3>${statusMarkup(user.activationState)}</div>
    <div class="mobile-item-meta"><span>Joined<b>${escapeHtml(formatDate(user.createdAt))}</b></span><span>Last seen<b>${escapeHtml(formatDateTime(user.lastSeenAt))}</b></span><span>Installs<b>${user.installCount}</b></span><span>Devices<b>${user.deviceCount}</b></span></div>
  </article>`).join('')}</div>`;
  return desktop + mobile;
}

function installTable(installs: InstallDashboardInstallSummary[]): string {
  if (!installs.length) return '<p class="table-empty">No installs match this view.</p>';
  const desktop = `<div class="data-table-wrap"><table class="data-table" aria-label="Consuelo OS installations">
    <thead><tr><th>Install</th><th>Status</th><th>Stage</th><th>Release</th><th>Platform</th><th>Started</th><th>Duration</th></tr></thead>
    <tbody>${installs.map((install) => `<tr>
      <td class="primary-cell"><a href="/installs/${encodeURIComponent(install.installId)}"><strong>${escapeHtml(install.userId ?? 'Anonymous install')}</strong></a><small>${escapeHtml(install.installId)}</small></td>
      <td>${statusMarkup(install.status)}</td>
      <td><span class="secondary">${escapeHtml(titleCase(install.currentStage))}</span>${install.lastErrorCode ? `<small>${escapeHtml(errorLabel(install.lastErrorCode))}</small>` : ''}</td>
      <td>${escapeHtml(install.release ?? '—')}<small class="secondary">${escapeHtml(install.channel ?? '—')}</small></td>
      <td>${escapeHtml([install.platform, install.architecture].filter(Boolean).join(' / ') || '—')}</td>
      <td>${escapeHtml(formatDateTime(install.startedAt))}</td>
      <td>${escapeHtml(formatDuration(install.durationMs))}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
  const mobile = `<div class="mobile-list" aria-label="Consuelo OS installations">${installs.map((install) => `<article class="mobile-item">
    <div class="mobile-item-top"><h3><a href="/installs/${encodeURIComponent(install.installId)}">${escapeHtml(install.userId ?? 'Anonymous install')}</a></h3>${statusMarkup(install.status)}</div>
    <div class="mobile-item-meta"><span>Stage<b>${escapeHtml(titleCase(install.currentStage))}</b></span><span>Release<b>${escapeHtml(install.release ?? '—')}</b></span><span>Started<b>${escapeHtml(formatDateTime(install.startedAt))}</b></span><span>Duration<b>${escapeHtml(formatDuration(install.durationMs))}</b></span></div>
  </article>`).join('')}</div>`;
  return desktop + mobile;
}

function deviceTable(devices: InstallDashboardDeviceSummary[]): string {
  if (!devices.length) return '<p class="table-empty">No devices match this view.</p>';
  const desktop = `<div class="data-table-wrap"><table class="data-table" aria-label="Registered Consuelo OS devices">
    <thead><tr><th>Device</th><th>State</th><th>Connector</th><th>User</th><th>Release channel</th><th>Agents</th><th>Last seen</th></tr></thead>
    <tbody>${devices.map((device) => `<tr>
      <td class="primary-cell"><strong>${escapeHtml(device.displayName ?? device.nodeId)}</strong><small>${escapeHtml(device.nodeId)}</small></td>
      <td>${statusMarkup(device.state)}</td>
      <td>${device.connectorStatus ? statusMarkup(device.connectorStatus) : '—'}</td>
      <td>${device.userId ? `<a href="/users/${encodeURIComponent(device.userId)}">${escapeHtml(device.userId)}</a>` : '—'}</td>
      <td>${escapeHtml(device.channel ?? '—')}</td>
      <td>${escapeHtml(device.agents.join(', ') || 'None')}</td>
      <td>${escapeHtml(formatDateTime(device.lastSeenAt))}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
  const mobile = `<div class="mobile-list" aria-label="Registered Consuelo OS devices">${devices.map((device) => `<article class="mobile-item">
    <div class="mobile-item-top"><h3>${escapeHtml(device.displayName ?? device.nodeId)}</h3>${statusMarkup(device.state)}</div>
    <div class="mobile-item-meta"><span>Connector<b>${escapeHtml(titleCase(device.connectorStatus ?? 'unknown'))}</b></span><span>Channel<b>${escapeHtml(device.channel ?? '—')}</b></span><span>Agents<b>${escapeHtml(device.agents.join(', ') || 'None')}</b></span><span>Last seen<b>${escapeHtml(formatDateTime(device.lastSeenAt))}</b></span></div>
  </article>`).join('')}</div>`;
  return desktop + mobile;
}

function errorTable(errors: InstallDashboardErrorGroup[]): string {
  const sorted = [...errors].sort((a, b) => b.count - a.count);
  return `<div class="data-table-wrap"><table class="data-table" aria-label="Grouped install errors">
    <thead><tr><th>Error</th><th>Impact</th><th class="number">Events</th><th class="number">Installs</th><th class="number">Users</th><th>Latest</th><th>Channel mix</th></tr></thead>
    <tbody>${sorted.map((error) => `<tr>
      <td class="primary-cell"><strong>${escapeHtml(errorLabel(error.errorCode))}</strong><small>${escapeHtml(titleCase(error.stage))}</small></td>
      <td>${statusMarkup(error.impact === 'fatal' ? 'failed' : 'degraded')}</td>
      <td class="number">${formatNumber(error.count)}</td>
      <td class="number">${formatNumber(error.affectedInstalls)}</td>
      <td class="number">${formatNumber(error.affectedUsers)}</td>
      <td>${escapeHtml(formatDateTime(error.latestAt))}</td>
      <td>${escapeHtml(Object.entries(error.channelBreakdown).map(([channel, count]) => `${channel} ${count}`).join(' · '))}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function overviewPage(fixtures: InternalDashboardFixtures): string {
  const { overview } = fixtures;
  const completionRate = formatPercent(overview.installs.completed, overview.installs.started);
  return `<section aria-labelledby="overview-finding">
    <p class="eyebrow">Consuelo internal · 30 day view</p>
    <h1 class="finding" id="overview-finding">${overview.users.registered} people have joined Consuelo. ${overview.installs.completed} finished installing OS. ${overview.users.active7d} were active this week.</h1>
    <p class="finding-detail">Activation is at <strong>${completionRate}</strong> from install start to completed OS setup. The leading failure remains <strong>${escapeHtml(errorLabel(fixtures.errors.items[0]?.errorCode ?? 'none'))}</strong>.</p>
    <div class="summary-line" aria-label="Current overview">
      <div class="summary-fact"><b>${overview.users.registered}</b><span>Registered users</span></div>
      <div class="summary-fact"><b>${overview.users.activated}</b><span>Activated users</span></div>
      <div class="summary-fact"><b>${overview.installs.failed}</b><span>Failed installs</span></div>
      <div class="summary-fact"><b>${overview.devices.online}/${overview.devices.total}</b><span>Devices online</span></div>
    </div>
    <div class="dashboard-grid">
      <div>
        <section class="dashboard-section section-rule" aria-labelledby="trend-title">
          <div class="section-heading"><h2 id="trend-title">Completed installs are tracking new registrations.</h2><p>Daily activity, ${escapeHtml(formatDate(overview.trend[0]?.date))}–${escapeHtml(formatDate(overview.trend.at(-1)?.date))}</p></div>
          ${trendChart(overview)}
        </section>
        <section class="dashboard-section section-rule" aria-labelledby="users-title">
          <div class="section-heading"><h2 id="users-title">Recent users</h2><p>The first support surface: who joined, how far they got, and when we last saw them.</p></div>
          ${userTable(fixtures.users.items)}
        </section>
      </div>
      <aside>
        <section class="dashboard-section section-rule" aria-labelledby="activation-title">
          <div class="section-heading"><h2 id="activation-title">Activation progression</h2></div>
          ${activationTable(overview)}
        </section>
        <section class="dashboard-section section-rule" aria-labelledby="failures-title">
          <div class="section-heading"><h2 id="failures-title">Background service startup is the largest failure cluster.</h2><p>Grouped by stable error code.</p></div>
          ${errorRanking(fixtures.errors.items)}
        </section>
      </aside>
    </div>
  </section>`;
}

function installsPage(fixtures: InternalDashboardFixtures): string {
  const overview = fixtures.overview;
  return `<section aria-labelledby="installs-finding">
    <p class="eyebrow">Installations · ${escapeHtml(overview.window)}</p>
    <h1 class="finding" id="installs-finding">${overview.installs.completed} of ${overview.installs.started} install starts completed; ${overview.installs.failed} failed.</h1>
    <p class="finding-detail">Every row is keyed by <code>install_id</code>, so the same attempt can be correlated with Cloudflare, Sentry, diagnostics, and a canonical user after authorization.</p>
    <section class="dashboard-section section-rule" aria-labelledby="install-table-title">
      <div class="section-heading"><h2 id="install-table-title">Recent installation attempts</h2><p>Completed, failed, in-progress, degraded, and anonymous pre-auth states remain distinct.</p></div>
      ${installTable(fixtures.installs.items)}
    </section>
  </section>`;
}

function devicesPage(fixtures: InternalDashboardFixtures): string {
  const overview = fixtures.overview;
  return `<section aria-labelledby="devices-finding">
    <p class="eyebrow">Devices · current fleet</p>
    <h1 class="finding" id="devices-finding">${overview.devices.online} of ${overview.devices.total} registered devices are online.</h1>
    <p class="finding-detail">Node state is separate from install state. A successful install can later be offline, and a revoked computer stays visible for audit context without appearing healthy.</p>
    <section class="dashboard-section section-rule" aria-labelledby="device-table-title">
      <div class="section-heading"><h2 id="device-table-title">Registered computers</h2><p>Node identity, connector health, release channel, agents, and last heartbeat.</p></div>
      ${deviceTable(fixtures.devices.items)}
    </section>
  </section>`;
}

function errorsPage(fixtures: InternalDashboardFixtures): string {
  const leading = [...fixtures.errors.items].sort((a, b) => b.count - a.count)[0];
  return `<section aria-labelledby="errors-finding">
    <p class="eyebrow">Errors · grouped by stable code</p>
    <h1 class="finding" id="errors-finding">${leading ? escapeHtml(titleCase(leading.errorCode)) : 'No failure cluster'} is the leading install failure.</h1>
    <p class="finding-detail">Counts use the stable telemetry error taxonomy rather than raw exception text, so a release or channel regression remains comparable over time.</p>
    <div class="dashboard-grid">
      <section class="dashboard-section section-rule" aria-labelledby="error-ranking-title">
        <div class="section-heading"><h2 id="error-ranking-title">Failure distribution</h2><p>Direct labels; no legend or decorative grid.</p></div>
        ${errorRanking(fixtures.errors.items)}
      </section>
      <aside class="dashboard-section section-rule" aria-labelledby="error-context-title">
        <div class="section-heading"><h2 id="error-context-title">Compared to what?</h2></div>
        <p class="finding-detail">${fixtures.overview.installs.failed} install sessions failed in the selected overview window. Error events can exceed failed sessions because one attempt may emit more than one grouped failure event.</p>
      </aside>
    </div>
    <section class="dashboard-section section-rule" aria-labelledby="error-table-title">
      <div class="section-heading"><h2 id="error-table-title">Error groups</h2><p>Impact, affected installs/users, latest occurrence, and release-channel mix.</p></div>
      ${errorTable(fixtures.errors.items)}
    </section>
  </section>`;
}

function userDetailPage(fixtures: InternalDashboardFixtures, userId: string): string {
  const user = fixtures.users.items.find((candidate) => candidate.userId === userId);
  if (!user) {
    return `<section><a class="back-link" href="/users">← Users</a><h1 class="finding">User not found.</h1><p class="finding-detail">User detail is derived from the contracted users, installs, and devices read models; there is no separate <code>/users/:id</code> backend API.</p></section>`;
  }
  const installs = fixtures.installs.items.filter((install) => install.userId === user.userId);
  const devices = fixtures.devices.items.filter((device) => device.userId === user.userId);
  return `<section>
    <a class="back-link" href="/users">← Users</a>
    <div class="detail-header"><div><p class="eyebrow">User · ${escapeHtml(user.activationState)}</p><h1>${escapeHtml(user.displayName ?? user.userId)}</h1></div><code class="detail-id">${escapeHtml(user.userId)}</code></div>
    <div class="detail-summary">
      <div class="detail-fact"><span>Activation</span><b>${statusMarkup(user.activationState)}</b></div>
      <div class="detail-fact"><span>Joined</span><b>${escapeHtml(formatDateTime(user.createdAt))}</b></div>
      <div class="detail-fact"><span>Installs</span><b>${user.installCount}</b></div>
      <div class="detail-fact"><span>Devices</span><b>${user.deviceCount}</b></div>
    </div>
    <div class="detail-layout">
      <section class="dashboard-section section-rule"><div class="section-heading"><h2>Install history</h2><p>Derived from the contracted installs list for this canonical user.</p></div>${installTable(installs)}</section>
      <aside class="dashboard-section section-rule"><div class="section-heading"><h2>Devices</h2></div>${deviceTable(devices)}</aside>
    </div>
  </section>`;
}

function evidenceMarkup(detail: InstallDashboardInstallDetail): string {
  const diagnostic = detail.diagnosticBundle.available
    ? `<li><strong>Diagnostic bundle</strong><a href="${escapeHtml(installDashboardDiagnosticRoute(detail.install.installId))}">Download redacted diagnostic</a><code>${escapeHtml(detail.diagnosticBundle.bundleId)}</code><span>Expires ${escapeHtml(formatDateTime(detail.diagnosticBundle.expiresAt))}</span></li>`
    : '<li><strong>Diagnostic bundle</strong><span>Not retained for this install.</span></li>';
  const sentry = detail.evidence.sentryEventIds.length
    ? detail.evidence.sentryEventIds.map((id) => `<li><strong>Sentry evidence</strong><code>${escapeHtml(id)}</code></li>`).join('')
    : '<li><strong>Sentry evidence</strong><span>No Sentry event attached.</span></li>';
  const cloudflare = detail.evidence.cloudflareTraceIds.length
    ? detail.evidence.cloudflareTraceIds.map((id) => `<li><strong>Cloudflare trace</strong><code>${escapeHtml(id)}</code></li>`).join('')
    : '<li><strong>Cloudflare trace</strong><span>No Cloudflare trace attached.</span></li>';
  return `<ul class="evidence-list">${diagnostic}${sentry}${cloudflare}</ul>`;
}

function installDetailPage(fixtures: InternalDashboardFixtures, installId: string): string {
  const detail = fixtures.installDetails[installId];
  const summary = detail?.install ?? fixtures.installs.items.find((candidate) => candidate.installId === installId);
  if (!summary) {
    return `<section><a class="back-link" href="/installs">← Installs</a><h1 class="finding">Install not found.</h1></section>`;
  }
  if (!detail) {
    return `<section><a class="back-link" href="/installs">← Installs</a><div class="detail-header"><div><p class="eyebrow">Install · ${escapeHtml(summary.status)}</p><h1>${escapeHtml(summary.userId ?? 'Anonymous install')}</h1></div><code class="detail-id">${escapeHtml(summary.installId)}</code></div><p class="finding-detail">The install summary exists, but a full timeline is not available for this record.</p></section>`;
  }
  return `<section>
    <a class="back-link" href="/installs">← Installs</a>
    <div class="detail-header"><div><p class="eyebrow">Install · ${escapeHtml(detail.install.status)}</p><h1>${escapeHtml(detail.install.userId ?? 'Anonymous install')}</h1></div><code class="detail-id">${escapeHtml(detail.install.installId)}</code></div>
    <div class="detail-summary">
      <div class="detail-fact"><span>Status</span><b>${statusMarkup(detail.install.status)}</b></div>
      <div class="detail-fact"><span>Current stage</span><b>${escapeHtml(titleCase(detail.install.currentStage))}</b></div>
      <div class="detail-fact"><span>Release</span><code>${escapeHtml(detail.install.release ?? '—')}</code></div>
      <div class="detail-fact"><span>Duration</span><b>${escapeHtml(formatDuration(detail.install.durationMs))}</b></div>
    </div>
    <div class="detail-layout">
      <section class="dashboard-section section-rule" aria-labelledby="timeline-title">
        <div class="section-heading"><h2 id="timeline-title">Install timeline</h2><p>One chronological view keyed by the shared install ID.</p></div>
        <ol class="timeline">${detail.timeline.map((event) => `<li data-outcome="${escapeHtml(event.outcome)}"><time class="timeline-time" datetime="${escapeHtml(event.occurredAt)}">${escapeHtml(formatClock(event.occurredAt))}</time><span class="timeline-mark" aria-hidden="true"></span><div class="timeline-copy"><h3>${escapeHtml(titleCase(event.name.replace('install.', '')))}</h3><p>${escapeHtml(titleCase(event.stage))} · ${escapeHtml(event.outcome)}${event.error ? ` · ${escapeHtml(errorLabel(event.error.code))}` : ''}</p></div></li>`).join('')}</ol>
      </section>
      <aside class="dashboard-section section-rule" aria-labelledby="evidence-title">
        <div class="section-heading"><h2 id="evidence-title">Evidence</h2><p>References only; no admin mutation controls in v1.</p></div>
        ${evidenceMarkup(detail)}
      </aside>
    </div>
  </section>`;
}

function pageMarkup(route: InternalDashboardRoute, fixtures: InternalDashboardFixtures): string {
  if (route.kind === 'users') return overviewPage(fixtures);
  if (route.kind === 'installs') return installsPage(fixtures);
  if (route.kind === 'devices') return devicesPage(fixtures);
  if (route.kind === 'errors') return errorsPage(fixtures);
  if (route.kind === 'user-detail') return userDetailPage(fixtures, route.id);
  return installDetailPage(fixtures, route.id);
}

export type InternalUserDashboardRenderOptions = {
  pathname?: string;
  assetMode?: 'hono' | 'inline';
  fixtureMode?: boolean;
  dataMode?: 'fixture' | 'contract' | 'live';
  fixtures?: InternalDashboardFixtures;
};

export function renderInternalUserDashboard(options: InternalUserDashboardRenderOptions = {}): string {
  const pathname = options.pathname ?? '/users';
  const route = resolveInternalDashboardRoute(pathname);
  const fixtures = options.fixtures ?? INTERNAL_DASHBOARD_FIXTURES;
  const inline = options.assetMode === 'inline';
  const styles = inline
    ? `<style>${internalDashboardStyles()}</style>`
    : `<link rel="stylesheet" href="/internal/assets/dashboard.css?v=${INTERNAL_DASHBOARD_ASSET_VERSION}">`;
  const script = inline
    ? `<script>${internalDashboardJavascript().replaceAll('</script', '<\\/script')}</script>`
    : `<script defer src="/internal/assets/dashboard.js?v=${INTERNAL_DASHBOARD_ASSET_VERSION}"></script>`;
  const fixtureFlag =
    options.dataMode ?? (options.fixtureMode === true ? 'fixture' : 'contract');
  const generatedAt = fixtures.overview.generatedAt;
  const footer =
    fixtureFlag === 'live'
      ? '<footer class="dashboard-footnote"><strong>Live control-plane data.</strong> Read-only Consuelo user, install, device, error, and diagnostic state.</footer>'
      : '<footer class="dashboard-footnote"><strong>Fixture surface.</strong> Branch 5 renders the shared Branch 1 read model only. Authentication, storage, live query APIs, and real evidence links land in the control-plane/integration branches.</footer>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <meta name="theme-color" content="#151515" media="(prefers-color-scheme: dark)">
  <meta name="theme-color" content="#fffff8" media="(prefers-color-scheme: light)">
  <meta name="description" content="Private Consuelo OS user, install, device, and error dashboard.">
  <title>Internal · Consuelo OS</title>
  ${styles}
</head>
<body>
  <div class="workspace-window" data-workspace-shell>
    ${renderWorkspaceChromeBar('internal', 'Internal')}
    <div class="workspace-view" data-workspace-view>
      <div class="dashboard-shell" data-internal-dashboard data-data-mode="${fixtureFlag}">
        <header class="dashboard-masthead">
          <div class="dashboard-brand"><a href="/users">Consuelo OS</a><span>Internal</span></div>
          <div class="dashboard-stamp">Read only · generated <time data-generated-relative datetime="${escapeHtml(generatedAt)}">${escapeHtml(formatDateTime(generatedAt))}</time></div>
        </header>
        ${navMarkup(route.nav)}
        <main class="dashboard-main" id="main-content">${pageMarkup(route, fixtures)}</main>
        ${footer}
      </div>
    </div>
  </div>
  ${script}
</body>
</html>`;
}

async function loadAllDashboardPages<T>(
  load: (cursor?: string) => Promise<InstallDashboardPage<T>>,
): Promise<InstallDashboardPage<T>> {
  try {
    const items: T[] = [];
    let cursor: string | undefined;
    do {
      const page = await load(cursor);
      items.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    return { items };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`internal dashboard pagination failed: ${message}`);
  }
}

export async function loadLiveInternalDashboardData(input: {
  route: InternalDashboardRoute;
  service: InstallControlPlaneService;
  nowMs: number;
}): Promise<InternalDashboardFixtures> {
  try {
    const [overview, users, installs, devices, errors] = await Promise.all([
      input.service.getOverview({ window: '30d', nowMs: input.nowMs }),
      loadAllDashboardPages((cursor) =>
        input.service.listUsers({ nowMs: input.nowMs, limit: 500, cursor }),
      ),
      loadAllDashboardPages((cursor) =>
        input.service.listInstalls({ nowMs: input.nowMs, limit: 500, cursor }),
      ),
      loadAllDashboardPages((cursor) =>
        input.service.listDevices({ nowMs: input.nowMs, limit: 500, cursor }),
      ),
      loadAllDashboardPages((cursor) =>
        input.service.listErrors({
          window: '30d',
          nowMs: input.nowMs,
          limit: 500,
          cursor,
        }),
      ),
    ]);
    const installDetails: Record<string, InstallDashboardInstallDetail> = {};
    if (input.route.kind === 'install-detail' && isInstallId(input.route.id)) {
      const detail = await input.service.getInstallDetail(input.route.id, {
        nowMs: input.nowMs,
      });
      if (detail) installDetails[input.route.id] = detail;
    }
    return { overview, users, installs, devices, errors, installDetails };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`internal dashboard live data load failed: ${message}`);
  }
}

type InternalDashboardPageAuthorizer = (request: Request) => Promise<boolean>;

function internalDashboardResponseHeaders(contentType: string): HeadersInit {
  return {
    'content-type': contentType,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  };
}

export function createInternalUserDashboardPageHandler(input: {
  service: InstallControlPlaneService;
  authorize: InternalDashboardPageAuthorizer;
  now?: () => number;
  expectedHost?: string;
}): (request: Request) => Promise<Response> {
  const now = input.now ?? (() => Date.now());
  const expectedHost = (input.expectedHost ?? 'internal.consuelohq.com').toLowerCase();
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (url.hostname.toLowerCase() !== expectedHost) {
      return new Response('not found', { status: 404 });
    }
    if (request.method !== 'GET') {
      return new Response('method not allowed', {
        status: 405,
        headers: { allow: 'GET', 'cache-control': 'no-store' },
      });
    }
    let authorized = false;
    try {
      authorized = await input.authorize(request);
    } catch {
      authorized = false;
    }
    if (!authorized) {
      return new Response('forbidden', {
        status: 403,
        headers: internalDashboardResponseHeaders('text/plain; charset=utf-8'),
      });
    }
    if (url.pathname === '/internal/assets/dashboard.css') {
      return new Response(internalDashboardStyles(), {
        headers: internalDashboardResponseHeaders('text/css; charset=utf-8'),
      });
    }
    if (url.pathname === '/internal/assets/dashboard.js') {
      return new Response(internalDashboardJavascript(), {
        headers: internalDashboardResponseHeaders(
          'text/javascript; charset=utf-8',
        ),
      });
    }
    const route = resolveInternalDashboardRoute(url.pathname);
    try {
      const fixtures = await loadLiveInternalDashboardData({
        route,
        service: input.service,
        nowMs: now(),
      });
      return new Response(
        renderInternalUserDashboard({
          pathname: url.pathname,
          fixtures,
          dataMode: 'live',
        }),
        {
          status: 200,
          headers: internalDashboardResponseHeaders('text/html; charset=utf-8'),
        },
      );
    } catch {
      return new Response('internal dashboard data unavailable', {
        status: 503,
        headers: internalDashboardResponseHeaders('text/plain; charset=utf-8'),
      });
    }
  };
}
