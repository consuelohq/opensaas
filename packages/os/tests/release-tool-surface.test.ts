import { describe, expect, it } from 'vitest';

import { buildToolManifest } from '../scripts/generate-tool-manifest';
import { getInputSchema } from '../scripts/lib/facade/schemas';
import { runToolSearch } from '../scripts/tools-search';

describe('release tool surface', () => {
  it('publishes one concise top-level release tool with the end-to-end runtime workflow', () => {
    const manifest = buildToolManifest({ write: false });
    const release = manifest.full.tools.find((entry) => entry.name === 'release');

    expect(release?.definition).toMatchObject({
      name: 'release',
      methodPath: ['release'],
      category: 'release',
      capabilities: { readOnly: false, mutating: true, safeToRetry: false },
      inputSchema: 'ReleaseInput',
      command: {
        script: 'release',
        branchMode: 'none',
        jsonFlag: '--json',
      },
    });
    expect(release?.definition.description).toContain('release to canary');
    expect(release?.definition.description).toContain('exact released version');
    expect(release?.definition.description).toContain('main-targeting review PR');
    expect(Number(release?.definition.defaultTimeout)).toBeGreaterThanOrEqual(4 * 60 * 60_000);
  });

  it('validates PR, target channel, release-only, and merge method inputs', () => {
    const schema = getInputSchema('ReleaseInput');
    expect(schema).not.toBeNull();
    expect(schema?.safeParse({ pr: 2185, channel: 'canary' }).success).toBe(true);
    expect(schema?.safeParse({ pr: 2185, channel: 'stable', releaseOnly: true, mergeMethod: 'squash' }).success).toBe(true);
    expect(schema?.safeParse({ pr: 0, channel: 'canary' }).success).toBe(false);
    expect(schema?.safeParse({ pr: 2185, channel: 'nightly' }).success).toBe(false);
  });

  it.each([
    'release to canary',
    'deploy this PR',
    'release and update',
    'release to production',
  ])('is discoverable for %s', async (query) => {
    const result = await runToolSearch({
      query,
      limit: 5,
      includeDocs: false,
      includeEmbeddings: false,
    });
    expect(result.matches.map((match) => match.name)).toContain('release');
  });
});
