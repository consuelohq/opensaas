import { describe, expect, it } from 'vitest';

import { expectFile, readOptionalText, readPackageJson } from './helpers';

const sourceCaptureModules = [
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
] as const;

const visibleSurfaceFiles = [
  'tooling/media-tool-manifest.json',
  'tooling/dev-tool-manifest.json',
  'manifests/tool.manifest.json',
  'manifests/core.manifest.json',
  'tooling/workflows.json',
  'manifests/workflow-bundles.json',
] as const;

describe('media source capture internal boundary', () => {
  it('keeps source capture as media-internal implementation plumbing', () => {
    for (const modulePath of sourceCaptureModules) expectFile(modulePath);
  });

  it('does not expose source capture as a tool, workflow, runbook, manifest entry, or package script', () => {
    for (const file of visibleSurfaceFiles) {
      const source = readOptionalText(file);
      expect(source, file + ' must not expose source.capture').not.toMatch(/source\.capture|media\.sourceCapture|source:capture|source-capture/i);
    }

    const packageJson = readPackageJson();
    const scriptNames = Object.keys((packageJson.scripts ?? {}) as Record<string, string>);
    expect(scriptNames).not.toEqual(expect.arrayContaining(['source:capture', 'source-capture', 'media:source-capture']));
  });

  it('requires media.ingest to consume source capture without routing through research ingest', () => {
    const ingestSource = readOptionalText('scripts/lib/media/ingest.ts');

    expect(ingestSource).toMatch(/source-capture|sourceCapture|SourceCapture/);
    expect(ingestSource).not.toMatch(/research-ingest|research:ingest|research\.ingest/);
  });

  it('keeps source acquisition process execution behind media process services', () => {
    const sourceCaptureProcess = readOptionalText('scripts/lib/media/source-capture/process.ts');
    expect(sourceCaptureProcess).toMatch(/SourceCaptureProcess|MediaProcess/);
    expect(sourceCaptureProcess).toMatch(/Bun\.spawn|spawn\(|execFile/);

    for (const modulePath of sourceCaptureModules) {
      if (modulePath === 'scripts/lib/media/source-capture/process.ts') continue;
      const source = readOptionalText(modulePath);
      expect(source, modulePath + ' must plan or normalize only').not.toMatch(/from ['"]node:child_process['"]|require\(['"]node:child_process['"]\)|Bun\.spawn|spawnSync\(/);
    }

    const ingestSource = readOptionalText('scripts/lib/media/ingest.ts');
    expect(ingestSource, 'media ingest must not execute child processes directly').not.toMatch(/from ['"]node:child_process['"]|require\(['"]node:child_process['"]\)|Bun\.spawn|spawnSync\(/);
  });
});
