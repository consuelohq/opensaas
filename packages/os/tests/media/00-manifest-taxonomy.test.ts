import { describe, expect, it } from 'vitest';

import {
  expectedMediaToolNames,
  expectArrayContainsAll,
  findGeneratedTool,
  findSourceTool,
  readGeneratedManifest,
  readText,
} from './helpers';

function mediaDefinitions() {
  return readGeneratedManifest('manifests/generated/tool.manifest.json').tools
    .filter((entry) => entry.definition.category === 'media')
    .map((entry) => entry.definition);
}

describe('media manifest taxonomy', () => {
  it('should satisfy media contract when the canonical media package owns every media tool', () => {
    const full = readGeneratedManifest('manifests/generated/tool.manifest.json');
    const mediaTools = full.tools.filter((entry) => entry.sourcePath === 'packages/os/tools/media/manifest.ts');
    const mediaNames = mediaTools.map((entry) => entry.name).sort();
    expectArrayContainsAll(mediaNames, expectedMediaToolNames);
    expect(mediaTools).toHaveLength(expectedMediaToolNames.length + 1);
    expect(full.tools.filter((entry) => entry.definition.category === 'media' && entry.sourcePath !== 'packages/os/tools/media/manifest.ts')).toEqual([]);
  });

  it('should satisfy media contract when TypeScript config and package source replace the retired JSON manifests', () => {
    const config = readText('manifests/manifest.config.ts');
    const mediaPackage = readText('tools/media/manifest.ts');
    expect(config).toContain('manifests/generated/tool.manifest.json');
    expect(mediaPackage).toContain('domain: "media"');
    expect(mediaPackage).toContain('sourcePath: "packages/os/tools/media/manifest.ts"');
  });

  it('should satisfy media contract when it includes every media tool in the generated full manifest and keeps media out of core by default', () => {
    const full = readGeneratedManifest('manifests/generated/tool.manifest.json');
    const core = readGeneratedManifest('manifests/generated/core.manifest.json');
    const fullNames = full.tools.map((tool) => tool.name);
    const coreNames = core.tools.map((tool) => tool.name);
    expectArrayContainsAll(fullNames, expectedMediaToolNames);
    for (const toolName of expectedMediaToolNames) expect(coreNames).not.toContain(toolName);
  });

  it('should satisfy media contract when every media package definition has explicit deterministic facade contracts', () => {
    const mediaTools = mediaDefinitions();
    for (const toolName of expectedMediaToolNames) {
      const tool = findSourceTool(mediaTools, toolName);
      expect(tool, 'missing media source tool: ' + toolName).toBeDefined();
      expect(tool?.category).toBe('media');
      expect(tool?.methodPath?.[0]).toBe('media');
      expect(tool?.description).toBeTruthy();
      expect(tool?.underlying).toMatch(/^os media/);
      expect(tool?.workflowRole).toMatch(/^media./);
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

  it('should satisfy media contract when it preserves source metadata for generated media tools', () => {
    const full = readGeneratedManifest('manifests/generated/tool.manifest.json');
    for (const toolName of expectedMediaToolNames) {
      const generated = findGeneratedTool(full.tools, toolName);
      expect(generated?.kind).toBe('facade-tool');
      expect(generated?.definition.category).toBe('media');
      expect(generated?.definition.command?.script).toBe('media');
    }
  });
});
