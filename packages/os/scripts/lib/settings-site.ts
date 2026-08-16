import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { nodesClientScript, nodesSiteStyles, renderNodesContent } from './nodes-site';
import { PRIVATE_WORKSPACE_SESSION_RECOVERY_JAVASCRIPT } from './private-workspace-session-recovery';
import {
  renderWorkspaceChromeBar,
  workspaceChromeClientScript,
  workspaceRouteSwitcherStyles,
  workspaceWindowShellStyles,
  type WorkspaceChromeOptions,
  type WorkspaceSurfaceId,
} from './workspace-chrome';

const overviewAssetDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../assets/vendor/observability-traces-v38',
);
const OVERVIEW_HEATMAP_GSAP = fs.readFileSync(
  path.join(overviewAssetDir, 'gsap.js'),
  'utf8',
).replaceAll('</script>', '<\\/script>');

export type ConfigurationPageId =
  | 'configuration'
  | 'tools'
  | 'nodes'
  | 'environments'
  | 'secrets';

const PAGE_COPY: Record<ConfigurationPageId, {
  title: string;
  description: string;
}> = {
  configuration: {
    title: 'Overview',
    description: 'See live workspace activity, operating readiness, and the agent surfaces available here.',
  },
  tools: {
    title: 'Tools',
    description: 'Control the tools, skills, and workflows available to agents in this workspace.',
  },
  nodes: {
    title: 'Nodes',
    description: 'Choose where Consuelo runs, see what is online, and manage your workspace default.',
  },
  environments: {
    title: 'Environments',
    description: 'Organize configuration by workspace, node, and runtime without exposing private values in the public shell.',
  },
  secrets: {
    title: 'Secrets',
    description: 'Connect credentials to the nodes and tools that need them without exposing secret values to agents.',
  },
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function configurationStyles(): string {
  return `
    :root {
      color-scheme: light dark;
      --site-color-paper: #faf7f2;
      --site-color-ink: #1c1a17;
      --site-color-surface: #fffaf3;
      --site-color-muted: #8a817a;
      --site-color-accent: #c0512f;
      --site-color-secondary: #2f5b4f;
      --site-color-line: rgba(28, 26, 23, 0.14);
      --site-color-line-strong: rgba(28, 26, 23, 0.28);
      --site-color-panel: rgba(28, 26, 23, 0.035);
      --site-color-canvas: #e9e4dc;
      --heat-cell-0: rgba(41, 37, 31, 0.045);
      --heat-cell-1: rgba(164, 66, 37, 0.12);
      --heat-cell-2: rgba(164, 66, 37, 0.20);
      --heat-cell-3: rgba(164, 66, 37, 0.31);
      --heat-cell-4: rgba(164, 66, 37, 0.44);
      --heat-cell-5: rgba(164, 66, 37, 0.64);
      --heat-highlight: #a44225;
      --heat-tooltip-bg: rgba(255, 255, 248, 0.97);
      --heat-tooltip-border: rgba(41, 37, 31, 0.16);
      --heat-tooltip-shadow: 0 18px 55px rgba(49, 37, 24, 0.18);
      --site-font-body: 'displayFont', 'displayFont Fallback', 'Times New Roman', serif;
      --site-font-mono: 'monoFont', 'monoFont Fallback', 'Courier New', monospace;
      background: var(--site-color-paper);
      color: var(--site-color-ink);
      font-family: var(--site-font-body);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --site-color-paper: #0f0f0d;
        --site-color-ink: #f7efe7;
        --site-color-surface: #191814;
        --site-color-muted: #c3b4a7;
        --site-color-accent: #e06b3e;
        --site-color-secondary: #a5b8a7;
        --site-color-line: rgba(255, 247, 235, 0.14);
        --site-color-line-strong: rgba(255, 247, 235, 0.28);
        --site-color-panel: rgba(255, 247, 235, 0.055);
        --site-color-canvas: #0d0d0c;
        --heat-cell-0: #f1e7d50e;
        --heat-cell-1: #f1e7d51a;
        --heat-cell-2: #f1e7d529;
        --heat-cell-3: #f1e7d53d;
        --heat-cell-4: #f1e7d557;
        --heat-cell-5: #c5a46d7a;
        --heat-highlight: #c5a46d;
        --heat-tooltip-bg: rgba(25, 24, 20, 0.96);
        --heat-tooltip-border: rgba(241, 231, 213, 0.16);
        --heat-tooltip-shadow: 0 18px 55px rgba(0, 0, 0, 0.44);
      }
    }
    ${workspaceWindowShellStyles()}
    @view-transition { navigation: auto; }
    ::view-transition-old(workspace-chrome), ::view-transition-new(workspace-chrome) { animation-duration: 90ms; }
    ::view-transition-old(workspace-body), ::view-transition-new(workspace-body) { animation-duration: 140ms; animation-timing-function: ease-out; }
    @media (prefers-reduced-motion: reduce) { ::view-transition-group(*) { animation-duration: 0.01ms !important; } .readiness-fill { transition: none !important; } }
    .identity, .status-pill, code, h3 { font-family: var(--site-font-mono); }
    .identity { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    .nav { display: grid; gap: 8px; }
    .nav a { color: var(--site-color-muted); text-decoration: none; font-size: 14px; padding: 6px 8px; border-left: 2px solid transparent; }
    .nav a:hover, .nav a.is-active { color: var(--site-color-accent); border-left-color: var(--site-color-accent); }
    .nav a:focus:not(:focus-visible) { outline: none; }
    .nav a:focus-visible { outline: 2px solid var(--site-color-accent); outline-offset: 2px; }
    .content { padding: clamp(24px, 4vw, 48px); display: grid; align-content: start; gap: 34px; min-width: 0; }
    h1, h2, h3, p, dl, dd, dt, ul, li { margin: 0; }
    h1 { font-size: clamp(34px, 5vw, 56px); line-height: 0.95; font-weight: 500; }
    h2 { font-size: 24px; font-weight: 500; }
    h3 { font-size: 12px; text-transform: uppercase; color: var(--site-color-muted); margin-bottom: 10px; }
    .hero, .panel-header, .state-panel { display: grid; gap: 10px; max-width: 760px; }
    .state-panel { border: 1px solid var(--site-color-line); background: var(--site-color-panel); padding: 18px; }
    .panel-section { display: grid; gap: 18px; max-width: 1080px; }
    .panel-header p, .muted, .empty { color: var(--site-color-muted); }
    .detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 28px; }
    .detail-grid dt { font-family: var(--site-font-mono); font-size: 11px; text-transform: uppercase; color: var(--site-color-muted); margin-bottom: 4px; }
    .detail-grid dd { font-size: 15px; overflow-wrap: anywhere; }
    .subsection { display: grid; gap: 12px; }
    .table-wrap { overflow-x: auto; }
    table { border-collapse: collapse; min-width: 720px; width: 100%; }
    th, td { padding: 8px 12px 8px 0; text-align: left; vertical-align: top; font-size: 14px; }
    th { font-family: var(--site-font-mono); font-size: 11px; text-transform: uppercase; color: var(--site-color-muted); }
    code { font-size: 12px; word-break: break-all; }
    .status-pill { display: inline-block; padding: 2px 8px; border: 1px solid var(--site-color-line-strong); border-radius: 999px; font-size: 11px; text-transform: uppercase; }
    .status-connected { color: var(--site-color-secondary); }
    .status-muted { color: var(--site-color-muted); }
    .status-warning { color: var(--site-color-accent); }
    .configuration-toggle { margin-right: 8px; }
    .environment-form, .source-control-form { display: grid; gap: 16px; max-width: 880px; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 18px; }
    .inline-check { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; }
    .inline-check input { width: auto; }
    .row-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .row-actions button { padding: 5px 8px; font-size: 12px; }
    .field { display: grid; gap: 6px; }
    .field-wide { grid-column: 1 / -1; }
    .field span { font-family: var(--site-font-mono); font-size: 11px; text-transform: uppercase; color: var(--site-color-muted); }
    input, select, textarea, button { font: inherit; }
    input, select, textarea { width: 100%; border: 1px solid var(--site-color-line-strong); background: var(--site-color-surface); color: var(--site-color-ink); padding: 9px 10px; }
    textarea { min-height: 116px; resize: vertical; font-family: var(--site-font-mono); font-size: 12px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    button { border: 1px solid var(--site-color-line-strong); background: var(--site-color-surface); color: var(--site-color-ink); padding: 8px 12px; cursor: pointer; }
    button:hover { border-color: var(--site-color-accent); color: var(--site-color-accent); }
    button:disabled { cursor: wait; opacity: 0.55; }
    .danger-button { color: var(--site-color-accent); }
    .tools-surface { display: grid; gap: 28px; max-width: 1240px; }
    .tools-lede { display: grid; grid-template-columns: minmax(0, .9fr) minmax(420px, 1.1fr); gap: 42px; align-items: start; border-bottom: 1px solid var(--site-color-line); padding-bottom: 24px; }
    .tools-finding { display: grid; gap: 7px; }
    .tools-finding h2 { font-size: clamp(25px, 3vw, 38px); line-height: 1.04; font-weight: 500; letter-spacing: -.025em; }
    .tools-finding p { color: var(--site-color-muted); max-width: 570px; line-height: 1.45; }
    .availability-plot { display: grid; gap: 13px; min-width: 0; }
    .availability-row { display: grid; grid-template-columns: 88px minmax(160px, 1fr) 78px; gap: 12px; align-items: center; }
    .availability-label, .availability-value { font-family: var(--site-font-mono); font-size: 11px; }
    .availability-label { color: var(--site-color-ink); }
    .availability-value { color: var(--site-color-muted); text-align: right; font-variant-numeric: tabular-nums; }
    .availability-track { height: 6px; background: color-mix(in srgb, var(--site-color-muted) 16%, transparent); overflow: hidden; }
    .availability-fill { display: block; height: 100%; background: var(--site-color-muted); transform-origin: left center; }
    .availability-row[data-complete="true"] .availability-fill { background: var(--site-color-secondary); }
    .tool-controls { display: grid; grid-template-columns: minmax(240px, 1fr) auto auto minmax(150px, .48fr); gap: 12px; align-items: center; }
    .tool-search-wrap { position: relative; }
    .tool-search-wrap span { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--site-color-muted); font-family: var(--site-font-mono); font-size: 11px; pointer-events: none; }
    #tool-search { padding-left: 72px; min-height: 38px; }
    .filter-cluster { display: inline-flex; border: 1px solid var(--site-color-line); padding: 2px; gap: 2px; }
    .filter-cluster button { border: 0; padding: 7px 9px; background: transparent; color: var(--site-color-muted); font-family: var(--site-font-mono); font-size: 10px; text-transform: uppercase; }
    .filter-cluster button[aria-pressed="true"] { background: var(--site-color-panel); color: var(--site-color-ink); }
    .inventory-summary { min-height: 18px; color: var(--site-color-muted); font-family: var(--site-font-mono); font-size: 11px; }
    .tool-inventory { display: grid; border-top: 1px solid var(--site-color-line-strong); }
    .inventory-row { display: grid; grid-template-columns: minmax(190px, 1.15fr) 92px minmax(140px, .85fr) 150px 138px; gap: 16px; align-items: center; min-height: 58px; padding: 10px 0; border-bottom: 1px solid var(--site-color-line); }
    .inventory-row[hidden] { display: none; }
    .inventory-name { min-width: 0; display: grid; gap: 3px; }
    .inventory-name strong { font-size: 16px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .inventory-name small, .inventory-kind, .inventory-meta, .inventory-state { font-family: var(--site-font-mono); font-size: 10px; line-height: 1.35; }
    .inventory-name small, .inventory-kind, .inventory-meta { color: var(--site-color-muted); }
    .inventory-kind { text-transform: uppercase; letter-spacing: .06em; }
    .inventory-state { color: var(--site-color-secondary); }
    .inventory-row[data-enabled="false"] .inventory-state { color: var(--site-color-accent); }
    .inventory-toggle { justify-self: end; display: inline-flex; align-items: center; gap: 8px; color: var(--site-color-ink); font-family: var(--site-font-mono); font-size: 10px; }
    .inventory-toggle input { appearance: none; width: 30px; height: 17px; padding: 0; border: 1px solid var(--site-color-line-strong); border-radius: 999px; background: transparent; position: relative; transition: background 140ms ease; }
    .inventory-toggle input::after { content: ''; position: absolute; width: 11px; height: 11px; top: 2px; left: 2px; border-radius: 50%; background: var(--site-color-muted); transition: transform 140ms ease, background 140ms ease; }
    .inventory-toggle input:checked { background: color-mix(in srgb, var(--site-color-secondary) 18%, transparent); }
    .inventory-toggle input:checked::after { transform: translateX(13px); background: var(--site-color-secondary); }
    .inventory-toggle input:focus-visible { outline: 2px solid var(--site-color-accent); outline-offset: 2px; }
    .inventory-empty { padding: 28px 0; color: var(--site-color-muted); }
    .overview-surface { display: grid; gap: 30px; max-width: 1240px; }
    .overview-heatmap-panel { position: relative; display: grid; gap: 20px; min-width: 0; padding: 2px 0 28px; border-bottom: 1px solid var(--site-color-line); }
    .overview-heatmap-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 28px; align-items: end; }
    .overview-heatmap-copy { display: grid; gap: 7px; }
    .overview-heatmap-copy h2 { max-width: 780px; font-size: clamp(29px, 4vw, 48px); line-height: 1.01; letter-spacing: -.035em; }
    .overview-heatmap-copy p:not(.identity) { color: var(--site-color-muted); line-height: 1.45; }
    .overview-heatmap-summary { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px 18px; color: var(--site-color-muted); font: 11px/1.25 var(--site-font-mono); font-variant-numeric: tabular-nums; }
    .overview-heatmap-summary b { color: var(--site-color-ink); font-weight: 600; }
    .overview-heatmap-scroll { max-width: 100%; overflow-x: auto; overscroll-behavior-inline: contain; scrollbar-width: thin; padding-bottom: 4px; }
    .overview-heatmap-frame { min-width: 760px; display: grid; gap: 7px; }
    .overview-heatmap-hours, .overview-heatmap-row { display: grid; grid-template-columns: 42px repeat(24, minmax(18px, 1fr)); gap: 3px; align-items: center; }
    .overview-heatmap-hours { color: var(--site-color-muted); font: 9px/1 var(--site-font-mono); }
    .overview-heatmap-hours span:not(:first-child) { text-align: center; }
    .overview-heatmap-day { color: var(--site-color-muted); font: 10px/1 var(--site-font-mono); }
    .overview-heat-cell { min-width: 0; min-height: 28px; border: 0; border-radius: 4px; background: var(--heat-cell-0); cursor: default; transition: box-shadow 160ms ease, transform 160ms ease; }
    .overview-heat-cell[data-level="1"] { background: var(--heat-cell-1); }
    .overview-heat-cell[data-level="2"] { background: var(--heat-cell-2); }
    .overview-heat-cell[data-level="3"] { background: var(--heat-cell-3); }
    .overview-heat-cell[data-level="4"] { background: var(--heat-cell-4); }
    .overview-heat-cell[data-level="5"] { background: var(--heat-cell-5); }
    .overview-heat-cell:hover, .overview-heat-cell:focus-visible { outline: none; transform: translateY(-1px); box-shadow: inset 0 0 0 1px var(--heat-highlight), 0 5px 13px color-mix(in srgb, var(--heat-highlight) 16%, transparent); }
    .overview-heatmap-tooltip { position: fixed; z-index: 160; width: min(260px, calc(100vw - 24px)); padding: 12px 13px; border: 1px solid var(--heat-tooltip-border); border-radius: 9px; background: var(--heat-tooltip-bg); box-shadow: var(--heat-tooltip-shadow); backdrop-filter: blur(15px); pointer-events: none; }
    .overview-heatmap-tooltip time { display: block; margin-bottom: 9px; color: var(--heat-highlight); font: 600 11px/1.25 var(--site-font-mono); }
    .overview-heatmap-tooltip dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .overview-heatmap-tooltip dt { color: var(--site-color-muted); font: 9px/1 var(--site-font-mono); text-transform: uppercase; letter-spacing: .06em; }
    .overview-heatmap-tooltip dd { margin-top: 4px; color: var(--site-color-ink); font: 600 12px/1.1 var(--site-font-mono); font-variant-numeric: tabular-nums; }
    .overview-lede { display: grid; grid-template-columns: minmax(0, .9fr) minmax(420px, 1.1fr); gap: 42px; align-items: start; border-bottom: 1px solid var(--site-color-line); padding-bottom: 26px; }
    .overview-finding { display: grid; gap: 8px; }
    .overview-finding h2 { font-size: clamp(26px, 3vw, 40px); line-height: 1.03; font-weight: 500; letter-spacing: -.025em; max-width: 650px; }
    .overview-finding p:not(.identity) { color: var(--site-color-muted); max-width: 600px; line-height: 1.45; }
    .readiness-plot { display: grid; gap: 14px; min-width: 0; padding-top: 2px; }
    .readiness-row { display: grid; grid-template-columns: 112px minmax(170px, 1fr) 84px; gap: 12px; align-items: center; }
    .readiness-label, .readiness-value { font-family: var(--site-font-mono); font-size: 11px; }
    .readiness-label { color: var(--site-color-ink); }
    .readiness-value { color: var(--site-color-muted); text-align: right; font-variant-numeric: tabular-nums; }
    .readiness-track { height: 6px; background: color-mix(in srgb, var(--site-color-muted) 16%, transparent); overflow: hidden; }
    .readiness-fill { display: block; height: 100%; background: var(--site-color-muted); transform-origin: left center; transition: width 240ms ease-out; }
    .readiness-row[data-complete="true"] .readiness-fill { background: var(--site-color-secondary); }
    .overview-context { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 28px; align-items: start; padding-bottom: 22px; border-bottom: 1px solid var(--site-color-line); }
    .overview-context-copy { display: grid; gap: 8px; }
    .overview-context-copy p { color: var(--site-color-muted); max-width: 720px; line-height: 1.45; }
    .overview-context-link { color: var(--site-color-ink); font-family: var(--site-font-mono); font-size: 11px; white-space: nowrap; }
    .overview-tool-link { display: flex; align-items: baseline; justify-content: space-between; gap: 22px; max-width: 1080px; border-top: 1px solid var(--site-color-line); border-bottom: 1px solid var(--site-color-line); padding: 18px 0; }
    .overview-tool-link a { color: var(--site-color-ink); font-family: var(--site-font-mono); font-size: 11px; }
    @media (max-width: 980px) {
      .overview-lede { grid-template-columns: 1fr; gap: 22px; }
      .tools-lede { grid-template-columns: 1fr; gap: 22px; }
      .tool-controls { grid-template-columns: 1fr; }
      .filter-cluster { width: 100%; overflow-x: auto; }
      .inventory-row { grid-template-columns: minmax(0, 1fr) 80px 120px; }
      .inventory-meta { display: none; }
      .inventory-toggle { grid-column: 3; }
    }
    @media (max-width: 620px) {
      .overview-heatmap-head { grid-template-columns: 1fr; gap: 11px; }
      .overview-heatmap-summary { justify-content: flex-start; }
      .overview-heatmap-frame { min-width: 620px; }
      .overview-heatmap-hours, .overview-heatmap-row { grid-template-columns: 34px repeat(24, minmax(14px, 1fr)); gap: 2px; }
      .overview-heat-cell { min-height: 20px; }
      .readiness-row { grid-template-columns: 88px minmax(90px, 1fr) 70px; }
      .overview-context { grid-template-columns: 1fr; gap: 12px; }
      .availability-row { grid-template-columns: 72px minmax(90px, 1fr) 68px; }
      .inventory-row { grid-template-columns: minmax(0, 1fr) auto; gap: 8px 12px; padding: 13px 0; }
      .inventory-kind { grid-column: 1; }
      .inventory-state { grid-column: 1; }
      .inventory-toggle { grid-column: 2; grid-row: 1 / span 3; }
    }
    .environment-card { border: 1px solid var(--site-color-line); background: var(--site-color-panel); padding: 18px; display: grid; gap: 14px; }
    .environment-card-header { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
    .environment-list { display: grid; gap: 14px; }
    .metadata-list { display: flex; flex-wrap: wrap; gap: 7px; }
    .metadata-list code { border: 1px solid var(--site-color-line); padding: 3px 6px; }
    .nodes-toolbar { display: flex; align-items: end; justify-content: space-between; gap: 18px; max-width: 1080px; }
    .nodes-toolbar-copy { display: grid; gap: 8px; max-width: 650px; }
    .primary-button { background: var(--site-color-ink); color: var(--site-color-paper); border-color: var(--site-color-ink); }
    .primary-button:hover { background: var(--site-color-accent); color: var(--site-color-paper); border-color: var(--site-color-accent); }
    .node-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; max-width: 1080px; }
    .node-card { border: 1px solid var(--site-color-line); background: var(--site-color-surface); padding: 20px; display: grid; gap: 18px; min-height: 190px; }
    .node-card.is-default { border-color: var(--site-color-accent); box-shadow: inset 3px 0 0 var(--site-color-accent); }
    .node-card-header { display: flex; align-items: start; justify-content: space-between; gap: 18px; }
    .node-card-title { display: grid; gap: 6px; }
    .node-card-title strong { font-size: 20px; font-weight: 500; }
    .node-badges { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
    .node-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; }
    .node-meta-item { display: grid; gap: 3px; }
    .node-meta-item span:first-child { font-family: var(--site-font-mono); font-size: 10px; text-transform: uppercase; color: var(--site-color-muted); }
    .node-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: auto; }
    .presence { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; }
    .presence-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--site-color-muted); }
    .presence-online .presence-dot { background: var(--site-color-secondary); }
    .presence-stale .presence-dot { background: var(--site-color-accent); }
    .node-feedback { min-height: 20px; }
    dialog { width: min(980px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; border: 1px solid var(--site-color-line-strong); background: var(--site-color-paper); color: var(--site-color-ink); padding: 0; box-shadow: 0 24px 80px rgba(0,0,0,0.28); }
    dialog::backdrop { background: rgba(0,0,0,0.48); }
    .dialog-shell { display: grid; gap: 28px; padding: clamp(22px, 4vw, 38px); }
    .dialog-header { display: flex; justify-content: space-between; align-items: start; gap: 20px; }
    .dialog-title { display: grid; gap: 8px; max-width: 650px; }
    .dialog-title h2 { font-size: clamp(28px, 4vw, 38px); }
    .dialog-close { width: 38px; height: 38px; padding: 0; display: grid; place-items: center; font-family: var(--site-font-mono); }
    .plan-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
    .plan-option { position: relative; display: block; min-width: 0; }
    .plan-option input { position: absolute; opacity: 0; pointer-events: none; }
    .plan-card { height: 100%; border: 1px solid var(--site-color-line); background: var(--site-color-surface); padding: 16px; display: grid; align-content: start; gap: 10px; cursor: pointer; transition: border-color 120ms ease, transform 120ms ease; }
    .plan-card:hover { border-color: var(--site-color-accent); transform: translateY(-1px); }
    .plan-option input:checked + .plan-card { border-color: var(--site-color-accent); box-shadow: inset 0 0 0 1px var(--site-color-accent); }
    .plan-option input:focus-visible + .plan-card { outline: 2px solid var(--site-color-accent); outline-offset: 2px; }
    .plan-name { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .plan-name strong { font-size: 17px; font-weight: 500; }
    .plan-recommended { font-family: var(--site-font-mono); color: var(--site-color-accent); font-size: 9px; text-transform: uppercase; letter-spacing: .03em; }
    .plan-spec { color: var(--site-color-muted); font-size: 13px; line-height: 1.35; }
    .plan-price { font-size: 20px; min-height: 26px; }
    .plan-price small { color: var(--site-color-muted); font-size: 12px; }
    .cloud-config { display: grid; grid-template-columns: minmax(0, 340px) 1fr; gap: 20px; align-items: end; }
    .cloud-note { border-left: 2px solid var(--site-color-secondary); padding-left: 14px; display: grid; gap: 4px; }
    .provisioning-button:disabled { cursor: not-allowed; }
    .provisioning-progress { border-left: 2px solid var(--site-color-accent); padding: 2px 0 2px 14px; display: grid; gap: 4px; }
    .provisioning-progress strong { font-weight: 500; }
    label { cursor: pointer; }
    [hidden] { display: none !important; }
    .sr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0,0,0,0) !important; white-space: nowrap !important; border: 0 !important; }
    @media (max-width: 900px) {
      .detail-grid { grid-template-columns: 1fr; }
      .form-grid { grid-template-columns: 1fr; }
      .field-wide { grid-column: auto; }
      .environment-card-header { display: grid; }
      .nodes-toolbar, .node-card-header, .node-card-footer, .dialog-header { align-items: stretch; display: grid; }
      .node-list { grid-template-columns: 1fr; }
      .plan-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .cloud-config { grid-template-columns: 1fr; }
    }
    @media (max-width: 560px) {
      .plan-grid { grid-template-columns: 1fr; }
      .node-meta { grid-template-columns: 1fr; }
    }
    @media (prefers-reduced-motion: reduce) {
      .overview-heat-cell { transition: none; }
    }
  ` + workspaceRouteSwitcherStyles() + nodesSiteStyles();
}

function configurationClientScript(): string {
  return `
    const byId = (id) => document.getElementById(id);
    const setHtml = (id, value) => { const element = byId(id); if (element) element.innerHTML = value; };
    const setText = (id, value) => { const element = byId(id); if (element) element.textContent = value; };
    const setHidden = (id, value) => { const element = byId(id); if (element) element.hidden = value; };
    const escapeHtml = (value) => String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('\"', '&quot;')
      .replaceAll("'", '&#39;');
    const statusClass = (status) => {
      if (status === 'connected' || status === 'verified') return 'status-connected';
      if (status === 'not_configured' || status === 'not_detected' || status === 'detected' || status === 'unsupported') return 'status-muted';
      return 'status-warning';
    };
    const pill = (status) => '<span class="status-pill ' + statusClass(status) + '">' + escapeHtml(String(status || 'unknown').replaceAll('_', ' ')) + '</span>';
    const emptyRow = (columns, message) => '<tr><td colspan="' + columns + '" class="empty">' + escapeHtml(message) + '</td></tr>';
    const detail = (label, value, code = false) => '<div><dt>' + escapeHtml(label) + '</dt><dd>' + (code ? '<code>' + escapeHtml(value) + '</code>' : escapeHtml(value)) + '</dd></div>';

    const OVERVIEW_HEATMAP_CACHE_KEY = 'consuelo:overview-heatmap:v1';
    const OVERVIEW_HEATMAP_TTL_MS = 30000;
    const OVERVIEW_HEATMAP_REFRESH_MS = 30000;
    const OVERVIEW_HEATMAP_URL = '/gateway/traces/recent?direction=older&cursor=latest&limit=100&site=trace-burn-intelligence&sourceMode=local-networked&includeRawPayload=false';
    const OVERVIEW_HEATMAP_MAX_PAGES = 24;
    const heatCompact = (value) => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0));
    const heatCost = (value) => '$' + Number(value || 0).toFixed(Number(value || 0) >= 1 ? 2 : 4);
    const heatTimestamp = (row) => row && (row.startTime || row.startedAt || row.started_at || row.time || row.ts || row.timestamp || row.createdAt || row.created_at);
    const heatTokens = (row) => Number(row?.tokens ?? row?.totalTokens ?? row?.total_tokens ?? (Number(row?.inputTokens ?? row?.input_tokens ?? 0) + Number(row?.outputTokens ?? row?.output_tokens ?? 0)));
    const heatCostValue = (row) => Number(row?.cost ?? row?.costUsd ?? row?.totalCostUsd ?? row?.total_cost_usd ?? 0);
    const heatDayKey = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    const heatDayLabel = (date) => new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
    const heatDateLabel = (date) => new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);

    function aggregateOverviewHeatmap(rows) {
      const now = new Date();
      const days = [];
      for (let offset = 6; offset >= 0; offset -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
        days.push({ key: heatDayKey(date), label: heatDayLabel(date), dateLabel: heatDateLabel(date) });
      }
      const allowed = new Set(days.map((day) => day.key));
      const buckets = {};
      for (const day of days) {
        for (let hour = 0; hour < 24; hour += 1) buckets[day.key + ':' + String(hour)] = { calls: 0, tokens: 0, cost: 0 };
      }
      let calls = 0;
      let tokens = 0;
      let cost = 0;
      for (const row of Array.isArray(rows) ? rows : []) {
        const stamp = heatTimestamp(row);
        const date = new Date(String(stamp || ''));
        if (Number.isNaN(date.getTime())) continue;
        const dayKey = heatDayKey(date);
        if (!allowed.has(dayKey)) continue;
        const key = dayKey + ':' + String(date.getHours());
        const bucket = buckets[key];
        if (!bucket) continue;
        const rowTokens = heatTokens(row);
        const rowCost = heatCostValue(row);
        bucket.calls += 1;
        bucket.tokens += rowTokens;
        bucket.cost += rowCost;
        calls += 1;
        tokens += rowTokens;
        cost += rowCost;
      }
      const maxCalls = Math.max(0, ...Object.values(buckets).map((bucket) => Number(bucket.calls || 0)));
      return { days, buckets, totals: { calls, tokens, cost }, maxCalls };
    }

    function overviewHeatLevel(calls, maxCalls) {
      if (!calls || !maxCalls) return 0;
      const ratio = calls / maxCalls;
      if (ratio >= 0.8) return 5;
      if (ratio >= 0.55) return 4;
      if (ratio >= 0.32) return 3;
      if (ratio >= 0.14) return 2;
      return 1;
    }

    function hideOverviewHeatTooltip() {
      const tooltip = byId('overview-heatmap-tooltip');
      if (tooltip) tooltip.hidden = true;
    }

    function showOverviewHeatTooltip(cell) {
      const tooltip = byId('overview-heatmap-tooltip');
      if (!(tooltip instanceof HTMLElement) || !(cell instanceof HTMLElement)) return;
      setText('overview-heatmap-tooltip-time', cell.dataset.time || '');
      setText('overview-heatmap-tooltip-calls', heatCompact(cell.dataset.calls));
      setText('overview-heatmap-tooltip-tokens', heatCompact(cell.dataset.tokens));
      setText('overview-heatmap-tooltip-cost', heatCost(cell.dataset.cost));
      tooltip.hidden = false;
      const rect = cell.getBoundingClientRect();
      window.requestAnimationFrame(() => {
        const left = Math.max(12, Math.min(window.innerWidth - tooltip.offsetWidth - 12, rect.left + rect.width / 2 - tooltip.offsetWidth / 2));
        const preferredTop = rect.top - tooltip.offsetHeight - 10;
        const top = preferredTop >= 12 ? preferredTop : Math.min(window.innerHeight - tooltip.offsetHeight - 12, rect.bottom + 10);
        tooltip.style.left = Math.round(left) + 'px';
        tooltip.style.top = Math.round(top) + 'px';
      });
    }

    function animateOverviewHeatmap(cells) {
      const reduceMotion = globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const gsap = globalThis.gsap;
      if (reduceMotion || !gsap || typeof gsap.fromTo !== 'function') return;
      gsap.fromTo(cells, { opacity: 0.22, scale: 0.88 }, { opacity: 1, scale: 1, duration: 0.28, stagger: 0.006, ease: 'power2.out', clearProps: 'opacity,transform' });
    }

    function renderOverviewHeatmap(aggregate) {
      const grid = byId('overview-heatmap-grid');
      if (!grid || !aggregate || !Array.isArray(aggregate.days)) return;
      const rows = aggregate.days.map((day) => {
        const cells = [];
        for (let hour = 0; hour < 24; hour += 1) {
          const bucket = aggregate.buckets?.[day.key + ':' + String(hour)] || { calls: 0, tokens: 0, cost: 0 };
          const level = overviewHeatLevel(bucket.calls, aggregate.maxCalls);
          const hourLabel = String(hour).padStart(2, '0') + ':00';
          const aria = day.dateLabel + ' ' + hourLabel + ', ' + String(bucket.calls) + ' calls, ' + heatCompact(bucket.tokens) + ' tokens, ' + heatCost(bucket.cost);
          cells.push('<div class="overview-heat-cell" role="gridcell" tabindex="0" data-level="' + String(level) + '" data-time="' + escapeHtml(day.dateLabel + ' · ' + hourLabel) + '" data-calls="' + String(bucket.calls) + '" data-tokens="' + String(bucket.tokens) + '" data-cost="' + String(bucket.cost) + '" aria-label="' + escapeHtml(aria) + '"></div>');
        }
        return '<div class="overview-heatmap-row" role="row"><span class="overview-heatmap-day" role="rowheader">' + escapeHtml(day.label) + '</span>' + cells.join('') + '</div>';
      }).join('');
      grid.innerHTML = rows;
      const totals = aggregate.totals || { calls: 0, tokens: 0, cost: 0 };
      setText('overview-heatmap-calls', heatCompact(totals.calls));
      setText('overview-heatmap-tokens', heatCompact(totals.tokens));
      setText('overview-heatmap-cost', heatCost(totals.cost));
      setText('overview-heatmap-title', totals.calls > 0 ? 'Activity concentrates into a readable weekly rhythm' : 'Live trace activity will appear here');
      grid.setAttribute('aria-label', 'Trace activity by local hour for the last seven days. ' + String(totals.calls) + ' calls, ' + heatCompact(totals.tokens) + ' tokens, ' + heatCost(totals.cost) + '.');
      const cells = Array.from(grid.querySelectorAll('.overview-heat-cell'));
      cells.forEach((cell) => {
        cell.addEventListener('pointerenter', () => showOverviewHeatTooltip(cell));
        cell.addEventListener('pointerleave', hideOverviewHeatTooltip);
        cell.addEventListener('focus', () => showOverviewHeatTooltip(cell));
        cell.addEventListener('blur', hideOverviewHeatTooltip);
      });
      animateOverviewHeatmap(cells);
    }

    function readOverviewHeatmapCache() {
      try {
        const raw = sessionStorage.getItem(OVERVIEW_HEATMAP_CACHE_KEY);
        const cached = raw ? JSON.parse(raw) : null;
        if (!cached || Date.now() - Number(cached.savedAt || 0) > OVERVIEW_HEATMAP_TTL_MS) return null;
        return cached.aggregate || null;
      } catch {
        return null;
      }
    }

    async function readOverviewHeatmapRows() {
      const rows = [];
      let cursor = 'latest';
      const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
      for (let page = 0; page < OVERVIEW_HEATMAP_MAX_PAGES; page += 1) {
        const requestUrl = OVERVIEW_HEATMAP_URL.replace('cursor=latest', 'cursor=' + encodeURIComponent(cursor));
        const response = await fetch(requestUrl, { headers: { accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) throw new Error('trace heatmap returned ' + response.status);
        const payload = await response.json();
        if (!payload || payload.ok === false) throw new Error('trace heatmap payload unavailable');
        const data = payload.data || payload;
        const pageRows = Array.isArray(data.rows) ? data.rows : [];
        rows.push(...pageRows);
        const oldest = pageRows.reduce((value, row) => {
          const time = new Date(String(heatTimestamp(row) || '')).getTime();
          return Number.isFinite(time) ? Math.min(value, time) : value;
        }, Number.POSITIVE_INFINITY);
        if (!data.nextCursor || pageRows.length === 0 || oldest <= cutoff) break;
        cursor = String(data.nextCursor);
      }
      return rows;
    }

    async function refreshOverviewHeatmap() {
      if (!byId('overview-heatmap-grid')) return;
      try {
        const rows = await readOverviewHeatmapRows();
        const aggregate = aggregateOverviewHeatmap(rows);
        renderOverviewHeatmap(aggregate);
        try { sessionStorage.setItem(OVERVIEW_HEATMAP_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), aggregate })); } catch {}
      } catch {
        const grid = byId('overview-heatmap-grid');
        if (grid && !grid.children.length) grid.setAttribute('aria-label', 'Live trace activity is temporarily unavailable.');
      }
    }

    function initOverviewHeatmap() {
      if (!byId('overview-heatmap-grid')) return;
      const cached = readOverviewHeatmapCache();
      if (cached) renderOverviewHeatmap(cached);
      void refreshOverviewHeatmap();
      window.setInterval(() => { if (!document.hidden) void refreshOverviewHeatmap(); }, OVERVIEW_HEATMAP_REFRESH_MS);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) void refreshOverviewHeatmap(); });
    }

    let currentSourceControl = { configured: false, defaultRepositoryId: null, repositories: [] };

    const sourceControlField = (id, value) => {
      const element = byId(id);
      if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) element.value = value ?? '';
    };

    function resetSourceControlForm() {
      const form = byId('source-control-form');
      if (form instanceof HTMLFormElement) form.reset();
      sourceControlField('source-control-provider', 'github');
      sourceControlField('source-control-branch', 'main');
      const defaultInput = byId('source-control-default');
      if (defaultInput instanceof HTMLInputElement) defaultInput.checked = currentSourceControl.repositories.length === 0;
      setText('source-control-form-status', 'Repository root is used when code roots are empty.');
    }

    function editSourceControlRepository(repository) {
      sourceControlField('source-control-id', repository.id || '');
      sourceControlField('source-control-name', repository.name || '');
      sourceControlField('source-control-provider', repository.provider || 'github');
      sourceControlField('source-control-repo', repository.nameWithOwner || '');
      sourceControlField('source-control-branch', repository.defaultBranch || 'main');
      sourceControlField('source-control-connection', repository.connectionRef || '');
      sourceControlField('source-control-roots', (repository.codeRoots || []).join(', '));
      const defaultInput = byId('source-control-default');
      if (defaultInput instanceof HTMLInputElement) defaultInput.checked = currentSourceControl.defaultRepositoryId === repository.id;
      setText('source-control-form-status', 'Editing ' + (repository.nameWithOwner || repository.id) + '.');
      byId('source-control-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function sourceControlRow(repository) {
      const isDefault = currentSourceControl.defaultRepositoryId === repository.id;
      const status = repository.ready ? pill('connected') : pill('not_configured');
      return '<tr data-source-control-id="' + escapeHtml(repository.id) + '">' +
        '<td>' + (isDefault ? '<strong>Default</strong>' : '<span class="muted">—</span>') + '</td>' +
        '<td><code>' + escapeHtml(repository.nameWithOwner || '') + '</code><br>' + status + '</td>' +
        '<td>' + escapeHtml(repository.provider || 'github') + '</td>' +
        '<td><code>' + escapeHtml(repository.defaultBranch || 'main') + '</code></td>' +
        '<td><code>' + escapeHtml(repository.connectionRef || 'not connected') + '</code></td>' +
        '<td><code>' + escapeHtml((repository.codeRoots || []).join(', ') || 'repository root') + '</code></td>' +
        '<td><div class="row-actions"><button type="button" data-source-action="edit">Edit</button>' +
          (!isDefault ? '<button type="button" data-source-action="default">Make default</button>' : '') +
          '<button type="button" class="danger-button" data-source-action="remove">Remove</button></div></td>' +
      '</tr>';
    }

    function bindSourceControlRows() {
      document.querySelectorAll('[data-source-control-id]').forEach((row) => {
        const id = row.getAttribute('data-source-control-id');
        const repository = currentSourceControl.repositories.find((candidate) => candidate.id === id);
        if (!repository) return;
        row.querySelector('[data-source-action="edit"]')?.addEventListener('click', () => editSourceControlRepository(repository));
        row.querySelector('[data-source-action="default"]')?.addEventListener('click', () => void persistSourceControl({
          ...currentSourceControl,
          defaultRepositoryId: repository.id,
        }, 'Default repository updated.'));
        row.querySelector('[data-source-action="remove"]')?.addEventListener('click', () => {
          const repositories = currentSourceControl.repositories.filter((candidate) => candidate.id !== repository.id);
          const defaultRepositoryId = currentSourceControl.defaultRepositoryId === repository.id
            ? (repositories[0]?.id || null)
            : currentSourceControl.defaultRepositoryId;
          void persistSourceControl({ ...currentSourceControl, repositories, defaultRepositoryId }, 'Repository removed.');
        });
      });
    }

    function renderSourceControl(snapshot) {
      currentSourceControl = {
        configured: snapshot?.configured === true,
        defaultRepositoryId: snapshot?.defaultRepositoryId || null,
        repositories: Array.isArray(snapshot?.repositories) ? snapshot.repositories : [],
      };
      const rows = byId('source-control-repository-list');
      if (rows) rows.innerHTML = currentSourceControl.repositories.length
        ? currentSourceControl.repositories.map(sourceControlRow).join('')
        : emptyRow(7, 'No source-control repositories configured. Diffs will stay in setup mode.');
      setText('source-control-summary', currentSourceControl.repositories.length
        ? currentSourceControl.repositories.length + ' repositor' + (currentSourceControl.repositories.length === 1 ? 'y' : 'ies') + (currentSourceControl.configured ? ' · ready' : ' · connection required')
        : 'No repositories connected');
      bindSourceControlRows();
      resetSourceControlForm();
    }

    async function persistSourceControl(next, successMessage) {
      setText('source-control-form-status', 'Saving source-control configuration…');
      try {
        const response = await fetch('/gateway/configuration/source-control', {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({
            defaultRepositoryId: next.defaultRepositoryId || null,
            repositories: next.repositories.map((repository) => ({
              id: repository.id,
              ...(repository.name ? { name: repository.name } : {}),
              provider: repository.provider || 'github',
              nameWithOwner: repository.nameWithOwner,
              defaultBranch: repository.defaultBranch || 'main',
              connectionRef: repository.connectionRef || null,
              codeRoots: Array.isArray(repository.codeRoots) ? repository.codeRoots : [],
            })),
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload || payload.ok === false || !payload.snapshot) {
          throw new Error(payload?.error?.message || 'Source-control update was denied.');
        }
        renderSourceControl(payload.snapshot);
        setText('source-control-form-status', successMessage || 'Source-control configuration updated.');
      } catch (/** @type {unknown} */ error) {
        setText('source-control-form-status', error instanceof Error ? error.message : 'Source-control update failed.');
      }
    }

    function submitSourceControl(event) {
      event.preventDefault();
      const form = event.currentTarget;
      if (!(form instanceof HTMLFormElement)) return;
      const data = new FormData(form);
      const id = String(data.get('id') || '').trim();
      const nameWithOwner = String(data.get('nameWithOwner') || '').trim();
      const connectionRef = String(data.get('connectionRef') || '').trim();
      if (!id || !nameWithOwner || !connectionRef) {
        setText('source-control-form-status', 'Project ID, repository, and connection binding are required.');
        return;
      }
      const repository = {
        id,
        ...(String(data.get('name') || '').trim() ? { name: String(data.get('name')).trim() } : {}),
        provider: String(data.get('provider') || 'github').trim() || 'github',
        nameWithOwner,
        defaultBranch: String(data.get('defaultBranch') || 'main').trim() || 'main',
        connectionRef,
        codeRoots: String(data.get('codeRoots') || '').split(',').map((value) => value.trim()).filter(Boolean),
        ready: true,
      };
      const repositories = currentSourceControl.repositories.filter((candidate) => candidate.id !== id);
      repositories.push(repository);
      const defaultInput = byId('source-control-default');
      const makeDefault = defaultInput instanceof HTMLInputElement && defaultInput.checked;
      const defaultRepositoryId = makeDefault || !currentSourceControl.defaultRepositoryId
        ? id
        : currentSourceControl.defaultRepositoryId;
      void persistSourceControl({ ...currentSourceControl, repositories, defaultRepositoryId }, 'Repository saved.');
    }

    async function loadSourceControl() {
      try {
        const response = await fetch('/gateway/configuration/source-control', { headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error('source-control configuration returned ' + response.status);
        const payload = await response.json();
        if (!payload || payload.ok === false || !payload.snapshot) throw new Error('invalid source-control configuration');
        renderSourceControl(payload.snapshot);
      } catch {
        setText('source-control-summary', 'Source-control configuration unavailable');
        setHtml('source-control-repository-list', emptyRow(7, 'Source-control configuration could not be loaded.'));
      }
    }

    byId('source-control-form')?.addEventListener('submit', (event) => void submitSourceControl(event));
    byId('source-control-form-reset')?.addEventListener('click', resetSourceControlForm);

    function bindToggles() {
      document.querySelectorAll('.configuration-toggle').forEach((input) => {
        input.addEventListener('change', async (event) => {
          const target = event.currentTarget;
          if (!(target instanceof HTMLInputElement)) return;
          const kind = target.dataset.kind;
          const name = target.dataset.name;
          if (!kind || !name) return;
          const requested = target.checked;
          target.disabled = true;
          try {
            const response = await fetch('/gateway/configuration/overlay', {
              method: 'POST',
              headers: { accept: 'application/json', 'content-type': 'application/json' },
              body: JSON.stringify({ kind, name, enabled: requested }),
            });
            if (!response.ok) throw new Error('gateway configuration overlay returned ' + response.status);
            const payload = await response.json();
            if (!payload || typeof payload !== 'object' || payload.ok === false || !payload.snapshot) throw new Error('invalid overlay response');
            renderSnapshot(payload.snapshot);
            setText('toggle-status', 'Updated ' + kind + ' ' + name + '.');
          } catch {
            target.checked = !requested;
            target.disabled = false;
            setText('toggle-status', 'Update denied or unavailable. Use the signed gateway or local Configuration CLI.');
          }
        });
      });
    }

    let toolInventoryItems = [];
    const toolInventoryFilters = { query: '', kind: 'all', state: 'all', category: 'all' };

    function inventoryItems(snapshot) {
      const tools = (Array.isArray(snapshot.tools) ? snapshot.tools : []).map((item) => ({
        id: 'tool:' + item.name,
        name: item.name,
        kind: 'tool',
        category: item.category || (item.core ? 'core' : 'tool'),
        enabled: item.enabled !== false,
        configurable: item.configurable !== false,
        detail: item.core ? 'Core facade tool' : 'Facade tool',
      }));
      const skills = (Array.isArray(snapshot.skills) ? snapshot.skills : []).map((item) => ({
        id: 'skill:' + item.name,
        name: item.name,
        kind: 'skill',
        category: item.category || 'skill',
        enabled: item.enabled !== false,
        configurable: item.configurable !== false,
        detail: item.configurable === false ? 'Managed locally' : 'OS skill',
      }));
      const workflows = (Array.isArray(snapshot.runBooks) ? snapshot.runBooks : []).map((item) => ({
        id: 'workflow:' + item.id,
        name: item.id,
        kind: 'workflow',
        category: 'workflow',
        enabled: item.enabled !== false,
        configurable: true,
        detail: (Array.isArray(item.aliases) && item.aliases.length ? item.aliases.join(', ') : 'No aliases') + ' · ' + String(item.roleCount || 0) + ' roles · ' + String(item.toolCount || 0) + ' tools',
      }));
      return tools.concat(skills, workflows).sort((left, right) => left.name.localeCompare(right.name));
    }

    function renderAvailabilityPlot(items) {
      const plot = byId('tool-availability-plot');
      if (!plot) return;
      const groups = [
        ['Tools', items.filter((item) => item.kind === 'tool')],
        ['Skills', items.filter((item) => item.kind === 'skill')],
        ['Workflows', items.filter((item) => item.kind === 'workflow')],
      ];
      plot.innerHTML = groups.map(([label, group]) => {
        const total = group.length;
        const enabled = group.filter((item) => item.enabled).length;
        const percent = total ? Math.round((enabled / total) * 100) : 0;
        return '<div class="availability-row" data-complete="' + String(total > 0 && enabled === total) + '">' +
          '<span class="availability-label">' + escapeHtml(label) + '</span>' +
          '<span class="availability-track" aria-hidden="true"><span class="availability-fill" style="width:' + String(percent) + '%"></span></span>' +
          '<span class="availability-value">' + String(enabled) + ' / ' + String(total) + '</span>' +
        '</div>';
      }).join('');
      const enabled = items.filter((item) => item.enabled).length;
      setText('tool-availability-title', enabled === items.length && items.length > 0
        ? 'Every agent surface is available'
        : String(enabled) + ' of ' + String(items.length) + ' agent surfaces are enabled');
    }

    function renderOverviewReadiness(snapshot, items) {
      const plot = byId('overview-readiness-plot');
      if (!plot) return;
      const cloud = (Array.isArray(snapshot.cloudConnectors) ? snapshot.cloudConnectors : []).filter((connector) => connector.placeholder !== true);
      const local = Array.isArray(snapshot.localAgents) ? snapshot.localAgents : [];
      const capabilities = Array.isArray(snapshot.capabilities) ? snapshot.capabilities : [];
      const connectedCloud = cloud.filter((connector) => String(connector.status || '').toLowerCase() === 'connected').length;
      const connectedLocal = local.filter((agent) => agent.detected === true || ['connected', 'verified'].includes(String(agent.status || '').toLowerCase())).length;
      const groups = [
        { label: 'Connections', ready: connectedCloud + connectedLocal, total: cloud.length + local.length },
        { label: 'Capabilities', ready: capabilities.filter((capability) => String(capability.status || '').toLowerCase() === 'connected').length, total: capabilities.length },
        { label: 'Agent surfaces', ready: items.filter((item) => item.enabled).length, total: items.length },
      ];
      plot.innerHTML = groups.map((group) => {
        const percent = group.total ? Math.round((group.ready / group.total) * 100) : 0;
        return '<div class="readiness-row" data-complete="' + String(group.total > 0 && group.ready === group.total) + '">' +
          '<span class="readiness-label">' + escapeHtml(group.label) + '</span>' +
          '<span class="readiness-track" aria-hidden="true"><span class="readiness-fill" style="width:' + String(percent) + '%"></span></span>' +
          '<span class="readiness-value">' + String(group.ready) + ' / ' + String(group.total) + '</span>' +
        '</div>';
      }).join('');
      const ready = groups.reduce((sum, group) => sum + group.ready, 0);
      const total = groups.reduce((sum, group) => sum + group.total, 0);
      const biggestGap = groups
        .map((group) => ({ ...group, missing: group.total - group.ready }))
        .sort((left, right) => right.missing - left.missing)[0];
      setText('overview-readiness-title', total > 0 && ready === total
        ? 'Every workspace check is ready'
        : total > 0
          ? String(ready) + ' of ' + String(total) + ' workspace checks are ready'
          : 'Workspace readiness is waiting for data');
      setText('overview-readiness-copy', biggestGap && biggestGap.missing > 0
        ? 'The largest readiness gap is ' + biggestGap.label.toLowerCase() + ': ' + String(biggestGap.ready) + ' of ' + String(biggestGap.total) + ' ready.'
        : 'Connections, capabilities, and agent surfaces are compared side by side against the current workspace state.');
      plot.setAttribute('aria-label', 'Workspace readiness by operating area: ' + groups.map((group) => group.label + ' ' + String(group.ready) + ' of ' + String(group.total)).join('; '));
    }

    function inventoryToggle(item) {
      if (!item.configurable) {
        return '<span class="inventory-toggle"><span>Managed locally</span></span>';
      }
      const action = item.enabled ? 'Disable' : 'Re-enable';
      return '<label class="inventory-toggle"><input type="checkbox" class="configuration-toggle" data-kind="' + escapeHtml(item.kind) + '" data-name="' + escapeHtml(item.name) + '" ' + (item.enabled ? 'checked' : '') + ' aria-label="' + escapeHtml(action + ' ' + item.name) + '"><span>' + action + '</span></label>';
    }

    function inventoryRow(item) {
      const state = item.enabled ? 'Enabled' : 'Available to re-enable';
      return '<article class="inventory-row" data-inventory-row data-enabled="' + String(item.enabled) + '" data-kind="' + escapeHtml(item.kind) + '" data-category="' + escapeHtml(item.category || '') + '">' +
        '<div class="inventory-name"><strong>' + escapeHtml(item.name) + '</strong><small>' + escapeHtml(item.detail || '') + '</small></div>' +
        '<span class="inventory-kind">' + escapeHtml(item.kind) + '</span>' +
        '<span class="inventory-meta">' + escapeHtml(item.category || 'uncategorized') + '</span>' +
        '<span class="inventory-state">' + escapeHtml(state) + '</span>' +
        inventoryToggle(item) +
      '</article>';
    }

    function renderInventoryCategories(items) {
      const select = byId('tool-category-filter');
      if (!(select instanceof HTMLSelectElement)) return;
      const selected = toolInventoryFilters.category;
      const categories = Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort();
      select.innerHTML = '<option value="all">All categories</option>' + categories.map((category) => '<option value="' + escapeHtml(category) + '">' + escapeHtml(category) + '</option>').join('');
      select.value = categories.includes(selected) ? selected : 'all';
      if (select.value !== selected) toolInventoryFilters.category = select.value;
    }

    function renderToolInventory() {
      const container = byId('tool-inventory');
      if (!container) return;
      const query = toolInventoryFilters.query.trim().toLowerCase();
      const visible = toolInventoryItems.filter((item) => {
        if (toolInventoryFilters.kind !== 'all' && item.kind !== toolInventoryFilters.kind) return false;
        if (toolInventoryFilters.state === 'enabled' && !item.enabled) return false;
        if (toolInventoryFilters.state === 'disabled' && item.enabled) return false;
        if (toolInventoryFilters.category !== 'all' && item.category !== toolInventoryFilters.category) return false;
        if (!query) return true;
        return [item.name, item.kind, item.category, item.detail].join(' ').toLowerCase().includes(query);
      });
      container.innerHTML = visible.length
        ? visible.map(inventoryRow).join('')
        : '<p class="inventory-empty">No agent surfaces match these filters.</p>';
      const disabled = toolInventoryItems.filter((item) => !item.enabled).length;
      setText('tool-summary', String(toolInventoryItems.length - disabled) + ' enabled · ' + String(disabled) + ' disabled · ' + String(visible.length) + ' shown');
      bindToggles();
    }

    function setFilterPressed(selector, attribute, value) {
      document.querySelectorAll(selector).forEach((button) => {
        if (button instanceof HTMLButtonElement) button.setAttribute('aria-pressed', button.getAttribute(attribute) === value ? 'true' : 'false');
      });
    }

    function renderSnapshot(snapshot) {
      const workspace = snapshot.workspace || {};
      const overlay = snapshot.overlay || {};
      setHtml('configuration-details', [
        detail('Mode', workspace.mode || 'unknown'),
        detail('Workspace host', workspace.workspaceHost || 'not configured', true),
        detail('Workspace slug', workspace.workspaceSlug || 'not configured'),
        detail('Connector', workspace.connectorId || 'not configured'),
        detail('Transport', workspace.connectorTransport || 'not configured'),
        detail('MCP URL', workspace.mcpUrl || 'not configured', true),
        detail('Generated', snapshot.generatedAt || 'unknown', true),
        detail('Overlay updated', overlay.updatedAt || 'never', true),
      ].join(''));

      const cloud = Array.isArray(snapshot.cloudConnectors) ? snapshot.cloudConnectors : [];
      setHtml('cloud-agent-rows', cloud.length ? cloud.map((connector) => '<tr><td>' + escapeHtml(connector.label) + '</td><td>' + escapeHtml(connector.kind) + '</td><td>' + pill(connector.status) + '</td><td>' + escapeHtml(connector.placeholder ? 'Coming soon' : 'Active connector') + '</td><td><code>' + escapeHtml(connector.mcpUrl || '—') + '</code></td></tr>').join('') : emptyRow(5, 'No cloud agents configured.'));

      const local = Array.isArray(snapshot.localAgents) ? snapshot.localAgents : [];
      setHtml('local-agent-rows', local.length ? local.map((agent) => '<tr><td>' + escapeHtml(agent.label) + '</td><td>' + escapeHtml(agent.kind) + '</td><td>' + pill(agent.status) + '</td><td>' + escapeHtml(agent.detected ? 'Detected' : 'Not detected') + '</td><td>' + escapeHtml(agent.message || 'Connection not verified.') + '</td></tr>').join('') : emptyRow(5, 'No local agents detected on this node.'));

      toolInventoryItems = inventoryItems(snapshot);
      renderOverviewReadiness(snapshot, toolInventoryItems);
      renderInventoryCategories(toolInventoryItems);
      renderAvailabilityPlot(toolInventoryItems);
      renderToolInventory();

      const capabilities = Array.isArray(snapshot.capabilities) ? snapshot.capabilities : [];
      setHtml('capability-rows', capabilities.length ? capabilities.map((capability) => '<tr><td>' + escapeHtml(capability.title) + '</td><td><code>' + escapeHtml(capability.id) + '</code></td><td>' + pill(capability.status) + '</td><td>' + escapeHtml(capability.message) + '</td></tr>').join('') : emptyRow(4, 'No capability checks returned.'));

      setHidden('configuration-loading', true);
      setHidden('configuration-error', true);
      const configurationContent = byId('configuration-content');
      if (configurationContent) configurationContent.setAttribute('aria-busy', 'false');
    }

    async function loadConfiguration() {
      try {
        const response = await fetch('/gateway/configuration/snapshot', { headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error('gateway configuration snapshot returned ' + response.status);
        const payload = await response.json();
        if (!payload || typeof payload !== 'object' || payload.ok === false || !payload.snapshot) throw new Error('invalid gateway configuration snapshot');
        renderSnapshot(payload.snapshot);
      } catch {
        setHidden('configuration-loading', true);
        setHidden('configuration-error', false);
        const configurationContent = byId('configuration-content');
        if (configurationContent) configurationContent.setAttribute('aria-busy', 'false');
      }
    }

    byId('tool-search')?.addEventListener('input', (event) => {
      toolInventoryFilters.query = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.value : '';
      renderToolInventory();
    });
    document.querySelectorAll('[data-inventory-kind]').forEach((button) => button.addEventListener('click', () => {
      toolInventoryFilters.kind = button.getAttribute('data-inventory-kind') || 'all';
      setFilterPressed('[data-inventory-kind]', 'data-inventory-kind', toolInventoryFilters.kind);
      renderToolInventory();
    }));
    document.querySelectorAll('[data-inventory-state]').forEach((button) => button.addEventListener('click', () => {
      toolInventoryFilters.state = button.getAttribute('data-inventory-state') || 'all';
      setFilterPressed('[data-inventory-state]', 'data-inventory-state', toolInventoryFilters.state);
      renderToolInventory();
    }));
    byId('tool-category-filter')?.addEventListener('change', (event) => {
      toolInventoryFilters.category = event.currentTarget instanceof HTMLSelectElement ? event.currentTarget.value : 'all';
      renderToolInventory();
    });

    initOverviewHeatmap();
    void loadConfiguration();
    void loadSourceControl();
  `;
}

function environmentClientScript(): string {
  return `
    const byId = (id) => document.getElementById(id);
    const setText = (id, value) => { const element = byId(id); if (element) element.textContent = value; };
    const setHidden = (id, value) => { const element = byId(id); if (element) element.hidden = value; };
    const escapeHtml = (value) => String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
    let currentEnvironments = [];

    const scopeLabel = (scope) => scope && scope.kind === 'nodes'
      ? ((scope.nodeIds || []).length + ' node' + ((scope.nodeIds || []).length === 1 ? '' : 's'))
      : 'Workspace';

    function metadataBadges(metadata) {
      const entries = Object.entries(metadata || {});
      return entries.length
        ? entries.map(([key, value]) => '<code>' + escapeHtml(key) + ' = ' + escapeHtml(value) + '</code>').join('')
        : '<span class="muted">No configuration metadata.</span>';
    }

    function environmentCard(environment) {
      return '<article class="environment-card" data-environment-id="' + escapeHtml(environment.environmentId) + '">' +
        '<div class="environment-card-header"><div><h2>' + escapeHtml(environment.name) + '</h2><p class="muted">' + escapeHtml(environment.label || environment.slug) + '</p></div>' +
        '<span class="status-pill">' + escapeHtml(environment.status || 'active') + '</span></div>' +
        '<dl class="detail-grid">' +
          '<div><dt>Scope</dt><dd>' + escapeHtml(scopeLabel(environment.scope)) + '</dd></div>' +
          '<div><dt>Labels</dt><dd>' + escapeHtml((environment.labels || []).join(', ') || 'None') + '</dd></div>' +
          '<div><dt>Updated</dt><dd><code>' + escapeHtml(environment.updatedAt || 'Unknown') + '</code></dd></div>' +
          '<div><dt>Environment ID</dt><dd><code>' + escapeHtml(environment.environmentId) + '</code></dd></div>' +
        '</dl>' +
        '<div class="metadata-list">' + metadataBadges(environment.metadata) + '</div>' +
        '<div class="actions"><button type="button" data-action="edit">Edit</button><button type="button" class="danger-button" data-action="delete">Delete</button></div>' +
      '</article>';
    }

    function bindEnvironmentCards() {
      document.querySelectorAll('[data-environment-id]').forEach((card) => {
        const environmentId = card.getAttribute('data-environment-id');
        const environment = currentEnvironments.find((candidate) => candidate.environmentId === environmentId);
        if (!environment) return;
        card.querySelector('[data-action="edit"]')?.addEventListener('click', () => editEnvironment(environment));
        card.querySelector('[data-action="delete"]')?.addEventListener('click', () => void deleteEnvironment(environment));
      });
    }

    function renderEnvironmentSnapshot(snapshot) {
      currentEnvironments = Array.isArray(snapshot?.environments) ? snapshot.environments : [];
      const list = byId('environment-list');
      if (list) {
        list.innerHTML = currentEnvironments.length
          ? currentEnvironments.map(environmentCard).join('')
          : '<section class="state-panel"><strong>No environments yet</strong><p class="muted">Create an environment to organize non-sensitive configuration for this workspace.</p></section>';
      }
      setText('environment-summary', currentEnvironments.length + ' environment' + (currentEnvironments.length === 1 ? '' : 's'));
      setHidden('environment-loading', true);
      setHidden('environment-error', true);
      const content = byId('environment-content');
      if (content) content.setAttribute('aria-busy', 'false');
      bindEnvironmentCards();
    }

    function resetEnvironmentForm() {
      const form = byId('environment-form');
      if (!(form instanceof HTMLFormElement)) return;
      form.reset();
      const id = byId('environment-id');
      if (id instanceof HTMLInputElement) id.value = '';
      const status = byId('environment-status-input');
      if (status instanceof HTMLSelectElement) status.value = 'active';
      const scope = byId('environment-scope');
      if (scope instanceof HTMLSelectElement) scope.value = 'workspace';
      const nodes = byId('environment-nodes');
      if (nodes instanceof HTMLInputElement) nodes.disabled = true;
      setText('environment-form-heading', 'Create environment');
      setText('environment-form-status', 'Environment records contain configuration metadata only.');
    }

    function editEnvironment(environment) {
      const assign = (id, value) => { const element = byId(id); if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) element.value = value; };
      assign('environment-id', environment.environmentId || '');
      assign('environment-name', environment.name || '');
      assign('environment-label', environment.label || '');
      assign('environment-labels', (environment.labels || []).join(', '));
      assign('environment-status-input', environment.status || 'active');
      assign('environment-scope', environment.scope?.kind || 'workspace');
      assign('environment-nodes', environment.scope?.kind === 'nodes' ? (environment.scope.nodeIds || []).join(', ') : '');
      assign('environment-metadata', JSON.stringify(environment.metadata || {}, null, 2));
      const nodes = byId('environment-nodes');
      if (nodes instanceof HTMLInputElement) nodes.disabled = environment.scope?.kind !== 'nodes';
      setText('environment-form-heading', 'Edit ' + environment.name);
      byId('environment-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function formPayload(form) {
      const data = new FormData(form);
      const scopeKind = String(data.get('scope') || 'workspace');
      const metadataText = String(data.get('metadata') || '{}').trim() || '{}';
      const metadata = JSON.parse(metadataText);
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Metadata must be a JSON object.');
      const nodeIds = String(data.get('nodeIds') || '').split(',').map((value) => value.trim()).filter(Boolean);
      return {
        ...(String(data.get('environmentId') || '').trim() ? { environmentId: String(data.get('environmentId')).trim() } : {}),
        name: String(data.get('name') || '').trim(),
        ...(String(data.get('label') || '').trim() ? { label: String(data.get('label')).trim() } : {}),
        labels: String(data.get('labels') || '').split(',').map((value) => value.trim()).filter(Boolean),
        status: String(data.get('status') || 'active'),
        scope: scopeKind === 'nodes' ? { kind: 'nodes', nodeIds } : { kind: 'workspace' },
        metadata,
      };
    }

    async function submitEnvironment(event) {
      event.preventDefault();
      const form = event.currentTarget;
      if (!(form instanceof HTMLFormElement)) return;
      const submit = form.querySelector('button[type="submit"]');
      if (submit instanceof HTMLButtonElement) submit.disabled = true;
      try {
        const payload = formPayload(form);
        const response = await fetch('/gateway/environments/upsert', {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok || !result || result.ok === false || !result.snapshot) {
          throw new Error(result?.error?.message || 'Environment update was denied.');
        }
        renderEnvironmentSnapshot(result.snapshot);
        resetEnvironmentForm();
        setText('environment-form-status', result.created ? 'Environment created.' : 'Environment updated.');
      } catch {
        setText('environment-form-status', 'Environment update failed. Check the form and try again.');
      } finally {
        if (submit instanceof HTMLButtonElement) submit.disabled = false;
      }
    }

    async function deleteEnvironment(environment) {
      if (!globalThis.confirm('Delete ' + environment.name + '?')) return;
      try {
        const response = await fetch('/gateway/environments/delete', {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({ environmentId: environment.environmentId }),
        });
        const result = await response.json();
        if (!response.ok || !result || result.ok === false || !result.snapshot) throw new Error('Environment deletion was denied.');
        renderEnvironmentSnapshot(result.snapshot);
        resetEnvironmentForm();
      } catch {
        setText('environment-form-status', 'Environment deletion was denied or unavailable.');
      }
    }

    async function loadEnvironments() {
      try {
        const response = await fetch('/gateway/environments/snapshot', { headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error('environment gateway returned ' + response.status);
        const payload = await response.json();
        if (!payload || payload.ok === false || !payload.snapshot) throw new Error('invalid environment snapshot');
        renderEnvironmentSnapshot(payload.snapshot);
      } catch {
        setHidden('environment-loading', true);
        setHidden('environment-error', false);
        const content = byId('environment-content');
        if (content) content.setAttribute('aria-busy', 'false');
      }
    }

    byId('environment-form')?.addEventListener('submit', (event) => void submitEnvironment(event));
    byId('environment-form-reset')?.addEventListener('click', resetEnvironmentForm);
    byId('environment-scope')?.addEventListener('change', (event) => {
      const nodes = byId('environment-nodes');
      if (nodes instanceof HTMLInputElement && event.currentTarget instanceof HTMLSelectElement) {
        nodes.disabled = event.currentTarget.value !== 'nodes';
        if (nodes.disabled) nodes.value = '';
      }
    });
    resetEnvironmentForm();
    void loadEnvironments();
  `;
}

function renderOverviewPanels(): string {
  const heatmapHours = Array.from({ length: 24 }, (_, hour) =>
    hour % 3 === 0 || hour === 23 ? `<span>${String(hour).padStart(2, '0')}</span>` : '<span></span>',
  ).join('');
  return `
        <section class="overview-surface" id="overview" aria-labelledby="overview-heatmap-title">
          <section class="overview-heatmap-panel" data-overview-heatmap aria-labelledby="overview-heatmap-title">
            <div class="overview-heatmap-head">
              <div class="overview-heatmap-copy">
                <p class="identity">Last seven days</p>
                <h2 id="overview-heatmap-title">Live trace activity will appear here</h2>
                <p>Calls, tokens, and cost by local hour. Hover or focus any cell for details; the heatmap refreshes from the signed trace gateway.</p>
              </div>
              <div class="overview-heatmap-summary" aria-live="polite">
                <span>Calls <b id="overview-heatmap-calls">0</b></span>
                <span>Tokens <b id="overview-heatmap-tokens">0</b></span>
                <span>Cost <b id="overview-heatmap-cost">$0.0000</b></span>
              </div>
            </div>
            <div class="overview-heatmap-scroll" tabindex="0" aria-label="Scrollable trace activity heatmap">
              <div class="overview-heatmap-frame">
                <div class="overview-heatmap-hours" aria-hidden="true"><span></span>${heatmapHours}</div>
                <div id="overview-heatmap-grid" role="grid" aria-label="Trace activity by local hour for the last seven days."></div>
              </div>
            </div>
            <aside id="overview-heatmap-tooltip" class="overview-heatmap-tooltip" hidden>
              <time id="overview-heatmap-tooltip-time"></time>
              <dl>
                <div><dt>Calls</dt><dd id="overview-heatmap-tooltip-calls">0</dd></div>
                <div><dt>Tokens</dt><dd id="overview-heatmap-tooltip-tokens">0</dd></div>
                <div><dt>Cost</dt><dd id="overview-heatmap-tooltip-cost">$0.0000</dd></div>
              </dl>
            </aside>
          </section>
          <div class="overview-lede">
            <div class="overview-finding">
              <p class="identity">Workspace readiness</p>
              <h2 id="overview-readiness-title">Checking the workspace…</h2>
              <p id="overview-readiness-copy">Comparing live connections, node capabilities, and the agent surfaces available in this workspace.</p>
            </div>
            <div id="overview-readiness-plot" class="readiness-plot" role="img" aria-label="Workspace readiness by operating area"></div>
          </div>
          <div class="overview-context">
            <div class="overview-context-copy">
              <h2>One workspace, directly readable</h2>
              <p>Overview shows live activity and operating posture first. Detailed configuration stays below, while Nodes, Tools, Secrets, and Tracing remain focused work surfaces.</p>
            </div>
            <a class="overview-context-link" target="_blank" rel="noopener noreferrer" href="https://docs.consuelohq.com/">Open Documentation →</a>
          </div>
        </section>
        <section class="panel-section" id="configuration">
          <header class="panel-header"><h2>Operating context</h2><p>Workspace and node configuration loaded through the signed gateway.</p></header>
          <dl class="detail-grid" id="configuration-details"></dl>
          <p id="toggle-status" class="muted">Changes are authorized and written through /gateway/configuration/overlay.</p>
        </section>
        <section class="panel-section" id="source-control">
          <header class="panel-header">
            <h2>Source control</h2>
            <p>Choose the repositories Diffs can review. Store the credential in <a href="/secrets">Secrets</a>, then enter its connection binding ID here; secret values never load into this page.</p>
            <p id="source-control-summary" class="muted">Loading source-control configuration…</p>
          </header>
          <form id="source-control-form" class="source-control-form">
            <div class="form-grid">
              <label class="field"><span>Project ID</span><input id="source-control-id" name="id" required maxlength="80" placeholder="app" autocomplete="off" /></label>
              <label class="field"><span>Display name</span><input id="source-control-name" name="name" maxlength="120" placeholder="App" autocomplete="off" /></label>
              <label class="field"><span>Provider</span><select id="source-control-provider" name="provider"><option value="github">GitHub</option></select></label>
              <label class="field"><span>Repository</span><input id="source-control-repo" name="nameWithOwner" required placeholder="owner/repository" autocomplete="off" /></label>
              <label class="field"><span>Default branch</span><input id="source-control-branch" name="defaultBranch" value="main" required autocomplete="off" /></label>
              <label class="field"><span>Connection binding</span><input id="source-control-connection" name="connectionRef" required placeholder="github-app:primary" autocomplete="off" /></label>
              <label class="field field-wide"><span>Code roots</span><input id="source-control-roots" name="codeRoots" placeholder="src, packages/app (blank = repository root)" autocomplete="off" /></label>
            </div>
            <label class="inline-check"><input id="source-control-default" name="makeDefault" type="checkbox" /> Make this the default repository</label>
            <div class="actions"><button type="submit">Save repository</button><button id="source-control-form-reset" type="button">Clear</button></div>
            <p id="source-control-form-status" class="muted" aria-live="polite">Repository root is used when code roots are empty.</p>
          </form>
          <div class="table-wrap"><table><thead><tr><th>Default</th><th>Repository</th><th>Provider</th><th>Branch</th><th>Connection</th><th>Code roots</th><th>Actions</th></tr></thead><tbody id="source-control-repository-list"></tbody></table></div>
        </section>
        <section class="panel-section" id="connections">
          <header class="panel-header"><h2>Connections</h2><p>Cloud and local agent connections for this workspace.</p></header>
          <div class="subsection"><h3>Cloud agents</h3><div class="table-wrap"><table><thead><tr><th>Name</th><th>Kind</th><th>Status</th><th>Notes</th><th>MCP URL</th></tr></thead><tbody id="cloud-agent-rows"></tbody></table></div></div>
          <div class="subsection"><h3>Local agents</h3><div class="table-wrap"><table><thead><tr><th>Name</th><th>Kind</th><th>Status</th><th>Detection</th><th>Notes</th></tr></thead><tbody id="local-agent-rows"></tbody></table></div></div>
        </section>
        <section class="overview-tool-link" aria-label="Tool management"><div><h2>Agent surfaces</h2><p class="muted">Tools, skills, and workflows are managed in one inventory.</p></div><a href="/tools">Open Tools →</a></section>
        <section class="panel-section" id="capabilities">
          <header class="panel-header"><h2>Capabilities</h2><p>Node capability checks for this OS home.</p></header>
          <div class="table-wrap"><table><thead><tr><th>Capability</th><th>ID</th><th>Status</th><th>Message</th></tr></thead><tbody id="capability-rows"></tbody></table></div>
        </section>`;
}

function renderToolPanels(): string {
  return `
        <section class="tools-surface" id="tools">
          <div class="tools-lede">
            <div class="tools-finding">
              <p class="identity">Agent surface</p>
              <h2 id="tool-availability-title">Availability across tools, skills, and workflows</h2>
              <p>Disabled items stay in this inventory so you can re-enable them at any time. Nothing disappears when you turn it off.</p>
              <p id="tool-summary" class="inventory-summary" aria-live="polite">Loading current availability…</p>
            </div>
            <div id="tool-availability-plot" class="availability-plot" role="img" aria-label="Tool availability by surface"></div>
          </div>
          <div class="tool-controls" aria-label="Tool inventory filters">
            <label class="tool-search-wrap" for="tool-search"><span>Search</span><input id="tool-search" type="search" autocomplete="off" placeholder="name or category" /></label>
            <div class="filter-cluster" data-tool-kind-filter role="group" aria-label="Surface type">
              <button type="button" data-inventory-kind="all" aria-pressed="true">All</button>
              <button type="button" data-inventory-kind="tool" aria-pressed="false">Tools</button>
              <button type="button" data-inventory-kind="skill" aria-pressed="false">Skills</button>
              <button type="button" data-inventory-kind="workflow" aria-pressed="false">Workflows</button>
            </div>
            <div class="filter-cluster" data-tool-state-filter role="group" aria-label="Availability state">
              <button type="button" data-inventory-state="all" aria-pressed="true">All</button>
              <button type="button" data-inventory-state="enabled" aria-pressed="false">Enabled</button>
              <button type="button" data-inventory-state="disabled" aria-pressed="false">Disabled</button>
            </div>
            <label class="field"><span class="sr-only">Category</span><select id="tool-category-filter" aria-label="Category"><option value="all">All categories</option></select></label>
          </div>
          <p id="toggle-status" class="inventory-summary" aria-live="polite">Toggle an item to change its workspace availability.</p>
          <div id="tool-inventory" class="tool-inventory" aria-live="polite"></div>
          <p class="sr-only">Disabled items are Available to re-enable. Use the Re-enable toggle beside the item.</p>
        </section>`;
}

// Metadata only. No value column and no reveal control are rendered.
function secretsClientScript(): string {
  return `
    const byId = (id) => document.getElementById(id);
    const setHidden = (id, value) => { const element = byId(id); if (element) element.hidden = value; };
    const setText = (id, value) => { const element = byId(id); if (element) element.textContent = value; };
    const renderBindingRow = (binding) => {
      const row = document.createElement('tr');
      for (const value of [binding.bindingId, binding.nodeId, binding.status, binding.updatedAt]) {
        const cell = document.createElement('td');
        cell.textContent = String(value ?? '');
        row.append(cell);
      }
      return row;
    };
    fetch('/gateway/secrets/bindings', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('secrets unavailable')))
      .then((payload) => {
        const bindings = Array.isArray(payload && payload.bindings) ? payload.bindings : [];
        const rows = byId('secret-rows');
        if (rows) {
          rows.replaceChildren();
          if (bindings.length) {
            for (const binding of bindings) rows.append(renderBindingRow(binding));
          } else {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 4;
            cell.className = 'empty';
            cell.textContent = 'No credentials are connected yet.';
            row.append(cell);
            rows.append(row);
          }
        }
        setText('secret-summary', bindings.length + (bindings.length === 1 ? ' binding' : ' bindings'));
        setHidden('secret-loading', true);
        setHidden('secret-error', true);
        const content = byId('secret-content');
        if (content) content.setAttribute('aria-busy', 'false');
      })
      .catch(() => {
        setHidden('secret-loading', true);
        setHidden('secret-error', false);
        const content = byId('secret-content');
        if (content) content.setAttribute('aria-busy', 'false');
      });
  `;
}

function renderSecretsContent(): string {
  return `
      <p id="secret-loading" class="sr-only" aria-live="polite">Loading secret connections</p>
      <section id="secret-error" class="state-panel" aria-live="polite" hidden>
        <strong>Secret connections unavailable</strong>
        <p class="muted">Sign in to this workspace or verify that its home node is online.</p>
      </section>
      <div id="secret-content" aria-busy="true">
        <section class="panel-section">
          <header class="panel-header"><h2>Connected credentials</h2><p id="secret-summary" class="muted">0 bindings</p></header>
          <p class="muted">Values are never returned to this page or to an agent. Never paste a credential into an agent conversation.</p>
          <div class="table-wrap"><table><thead><tr><th>Binding</th><th>Node</th><th>Status</th><th>Updated</th></tr></thead><tbody id="secret-rows"></tbody></table></div>
        </section>
      </div>`;
}

function renderEnvironmentContent(): string {
  return `
      <p id="environment-loading" class="sr-only" aria-live="polite">Loading environments</p>
      <section id="environment-error" class="state-panel" aria-live="polite" hidden>
        <strong>Environments unavailable</strong>
        <p class="muted">Sign in to this workspace or verify that its home node is online.</p>
      </section>
      <div id="environment-content" aria-busy="true">
        <section class="panel-section">
          <header class="panel-header"><h2>Workspace environments</h2><p id="environment-summary" class="muted">0 environments</p></header>
          <div id="environment-list" class="environment-list"></div>
        </section>
        <section class="panel-section">
          <header class="panel-header"><h2 id="environment-form-heading">Create environment</h2><p>Store labels, scope, status, and non-sensitive configuration metadata. Credentials belong in Secrets.</p></header>
          <form id="environment-form" class="environment-form">
            <input id="environment-id" name="environmentId" type="hidden" />
            <div class="form-grid">
              <label class="field"><span>Name</span><input id="environment-name" name="name" required maxlength="80" autocomplete="off" /></label>
              <label class="field"><span>Display label</span><input id="environment-label" name="label" maxlength="160" autocomplete="off" /></label>
              <label class="field"><span>Labels</span><input id="environment-labels" name="labels" placeholder="production, customer" autocomplete="off" /></label>
              <label class="field"><span>Status</span><select id="environment-status-input" name="status"><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select></label>
              <label class="field"><span>Scope</span><select id="environment-scope" name="scope"><option value="workspace">Entire workspace</option><option value="nodes">Selected nodes</option></select></label>
              <label class="field"><span>Node IDs</span><input id="environment-nodes" name="nodeIds" placeholder="node-primary, node-preview" disabled autocomplete="off" /></label>
              <label class="field field-wide"><span>Configuration metadata (JSON)</span><textarea id="environment-metadata" name="metadata" spellcheck="false">{}</textarea></label>
            </div>
            <div class="actions"><button type="submit">Save environment</button><button id="environment-form-reset" type="button">Clear</button></div>
            <p id="environment-form-status" class="muted" aria-live="polite">Environment records contain configuration metadata only.</p>
          </form>
        </section>
      </div>`;
}

function renderHydratedContent(page: 'configuration' | 'tools'): string {
  const panels = page === 'tools' ? renderToolPanels() : renderOverviewPanels();
  return `
      <p id="configuration-loading" class="sr-only" aria-live="polite">Loading workspace configuration</p>
      <section id="configuration-error" class="state-panel" aria-live="polite" hidden>
        <strong>Configuration unavailable</strong>
        <p class="muted">Sign in to this workspace or verify that its home node is online.</p>
      </section>
      <div id="configuration-content" aria-busy="true">${panels}</div>`;
}

function configurationSurface(page: ConfigurationPageId): WorkspaceSurfaceId {
  if (page === 'tools') return 'tools';
  if (page === 'nodes') return 'nodes';
  if (page === 'secrets') return 'secrets';
  return 'overview';
}

export function renderConfigurationSite(
  page: ConfigurationPageId = 'configuration',
  chromeOptions: WorkspaceChromeOptions = {},
): string {
  const copy = PAGE_COPY[page];
  const requiresConfigurationSnapshot = page === 'configuration' || page === 'tools';
  const content = requiresConfigurationSnapshot
    ? renderHydratedContent(page)
    : page === 'nodes'
      ? renderNodesContent()
      : page === 'environments'
        ? renderEnvironmentContent()
        : renderSecretsContent();
  const clientScript = requiresConfigurationSnapshot
    ? configurationClientScript()
    : page === 'nodes'
      ? nodesClientScript()
      : page === 'environments'
        ? environmentClientScript()
        : secretsClientScript();
  const overviewHeatmapGsap = page === 'configuration'
    ? `<script id="overview-heatmap-gsap">${OVERVIEW_HEATMAP_GSAP}</script>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${copy.title} - Consuelo OS</title>
  <style>${configurationStyles()}</style>
</head>
<body>
  <div class="workspace-window" data-workspace-shell>
    ${renderWorkspaceChromeBar(configurationSurface(page), copy.title, chromeOptions)}
    <div class="workspace-view" data-workspace-view>
      <main class="content">
        <header class="hero">
          <h1>${copy.title}</h1>
          <p>${copy.description}</p>
        </header>
        ${content}
      </main>
    </div>
  </div>
  ${overviewHeatmapGsap}
  <script>${PRIVATE_WORKSPACE_SESSION_RECOVERY_JAVASCRIPT}\n${workspaceChromeClientScript()}\n${clientScript}</script>
</body>
</html>`;
}

export function renderSettingsSite(): string {
  return renderConfigurationSite('configuration');
}

export function buildConfigurationSite(
  _home?: string,
  page: ConfigurationPageId = 'configuration',
): string {
  return renderConfigurationSite(page);
}

export function buildSettingsSite(_home?: string): string {
  return renderConfigurationSite('configuration');
}
