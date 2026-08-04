import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import { readStreamInstructionsEffect } from '../scripts/lib/streams/instructions';

describe('dialer stream instructions', () => {
  it('ships one canonical dialer context through the OS stream reader', async () => {
    const packageRoot = resolve(import.meta.dirname, '..');
    const result = await Effect.runPromise(
      readStreamInstructionsEffect({
        streamsRoot: resolve(packageRoot, 'streams'),
        area: 'dialer',
      }),
    );

    expect(result.exists).toBe(true);
    expect(result.content).toContain('# Consuelo Dialer agent instructions');
    expect(result.content).toContain('Pipeline stage = predictive queue');
    expect(result.content).toContain(
      'Railway, Cloudflare, and Marketplace are separate deployments',
    );
  });

  it('keeps OS and Workspace stream copies byte-identical', () => {
    const repositoryRoot = resolve(import.meta.dirname, '../../..');
    const osInstructions = readFileSync(
      resolve(repositoryRoot, 'packages/os/streams/dialer/AGENTS.md'),
      'utf8',
    );
    const workspaceInstructions = readFileSync(
      resolve(repositoryRoot, 'packages/workspace/streams/dialer/AGENTS.md'),
      'utf8',
    );

    expect(workspaceInstructions).toBe(osInstructions);
  });
});
