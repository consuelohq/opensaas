import { describe, expect, it } from 'vitest';

import { expectSchemaAccepts, expectSchemaRejects, getExport, importMediaModule, validTimelineFixture } from './helpers';

describe('media.timeline.v1 contract', () => {
  it('should satisfy media contract when it accepts a structured vertical sports-science timeline', async () => {
    const module = await importMediaModule('scripts/lib/media/schema.ts');
    const schema = getExport(module, 'MediaTimelineSchema');

    expectSchemaAccepts(schema, validTimelineFixture());
  });

  it('should satisfy media contract when it rejects invalid timestamps, missing assets, missing provenance, and unbounded overlays', async () => {
    const module = await importMediaModule('scripts/lib/media/schema.ts');
    const schema = getExport(module, 'MediaTimelineSchema');

    expectSchemaRejects(schema, validTimelineFixture({ schema: 'media.timeline.v0' }));
    expectSchemaRejects(schema, validTimelineFixture({ provenance: undefined }));
    expectSchemaRejects(schema, validTimelineFixture({ assets: [] }));
    expectSchemaRejects(schema, validTimelineFixture({ beats: [{ id: 'bad', startSeconds: 99, endSeconds: 100, type: 'freeze' }] }));
    expectSchemaRejects(schema, validTimelineFixture({ beats: [{ id: 'bad', startSeconds: 10, endSeconds: 9, type: 'freeze' }] }));
    expectSchemaRejects(schema, validTimelineFixture({ overlays: [{ id: 'bad', type: 'label', data: { text: 'missing time range' } }] }));
  });

  it('should satisfy media contract when it requires analysis-backed sports-science overlays instead of prose-only vibes', async () => {
    const module = await importMediaModule('scripts/lib/media/schema.ts');
    const schema = getExport(module, 'MediaTimelineSchema');

    expectSchemaRejects(schema, validTimelineFixture({
      overlays: [{ id: 'overlay_bad', type: 'joint-angle', startSeconds: 1, endSeconds: 2, data: { label: 'knee angle' } }],
    }));
    expectSchemaAccepts(schema, validTimelineFixture({
      analysisRefs: [{ id: 'pose_001', kind: 'media.pose-track.v1', path: 'analysis/pose.json' }],
      overlays: [{ id: 'overlay_ok', type: 'joint-angle', startSeconds: 1, endSeconds: 2, data: { poseTrackId: 'pose_001', points: ['hip', 'knee', 'ankle'], label: 'knee angle' } }],
    }));
  });
});
