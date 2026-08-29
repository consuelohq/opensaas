import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('internal dashboard Astro source', () => {
  it('keeps the private dashboard view source in Astro without exposing private data or auth logic', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        '..',
        'consuelo-website',
        'src',
        'components',
        'os',
        'InternalDashboardShell.astro',
      ),
      'utf8',
    );

    expect(source).toContain('class="workspace-window"');
    expect(source).toContain('class="trxChrome"');
    expect(source).toContain('var(--site-color-paper)');
    expect(source).toContain('var(--site-color-ink)');
    expect(source).toContain('var(--site-color-line)');
    expect(source).toContain('<slot />');
    expect(source).not.toContain('Cloudflare Access');
    expect(source).not.toContain('__Host-consuelo_os_session');
    expect(source).not.toContain('/api/internal/os/v1');
  });
});
