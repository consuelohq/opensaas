import { describe, expect, it } from 'vitest';

import { renderLauncherOnboarding } from '../scripts/lib/launcher-onboarding';

describe('launcher onboarding', () => {
  it('renders ChatGPT cloud-agent onboarding with copyable MCP URL and local agent status', () => {
    const html = renderLauncherOnboarding({
      mcpUrl: 'https://kokayi.consuelohq.com/mcp',
      workspaceHostname: 'internal.consuelohq.com',
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
    expect(html).toContain('<button class="url-copy" type="button" aria-label="Copy MCP URL" data-copy-mcp>');
    expect(html).toContain('<code id="mcp-url">https://kokayi.consuelohq.com/mcp</code>');
    expect(html).toContain('<span data-copy-label aria-live="polite">COPY</span>');
    expect(html).toContain("document.querySelector('[data-copy-mcp]')");
    expect(html).toContain('if (!navigator.clipboard)');
    expect(html).toContain('await navigator.clipboard.writeText(value)');
    expect(html).toContain("label.textContent = 'COPIED'");
    expect(html).toContain("label.textContent = 'COPY'");
    expect(html).toContain('}, 1500);');
    expect(html).toContain('.url-copy:hover, .url-copy:focus-visible');
    expect(html).not.toContain('data-copy-target="mcp-url"');
    expect(html).not.toContain('<div class="url-row">');
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
    expect(html).not.toContain('Go to market');
    expect(html).toContain('Artifacts');
    expect(html).toContain('Observability');
    expect(html).toContain('href="https://internal.consuelohq.com/artifacts"');
    expect(html).toContain('href="https://internal.consuelohq.com/observability"');
    expect(html).toContain('href="https://internal.consuelohq.com/diffs"');
    expect(html).not.toContain('sites.consuelohq.com');
    expect(html).not.toContain('app.consuelohq.com');
    expect(html).not.toContain('href="https://internal.consuelohq.com/tracing"');
    expect(html).toContain('Code review');
    expect(html).toContain('Guides and Tips');
    expect(html).toContain('Documentation');
    expect(html).toContain('Writing');
    expect(html).toContain('Decision loops');
    expect(html).toContain('https://consuelohq.com/blog/software-is-becoming-decision-infrastructure/');
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
    expect(html).toContain('Connected to 3 local agents');
    expect(html).not.toContain('Checking local agents');
    expect(html).toContain('data-agent-count');
    expect(html).toContain('data-agent-list');
    expect(html).toContain('https://os.consuelohq.com/workspace/agents');
    expect(html).toContain('workspace_host');
    expect(html).toContain('window.location.hostname');
    expect(html).toContain('.textContent =');
    expect(html).not.toContain('.innerHTML =');
    expect(html).toContain('<li>Codex</li>');
    expect(html).toContain('<li>OpenCode</li>');
    expect(html).toContain("payload.state === 'online'");
    expect(html).toContain("payload.state === 'stale'");
    expect(html).toContain("payload.state === 'offline'");
    expect(html).toContain("payload.state === 'never_reported'");
    expect(html).toContain('Local agent status unavailable.');
    expect(html).toContain('const launcherWorkspaceHost = \"internal.consuelohq.com\"');
    expect(html).toContain("countElement.setAttribute('data-agent-status', 'stale')");
    expect(html).toContain('<li>Cursor</li>');
    expect(html).not.toContain('[GTM]');
    expect(html).not.toContain('[Office]');
    expect(html).not.toContain('[Tracing]');
    expect(html).not.toContain('[Diffs]');
  });

  it('uses workspace-specific empty local-agent copy', () => {
    const html = renderLauncherOnboarding({
      mcpUrl: 'https://os.consuelohq.com/mcp',
      workspaceHostname: 'internal.consuelohq.com',
      localAgents: [],
    });

    expect(html).toContain('Connected to 0 local agents');
    expect(html).not.toContain('Checking local agents');
    expect(html).toContain('<p class="muted" data-agent-fallback hidden></p>');
    expect(html).not.toContain('No local agents connected yet.');
    expect(html).toContain('data-agent-fallback');
  });

  it('renders escaped local launcher sections after Sites and before Guides', () => {
    const html = renderLauncherOnboarding({
      mcpUrl: 'https://os.consuelohq.com/mcp',
      workspaceHostname: 'internal.consuelohq.com',
      extraSections: [{
        id: 'internal',
        label: 'Internal <ops>',
        links: [{
          label: 'Users & installs <private>',
          href: 'https://internal.consuelohq.com/users?view=a&scope=b',
        }],
      }],
    });

    expect(html).toContain('<h2 class="section-title">Internal &lt;ops&gt;</h2>');
    expect(html).toContain('Users &amp; installs &lt;private&gt;');
    expect(html).toContain('href="https://internal.consuelohq.com/users?view=a&amp;scope=b"');
    expect(html).not.toContain('Internal <ops>');
    expect(html).not.toContain('Users & installs <private>');

    const sitesIndex = html.indexOf('<h2 class="section-title">Sites</h2>');
    const internalIndex = html.indexOf('<h2 class="section-title">Internal &lt;ops&gt;</h2>');
    const guidesIndex = html.indexOf('<h2 class="section-title">Guides and Tips</h2>');
    expect(internalIndex).toBeGreaterThan(sitesIndex);
    expect(guidesIndex).toBeGreaterThan(internalIndex);
  });

  it('derives every product link from an arbitrary authenticated customer workspace', () => {
    const html = renderLauncherOnboarding({
      mcpUrl: 'https://os.consuelohq.com/mcp',
      workspaceHostname: 'acme.consuelohq.com',
    });

    for (const path of ['/artifacts', '/observability', '/diffs']) {
      expect(html).toContain(`href="https://acme.consuelohq.com${path}"`);
    }
    expect(html).not.toContain('href="https://acme.consuelohq.com/gtm"');
    expect(html).not.toContain('internal.consuelohq.com');
    expect(html).not.toContain('sites.consuelohq.com');
    expect(html).not.toContain('app.consuelohq.com');
  });

  it('rejects non-workspace hosts instead of generating a global fallback', () => {
    expect(() => renderLauncherOnboarding({
      mcpUrl: 'https://os.consuelohq.com/mcp',
      workspaceHostname: 'sites.consuelohq.com',
    })).toThrow(/workspace hostname/i);
  });
});
