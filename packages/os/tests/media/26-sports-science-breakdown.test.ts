import { describe, expect, it } from 'vitest';

import { expectFunctionExport, expectSchemaAccepts, expectSchemaRejects, getExport, importMediaModule } from './helpers';

describe('sports-science breakdown planning', () => {
  it('requires structured claims linked to timestamp, frame, metric, and provenance', async () => {
    const schemaModule = await importMediaModule('scripts/lib/media/schema.ts');
    const schema = getExport(schemaModule, 'MediaBreakdownPlanSchema');

    expectSchemaAccepts(schema, {
      schema: 'media.breakdown-plan.v1',
      id: 'breakdown_001',
      timelineId: 'timeline_fixture_001',
      claims: [
        { id: 'claim_001', text: 'Plant foot angle changes force transfer.', timestampSeconds: 12.4, frameRef: 'frames/000124.png', metricRef: 'metrics/knee-angle.json', provenanceRef: 'asset_fixture_001' },
      ],
      plannedOverlays: [{ overlayId: 'overlay_001', claimId: 'claim_001', requiredData: ['media.pose-track.v1'] }],
    });

    expectSchemaRejects(schema, {
      schema: 'media.breakdown-plan.v1',
      id: 'bad',
      claims: [{ id: 'claim_bad', text: 'Explosive hips because it looks cool.' }],
    });
  });

  it('prevents invented measurements when required data is absent', async () => {
    const module = await importMediaModule('scripts/lib/media/sports-science.ts');
    expectFunctionExport(module, 'assertBreakdownPlanIsDataBacked');

    const assertDataBacked = module.assertBreakdownPlanIsDataBacked as (plan: unknown, availableRefs: string[]) => void;
    expect(() => assertDataBacked({ plannedOverlays: [{ requiredData: ['media.pose-track.v1'] }] }, [])).toThrow();
    expect(() => assertDataBacked({ plannedOverlays: [{ requiredData: ['media.pose-track.v1'] }] }, ['media.pose-track.v1'])).not.toThrow();
  });
});
