export type LauncherLocalAgent = {
  name: string;
  label: string;
  connected: boolean;
};

export type LauncherOnboardingOptions = {
  mcpUrl: string;
  localAgents?: LauncherLocalAgent[];
};

const CHATGPT_CONNECTORS_URL = 'https://chatgpt.com/apps#settings/Connectors';

const launcherLinks = {
  sites: [
    { label: 'Go to market', href: 'https://sites.consuelohq.com/gtm' },
    { label: 'Artifacts', href: 'https://sites.consuelohq.com/office' },
    { label: 'Observability', href: 'https://sites.consuelohq.com/tracing' },
    { label: 'Code review', href: 'https://sites.consuelohq.com/diffs' },
  ],
  guides: [{ label: 'Documentation', href: 'https://docs.consuelohq.com/' }],
  writing: [{ label: 'Decision loops', href: '/writing/on-decision-loops' }],
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function connectedAgentItems(localAgents: LauncherLocalAgent[]): string {
  const connectedAgents = localAgents.filter((agent) => agent.connected);
  if (connectedAgents.length === 0) {
    return '<p class="muted">No local agents connected to workspace yet.</p>';
  }

  return `<ul class="agent-list">${connectedAgents.map((agent) => `<li>${escapeHtml(agent.label)}</li>`).join('')}</ul>`;
}

function navLinks(items: ReadonlyArray<{ label: string; href: string }>): string {
  return `<ul class="link-list">${items
    .map((item) => `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a></li>`)
    .join('')}</ul>`;
}

export function renderLauncherOnboarding(options: LauncherOnboardingOptions): string {
  const localAgents = options.localAgents ?? [];
  const connectedLocalAgentCount = localAgents.filter((agent) => agent.connected).length;
  const localAgentNoun = connectedLocalAgentCount === 1 ? 'agent' : 'agents';
  const escapedMcpUrl = escapeHtml(options.mcpUrl);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Consuelo OS</title>
  <style>
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
    main { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 34vw); }
    .content { padding: clamp(28px, 5vw, 74px); display: flex; flex-direction: column; gap: clamp(52px, 10vw, 124px); }
    .identity, .meta-label, .section-title, button { font-family: var(--site-font-mono); font-weight: 700; letter-spacing: 0; text-transform: uppercase; }
    .identity { font-size: 13px; line-height: 1; }
    .hero { max-width: 760px; display: grid; gap: 24px; }
    h1 { margin: 0; font-size: clamp(44px, 7vw, 92px); font-weight: 500; line-height: 0.9; letter-spacing: 0; }
    p { margin: 0; font-size: clamp(18px, 1.8vw, 24px); line-height: 1.5; }
    a { color: inherit; text-decoration-color: color-mix(in srgb, var(--site-color-accent) 70%, transparent); text-underline-offset: 4px; }
    a:hover { color: var(--site-color-accent); }
    .url-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: stretch; gap: 10px; max-width: 820px; }
    code { display: flex; align-items: center; min-width: 0; padding: 14px 15px; border: 1px solid var(--site-color-line-strong); background: var(--site-color-surface); color: var(--site-color-ink); overflow-x: auto; white-space: nowrap; font: 13px/1.4 var(--site-font-mono); }
    button { border: 1px solid var(--site-color-ink); background: var(--site-color-ink); color: var(--site-color-paper); padding: 0 18px; min-width: 86px; cursor: pointer; }
    button:focus-visible { outline: 3px solid var(--site-color-accent); outline-offset: 2px; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 34px; max-width: 760px; }
    .meta-item { display: grid; gap: 6px; }
    .meta-label, .section-title { color: var(--site-color-muted); font-size: 11px; line-height: 1.2; }
    .meta-value, .panel p, li { font-size: 15px; line-height: 1.45; }
    .panel { border-left: 1px solid var(--site-color-line); background: var(--site-color-panel); padding: clamp(28px, 4vw, 58px); display: flex; flex-direction: column; justify-content: space-between; gap: 52px; }
    .panel-stack { display: grid; gap: 44px; }
    .section { display: grid; gap: 13px; }
    .section-title { margin: 0; }
    .muted { color: var(--site-color-muted); }
    ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 9px; }
    li { color: var(--site-color-ink); }
    .link-list a { color: var(--site-color-muted); text-decoration: none; }
    .link-list a:hover { color: var(--site-color-accent); text-decoration: underline; }
    .agent-list li::before { content: "●"; margin-right: 8px; color: var(--site-color-secondary); }
    .status { display: grid; gap: 12px; }
    .status p { font-size: 14px; }
    @media (max-width: 860px) {
      main { grid-template-columns: 1fr; }
      .content { gap: 54px; }
      .panel { border-left: 0; border-top: 1px solid var(--site-color-line); }
      .url-row, .meta-grid { grid-template-columns: 1fr; }
      button { min-height: 44px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="content" aria-label="Consuelo OS onboarding">
      <div class="identity">Consuelo OS</div>
      <div class="hero">
        <h1>Welcome to Consuelo OS</h1>
        <p>Here is the URL to connect <a href="${CHATGPT_CONNECTORS_URL}" target="_blank" rel="noopener noreferrer">ChatGPT</a> to your workspace.</p>
        <div class="url-row">
          <code id="mcp-url">${escapedMcpUrl}</code>
          <button type="button" aria-label="Copy MCP URL" data-copy-target="mcp-url">Copy</button>
        </div>
        <dl class="meta-grid" aria-label="Consuelo OS details">
          <div class="meta-item"><dt class="meta-label">Contact</dt><dd class="meta-value"><a href="mailto:support@consuelohq.com">support@consuelohq.com</a></dd></div>
          <div class="meta-item"><dt class="meta-label">Location</dt><dd class="meta-value">USA</dd></div>
          <div class="meta-item"><dt class="meta-label">Status</dt><dd class="meta-value">Online</dd></div>
          <div class="meta-item"><dt class="meta-label">Open position</dt><dd class="meta-value"><a href="/careers/systems-engineer">Systems Engineer</a></dd></div>
        </dl>
      </div>
    </section>
    <aside class="panel" aria-label="Cloud agents">
      <div class="panel-stack">
        <section class="section">
          <h2 class="section-title">Connect to your cloud agents</h2>
          <p class="muted">ChatGPT is ready now.</p>
        </section>
        <section class="section">
          <h2 class="section-title">Sites</h2>
          ${navLinks(launcherLinks.sites)}
        </section>
        <section class="section">
          <h2 class="section-title">Guides and Tips</h2>
          ${navLinks(launcherLinks.guides)}
        </section>
        <section class="section">
          <h2 class="section-title">Writing</h2>
          ${navLinks(launcherLinks.writing)}
        </section>
      </div>
      <section class="status" aria-label="Local agents">
        <p>Connected to ${connectedLocalAgentCount} local ${localAgentNoun}</p>
        ${connectedAgentItems(localAgents)}
      </section>
    </aside>
  </main>
  <script>
    document.querySelector('[data-copy-target="mcp-url"]')?.addEventListener('click', async () => {
      const value = document.getElementById('mcp-url')?.textContent ?? '';
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        document.querySelector('[data-copy-target="mcp-url"]')?.setAttribute('data-copy-status', 'failed');
      }
    });
  </script>
</body>
</html>
`;
}
