export type ConfigurationPageId =
  | 'configuration'
  | 'tools'
  | 'environments'
  | 'secrets';

const CONFIGURATION_PAGES: Array<{
  id: ConfigurationPageId;
  label: string;
  href: string;
}> = [
  { id: 'configuration', label: 'Overview', href: '/configuration' },
  { id: 'tools', label: 'Tools', href: '/tools' },
  { id: 'environments', label: 'Environments', href: '/environments' },
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
    label { cursor: pointer; }
    [hidden] { display: none !important; }
    @media (max-width: 900px) {
      .shell { grid-template-columns: 1fr; }
      .sidebar { border-right: 0; border-bottom: 1px solid var(--site-color-line); }
      .detail-grid { grid-template-columns: 1fr; }
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

    function toggleRow(kind, name, enabled, category) {
      return '<tr><td><label><input type="checkbox" class="configuration-toggle" data-kind="' + escapeHtml(kind) + '" data-name="' + escapeHtml(name) + '" ' + (enabled ? 'checked' : '') + '> ' + escapeHtml(name) + '</label></td><td>' + escapeHtml(kind) + '</td><td>' + pill(enabled ? 'connected' : 'disabled') + '</td><td>' + (category ? '<code>' + escapeHtml(category) + '</code>' : '<span class="muted">—</span>') + '</td></tr>';
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
      setHtml('tool-rows', tools.length ? tools.map((item) => toggleRow(item.kind, item.name, item.enabled, item.category)).join('') : emptyRow(4, 'No tools found.'));

      const skills = Array.isArray(snapshot.skills) ? snapshot.skills : [];
      setHtml('skill-summary', detail('Enabled skills', String(skills.filter((skill) => skill.enabled).length)) + detail('Disabled skills', String((overlay.disabledSkills || []).length)));
      setHtml('skill-rows', skills.length ? skills.map((item) => toggleRow(item.kind, item.name, item.enabled, item.category)).join('') : emptyRow(4, 'No skills found.'));

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
  `;
}

function renderOverviewPanels(): string {
  return `
        <section class="panel-section" id="configuration">
          <header class="panel-header"><h2>Configuration</h2><p>Workspace and node configuration loaded through the signed gateway.</p></header>
          <dl class="detail-grid" id="configuration-details"></dl>
          <p id="toggle-status" class="muted">Changes are authorized and written through /gateway/configuration/overlay.</p>
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

function renderPlannedPanel(page: 'environments' | 'secrets'): string {
  if (page === 'environments') {
    return `
      <section class="state-panel" aria-live="polite">
        <strong>Environment registry is not available yet</strong>
        <p class="muted">This route is ready for the environment model. No environment values or private workspace state are embedded in this public shell.</p>
      </section>`;
  }

  return `
      <section class="state-panel" aria-live="polite">
        <strong>Secret connections are not available yet</strong>
        <p class="muted">This route is ready for the credential broker. Never paste a credential into an agent conversation.</p>
      </section>`;
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
    : renderPlannedPanel(page);

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
  ${requiresConfigurationSnapshot ? `<script>${configurationClientScript()}</script>` : ''}
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
