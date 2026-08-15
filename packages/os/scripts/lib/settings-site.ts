import { listManagedCloudPlans, listManagedCloudRegions } from './managed-cloud-pricing';
import { PRIVATE_WORKSPACE_SESSION_RECOVERY_JAVASCRIPT } from './private-workspace-session-recovery';
import {
  renderWorkspaceChromeBar,
  workspaceChromeClientScript,
  workspaceRouteSwitcherStyles,
  type WorkspaceSurfaceId,
} from './workspace-chrome';
import {
  renderSecretsContent,
  secretsClientScript,
  secretsSiteStyles,
} from './secrets-site';

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
    description: 'See what is connected to your workspace and what agents can use here.',
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
    description: 'Store credentials securely for this workspace.',
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
      }
    }
    * { box-sizing: border-box; }
    html { background: #0d0d0c; }
    body { margin: 0; min-height: 100vh; padding: 14px; background: #0d0d0c; color: var(--site-color-ink); }
    .workspace-window { width: min(1880px, calc(100vw - 28px)); min-height: calc(100vh - 28px); margin: 0 auto; overflow: clip; border: 1px solid rgba(241, 231, 213, 0.16); border-radius: 18px; background: var(--site-color-paper); box-shadow: 0 34px 110px rgba(0, 0, 0, 0.42); display: grid; grid-template-rows: 42px minmax(0, 1fr); }
    .trxChrome { position: relative; z-index: 70; display: grid; grid-template-columns: minmax(84px, 1fr) auto minmax(84px, 1fr); align-items: center; height: 42px; padding: 0 14px; border-bottom: 1px solid rgba(241, 231, 213, 0.10); background: #151411; color: #d8d0c1; view-transition-name: workspace-chrome; }
    .trxDots { display: flex; align-items: center; gap: 8px; justify-self: start; }
    .trxDot { width: 12px; height: 12px; padding: 0; border: 0; border-radius: 50%; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(0,0,0,.22); }
    .trxDot.red { background: #d85e54; }
    .trxDot.yellow { background: #d5ad49; }
    .trxDot.green { background: #64a866; }
    .trxChromeTitle { justify-self: center; color: #d8d0c1; font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .01em; }
    .trxChromeActions { justify-self: end; min-width: 72px; text-align: right; }
    .trxClock { color: #918a7f; font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }
    .workspace-view { min-width: 0; min-height: 0; background: var(--site-color-paper); view-transition-name: workspace-body; }
    @view-transition { navigation: auto; }
    ::view-transition-old(workspace-chrome), ::view-transition-new(workspace-chrome) { animation-duration: 90ms; }
    ::view-transition-old(workspace-body), ::view-transition-new(workspace-body) { animation-duration: 140ms; animation-timing-function: ease-out; }
    @media (prefers-reduced-motion: reduce) { ::view-transition-group(*) { animation-duration: 0.01ms !important; } }
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
    .overview-tool-link { display: flex; align-items: baseline; justify-content: space-between; gap: 22px; max-width: 1080px; border-top: 1px solid var(--site-color-line); border-bottom: 1px solid var(--site-color-line); padding: 18px 0; }
    .overview-tool-link a { color: var(--site-color-ink); font-family: var(--site-font-mono); font-size: 11px; }
    @media (max-width: 980px) {
      .tools-lede { grid-template-columns: 1fr; gap: 22px; }
      .tool-controls { grid-template-columns: 1fr; }
      .filter-cluster { width: 100%; overflow-x: auto; }
      .inventory-row { grid-template-columns: minmax(0, 1fr) 80px 120px; }
      .inventory-meta { display: none; }
      .inventory-toggle { grid-column: 3; }
    }
    @media (max-width: 620px) {
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
      body { padding: 0; }
      .workspace-window { width: 100vw; min-height: 100dvh; border: 0; border-radius: 0; }
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
  ` + workspaceRouteSwitcherStyles() + secretsSiteStyles();
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
  return `
        <section class="panel-section" id="configuration">
          <header class="panel-header"><h2>Configuration</h2><p>Workspace and node configuration loaded through the signed gateway.</p></header>
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

function renderNodesContent(): string {
  const plans = listManagedCloudPlans();
  const regions = listManagedCloudRegions();
  const planCards = plans.map((plan) => {
    const cpu = plan.cpu.vcpus + (plan.cpu.shared ? ' shared vCPU' : ' vCPU');
    const checked = plan.recommended ? ' checked' : '';
    const recommended = plan.recommended ? '<span class="plan-recommended">Recommended</span>' : '';
    return '<label class="plan-option"><input type="radio" name="cloud-plan" value="' + escapeHtml(plan.id) + '"' + checked + '><span class="plan-card"><span class="plan-name"><strong>' + escapeHtml(plan.name) + '</strong>' + recommended + '</span><span class="plan-spec">' + escapeHtml(cpu) + ' · ' + escapeHtml(String(plan.memoryGb)) + ' GB RAM</span><span class="plan-price" data-plan-price="' + escapeHtml(plan.id) + '">Price loading…</span></span></label>';
  }).join('');
  const regionOptions = regions.map((region) =>
    '<option value="' + escapeHtml(region.id) + '">' + escapeHtml(region.name) + '</option>',
  ).join('');
  return [
    '<p id="node-loading" class="sr-only" aria-live="polite">Loading workspace nodes</p>',
    '<section id="node-error" class="state-panel" aria-live="polite" hidden>',
    '  <strong>Nodes unavailable</strong>',
    '  <p class="muted">Sign in again or verify the workspace control plane is available.</p>',
    '</section>',
    '<div id="node-content" aria-busy="true">',
    '  <section class="panel-section">',
    '    <div class="nodes-toolbar">',
    '      <div class="nodes-toolbar-copy"><h2>Workspace nodes</h2><p id="node-summary" class="muted">Loading node presence…</p></div>',
    '      <button id="add-node-button" class="primary-button" type="button">+ Add node</button>',
    '    </div>',
    '    <p id="node-feedback" class="muted node-feedback" aria-live="polite">The default node receives calls when an agent does not choose one explicitly.</p>',
    '    <div id="node-list" class="node-list"></div>',
    '  </section>',
    '</div>',
    '<dialog id="add-node-dialog" aria-labelledby="add-node-title">',
    '  <div class="dialog-shell">',
    '    <header class="dialog-header">',
    '      <div class="dialog-title"><p class="identity">Managed by Consuelo</p><h2 id="add-node-title">Create cloud node</h2><p class="muted">Always available. One flat monthly price. No cold starts when your agents need to work.</p></div>',
    '      <button id="add-node-close" class="dialog-close" type="button" aria-label="Close">×</button>',
    '    </header>',
    '    <section class="subsection" aria-labelledby="plan-heading"><h3 id="plan-heading">Choose a plan</h3><div class="plan-grid">' + planCards + '</div></section>',
    '    <section class="cloud-config">',
    '      <label class="field"><span>Region</span><select id="cloud-region">' + regionOptions + '</select></label>',
    '      <div class="cloud-note"><strong>Built for always-on agent work</strong><p class="muted">CPU, RAM, storage, networking, and managed operations are rolled into the monthly price.</p></div>',
    '    </section>',
    '    <div class="actions"><button id="create-cloud-node-button" class="primary-button provisioning-button" type="button" disabled>Create cloud node</button><button id="add-node-cancel" type="button">Cancel</button></div>',
    '    <p id="pricing-status" class="muted" aria-live="polite">Loading current monthly prices…</p>',
    '    <div id="provisioning-progress" class="provisioning-progress" aria-live="polite" hidden><strong id="provisioning-phase">Preparing cloud node</strong><p id="provisioning-detail" class="muted">You can leave this page after creation starts. The node will continue provisioning.</p></div>',
    '  </div>',
    '</dialog>',
  ].join(String.fromCharCode(10));
}

function nodesClientScript(): string {
  return [
    "const byId = (id) => document.getElementById(id);",
    "const setHidden = (id, value) => { const element = byId(id); if (element) element.hidden = value; };",
    "const setText = (id, value) => { const element = byId(id); if (element) element.textContent = value; };",
    "const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll(String.fromCharCode(34), '&quot;').replaceAll(String.fromCharCode(39), '&#39;');",
    "let currentNodeSnapshot = null;",
    "let pricingRequestGeneration = 0;",
    "let currentPricing = null;",
    "let currentProvisioningJobId = null;",
    "let currentProvisioningKey = null;",
    "let provisioningPollTimer = null;",
    "const prettyPlatform = (value) => value === 'darwin' ? 'macOS' : value === 'linux' ? 'Linux' : value === 'win32' || value === 'windows' ? 'Windows' : (value || 'Unknown platform');",
    "const prettyPresence = (value) => value === 'online' ? 'Online' : value === 'stale' ? 'Stale' : 'Offline';",
    "const csrfToken = () => { const part = document.cookie.split(';').map((value) => value.trim()).find((value) => value.startsWith('__Host-consuelo_os_csrf=')); return part ? decodeURIComponent(part.slice(part.indexOf('=') + 1)) : ''; };",
    "const selectedPlanId = () => { const input = document.querySelector('input[name=\"cloud-plan\"]:checked'); return input instanceof HTMLInputElement ? input.value : ''; };",
    "const selectedRegionId = () => { const input = byId('cloud-region'); return input instanceof HTMLSelectElement ? input.value : ''; };",
    "const selectedQuote = () => { const planId = selectedPlanId(); const region = selectedRegionId(); const quotes = currentPricing && Array.isArray(currentPricing.quotes) ? currentPricing.quotes : []; return quotes.find((quote) => quote && quote.plan && quote.plan.id === planId && quote.region && quote.region.id === region) || null; };",
    "const nodeCard = (node) => { const isDefault = currentNodeSnapshot && currentNodeSnapshot.defaultNodeId === node.nodeId; const isCurrent = currentNodeSnapshot && currentNodeSnapshot.currentNodeId === node.nodeId; const online = node.presence === 'online' && node.state === 'active'; const badges = [isDefault ? '<span class=\"status-pill status-connected\">Default</span>' : '', isCurrent ? '<span class=\"status-pill\">Current</span>' : '', node.role === 'home' ? '<span class=\"status-pill\">Home</span>' : ''].filter(Boolean).join(''); const action = isDefault ? '<button type=\"button\" disabled>Default node</button>' : '<button type=\"button\" data-make-default=\"' + escapeHtml(node.nodeId) + '\" ' + (online ? '' : 'disabled') + '>Make default</button>'; return '<article class=\"node-card' + (isDefault ? ' is-default' : '') + '\">' + '<header class=\"node-card-header\"><div class=\"node-card-title\"><strong>' + escapeHtml(node.displayName || node.nodeId) + '</strong><code>' + escapeHtml(node.nodeId) + '</code></div><div class=\"node-badges\">' + badges + '</div></header>' + '<div class=\"node-meta\"><div class=\"node-meta-item\"><span>Platform</span><span>' + escapeHtml(prettyPlatform(node.platform)) + '</span></div><div class=\"node-meta-item\"><span>Channel</span><span>' + escapeHtml(node.channel || 'standard') + '</span></div></div>' + '<footer class=\"node-card-footer\"><span class=\"presence presence-' + escapeHtml(node.presence || 'offline') + '\"><span class=\"presence-dot\"></span>' + escapeHtml(prettyPresence(node.presence)) + '</span>' + action + '</footer>' + '</article>'; };",
    "function bindDefaultButtons() { document.querySelectorAll('[data-make-default]').forEach((button) => { button.addEventListener('click', () => void makeDefault(button.getAttribute('data-make-default') || '', button)); }); }",
    "function renderNodes(snapshot) { currentNodeSnapshot = snapshot; const nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : []; const list = byId('node-list'); if (list) list.innerHTML = nodes.length ? nodes.map(nodeCard).join('') : '<section class=\"state-panel\"><strong>No nodes yet</strong><p class=\"muted\">Add a cloud node to start using Consuelo without installing it on a computer.</p></section>'; const presence = snapshot.presence || {}; setText('node-summary', nodes.length + (nodes.length === 1 ? ' node' : ' nodes') + ' · ' + String(presence.online || 0) + ' online'); setHidden('node-loading', true); setHidden('node-error', true); const content = byId('node-content'); if (content) content.setAttribute('aria-busy', 'false'); bindDefaultButtons(); }",
    "async function loadNodes() { try { const response = await fetch('/gateway/nodes/snapshot', { headers: { accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' }); if (!response.ok) throw new Error('nodes unavailable'); renderNodes(await response.json()); } catch { setHidden('node-loading', true); setHidden('node-error', false); const content = byId('node-content'); if (content) content.setAttribute('aria-busy', 'false'); } }",
    "async function makeDefault(nodeId, button) { const csrf = csrfToken(); if (!nodeId || !csrf) { setText('node-feedback', 'Your workspace session needs to be refreshed before changing the default node.'); return; } if (button instanceof HTMLButtonElement) button.disabled = true; setText('node-feedback', 'Updating workspace default…'); try { const response = await fetch('/gateway/nodes/default', { method: 'POST', credentials: 'same-origin', headers: { accept: 'application/json', 'content-type': 'application/json', 'x-consuelo-csrf-token': csrf }, body: JSON.stringify({ nodeId }) }); if (!response.ok) throw new Error('default update denied'); await loadNodes(); setText('node-feedback', 'Default node updated. New untargeted OS calls will route there.'); } catch { if (button instanceof HTMLButtonElement) button.disabled = false; setText('node-feedback', 'Default node update failed. The existing default was kept.'); } }",
    "const formatMonthlyPrice = (quote) => { if (!quote || !Number.isSafeInteger(quote.monthlyPriceCents)) return 'Price available soon'; const value = quote.monthlyPriceCents / 100; try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: quote.currency || 'USD', maximumFractionDigits: 0 }).format(value) + '<small>/month</small>'; } catch { return '$' + String(Math.ceil(value)) + '<small>/month</small>'; } };",
    "function updateCreateButton() { const button = byId('create-cloud-node-button'); if (!(button instanceof HTMLButtonElement)) return; const ready = Boolean(selectedQuote()) && !currentProvisioningJobId; button.disabled = !ready; button.textContent = currentProvisioningJobId ? 'Creating cloud node…' : 'Create cloud node'; }",
    "async function loadPricing() { const requestGeneration = ++pricingRequestGeneration; const selectedRegion = selectedRegionId() || 'us-east1'; setText('pricing-status', 'Loading current monthly prices…'); currentPricing = null; updateCreateButton(); try { const response = await fetch('/gateway/nodes/pricing?region=' + encodeURIComponent(selectedRegion), { headers: { accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' }); if (!response.ok) throw new Error('pricing unavailable'); const payload = await response.json(); if (requestGeneration !== pricingRequestGeneration) return; currentPricing = payload; const quotes = Array.isArray(payload.quotes) ? payload.quotes : []; document.querySelectorAll('[data-plan-price]').forEach((element) => { const quote = quotes.find((candidate) => candidate && candidate.plan && candidate.plan.id === element.getAttribute('data-plan-price')); element.innerHTML = formatMonthlyPrice(quote); }); setText('pricing-status', payload.pricingAvailable ? 'Monthly price includes an always-on node and managed operations.' : 'Plans are ready; monthly prices will appear when the current rate card is published.'); updateCreateButton(); } catch { if (requestGeneration !== pricingRequestGeneration) return; document.querySelectorAll('[data-plan-price]').forEach((element) => { element.textContent = 'Price available soon'; }); setText('pricing-status', 'Pricing is temporarily unavailable. Try again in a moment.'); updateCreateButton(); } }",
    "const provisioningCopy = (status) => status === 'requested' ? ['Request received', 'Your cloud node is queued for provisioning.'] : status === 'provisioning' ? ['Creating cloud resources', 'Preparing compute, storage, and private networking.'] : status === 'booting' ? ['Installing Consuelo', 'The node is booting and installing the current Consuelo runtime.'] : status === 'connecting' ? ['Connecting your node', 'Consuelo is establishing its secure workspace connection.'] : status === 'ready' ? ['Cloud node ready', 'Your node is online and available to your agents.'] : status === 'failed' ? ['Cloud node needs attention', 'Provisioning did not finish. No second node will be created by retrying this request.'] : ['Preparing cloud node', 'Provisioning is starting.'];",
    "function renderProvisioning(job) { if (!job) return; currentProvisioningJobId = job.jobId; const copy = provisioningCopy(job.status); setHidden('provisioning-progress', false); setText('provisioning-phase', copy[0]); setText('provisioning-detail', job.status === 'failed' && job.errorMessage ? job.errorMessage : copy[1]); updateCreateButton(); }",
    "function stopProvisioningPoll() { if (provisioningPollTimer) window.clearTimeout(provisioningPollTimer); provisioningPollTimer = null; }",
    "async function pollProvisioning() { if (!currentProvisioningJobId) return; try { const response = await fetch('/gateway/nodes/provisioning?job_id=' + encodeURIComponent(currentProvisioningJobId), { headers: { accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' }); if (!response.ok) throw new Error('status unavailable'); const payload = await response.json(); const job = payload && payload.job; renderProvisioning(job); if (job && job.status === 'ready') { stopProvisioningPoll(); await loadNodes(); currentProvisioningJobId = null; currentProvisioningKey = null; updateCreateButton(); window.setTimeout(() => { const dialog = byId('add-node-dialog'); if (dialog instanceof HTMLDialogElement) dialog.close(); }, 900); return; } if (job && job.status === 'failed') { stopProvisioningPoll(); currentProvisioningJobId = null; currentProvisioningKey = null; updateCreateButton(); return; } } catch { setText('provisioning-detail', 'The node is still being created. Status will retry automatically.'); } provisioningPollTimer = window.setTimeout(() => void pollProvisioning(), 2000); }",
    "async function createCloudNode() { const csrf = csrfToken(); const quote = selectedQuote(); if (!csrf || !quote) { setText('pricing-status', 'Refresh the page and current monthly price before creating a node.'); return; } const button = byId('create-cloud-node-button'); if (button instanceof HTMLButtonElement) button.disabled = true; currentProvisioningKey = currentProvisioningKey || (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function' ? globalThis.crypto.randomUUID() : 'cloud-' + Date.now() + '-' + Math.random().toString(16).slice(2)); setHidden('provisioning-progress', false); setText('provisioning-phase', 'Creating cloud node'); setText('provisioning-detail', 'Submitting your plan and region to Consuelo…'); try { const response = await fetch('/gateway/nodes/provision', { method: 'POST', credentials: 'same-origin', headers: { accept: 'application/json', 'content-type': 'application/json', 'x-consuelo-csrf-token': csrf }, body: JSON.stringify({ planId: quote.plan.id, region: quote.region.id, pricingVersion: quote.pricingVersion, idempotencyKey: currentProvisioningKey }) }); const payload = await response.json().catch(() => ({})); const job = payload && payload.job; if (!response.ok && response.status !== 409) throw new Error('create failed'); if (!job) throw new Error('missing job'); renderProvisioning(job); void pollProvisioning(); } catch { currentProvisioningJobId = null; setText('provisioning-phase', 'Cloud node was not created'); setText('provisioning-detail', 'Nothing was charged or provisioned. Check your connection and try again.'); updateCreateButton(); } }",
    "const dialog = byId('add-node-dialog');",
    "byId('add-node-button')?.addEventListener('click', () => { if (dialog instanceof HTMLDialogElement) { currentProvisioningKey = null; setHidden('provisioning-progress', true); dialog.showModal(); void loadPricing(); } });",
    "byId('add-node-close')?.addEventListener('click', () => { if (dialog instanceof HTMLDialogElement) dialog.close(); });",
    "byId('add-node-cancel')?.addEventListener('click', () => { if (dialog instanceof HTMLDialogElement) dialog.close(); });",
    "byId('create-cloud-node-button')?.addEventListener('click', () => void createCloudNode());",
    "byId('cloud-region')?.addEventListener('change', () => void loadPricing());",
    "document.querySelectorAll('input[name=\"cloud-plan\"]').forEach((input) => input.addEventListener('change', updateCreateButton));",
    "void loadNodes();",
  ].join(String.fromCharCode(10));
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

export function renderConfigurationSite(page: ConfigurationPageId = 'configuration'): string {
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
    ${renderWorkspaceChromeBar(configurationSurface(page), copy.title)}
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
