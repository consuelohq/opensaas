import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('launcher Astro source', () => {
  it('keeps the OS launcher theming source in Astro with website tokens', () => {
    const source = readFileSync(
      join(process.cwd(), '..', 'consuelo-website', 'src', 'pages', 'os', 'launcher.astro'),
      'utf8',
    );

    expect(source).toContain('MarketingLayout');
    expect(source).toContain('../styles/tokens.css');
    expect(source).toContain('var(--site-color-paper)');
    expect(source).toContain('var(--site-color-ink)');
    expect(source).toContain('var(--site-color-muted)');
    expect(source).toContain('Welcome to Consuelo OS');
    expect(source).toContain('Here is the URL to connect');
    expect(source).toContain('class="os-launcher__url-copy"');
    expect(source).toContain('data-copy-mcp');
    expect(source).toContain('<span data-copy-label aria-live="polite">COPY</span>');
    expect(source).toContain('if (!navigator.clipboard)');
    expect(source).toContain("copyLabel.textContent = 'COPIED'");
    expect(source).toContain("copyLabel.textContent = 'COPY'");
    expect(source).toContain('}, 1500);');
    expect(source).toContain('.os-launcher__url-copy:hover,');
    expect(source).toContain('.os-launcher__url-copy:focus-visible');
    expect(source).not.toContain('data-copy-target="mcp-url"');
    expect(source).not.toContain('class="os-launcher__url-row"');
    expect(source).toContain('Connect to your cloud agents');
    expect(source).toContain("{ label: 'Observability', href: workspaceUrl('/observability') }");
    expect(source).toContain("{ label: 'Artifacts', href: workspaceUrl('/artifacts') }");
    expect(source).toContain("{ label: 'Code review', href: workspaceUrl('/diffs') }");
    expect(source).not.toContain("{ label: 'Go to market'");
    expect(source).not.toContain("workspaceUrl('/gtm')");
    expect(source).not.toContain('sites.consuelohq.com');
    expect(source).not.toContain("href: 'https://app.consuelohq.com");
  });
});
