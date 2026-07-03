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
    expect(html).toContain('Here is the URL to connect');
    expect(html).toContain('to your workspace.');
    expect(html).toContain('href="https://chatgpt.com/apps#settings/Connectors"');
    expect(html).toContain('>ChatGPT</a>');
    expect(html).toContain('<code id="mcp-url">https://kokayi.consuelohq.com/mcp</code>');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Copy MCP URL"');
    expect(html).toContain('support@consuelohq.com');
    expect(html).toContain('USA');
    expect(html).toContain('Online');
    expect(html).toContain('Systems Engineer');
    expect(html).toContain('href="/careers/systems-engineer"');
    expect(html).toContain('Connect to your cloud agents');
    expect(html).toContain('Settings');
    expect(html).toContain('Configuration');
    expect(html).toContain('href="/settings"');
    expect(html).toContain('Sites');
    expect(html).toContain('Go to market');
    expect(html).toContain('Artifacts');
    expect(html).toContain('Observability');
    expect(html).toContain('href="https://sites.consuelohq.com/observability"');
    expect(html).not.toContain('href="https://sites.consuelohq.com/tracing"');
    expect(html).toContain('Code review');
    expect(html).toContain('Guides and Tips');
    expect(html).toContain('Documentation');
    expect(html).toContain('Writing');
    expect(html).toContain('Decision loops');
    expect(html).toContain('Connected to 2 local agents');
    expect(html).toContain('Codex');
    expect(html).toContain('OpenCode');
    expect(html).not.toContain('<li>Cursor</li>');
    expect(html).not.toContain('[GTM]');
    expect(html).not.toContain('[Office]');
    expect(html).not.toContain('[Tracing]');
    expect(html).not.toContain('[Diffs]');
  });

  it('uses workspace-specific empty local-agent copy', () => {
    const html = renderLauncherOnboarding({
      mcpUrl: 'https://os.consuelohq.com/mcp',
      localAgents: [],
    });

    expect(html).toContain('Connected to 0 local agents');
    expect(html).toContain('No local agents connected to workspace yet.');
    expect(html).not.toContain('No local agents connected yet.');
  });
});
