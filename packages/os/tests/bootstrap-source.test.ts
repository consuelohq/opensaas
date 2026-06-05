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
});
