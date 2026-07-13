import { describe, expect, it } from 'vitest';

import { expectFunctionExport, importMediaModule, readIfExistsRepo } from './helpers';

describe('media artifact and office handoff', () => {
  it('should satisfy media contract when it emits artifact-compatible manifests without importing office', async () => {
    const module = await importMediaModule('scripts/lib/media/artifacts.ts');
    expectFunctionExport(module, 'toArtifactManifest');
    expect(module.mediaArtifactKind).toBe('media.render');
    expect(module.artifactSchema).toBe('artifact.manifest.v1');

    const source = readIfExistsRepo('packages/os/scripts/lib/media/artifacts.ts');
    expect(source).not.toMatch(/from ['"].*(office|consuelo-design)/);
  });

  it('should satisfy media contract when it keeps office as consumer/publisher rather than media renderer', () => {
    const officeSource = [
      readIfExistsRepo('packages/os/scripts/lib/office.ts'),
      readIfExistsRepo('packages/os/scripts/os.ts'),
      readIfExistsRepo('packages/consuelo-design/src/index.ts'),
    ].join('\n');

    expect(officeSource).not.toMatch(/media\.compose|ffmpeg|ffprobe/);
    expect(officeSource).not.toMatch(/pose\.estimate|motion\.track/);
  });

  it('should satisfy media contract when it carries preview path, source provenance, rights status, and schema version into artifact handoff', async () => {
    const module = await importMediaModule('scripts/lib/media/artifacts.ts');
    const toArtifact = module.toArtifactManifest as (input: unknown) => Record<string, unknown>;
    const renderResultFixture = {
      schema: 'media.render-result.v1',
      id: 'render_001',
      output: { path: 'renders/final.mp4' },
      provenance: {
        sourceAssetId: 'asset_001',
        rightsStatus: 'needs-review',
      },
    };
    const artifact = toArtifact(renderResultFixture);

    expect(artifact).toMatchObject({
      schema: 'artifact.manifest.v1',
      kind: 'media.render',
      previewPath: 'renders/final.mp4',
      provenance: {
        sourceAssetId: 'asset_001',
        rightsStatus: 'needs-review',
      },
    });
  });
});
