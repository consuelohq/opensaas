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
    return '<p class="muted">No local agents connected yet.</p>';
  }

  return `<ul>${connectedAgents.map((agent) => `<li>${escapeHtml(agent.label)}</li>`).join('')}</ul>`;
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
    :root { color-scheme: light dark; background: #f6f4ef; color: #161512; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #f6f4ef; color: #161512; }
    main { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(360px, 42vw); }
    .content { padding: clamp(28px, 5vw, 72px); display: flex; flex-direction: column; gap: 64px; }
    .identity { font-size: 13px; font-weight: 700; letter-spacing: 0; }
    .hero { max-width: 680px; display: grid; gap: 24px; }
    h1 { margin: 0; font-size: clamp(40px, 6vw, 76px); line-height: 0.96; letter-spacing: 0; }
    p { margin: 0; font-size: 17px; line-height: 1.55; }
    a { color: #1f5f8f; text-underline-offset: 3px; }
    .url-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: stretch; gap: 10px; max-width: 760px; }
    code { display: flex; align-items: center; min-width: 0; padding: 13px 14px; border: 1px solid #d4cec1; background: #fffaf1; color: #161512; overflow-x: auto; white-space: nowrap; font: 13px/1.4 "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
    button { border: 1px solid #161512; background: #161512; color: #fffaf1; padding: 0 18px; min-width: 86px; font: inherit; cursor: pointer; }
    button:focus-visible { outline: 3px solid #8ab8d6; outline-offset: 2px; }
    .panel { background: #101010; color: #f7f4ed; padding: clamp(28px, 4vw, 56px); display: flex; flex-direction: column; justify-content: space-between; gap: 48px; }
    .panel h2 { margin: 0 0 16px; font-size: 22px; line-height: 1.1; letter-spacing: 0; }
    .status { display: grid; gap: 12px; }
    .status p { font-size: 14px; color: #d7d0c2; }
    .muted { color: #a9a091; }
    ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
    li { font-size: 14px; }
    li::before { content: "●"; margin-right: 8px; color: #8ab8d6; }
    @media (max-width: 860px) { main { grid-template-columns: 1fr; } .content { gap: 42px; } .url-row { grid-template-columns: 1fr; } button { min-height: 44px; } }
  </style>
</head>
<body>
  <main>
    <section class="content" aria-label="Consuelo OS onboarding">
      <div class="identity">Consuelo OS</div>
      <div class="hero">
        <h1>Welcome to Consuelo OS</h1>
        <p>Here is your URL to connect to <a href="${CHATGPT_CONNECTORS_URL}" target="_blank" rel="noopener noreferrer">ChatGPT</a>.</p>
        <div class="url-row">
          <code id="mcp-url">${escapedMcpUrl}</code>
          <button type="button" aria-label="Copy MCP URL" data-copy-target="mcp-url">Copy</button>
        </div>
      </div>
    </section>
    <aside class="panel" aria-label="Cloud agents">
      <section>
        <h2>Connect to your cloud agents</h2>
        <p>ChatGPT is ready now.</p>
      </section>
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
