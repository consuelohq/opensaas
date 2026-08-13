import { describe, expect, it } from 'vitest';

import { buildToolManifest } from '../scripts/generate-tool-manifest';
import { getInputSchema } from '../scripts/lib/facade/schemas';
import { runToolSearch } from '../scripts/tools-search';

describe('lifecycle tool surface', () => {
  it('publishes update and status as thin lifecycle CLI tools', () => {
    const manifest = buildToolManifest({ write: false });
    const update = manifest.full.tools.find(
      (entry) => entry.name === 'lifecycle.update',
    );
    const status = manifest.full.tools.find(
      (entry) => entry.name === 'lifecycle.status',
    );

    expect(update?.definition).toMatchObject({
      methodPath: ['lifecycle', 'update'],
      capabilities: { readOnly: false, mutating: true, safeToRetry: false },
      inputSchema: 'LifecycleUpdateInput',
      command: {
        script: 'lifecycle',
        subcommand: 'update',
        branchMode: 'none',
        jsonFlag: '--json',
      },
    });
    expect(status?.definition).toMatchObject({
      methodPath: ['lifecycle', 'status'],
      capabilities: { readOnly: true, mutating: false, safeToRetry: true },
      command: {
        script: 'lifecycle',
        subcommand: 'status',
        branchMode: 'none',
        jsonFlag: '--json',
      },
    });
  });

  it('validates lifecycle update channels without inventing updater-specific options', () => {
    const schema = getInputSchema('LifecycleUpdateInput');
    expect(schema).not.toBeNull();
    expect(schema?.safeParse({ channel: 'canary' }).success).toBe(true);
    expect(schema?.safeParse({ channel: 'made-up' }).success).toBe(false);
  });

  it.each([
    ['update Consuelo OS', 'lifecycle.update'],
    ['upgrade runtime release', 'lifecycle.update'],
    ['check Consuelo lifecycle status', 'lifecycle.status'],
  ])('is discoverable for %s', async (query, expected) => {
    const result = await runToolSearch({
      query,
      limit: 5,
      includeDocs: false,
      includeEmbeddings: false,
    });
    expect(result.matches.map((match) => match.name)).toContain(expected);
  });
});
