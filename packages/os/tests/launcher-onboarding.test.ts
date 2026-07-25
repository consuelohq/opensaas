import { describe, expect, it } from 'vitest';

import {
  createWorkspaceProductUrls,
  renderLauncherOnboarding,
} from '../scripts/lib/launcher-onboarding';

describe('launcher onboarding', () => {
  it.each([
    {
      workspaceHost: 'internal.consuelohq.com',
      expected: {
        launcher: 'https://internal.consuelohq.com/',
        gtm: 'https://internal.consuelohq.com/gtm',
        artifacts: 'https://internal.consuelohq.com/artifacts',
        observability: 'https://internal.consuelohq.com/observability',
        diffs: 'https://internal.consuelohq.com/diffs',
      },
    },
    {
      workspaceHost: 'acme-customer.consuelohq.com',
      expected: {
        launcher: 'https://acme-customer.consuelohq.com/',
        gtm: 'https://acme-customer.consuelohq.com/gtm',
        artifacts: 'https://acme-customer.consuelohq.com/artifacts',
        observability: 'https://acme-customer.consuelohq.com/observability',
        diffs: 'https://acme-customer.consuelohq.com/diffs',
      },
    },
  ])('derives product URLs from authenticated workspace host $workspaceHost', ({ workspaceHost, expected }) => {
    expect(createWorkspaceProductUrls(workspaceHost)).toMatchObject(expected);
  });

  it('rejects platform hosts instead of using a GTM fallback', () => {
    for (const host of ['app.consuelohq.com', 'sites.consuelohq.com', 'os.consuelohq.com']) {
      expect(() => createWorkspaceProductUrls(host)).toThrow(/workspace host/i);
    }
  });

  it('renders ChatGPT cloud-agent onboarding with copyable MCP URL and local agent status', () => {
    const html = renderLauncherOnboarding({
      workspaceHost: 'acme-customer.consuelohq.com',
      mcpUrl: 'https://kokayi.consuelohq.com/mcp',
      localAgents: [
        { name: 'codex', label: 'Codex', status: 'verified' },
        { name: 'opencode', label: 'OpenCode', status: 'verified' },
        { name: 'cursor', label: 'Cursor', status: 'configured' },
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
    expect(html).toContain('<h2 class="section-title">Configuration</h2>');
    expect(html).toContain('href="/tools"');
    expect(html).toContain('href="/environments"');
    expect(html).toContain('href="/secrets"');
    expect(html).not.toContain('href="/configuration"');
    expect(html).not.toContain('<h2 class="section-title">Settings</h2>');
    expect(html).toContain('Sites');
    expect(html).toContain('Go to market');
    expect(html).toContain('Artifacts');
    expect(html).toContain('Observability');
    expect(html).toContain('href="https://acme-customer.consuelohq.com/gtm"');
    expect(html).toContain('href="https://acme-customer.consuelohq.com/artifacts"');
    expect(html).toContain('href="https://acme-customer.consuelohq.com/observability"');
    expect(html).toContain('href="https://acme-customer.consuelohq.com/diffs"');
    expect(html).not.toMatch(/https:\/\/(?:sites|app|internal|testing)\.consuelohq\.com\/(?:gtm|artifacts|observability|diffs)/);
    expect(html).toContain('Code review');
    expect(html).toContain('Guides and Tips');
    expect(html).toContain('Documentation');
    expect(html).toContain('Writing');
    expect(html).toContain('Decision loops');
    const sitesIndex = html.indexOf('<h2 class="section-title">Sites</h2>');
    const guidesIndex = html.indexOf('<h2 class="section-title">Guides and Tips</h2>');
    const writingIndex = html.indexOf('<h2 class="section-title">Writing</h2>');
    const configurationIndex = html.indexOf('<h2 class="section-title">Configuration</h2>');
    expect(sitesIndex).toBeGreaterThan(-1);
    expect(guidesIndex).toBeGreaterThan(sitesIndex);
    expect(writingIndex).toBeGreaterThan(guidesIndex);
    expect(configurationIndex).toBeGreaterThan(writingIndex);
    expect(html.indexOf('href="/tools"')).toBeLessThan(html.indexOf('href="/environments"'));
    expect(html.indexOf('href="/environments"')).toBeLessThan(html.indexOf('href="/secrets"'));
    expect(html).toContain('Connected to 2 local agents');
    expect(html).toContain('data-agent-count');
    expect(html).toContain('data-agent-list');
    expect(html).toContain('https://os.consuelohq.com/workspace/agents');
    expect(html).toContain('workspace_host');
    expect(html).toContain('window.location.hostname');
    expect(html).toContain('.textContent =');
    expect(html).not.toContain('.innerHTML =');
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
      workspaceHost: 'internal.consuelohq.com',
      mcpUrl: 'https://os.consuelohq.com/mcp',
      localAgents: [],
    });

    expect(html).toContain('Connected to 0 local agents');
    expect(html).toContain('No local agents connected to workspace yet.');
    expect(html).not.toContain('No local agents connected yet.');
    expect(html).toContain('data-agent-fallback');
  });
});
