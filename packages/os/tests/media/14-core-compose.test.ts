import { describe, expect, it } from 'vitest';

import { expectFunctionExport, importMediaModule, validTimelineFixture } from './helpers';

describe('media.compose core tool', () => {
  it('exposes Effect and CLI composition surfaces', async () => {
    const module = await importMediaModule('scripts/lib/media/compose.ts');
    expectFunctionExport(module, 'composeEffect');
    expectFunctionExport(module, 'composeForCli');
  });

  it('renders a vertical mp4 through ffmpeg with deterministic filtergraph planning', async () => {
    const module = await importMediaModule('scripts/lib/media/compose.ts');
    expectFunctionExport(module, 'buildComposePlan');

    const build = module.buildComposePlan as (input: { timeline: unknown; outPath: string }) => { command: string; args: string[]; outputPath: string };
    const plan = build({ timeline: validTimelineFixture(), outPath: 'renders/out.mp4' });

    expect(plan.command).toBe('ffmpeg');
    expect(plan.args).toEqual(expect.arrayContaining(['-y']));
    expect(plan.args.join(' ')).toMatch(/1080|1920|scale|pad|crop/);
    expect(plan.args.join(' ')).toMatch(/drawtext|overlay|filter_complex/);
    expect(plan.outputPath).toBe('renders/out.mp4');
  });

  it('requires timeline validation and QA handoff metadata before writing final output', async () => {
    const module = await importMediaModule('scripts/lib/media/compose.ts');
    expectFunctionExport(module, 'assertComposableTimeline');

    const assertComposable = module.assertComposableTimeline as (timeline: unknown) => void;
    expect(() => assertComposable(validTimelineFixture())).not.toThrow();
    expect(() => assertComposable(validTimelineFixture({ provenance: undefined }))).toThrow();
  });
});
