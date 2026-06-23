import { describe, expect, it } from 'vitest';

import { expectedSchemaKinds, expectSchemaAccepts, expectSchemaRejects, getExport, importMediaModule, validRenderResultFixture } from './helpers';

describe('media render and artifact contracts', () => {
  it('should satisfy media contract when it accepts a render result carrying QA, tool versions, provenance, and artifacts', async () => {
    const module = await importMediaModule('scripts/lib/media/schema.ts');
    const schema = getExport(module, 'MediaRenderResultSchema');

    expectSchemaAccepts(schema, validRenderResultFixture());
  });

  it('should satisfy media contract when it rejects render results without output, QA, tool versions, or source provenance', async () => {
    const module = await importMediaModule('scripts/lib/media/schema.ts');
    const schema = getExport(module, 'MediaRenderResultSchema');

    expectSchemaRejects(schema, validRenderResultFixture({ output: undefined }));
    expectSchemaRejects(schema, validRenderResultFixture({ qa: undefined }));
    expectSchemaRejects(schema, validRenderResultFixture({ toolVersions: {} }));
    expectSchemaRejects(schema, validRenderResultFixture({ provenance: undefined }));
  });

  it('should satisfy media contract when it exports every final-state media schema and kind', async () => {
    const module = await importMediaModule('scripts/lib/media/schema.ts');
    const schemaKinds = module.mediaSchemaKinds;

    expect([...schemaKinds].sort()).toEqual([...expectedSchemaKinds].sort());
    for (const exportName of [
      'MediaDependencyReportSchema',
      'MediaIngestManifestSchema',
      'MediaFrameManifestSchema',
      'MediaTranscriptSchema',
      'MediaPoseTrackSchema',
      'MediaMotionTrackSchema',
      'MediaOverlaySchema',
      'MediaBreakdownPlanSchema',
      'MediaExportPackageSchema',
    ]) {
      expect(module[exportName], 'missing schema export ' + exportName).toBeDefined();
    }
  });
});
