import { describe, expect, it } from 'vitest';

import { expectSchemaAccepts, expectSchemaRejects, getExport, importMediaModule, validAssetFixture } from './helpers';

describe('media.asset.v1 contract', () => {
  it('accepts a provenance-first probed source asset', async () => {
    const module = await importMediaModule('scripts/lib/media/schema.ts');
    const schema = getExport(module, 'MediaAssetSchema');

    expectSchemaAccepts(schema, validAssetFixture());
  });

  it('rejects unversioned, provenance-free, and impossible assets', async () => {
    const module = await importMediaModule('scripts/lib/media/schema.ts');
    const schema = getExport(module, 'MediaAssetSchema');

    expectSchemaRejects(schema, { ...validAssetFixture(), schema: undefined });
    expectSchemaRejects(schema, { ...validAssetFixture(), source: { path: 'assets/source.mp4' } });
    expectSchemaRejects(schema, validAssetFixture({ probe: { durationSeconds: -1, width: 1920, height: 1080, fps: 30, videoCodec: 'h264' } }));
    expectSchemaRejects(schema, validAssetFixture({ probe: { durationSeconds: 45, width: 0, height: 1080, fps: 30, videoCodec: 'h264' } }));
  });

  it('exports the stable schema kind constant', async () => {
    const module = await importMediaModule('scripts/lib/media/schema.ts');
    expect(module.MEDIA_ASSET_SCHEMA).toBe('media.asset.v1');
  });
});
