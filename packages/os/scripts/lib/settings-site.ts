import {
  buildSettingsSnapshot,
  type SettingsManifestItem,
  type SettingsRunBook,
  type SettingsSnapshot,
} from './settings-snapshot';

export type SettingsSectionId =
  | 'configuration'
  | 'connections'
  | 'tools'
  | 'skills'
  | 'run-books'
  | 'capabilities';

const SETTINGS_SECTIONS: Array<{ id: SettingsSectionId; label: string }> = [
  { id: 'configuration', label: 'Configuration' },
  { id: 'connections', label: 'Connections' },
  { id: 'tools', label: 'Tools' },
  { id: 'skills', label: 'Skills' },
  { id: 'run-books', label: 'Run Books' },
  { id: 'capabilities', label: 'Capabilities' },
];

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function statusClass(status: string): string {
  if (status === 'connected') return 'status-connected';
  if (status === 'not_configured') return 'status-muted';
  return 'status-warning';
}

function renderStatusPill(status: string): string {
  return `<span class="status-pill ${statusClass(status)}">${escapeHtml(status.replaceAll('_', ' '))}</span>`;
}

function renderConfigurationSection(snapshot: SettingsSnapshot): string {
  const workspace = snapshot.workspace;
  return `
    <section class="panel-section" id="configuration" aria-labelledby="configuration-title">
      <header class="panel-header">
        <h2 id="configuration-title">Configuration</h2>
        <p>Workspace-scoped OS settings with manifest overlay at <code>${escapeHtml(snapshot.overlay.path)}</code>.</p>
      </header>
      <dl class="detail-grid">
        <div><dt>Mode</dt><dd>${escapeHtml(workspace.mode ?? 'unknown')}</dd></div>
        <div><dt>Workspace host</dt><dd><code>${escapeHtml(workspace.workspaceHost ?? 'not configured')}</code></dd></div>
        <div><dt>Workspace slug</dt><dd>${escapeHtml(workspace.workspaceSlug ?? 'not configured')}</dd></div>
        <div><dt>Connector</dt><dd>${escapeHtml(workspace.connectorId ?? 'not configured')}</dd></div>
        <div><dt>Transport</dt><dd>${escapeHtml(workspace.connectorTransport ?? 'not configured')}</dd></div>
        <div><dt>MCP URL</dt><dd><code>${escapeHtml(workspace.mcpUrl ?? 'not configured')}</code></dd></div>
        <div><dt>Generated</dt><dd><code>${escapeHtml(snapshot.generatedAt)}</code></dd></div>
        <div><dt>Overlay updated</dt><dd><code>${escapeHtml(snapshot.overlay.updatedAt ?? 'never')}</code></dd></div>
        <div><dt>Preview source</dt><dd id="preview-source">embedded snapshot</dd></div>
        <div><dt>Toggle writes</dt><dd id="toggle-status" class="muted">Signed POST to /gateway/settings/overlay when hosted.</dd></div>
      </dl>
    </section>
  `;
}

function renderToggleRow(kind: 'tool' | 'skill' | 'workflow', name: string, enabled: boolean, category = ''): string {
  return `
    <tr>
      <td><label><input type="checkbox" class="settings-toggle" data-kind="${escapeHtml(kind)}" data-name="${escapeHtml(name)}" ${enabled ? 'checked' : ''} /> ${escapeHtml(name)}</label></td>
      <td>${escapeHtml(kind)}</td>
      <td>${enabled ? '<span class="status-pill status-connected">enabled</span>' : '<span class="status-pill status-muted">disabled</span>'}</td>
      <td>${category ? `<code>${escapeHtml(category)}</code>` : '<span class="muted">—</span>'}</td>
    </tr>`;
}

function renderManifestItemRows(items: SettingsManifestItem[]): string {
  if (items.length === 0) return '<tr><td colspan="4" class="empty">No manifest entries found.</td></tr>';
  return items.map((item) => renderToggleRow(item.kind, item.name, item.enabled, item.category)).join('');
}

function renderConnectionsSection(snapshot: SettingsSnapshot): string {
  const cloudRows = snapshot.cloudConnectors.map((connector) => `
    <tr>
      <td>${escapeHtml(connector.label)}</td>
      <td>${escapeHtml(connector.kind)}</td>
      <td>${renderStatusPill(connector.status)}</td>
      <td>${connector.placeholder ? '<span class="muted">Coming soon</span>' : 'Active connector'}</td>
      <td><code>${escapeHtml(connector.mcpUrl ?? '—')}</code></td>
    </tr>`).join('');

  const localRows = snapshot.localAgents.length > 0
    ? snapshot.localAgents.map((agent) => `
    <tr>
      <td>${escapeHtml(agent.label)}</td>
      <td>${escapeHtml(agent.kind)}</td>
      <td>${renderStatusPill(agent.status)}</td>
      <td>${agent.detected ? 'Detected' : 'Not detected'}</td>
      <td>${agent.connected ? 'Connected' : 'Not connected'}</td>
    </tr>`).join('')
    : '<tr><td colspan="5" class="empty">No local agents detected on this machine.</td></tr>';

  return `
    <section class="panel-section" id="connections" aria-labelledby="connections-title">
      <header class="panel-header">
        <h2 id="connections-title">Connections</h2>
        <p>Cloud MCP connectors and local agent bindings for this workspace.</p>
      </header>
      <div class="subsection">
        <h3>Cloud agents</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Kind</th><th>Status</th><th>Notes</th><th>MCP URL</th></tr></thead>
            <tbody>${cloudRows}</tbody>
          </table>
        </div>
      </div>
      <div class="subsection">
        <h3>Local agents</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Kind</th><th>Status</th><th>Detection</th><th>Connection</th></tr></thead>
            <tbody>${localRows}</tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function renderToolsSection(snapshot: SettingsSnapshot): string {
  const manifest = snapshot.manifest;
  return `
    <section class="panel-section" id="tools" aria-labelledby="tools-title">
      <header class="panel-header">
        <h2 id="tools-title">Tools</h2>
        <p>Enable or disable facade tools via <code>manifest.overlay.json</code>. Disabled tools disappear from MCP, steering, and search.</p>
      </header>
      <dl class="detail-grid">
        <div><dt>Enabled tools</dt><dd>${snapshot.tools.filter((tool) => tool.enabled).length}</dd></div>
        <div><dt>Disabled tools</dt><dd>${snapshot.overlay.disabledTools.length}</dd></div>
        <div><dt>Core tools</dt><dd>${manifest.coreTools}</dd></div>
        <div><dt>CLI fallback</dt><dd><code>bun ./scripts/os.ts settings disable-tool &lt;name&gt;</code></dd></div>
      </dl>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Kind</th><th>Status</th><th>Category</th></tr></thead>
          <tbody>${renderManifestItemRows(snapshot.tools)}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderSkillsSection(snapshot: SettingsSnapshot): string {
  const selected = snapshot.manifest.selectedSkills;
  const selectedMarkup = selected.length > 0
    ? `<ul class="inline-list">${selected.map((skill) => `<li>${escapeHtml(skill)}</li>`).join('')}</ul>`
    : '<p class="muted">No install-time skill selection recorded.</p>';

  return `
    <section class="panel-section" id="skills" aria-labelledby="skills-title">
      <header class="panel-header">
        <h2 id="skills-title">Skills</h2>
        <p>OS skills exposed through MCP. Disable a skill to remove it from tools/list and steering.</p>
      </header>
      <dl class="detail-grid">
        <div><dt>Enabled skills</dt><dd>${snapshot.skills.filter((skill) => skill.enabled).length}</dd></div>
        <div><dt>Disabled skills</dt><dd>${snapshot.overlay.disabledSkills.length}</dd></div>
        <div><dt>Selected at install</dt><dd>${selectedMarkup}</dd></div>
        <div><dt>CLI fallback</dt><dd><code>bun ./scripts/os.ts settings disable-skill &lt;name&gt;</code></dd></div>
      </dl>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Kind</th><th>Status</th><th>Category</th></tr></thead>
          <tbody>${renderManifestItemRows(snapshot.skills)}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderRunBookRows(runBooks: SettingsRunBook[]): string {
  if (runBooks.length === 0) return '<tr><td colspan="5" class="empty">No workflow bundles found.</td></tr>';
  return runBooks.map((runBook) => `
    <tr>
      <td><label><input type="checkbox" class="settings-toggle" data-kind="workflow" data-name="${escapeHtml(runBook.id)}" ${runBook.enabled ? 'checked' : ''} /> ${escapeHtml(runBook.id)}</label></td>
      <td><code>${escapeHtml(runBook.aliases.join(', ') || '—')}</code></td>
      <td>${runBook.enabled ? '<span class="status-pill status-connected">enabled</span>' : '<span class="status-pill status-muted">disabled</span>'}</td>
      <td>${runBook.roleCount}</td>
      <td>${runBook.toolCount}</td>
    </tr>`).join('');
}

function renderRunBooksSection(snapshot: SettingsSnapshot): string {
  return `
    <section class="panel-section" id="run-books" aria-labelledby="run-books-title">
      <header class="panel-header">
        <h2 id="run-books-title">Run Books</h2>
        <p>Workflow bundles from <code>workflow-bundles.json</code>. Overlay disables are recorded now; hook routing respects them in a follow-up.</p>
      </header>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Workflow</th><th>Aliases</th><th>Status</th><th>Roles</th><th>Tools</th></tr></thead>
          <tbody>${renderRunBookRows(snapshot.runBooks)}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderCapabilitiesSection(snapshot: SettingsSnapshot): string {
  const rows = snapshot.capabilities.map((capability) => `
    <tr>
      <td>${escapeHtml(capability.title)}</td>
      <td><code>${escapeHtml(capability.id)}</code></td>
      <td>${renderStatusPill(capability.status)}</td>
      <td>${escapeHtml(capability.message)}</td>
    </tr>`).join('');

  return `
    <section class="panel-section" id="capabilities" aria-labelledby="capabilities-title">
      <header class="panel-header">
        <h2 id="capabilities-title">Capabilities</h2>
        <p>Doctor-quality capability checks for this OS home.</p>
      </header>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Capability</th><th>ID</th><th>Status</th><th>Message</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function settingsStyles(): string {
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
    .sidebar {
      border-right: 1px solid var(--site-color-line);
      background: var(--site-color-panel);
      padding: 28px 18px;
      display: grid;
      align-content: start;
      gap: 28px;
    }
    .identity, .nav-label, .status-pill, code, h3 { font-family: var(--site-font-mono); }
    .identity { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    .nav { display: grid; gap: 8px; }
    .nav a {
      color: var(--site-color-muted);
      text-decoration: none;
      font-size: 14px;
      padding: 6px 8px;
      border-left: 2px solid transparent;
    }
    .nav a:hover, .nav a.is-active { color: var(--site-color-accent); border-left-color: var(--site-color-accent); }
    .content { padding: clamp(24px, 4vw, 48px); display: grid; gap: 42px; }
    h1, h2, h3, p, dl, dd, dt, ul, li { margin: 0; }
    h1 { font-size: clamp(34px, 5vw, 56px); line-height: 0.95; font-weight: 500; }
    h2 { font-size: 24px; font-weight: 500; }
    h3 { font-size: 12px; text-transform: uppercase; color: var(--site-color-muted); margin-bottom: 10px; }
    .hero { display: grid; gap: 12px; max-width: 760px; }
    .panel-section { display: grid; gap: 18px; max-width: 1080px; }
    .panel-header { display: grid; gap: 8px; }
    .panel-header p, .muted, .empty { color: var(--site-color-muted); }
    .detail-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px 28px;
    }
    .detail-grid dt { font-family: var(--site-font-mono); font-size: 11px; text-transform: uppercase; color: var(--site-color-muted); margin-bottom: 4px; }
    .detail-grid dd { font-size: 15px; }
    .subsection { display: grid; gap: 12px; }
    .table-wrap { overflow-x: auto; }
    table { border-collapse: collapse; min-width: 720px; width: 100%; }
    th, td { padding: 8px 12px 8px 0; text-align: left; vertical-align: top; font-size: 14px; }
    th { font-family: var(--site-font-mono); font-size: 11px; text-transform: uppercase; color: var(--site-color-muted); }
    code { font-size: 12px; word-break: break-all; }
    .status-pill {
      display: inline-block;
      padding: 2px 8px;
      border: 1px solid var(--site-color-line-strong);
      border-radius: 999px;
      font-size: 11px;
      text-transform: uppercase;
    }
    .status-connected { color: var(--site-color-secondary); }
    .status-muted { color: var(--site-color-muted); }
    .status-warning { color: var(--site-color-accent); }
    .inline-list { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
    .inline-list li {
      border: 1px solid var(--site-color-line);
      padding: 4px 8px;
      font-family: var(--site-font-mono);
      font-size: 12px;
    }
    .settings-toggle { margin-right: 8px; }
    label { cursor: pointer; }
    @media (max-width: 900px) {
      .shell { grid-template-columns: 1fr; }
      .sidebar { border-right: 0; border-bottom: 1px solid var(--site-color-line); }
      .detail-grid { grid-template-columns: 1fr; }
    }
  `;
}

function renderNav(activeSection: SettingsSectionId = 'configuration'): string {
  return `<nav class="nav" aria-label="Settings sections">${SETTINGS_SECTIONS.map((section) => {
    const active = section.id === activeSection ? ' class="is-active"' : '';
    return `<a href="#${section.id}"${active}>${escapeHtml(section.label)}</a>`;
  }).join('')}</nav>`;
}

function embeddedSnapshotScript(snapshot: SettingsSnapshot): string {
  const serialized = JSON.stringify(snapshot).replaceAll('<', '\\u003c');
  return `
    window.__CONSUELO_SETTINGS__ = ${serialized};
    async function hydrateSettingsFromGateway() {
      const previewSource = document.getElementById('preview-source');
      try {
        const response = await fetch('/gateway/settings/snapshot', { headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error('gateway settings snapshot returned ' + response.status);
        const payload = await response.json();
        if (!payload || typeof payload !== 'object') throw new Error('invalid gateway settings snapshot');
        window.__CONSUELO_SETTINGS__ = payload.snapshot ?? payload;
        if (previewSource) previewSource.textContent = 'hosted gateway snapshot';
      } catch {
        if (previewSource) previewSource.textContent = 'embedded snapshot';
      }
    }
    async function postOverlayToggle(kind, name, enabled) {
      const status = document.getElementById('toggle-status');
      try {
        const response = await fetch('/gateway/settings/overlay', {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({ kind, name, enabled }),
        });
        if (!response.ok) throw new Error('gateway settings overlay returned ' + response.status);
        const payload = await response.json();
        if (!payload || typeof payload !== 'object' || payload.ok === false) throw new Error('overlay patch failed');
        window.__CONSUELO_SETTINGS__ = payload.snapshot ?? payload;
        if (status) status.textContent = 'Overlay updated for ' + kind + ' ' + name + '. Reload to refresh tables.';
        window.location.reload();
      } catch {
        if (status) status.textContent = 'Toggle requires hosted gateway auth or CLI: bun ./scripts/os.ts settings ' + (enabled ? 'enable' : 'disable') + '-' + kind + ' ' + name;
      }
    }
    document.querySelectorAll('.settings-toggle').forEach((input) => {
      input.addEventListener('change', (event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLInputElement)) return;
        const kind = target.dataset.kind;
        const name = target.dataset.name;
        if (!kind || !name) return;
        void postOverlayToggle(kind, name, target.checked);
      });
    });
    hydrateSettingsFromGateway();
  `;
}

export function renderSettingsSite(snapshot: SettingsSnapshot): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Settings - Consuelo OS</title>
  <style>${settingsStyles()}</style>
</head>
<body>
  <div class="shell">
    <aside class="sidebar" aria-label="Settings navigation">
      <div class="identity">Consuelo OS</div>
      ${renderNav()}
      <p class="muted">Manifest overlay toggles write through signed /gateway/settings/overlay when hosted.</p>
    </aside>
    <main class="content">
      <header class="hero">
        <h1>Settings</h1>
        <p>See what is connected to your workspace and what agents can use here.</p>
      </header>
      ${renderConfigurationSection(snapshot)}
      ${renderConnectionsSection(snapshot)}
      ${renderToolsSection(snapshot)}
      ${renderSkillsSection(snapshot)}
      ${renderRunBooksSection(snapshot)}
      ${renderCapabilitiesSection(snapshot)}
    </main>
  </div>
  <script>${embeddedSnapshotScript(snapshot)}</script>
</body>
</html>`;
}

export function buildSettingsSite(home: string): string {
  return renderSettingsSite(buildSettingsSnapshot(home));
}