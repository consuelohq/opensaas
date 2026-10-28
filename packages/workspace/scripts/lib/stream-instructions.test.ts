import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { readStreamInstructions } = require('./stream-instructions.js') as {
  readStreamInstructions: (area: string) => {
    exists: boolean;
    path: string;
    content: string;
  };
};

describe('workspace stream instructions', () => {
  it('reads the durable dialer AGENTS.md used by workspace stream context', () => {
    const result = readStreamInstructions('dialer');
    expect(result.exists).toBe(true);
    expect(result.path).toBe(
      resolve(import.meta.dirname, '../../streams/dialer/AGENTS.md'),
    );
    expect(result.content).toContain('# Consuelo Dialer agent instructions');
  });

  it('returns an explicit empty state when a stream has no instructions', () => {
    expect(readStreamInstructions('definitely-missing-stream')).toMatchObject({
      exists: false,
      content: '',
    });
  });
});
