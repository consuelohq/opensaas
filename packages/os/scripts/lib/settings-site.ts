import { listManagedCloudPlans, listManagedCloudRegions } from './managed-cloud-pricing';

export type ConfigurationPageId =
  | 'configuration'
  | 'tools'
  | 'nodes'
  | 'environments'
  | 'secrets';

const CONFIGURATION_PAGES: Array<{
  id: ConfigurationPageId;
  label: string;
  href: string;
}> = [
  { id: 'configuration', label: 'Overview', href: '/configuration' },
  { id: 'tools', label: 'Tools', href: '/tools' },
  { id: 'nodes', label: 'Nodes', href: '/nodes' },
  { id: 'secrets', label: 'Secrets', href: '/secrets' },
];

const PAGE_COPY: Record<ConfigurationPageId, {
  title: string;
  description: string;
}> = {
  configuration: {
    title: 'Configuration',
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

function renderNav(activePage: ConfigurationPageId): string {
  return `<nav class="nav" aria-label="Configuration navigation">${CONFIGURATION_PAGES.map((page) => {
    const active = page.id === activePage ? ' class="is-active" aria-current="page"' : '';
    return `<a href="${page.href}"${active}>${escapeHtml(page.label)}</a>`;
  }).join('')}</nav>`;
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
    body { margin: 0; min-height: 100vh; background: var(--site-color-paper); color: var(--site-color-ink); }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 240px minmax(0, 1fr); }
    .sidebar { border-right: 1px solid var(--site-color-line); background: var(--site-color-panel); padding: 28px 18px; display: grid; align-content: start; gap: 28px; }
    .identity, .status-pill, code, h3 { font-family: var(--site-font-mono); }
    .identity { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    .nav { display: grid; gap: 8px; }
    .nav a { color: var(--site-color-muted); text-decoration: none; font-size: 14px; padding: 6px 8px; border-left: 2px solid transparent; }
    .nav a:hover, .nav a.is-active { color: var(--site-color-accent); border-left-color: var(--site-color-accent); }
    .nav a:focus:not(:focus-visible) { outline: none; }
    .nav a:focus-visible { outline: 2px solid var(--site-color-accent); outline-offset: 2px; }
    .content { padding: clamp(24px, 4vw, 48px); display: grid; align-content: start; gap: 42px; }
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
    label { cursor: pointer; }
    [hidden] { display: none !important; }
    @media (max-width: 900px) {
      .shell { grid-template-columns: 1fr; }
      .sidebar { border-right: 0; border-bottom: 1px solid var(--site-color-line); }
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
  `;
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
      .replaceAll('"', '&quot;')
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

    function toggleRow(kind, name, enabled, category, configurable = true) {
      const control = configurable
        ? '<input type="checkbox" class="configuration-toggle" data-kind="' + escapeHtml(kind) + '" data-name="' + escapeHtml(name) + '" ' + (enabled ? 'checked' : '') + '>'
        : '<input type="checkbox" ' + (enabled ? 'checked ' : '') + 'disabled aria-label="' + escapeHtml(name + ' is managed locally') + '">';
      return '<tr><td><label>' + control + ' ' + escapeHtml(name) + '</label></td><td>' + escapeHtml(kind) + '</td><td>' + pill(enabled ? 'connected' : 'disabled') + '</td><td>' + (category ? '<code>' + escapeHtml(category) + '</code>' : '<span class="muted">—</span>') + '</td></tr>';
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

      const tools = Array.isArray(snapshot.tools) ? snapshot.tools : [];
      setHtml('tool-summary', detail('Enabled tools', String(tools.filter((tool) => tool.enabled).length)) + detail('Disabled tools', String((overlay.disabledTools || []).length)));
      setHtml('tool-rows', tools.length ? tools.map((item) => toggleRow(item.kind, item.name, item.enabled, item.category, item.configurable !== false)).join('') : emptyRow(4, 'No tools found.'));

      const skills = Array.isArray(snapshot.skills) ? snapshot.skills : [];
      setHtml('skill-summary', detail('Enabled skills', String(skills.filter((skill) => skill.enabled).length)) + detail('Disabled skills', String((overlay.disabledSkills || []).length)));
      setHtml('skill-rows', skills.length ? skills.map((item) => toggleRow(item.kind, item.name, item.enabled, item.category, item.configurable !== false)).join('') : emptyRow(4, 'No skills found.'));

      const workflows = Array.isArray(snapshot.runBooks) ? snapshot.runBooks : [];
      setHtml('workflow-rows', workflows.length ? workflows.map((workflow) => '<tr><td><label><input type="checkbox" class="configuration-toggle" data-kind="workflow" data-name="' + escapeHtml(workflow.id) + '" ' + (workflow.enabled ? 'checked' : '') + '> ' + escapeHtml(workflow.id) + '</label></td><td><code>' + escapeHtml((workflow.aliases || []).join(', ') || '—') + '</code></td><td>' + pill(workflow.enabled ? 'connected' : 'disabled') + '</td><td>' + escapeHtml(workflow.roleCount) + '</td><td>' + escapeHtml(workflow.toolCount) + '</td></tr>').join('') : emptyRow(5, 'No workflow bundles found.'));

      const capabilities = Array.isArray(snapshot.capabilities) ? snapshot.capabilities : [];
      setHtml('capability-rows', capabilities.length ? capabilities.map((capability) => '<tr><td>' + escapeHtml(capability.title) + '</td><td><code>' + escapeHtml(capability.id) + '</code></td><td>' + pill(capability.status) + '</td><td>' + escapeHtml(capability.message) + '</td></tr>').join('') : emptyRow(4, 'No capability checks returned.'));

      setHidden('configuration-loading', true);
      setHidden('configuration-error', true);
      setHidden('configuration-content', false);
      bindToggles();
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
        setHidden('configuration-content', true);
        setHidden('configuration-error', false);
      }
    }

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
      setHidden('environment-content', false);
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
        setHidden('environment-content', true);
        setHidden('environment-error', false);
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
        ${renderToolPanels()}
        <section class="panel-section" id="capabilities">
          <header class="panel-header"><h2>Capabilities</h2><p>Node capability checks for this OS home.</p></header>
          <div class="table-wrap"><table><thead><tr><th>Capability</th><th>ID</th><th>Status</th><th>Message</th></tr></thead><tbody id="capability-rows"></tbody></table></div>
        </section>`;
}

function renderToolPanels(): string {
  return `
        <section class="panel-section" id="tools">
          <header class="panel-header"><h2>Tools</h2><p>Enable or disable facade tools without editing generated manifests.</p></header>
          <dl class="detail-grid" id="tool-summary"></dl>
          <div class="table-wrap"><table><thead><tr><th>Name</th><th>Kind</th><th>Status</th><th>Category</th></tr></thead><tbody id="tool-rows"></tbody></table></div>
        </section>
        <section class="panel-section" id="skills">
          <header class="panel-header"><h2>Skills</h2><p>Control the OS skills exposed through MCP and steering.</p></header>
          <dl class="detail-grid" id="skill-summary"></dl>
          <div class="table-wrap"><table><thead><tr><th>Name</th><th>Kind</th><th>Status</th><th>Category</th></tr></thead><tbody id="skill-rows"></tbody></table></div>
        </section>
        <section class="panel-section" id="run-books">
          <header class="panel-header"><h2>Run Books</h2><p>Disabled workflow bundles are rejected by workflow intent routing.</p></header>
          <div class="table-wrap"><table><thead><tr><th>Workflow</th><th>Aliases</th><th>Status</th><th>Roles</th><th>Tools</th></tr></thead><tbody id="workflow-rows"></tbody></table></div>
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
        setHidden('secret-content', false);
      })
      .catch(() => {
        setHidden('secret-loading', true);
        setHidden('secret-content', true);
        setHidden('secret-error', false);
      });
  `;
}

function renderSecretsContent(): string {
  return `
      <section id="secret-loading" class="state-panel" aria-live="polite">
        <strong>Loading secret connections</strong>
        <p class="muted">Checking your workspace session and node connection.</p>
      </section>
      <section id="secret-error" class="state-panel" aria-live="polite" hidden>
        <strong>Secret connections unavailable</strong>
        <p class="muted">Sign in to this workspace or verify that its home node is online.</p>
      </section>
      <div id="secret-content" hidden>
        <section class="panel-section">
          <header class="panel-header"><h2>Connected credentials</h2><p id="secret-summary" class="muted">0 bindings</p></header>
          <p class="muted">Values are never returned to this page or to an agent. Never paste a credential into an agent conversation.</p>
          <div class="table-wrap"><table><thead><tr><th>Binding</th><th>Node</th><th>Status</th><th>Updated</th></tr></thead><tbody id="secret-rows"></tbody></table></div>
        </section>
      </div>`;
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
    '<section id="node-loading" class="state-panel" aria-live="polite">',
    '  <strong>Loading workspace nodes</strong>',
    '  <p class="muted">Checking node presence and your workspace default.</p>',
    '</section>',
    '<section id="node-error" class="state-panel" aria-live="polite" hidden>',
    '  <strong>Nodes unavailable</strong>',
    '  <p class="muted">Sign in again or verify the workspace control plane is available.</p>',
    '</section>',
    '<div id="node-content" hidden>',
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
    '    <div class="actions"><button class="primary-button provisioning-button" type="button" disabled>Provisioning coming soon</button><button id="add-node-cancel" type="button">Cancel</button></div>',
    '    <p id="pricing-status" class="muted" aria-live="polite">Loading current monthly prices…</p>',
    '  </div>',
    '</dialog>',
  ].join(String.fromCharCode(10));
}

function nodesClientScript(): string {
  return "const byId = (id) => document.getElementById(id);\nconst setHidden = (id, value) => { const element = byId(id); if (element) element.hidden = value; };\nconst setText = (id, value) => { const element = byId(id); if (element) element.textContent = value; };\nconst escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\"', '&quot;').replaceAll(\"'\", '&#39;');\nlet currentNodeSnapshot = null;\nconst prettyPlatform = (value) => value === 'darwin' ? 'macOS' : value === 'linux' ? 'Linux' : value === 'win32' || value === 'windows' ? 'Windows' : (value || 'Unknown platform');\nconst prettyPresence = (value) => value === 'online' ? 'Online' : value === 'stale' ? 'Stale' : 'Offline';\nconst csrfToken = () => { const part = document.cookie.split(';').map((value) => value.trim()).find((value) => value.startsWith('__Host-consuelo_os_csrf=')); return part ? decodeURIComponent(part.slice(part.indexOf('=') + 1)) : ''; };\nconst nodeCard = (node) => {\n  const isDefault = currentNodeSnapshot && currentNodeSnapshot.defaultNodeId === node.nodeId;\n  const isCurrent = currentNodeSnapshot && currentNodeSnapshot.currentNodeId === node.nodeId;\n  const online = node.presence === 'online' && node.state === 'active';\n  const badges = [isDefault ? '<span class=\"status-pill status-connected\">Default</span>' : '', isCurrent ? '<span class=\"status-pill\">Current</span>' : '', node.role === 'home' ? '<span class=\"status-pill\">Home</span>' : ''].filter(Boolean).join('');\n  const action = isDefault ? '<button type=\"button\" disabled>Default node</button>' : '<button type=\"button\" data-make-default=\"' + escapeHtml(node.nodeId) + '\" ' + (online ? '' : 'disabled') + '>Make default</button>';\n  return '<article class=\"node-card' + (isDefault ? ' is-default' : '') + '\">' + '<header class=\"node-card-header\"><div class=\"node-card-title\"><strong>' + escapeHtml(node.displayName || node.nodeId) + '</strong><code>' + escapeHtml(node.nodeId) + '</code></div><div class=\"node-badges\">' + badges + '</div></header>' + '<div class=\"node-meta\"><div class=\"node-meta-item\"><span>Platform</span><span>' + escapeHtml(prettyPlatform(node.platform)) + '</span></div><div class=\"node-meta-item\"><span>Channel</span><span>' + escapeHtml(node.channel || 'standard') + '</span></div></div>' + '<footer class=\"node-card-footer\"><span class=\"presence presence-' + escapeHtml(node.presence || 'offline') + '\"><span class=\"presence-dot\"></span>' + escapeHtml(prettyPresence(node.presence)) + '</span>' + action + '</footer>' + '</article>';\n};\nfunction bindDefaultButtons() { document.querySelectorAll('[data-make-default]').forEach((button) => { button.addEventListener('click', () => void makeDefault(button.getAttribute('data-make-default') || '', button)); }); }\nfunction renderNodes(snapshot) {\n  currentNodeSnapshot = snapshot;\n  const nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : [];\n  const list = byId('node-list');\n  if (list) list.innerHTML = nodes.length ? nodes.map(nodeCard).join('') : '<section class=\"state-panel\"><strong>No nodes yet</strong><p class=\"muted\">Add a cloud node to start using Consuelo without installing it on a computer.</p></section>';\n  const presence = snapshot.presence || {};\n  setText('node-summary', nodes.length + (nodes.length === 1 ? ' node' : ' nodes') + ' · ' + String(presence.online || 0) + ' online');\n  setHidden('node-loading', true); setHidden('node-error', true); setHidden('node-content', false); bindDefaultButtons();\n}\nasync function loadNodes() {\n  try { const response = await fetch('/gateway/nodes/snapshot', { headers: { accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' }); if (!response.ok) throw new Error('nodes unavailable'); renderNodes(await response.json()); }\n  catch { setHidden('node-loading', true); setHidden('node-content', true); setHidden('node-error', false); }\n}\nasync function makeDefault(nodeId, button) {\n  const csrf = csrfToken();\n  if (!nodeId || !csrf) { setText('node-feedback', 'Your workspace session needs to be refreshed before changing the default node.'); return; }\n  if (button instanceof HTMLButtonElement) button.disabled = true; setText('node-feedback', 'Updating workspace default…');\n  try {\n    const response = await fetch('/gateway/nodes/default', { method: 'POST', credentials: 'same-origin', headers: { accept: 'application/json', 'content-type': 'application/json', 'x-consuelo-csrf-token': csrf }, body: JSON.stringify({ nodeId }) });\n    if (!response.ok) throw new Error('default update denied'); await loadNodes(); setText('node-feedback', 'Default node updated. New untargeted OS calls will route there.');\n  } catch { if (button instanceof HTMLButtonElement) button.disabled = false; setText('node-feedback', 'Default node update failed. The existing default was kept.'); }\n}\nconst formatMonthlyPrice = (quote) => {\n  if (!quote || !Number.isSafeInteger(quote.monthlyPriceCents)) return 'Price available soon';\n  const value = quote.monthlyPriceCents / 100;\n  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: quote.currency || 'USD', maximumFractionDigits: 0 }).format(value) + '<small>/month</small>'; }\n  catch { return '$' + String(Math.ceil(value)) + '<small>/month</small>'; }\n};\nasync function loadPricing() {\n  const region = byId('cloud-region'); const selectedRegion = region instanceof HTMLSelectElement ? region.value : 'us-east1'; setText('pricing-status', 'Loading current monthly prices…');\n  try {\n    const response = await fetch('/gateway/nodes/pricing?region=' + encodeURIComponent(selectedRegion), { headers: { accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' });\n    if (!response.ok) throw new Error('pricing unavailable'); const payload = await response.json(); const quotes = Array.isArray(payload.quotes) ? payload.quotes : [];\n    document.querySelectorAll('[data-plan-price]').forEach((element) => { const quote = quotes.find((candidate) => candidate && candidate.plan && candidate.plan.id === element.getAttribute('data-plan-price')); element.innerHTML = formatMonthlyPrice(quote); });\n    setText('pricing-status', payload.pricingAvailable ? 'Monthly price includes an always-on node and managed operations.' : 'Plans are ready; monthly prices will appear when the current rate card is published.');\n  } catch { document.querySelectorAll('[data-plan-price]').forEach((element) => { element.textContent = 'Price available soon'; }); setText('pricing-status', 'Pricing is temporarily unavailable. No cloud node will be created from this screen yet.'); }\n}\nconst dialog = byId('add-node-dialog');\nbyId('add-node-button')?.addEventListener('click', () => { if (dialog instanceof HTMLDialogElement) { dialog.showModal(); void loadPricing(); } });\nbyId('add-node-close')?.addEventListener('click', () => { if (dialog instanceof HTMLDialogElement) dialog.close(); });\nbyId('add-node-cancel')?.addEventListener('click', () => { if (dialog instanceof HTMLDialogElement) dialog.close(); });\nbyId('cloud-region')?.addEventListener('change', () => void loadPricing());\nvoid loadNodes();";
}

function renderEnvironmentContent(): string {
  return `
      <section id="environment-loading" class="state-panel" aria-live="polite">
        <strong>Loading environments</strong>
        <p class="muted">Checking your workspace session and node connection.</p>
      </section>
      <section id="environment-error" class="state-panel" aria-live="polite" hidden>
        <strong>Environments unavailable</strong>
        <p class="muted">Sign in to this workspace or verify that its home node is online.</p>
      </section>
      <div id="environment-content" hidden>
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
      <section id="configuration-loading" class="state-panel" aria-live="polite">
        <strong>Loading workspace configuration</strong>
        <p class="muted">Checking your workspace session and node connection.</p>
      </section>
      <section id="configuration-error" class="state-panel" aria-live="polite" hidden>
        <strong>Configuration unavailable</strong>
        <p class="muted">Sign in to this workspace or verify that its home node is online.</p>
      </section>
      <div id="configuration-content" hidden>${panels}</div>`;
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
  <div class="shell">
    <aside class="sidebar" aria-label="Configuration sidebar">
      <div class="identity">Consuelo OS</div>
      ${renderNav(page)}
      <p class="muted">Private workspace state loads through authenticated Configuration APIs.</p>
    </aside>
    <main class="content">
      <header class="hero">
        <h1>${copy.title}</h1>
        <p>${copy.description}</p>
      </header>
      ${content}
    </main>
  </div>
  ${clientScript ? `<script>${clientScript}</script>` : ''}
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
