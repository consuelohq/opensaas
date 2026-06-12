import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('bootstrap source refresh controls', () => {
  it('documents an explicit source refresh option', () => {
    const bootstrap = readFileSync(join(process.cwd(), 'scripts', 'bootstrap.sh'), 'utf8');

    expect(bootstrap).toContain('--refresh-source');
    expect(bootstrap).toContain('REFRESH_SOURCE');
    expect(bootstrap).toContain('SOURCE_STATUS="refreshed"');
  });

  it('uses one dependency gate before the Bun onboarding UI', () => {
    const bootstrap = readFileSync(join(process.cwd(), 'scripts', 'bootstrap.sh'), 'utf8');

    expect(bootstrap).toContain('Consuelo OS needs its dependencies to continue.');
    expect(bootstrap).toContain('render_dependency_progress');
    expect(bootstrap).toContain('● dependencies');
    expect(bootstrap).toContain('○ home');
    expect(bootstrap).toContain('○ skills');
    expect(bootstrap).toContain('○ artifacts');
    expect(bootstrap).toContain('○ agents');
    expect(bootstrap).toContain('○ health');
    expect(bootstrap).not.toContain('Consuelo OS needs the local runtime source to continue.');
    expect(bootstrap).not.toContain('Consuelo OS needs its local runtime dependencies to continue.');
    expect(bootstrap).not.toContain('We can download/setup this now.');
    expect(bootstrap).not.toContain('We can install/setup this now.');
  });
});
