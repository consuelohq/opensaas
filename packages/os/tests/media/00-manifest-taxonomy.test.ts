import { describe, expect, it } from 'vitest';

import {
  expectedMediaToolNames,
  expectArrayContainsAll,
  findGeneratedTool,
  findSourceTool,
  readGeneratedManifest,
  readManifestArray,
  readOptionalText,
} from './helpers';

describe('media manifest taxonomy', () => {
  it('declares media tools in a dedicated media source manifest, not the legacy dev manifest', () => {
    const mediaTools = readManifestArray('tooling/media-tool-manifest.json');
    const devTools = readManifestArray('tooling/dev-tool-manifest.json');
    const mediaNames = mediaTools.map((tool) => tool.name).sort();
    const devNames = devTools.map((tool) => tool.name).sort();

    expectArrayContainsAll(mediaNames, expectedMediaToolNames);
    for (const toolName of expectedMediaToolNames) {
      expect(devNames, 'new media tool should not be added to legacy dev-tool-manifest: ' + toolName).not.toContain(toolName);
    }
  });

  it('records media-tool-manifest as a full/facade manifest source', () => {
    const sourceConfig = readOptionalText('tooling/manifest-sources.json') || readOptionalText('tooling/manifest.config.json');

    expect(sourceConfig, 'manifest source config should exist and include media-tool-manifest.json').toContain('media-tool-manifest.json');
    expect(sourceConfig).toMatch(/facade|full|operator|tool/i);
  });

  it('includes every media tool in the generated full manifest and keeps media out of core by default', () => {
    const full = readGeneratedManifest('manifests/tool.manifest.json');
    const core = readGeneratedManifest('manifests/core.manifest.json');
    const fullNames = full.tools.map((tool) => tool.name);
    const coreNames = core.tools.map((tool) => tool.name);

    expectArrayContainsAll(fullNames, expectedMediaToolNames);
    for (const toolName of expectedMediaToolNames) {
      expect(coreNames, 'media tool should not be in core manifest by default: ' + toolName).not.toContain(toolName);
    }
  });

  it('models every media manifest entry as a deterministic OS facade tool with explicit contracts', () => {
    const mediaTools = readManifestArray('tooling/media-tool-manifest.json');

    for (const toolName of expectedMediaToolNames) {
      const tool = findSourceTool(mediaTools, toolName);
      expect(tool, 'missing media source tool: ' + toolName).toBeDefined();
      expect(tool?.category).toBe('media');
      expect(tool?.methodPath?.[0]).toBe('media');
      expect(tool?.description).toBeTruthy();
      expect(tool?.underlying).toMatch(/^os media/);
      expect(tool?.workflowRole).toMatch(/^media\./);
      expect(tool?.inputSchema, toolName + ' should declare input schema').toMatch(/^Media/);
      expect(tool?.outputSchema, toolName + ' should declare output schema').toMatch(/^Media/);
      expect(tool?.capabilities?.deterministic).toBe(true);
      expect(typeof tool?.capabilities?.readOnly).toBe('boolean');
      expect(typeof tool?.capabilities?.mutating).toBe('boolean');
      expect(typeof tool?.capabilities?.safeToRetry).toBe('boolean');
      expect(tool?.command?.script).toBe('media');
      expect(tool?.command?.jsonFlag).toBe('--json');
      expect((tool?.requiredProfiles?.length ?? 0) > 0 || toolName === 'media.timeline.validate').toBe(true);
      expect((tool?.requiredCommands?.length ?? 0) > 0 || toolName === 'media.timeline.validate').toBe(true);
    }
  });

  it('preserves source metadata for generated media tools', () => {
    const full = readGeneratedManifest('manifests/tool.manifest.json');

    for (const toolName of expectedMediaToolNames) {
      const generated = findGeneratedTool(full.tools, toolName);
      expect(generated?.kind).toBe('facade-tool');
      expect(generated?.definition.category).toBe('media');
      expect(generated?.definition.command?.script).toBe('media');
    }
  });
});
