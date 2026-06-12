import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { normalizeManifest } from '../hooks/dispatcher.js';

const workflowRoles = new Map([
  ['stream.context', 'stream.context'],
  ['task.start', 'task.start'],
  ['fs.write', 'workpad.write'],
  ['code.run', 'decision.research'],
  ['task.exec', 'test.run'],
  ['git.diff', 'diff.inspect'],
  ['review.run', 'validation.review'],
  ['verify', 'validation.verify'],
  ['task.push', 'task.push'],
  ['task.pr', 'task.pr'],
  ['task.finish', 'task.finish'],
  ['tools.search', 'tool.search'],
]);

const devManifestPath = resolve(import.meta.dirname, '../tooling/dev-tool-manifest.json');
const fullManifestPath = resolve(import.meta.dirname, '../manifests/tool.manifest.json');
const coreManifestPath = resolve(import.meta.dirname, '../manifests/core.manifest.json');

type ManifestTool = {
  name: string;
  workflowRole?: string;
  definition?: ManifestTool;
};

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function asToolList(value: unknown): ManifestTool[] {
  if (Array.isArray(value)) return value as ManifestTool[];
  if (value && typeof value === 'object' && Array.isArray((value as { tools?: unknown }).tools)) {
    return (value as { tools: ManifestTool[] }).tools;
  }
  throw new Error('expected manifest tool array');
}

function findTool(list: ManifestTool[], name: string): ManifestTool {
  const entry = list.find((item) => item.name === name);
  if (!entry) throw new Error(`missing tool ${name}`);
  return entry;
}

describe('OS manifest workflow roles', () => {
  test('dev tool manifest carries task workflow roles at the tool-contract source', () => {
    const manifest = asToolList(readJson(devManifestPath));

    for (const [name, workflowRole] of workflowRoles) {
      expect(findTool(manifest, name)).toEqual(expect.objectContaining({ workflowRole }));
    }
  });

  test('generated full and core manifests preserve workflowRole inside definitions', () => {
    const full = asToolList(readJson(fullManifestPath));
    const core = asToolList(readJson(coreManifestPath));

    for (const [name, workflowRole] of workflowRoles) {
      expect(findTool(full, name).definition).toEqual(expect.objectContaining({ workflowRole }));
      expect(findTool(core, name).definition).toEqual(expect.objectContaining({ workflowRole }));
    }
  });

  test('dispatcher normalization does not synthesize workflow roles by default', () => {
    const normalized = normalizeManifest([
      { name: 'fs.write', inputSchema: 'FsWriteInput' },
      { name: 'custom.workpad', workflowRole: 'workpad.write', inputSchema: 'CustomWriteInput' },
    ]);

    expect(findTool(normalized, 'fs.write')).not.toHaveProperty('workflowRole');
    expect(findTool(normalized, 'custom.workpad')).toEqual(
      expect.objectContaining({ workflowRole: 'workpad.write' }),
    );
  });

  test('legacy fallback must be explicitly requested for old manifests', () => {
    const normalized = normalizeManifest([
      { name: 'fs.write', inputSchema: 'FsWriteInput' },
    ], { legacyWorkflowRoleFallback: true });

    expect(findTool(normalized, 'fs.write')).toEqual(expect.objectContaining({ workflowRole: 'workpad.write' }));
  });
});
