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
      resolve(import.meta.dirname, '../../../../areas/dialer/AGENTS.md'),
    );
    expect(result.content).toContain('# Dialer development, validation, and release runbook');
    expect(result.content).toContain('Pipeline stage = predictive queue');
    expect(result.content).toContain('RD inbound routing program');
  });

  it('returns an explicit empty state when a stream has no instructions', () => {
    expect(readStreamInstructions('definitely-missing-stream')).toMatchObject({
      exists: false,
      content: '',
    });
  });

  it('falls back to OS stream instructions when an area has no repository runbook', () => {
    const result = readStreamInstructions('media');
    expect(result.exists).toBe(true);
    expect(result.path).toBe(
      resolve(import.meta.dirname, '../../../os/streams/media/AGENTS.md'),
    );
  });
});
