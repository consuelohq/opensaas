import { describe, expect, it } from 'vitest';

import { renderLauncherOnboarding } from '../scripts/lib/launcher-onboarding';

describe('launcher onboarding', () => {
  it('renders ChatGPT cloud-agent onboarding with copyable MCP URL and local agent status', () => {
    const html = renderLauncherOnboarding({
      mcpUrl: 'https://kokayi.consuelohq.com/mcp',
      localAgents: [
        { name: 'codex', label: 'Codex', connected: true },
        { name: 'opencode', label: 'OpenCode', connected: true },
        { name: 'cursor', label: 'Cursor', connected: false },
      ],
    });

    expect(html).toContain('<title>Consuelo OS</title>');
    expect(html).toContain('Consuelo OS');
    expect(html).toContain('Welcome to Consuelo OS');
    expect(html).toContain('Here is your URL to connect to');
    expect(html).toContain('href="https://chatgpt.com/apps#settings/Connectors"');
    expect(html).toContain('>ChatGPT</a>');
    expect(html).toContain('<code id="mcp-url">https://kokayi.consuelohq.com/mcp</code>');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Copy MCP URL"');
    expect(html).toContain('Connect to your cloud agents');
    expect(html).toContain('Connected to 2 local agents');
    expect(html).toContain('Codex');
    expect(html).toContain('OpenCode');
    expect(html).not.toContain('<li>Cursor</li>');
  });
});
