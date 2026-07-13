import { describe, expect, it } from 'vitest';

import { expectFile, expectFunctionExport, importMediaModule, readOptionalText } from './helpers';

const expectedMediaModules = [
  'scripts/lib/media/schema.ts',
  'scripts/lib/media/errors.ts',
  'scripts/lib/media/dependency-catalog.ts',
  'scripts/lib/media/dependencies.ts',
  'scripts/lib/media/process.ts',
  'scripts/lib/media/fs.ts',
  'scripts/lib/media/probe.ts',
  'scripts/lib/media/frames.ts',
  'scripts/lib/media/timeline.ts',
  'scripts/lib/media/compose.ts',
  'scripts/lib/media/qa.ts',
  'scripts/lib/media/ingest.ts',
  'scripts/lib/media/youtube.ts',
  'scripts/lib/media/audio.ts',
  'scripts/lib/media/vision.ts',
  'scripts/lib/media/overlays.ts',
  'scripts/lib/media/export.ts',
  'scripts/lib/media/source-capture/schema.ts',
  'scripts/lib/media/source-capture/errors.ts',
  'scripts/lib/media/source-capture/plan.ts',
  'scripts/lib/media/source-capture/process.ts',
  'scripts/lib/media/source-capture/fs.ts',
  'scripts/lib/media/source-capture/ytdlp.ts',
  'scripts/lib/media/source-capture/summarize-adapter.ts',
  'scripts/lib/media/source-capture/bundle.ts',
  'scripts/lib/media/source-capture/checksums.ts',
  'scripts/lib/media/source-capture/provenance.ts',
  'scripts/media.ts',
] as const;

describe('media Effect architecture', () => {
  it('should satisfy media contract when it creates the expected media module boundaries', () => {
    for (const modulePath of expectedMediaModules) expectFile(modulePath);
  });

  it('should satisfy media contract when it exports Effect-returning domain functions and Promise-returning CLI adapters', async () => {
    const probe = await importMediaModule('scripts/lib/media/probe.ts');
    const frames = await importMediaModule('scripts/lib/media/frames.ts');
    const timeline = await importMediaModule('scripts/lib/media/timeline.ts');
    const compose = await importMediaModule('scripts/lib/media/compose.ts');
    const qa = await importMediaModule('scripts/lib/media/qa.ts');
    const ingest = await importMediaModule('scripts/lib/media/ingest.ts');

    for (const [module, effectName, cliName] of [
      [probe, 'probeEffect', 'probeForCli'],
      [frames, 'extractFramesEffect', 'extractFramesForCli'],
      [timeline, 'validateTimelineEffect', 'validateTimelineForCli'],
      [compose, 'composeEffect', 'composeForCli'],
      [qa, 'qaEffect', 'qaForCli'],
      [ingest, 'ingestMediaEffect', 'ingestMediaForCli'],
    ] as const) {
      expectFunctionExport(module, effectName);
      expectFunctionExport(module, cliName);
    }
  });

  it('should satisfy media contract when it keeps process execution isolated to the media process service', () => {
    const processSource = readOptionalText('scripts/lib/media/process.ts');
    expect(processSource).toMatch(/MediaProcess/);
    expect(processSource).toMatch(/Effect/);
    expect(processSource).toMatch(/Bun\.spawn|spawn\(|execFile/);

    const processBoundaryFiles = new Set(['scripts/lib/media/process.ts', 'scripts/lib/media/source-capture/process.ts']);

    for (const modulePath of expectedMediaModules) {
      if (processBoundaryFiles.has(modulePath)) continue;
      const source = readOptionalText(modulePath);
      expect(source, modulePath + ' must not import child_process').not.toMatch(/from ['"]node:child_process['"]|require\(['"]node:child_process['"]\)/);
      expect(source, modulePath + ' must not call Bun.spawn directly').not.toMatch(/Bun\.spawn|spawnSync\(/);
    }
  });

  it('should satisfy media contract when it limits Effect.runPromise to CLI adapter boundaries', () => {
    const allowedRunPromiseFiles = new Set(['scripts/media.ts']);

    for (const modulePath of expectedMediaModules) {
      const source = readOptionalText(modulePath);
      if (allowedRunPromiseFiles.has(modulePath)) continue;
      expect(source, modulePath + ' should return Effect values and must not call Effect.runPromise').not.toContain('Effect.runPromise');
    }
    expect(readOptionalText('scripts/media.ts')).toContain('Effect.runPromise');
  });

  it('should satisfy media contract when it exposes injectable process, filesystem, dependency, logger, and clock services', async () => {
    const processModule = await importMediaModule('scripts/lib/media/process.ts');
    const fsModule = await importMediaModule('scripts/lib/media/fs.ts');
    const dependenciesModule = await importMediaModule('scripts/lib/media/dependencies.ts');

    expect(processModule.MediaProcess).toBeDefined();
    expect(fsModule.MediaFs).toBeDefined();
    expect(dependenciesModule.MediaDependencyCatalog).toBeDefined();
    expect(dependenciesModule.MediaLogger).toBeDefined();
    expect(dependenciesModule.MediaClock).toBeDefined();
  });
});
