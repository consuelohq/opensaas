import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('dialer stream instructions', () => {
  it('keeps Dialer project guidance out of the OS runtime stream tree', () => {
    const repositoryRoot = resolve(import.meta.dirname, '../../..');
    expect(
      existsSync(resolve(repositoryRoot, 'packages/os/streams/dialer/AGENTS.md')),
    ).toBe(false);
    expect(
      existsSync(resolve(repositoryRoot, 'packages/os/streams/dialer/rd/README.md')),
    ).toBe(false);
    expect(existsSync(resolve(repositoryRoot, 'areas/dialer/AGENTS.md'))).toBe(true);
    expect(existsSync(resolve(repositoryRoot, 'areas/dialer/rd/README.md'))).toBe(true);
  });

  it('does not require a deprecated Workspace stream copy', () => {
    const repositoryRoot = resolve(import.meta.dirname, '../../..');
    expect(
      existsSync(
        resolve(repositoryRoot, 'packages/workspace/streams/dialer/AGENTS.md'),
      ),
    ).toBe(false);
  });
});
