import { describe, expect, it } from 'vitest';

import { expectFunctionExport, expectSchemaAccepts, expectSchemaRejects, getExport, importMediaModule } from './helpers';

describe('media.export package', () => {
  it('should satisfy media contract when it exports deterministic platform packages for Shorts, TikTok, Reels, and later longform', async () => {
    const module = await importMediaModule('scripts/lib/media/export.ts');
    expectFunctionExport(module, 'exportPackageEffect');
    expectFunctionExport(module, 'exportPackageForCli');

    expect(module.exportTargets).toEqual(expect.arrayContaining(['youtube-shorts', 'tiktok', 'reels', 'longform-youtube']));
  });

  it('should satisfy media contract when it requires mp4, thumbnail, captions, title notes, provenance, rights notes, and render result', async () => {
    const schemaModule = await importMediaModule('scripts/lib/media/schema.ts');
    const schema = getExport(schemaModule, 'MediaExportPackageSchema');

    expectSchemaAccepts(schema, {
      schema: 'media.export-package.v1',
      id: 'export_001',
      target: 'youtube-shorts',
      files: {
        mp4: 'renders/final.mp4',
        thumbnail: 'renders/thumb.png',
        captions: 'captions/en.vtt',
        notes: 'notes/title.md',
        renderResult: 'render-result.json',
      },
      provenance: {
        sourceAssetId: 'asset_fixture_001',
        rightsStatus: 'needs-review',
      },
      deterministic: true,
    });

    expectSchemaRejects(schema, {
      schema: 'media.export-package.v1',
      id: 'export_bad',
      target: 'youtube-shorts',
      files: { thumbnail: 'renders/thumb.png' },
      provenance: {
        sourceAssetId: 'asset_fixture_001',
        rightsStatus: 'needs-review',
      },
      deterministic: true,
    });
  });
});
