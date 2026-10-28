import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { normalizeManifest } from '../hooks/dispatcher.js';
import { toolPackages } from '../tools/registry';

const workflowRoles = new Map([
  ['stream.context', 'stream.context'],
  ['task.start', 'task.start'],
  ['fs.write', 'workpad.write'],
  ['code.run', 'decision.research'],
  ['code.call', 'test.run'],
  ['git.diff', 'diff.inspect'],
  ['review.run', 'validation.review'],
  ['verify', 'validation.verify'],
  ['task.push', 'task.push'],
  ['task.pr', 'task.pr'],
  ['task.finish', 'task.finish'],
  ['tools.search', 'tool.search'],
]);

const fullManifestPath = resolve(import.meta.dirname, '../manifests/generated/tool.manifest.json');
const coreManifestPath = resolve(import.meta.dirname, '../manifests/generated/core.manifest.json');

type ManifestTool = { name: string; workflowRole?: string };
type ManifestWrapper = { name: string; definition: ManifestTool };

function readDefinitions(path: string): ManifestTool[] {
  const value = JSON.parse(readFileSync(path, 'utf8')) as { tools?: ManifestWrapper[] };
  if (!Array.isArray(value.tools)) throw new Error('expected generated manifest tool array');
  return value.tools.map((entry) => entry.definition);
}
function findTool(list: ManifestTool[], name: string): ManifestTool {
  const entry = list.find((item) => item.name === name);
  if (!entry) throw new Error('missing tool ' + name);
  return entry;
}

describe('OS manifest workflow roles', () => {
  test('canonical tool packages carry task workflow roles at the contract source', () => {
    const definitions = toolPackages.flatMap((toolPackage) => toolPackage.definitions) as ManifestTool[];
    for (const [name, workflowRole] of workflowRoles) {
      expect(findTool(definitions, name)).toEqual(expect.objectContaining({ workflowRole }));
    }
  });

  test('generated manifests preserve workflowRole inside definitions', () => {
    const full = readDefinitions(fullManifestPath);
    const core = readDefinitions(coreManifestPath);
    for (const [name, workflowRole] of workflowRoles) {
      expect(findTool(full, name)).toEqual(expect.objectContaining({ workflowRole }));
      const coreTool = core.find((entry) => entry.name === name);
      if (coreTool) expect(coreTool).toEqual(expect.objectContaining({ workflowRole }));
    }
  });

  test('dispatcher normalization does not synthesize workflow roles by default', () => {
    const normalized = normalizeManifest([
      { name: 'fs.write', inputSchema: 'FsWriteInput' },
      { name: 'custom.workpad', workflowRole: 'workpad.write', inputSchema: 'CustomWriteInput' },
    ]);
    expect(findTool(normalized, 'fs.write')).not.toHaveProperty('workflowRole');
    expect(findTool(normalized, 'custom.workpad')).toEqual(expect.objectContaining({ workflowRole: 'workpad.write' }));
  });

  test('legacy fallback must be explicitly requested for old manifests', () => {
    const normalized = normalizeManifest([{ name: 'fs.write', inputSchema: 'FsWriteInput' }], { legacyWorkflowRoleFallback: true });
    expect(findTool(normalized, 'fs.write')).toEqual(expect.objectContaining({ workflowRole: 'workpad.write' }));
  });
});
