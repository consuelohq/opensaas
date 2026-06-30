import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTempDir, expectFunctionExport, expectJsonCliSuccess, expectSchemaAccepts, expectSchemaRejects, getExport, importMediaModule, removeTempDir, validRenderResultFixture } from './helpers';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) removeTempDir(dir);
});

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

  it('should satisfy media contract when final manifest-exposed surfaces route through the media CLI', () => {
    const dir = createTempDir('consuelo-media-test-final-cli-');
    tempDirs.push(dir);

    const renderResultPath = join(dir, 'render-result.json');
    writeFileSync(renderResultPath, JSON.stringify(validRenderResultFixture(), null, 2));

    const exported = expectJsonCliSuccess([
      'export',
      '--render-result',
      renderResultPath,
      '--target',
      'youtube-shorts',
      '--out',
      dir,
      '--json',
    ]);
    expect(exported).toMatchObject({ schema: 'media.export-package.v1', ok: true });

    const overlayPath = join(dir, 'overlay.json');
    writeFileSync(overlayPath, JSON.stringify({
      id: 'overlay_cli_001',
      render: { width: 1080, height: 1920, fps: 30, durationSeconds: 2 },
      primitives: [{ id: 'primitive_001', type: 'label', startSeconds: 0, endSeconds: 1, data: { text: 'plant foot' } }],
      output: { format: 'svg' },
      provenance: { status: 'needs-review', sourceAssetId: 'asset_fixture_001' },
    }, null, 2));

    const overlay = expectJsonCliSuccess(['overlay', 'render', '--spec', overlayPath, '--out', join(dir, 'overlay.svg'), '--json']);
    expect(overlay).toMatchObject({ schema: 'media.overlay.v1', ok: true });

    const breakdownPath = join(dir, 'breakdown.json');
    writeFileSync(breakdownPath, JSON.stringify({
      schema: 'media.breakdown-plan.v1',
      id: 'breakdown_cli_001',
      timelineId: 'timeline_fixture_001',
      claims: [{
        id: 'claim_001',
        text: 'The plant foot sets the force angle.',
        timestampSeconds: 1,
        frameRef: 'frame_001',
        metricRef: 'metric_001',
        provenanceRef: 'provenance_001',
      }],
      plannedOverlays: [{
        overlayId: 'overlay_001',
        claimId: 'claim_001',
        type: 'force-vector',
        coordinateRef: 'metric_001',
      }],
    }, null, 2));

    const breakdown = expectJsonCliSuccess([
      'breakdown',
      'plan',
      '--input',
      breakdownPath,
      '--available-ref',
      'metric_001',
      '--available-ref',
      'provenance_001',
      '--json',
    ]);
    expect(breakdown).toMatchObject({ schema: 'media.breakdown-plan.v1', ok: true });
  });
});
