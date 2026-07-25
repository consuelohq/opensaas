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
    expect(source).toContain('Connect to your cloud agents');
    expect(source).toContain("{ label: 'Go to market', href: '/gtm' }");
    expect(source).toContain("{ label: 'Artifacts', href: '/artifacts' }");
    expect(source).toContain("{ label: 'Observability', href: '/observability' }");
    expect(source).toContain("{ label: 'Code review', href: '/diffs' }");
    expect(source).not.toMatch(/https:\/\/(?:sites|app|internal|testing)\.consuelohq\.com\/(?:gtm|artifacts|office|observability|diffs)/);
  });
});
