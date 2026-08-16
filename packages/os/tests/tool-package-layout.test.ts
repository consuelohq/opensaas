import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildToolManifest, checkToolManifestDrift, generateToolManifest } from '../scripts/generate-tool-manifest';
import { manifestConfig } from '../manifests/manifest.config';
import { toolPackages } from '../tools/registry';
import { workflows } from '../workflows/workflows';

type JsonObject = Record<string, unknown>;
type Baseline = { version: 1; definitions: JsonObject[] };
type PythonClassifications = { version: 1; files: Record<string, { disposition: string; reason: string }> };

const packageRoot = resolve(import.meta.dirname, '..');
const baseline = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/tool-package-baseline.json'), 'utf8')) as Baseline;
const pythonClassifications = JSON.parse(readFileSync(join(import.meta.dirname, 'audit/fixtures/legacy-python-tool-classifications.json'), 'utf8')) as PythonClassifications;
const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function sortedDefinitions(definitions: JsonObject[]): JsonObject[] {
  return [...definitions].sort((left, right) => String(left.name).localeCompare(String(right.name)));
}

describe('canonical tool package layout', () => {
  it('owns every characterized active tool in exactly one package, schema, and handler', () => {
    const domains = toolPackages.map((toolPackage) => toolPackage.domain);
    expect(new Set(domains).size).toBe(domains.length);

    const definitions = toolPackages.flatMap((toolPackage) => toolPackage.definitions);
    const handlers = toolPackages.flatMap((toolPackage) => toolPackage.handlers);
    const schemas = toolPackages.flatMap((toolPackage) => toolPackage.schemas);
    const definitionNames = definitions.map((definition) => String(definition.name)).sort();
    const handlerNames = handlers.map((handler) => handler.name).sort();
    const schemaNames = schemas.map((schema) => schema.name).sort();

    expect(definitionNames).toHaveLength(baseline.definitions.length);
    expect(new Set(definitionNames).size).toBe(definitionNames.length);
    expect(handlerNames).toEqual(definitionNames);
    expect(schemaNames).toEqual(definitionNames);
    expect(sortedDefinitions(definitions as JsonObject[])).toEqual(sortedDefinitions(baseline.definitions));

    for (const toolPackage of toolPackages) {
      const sourceDirectory =
        toolPackage.domain === 'deployment'
          ? 'deployment-provider'
          : toolPackage.domain;
      expect(toolPackage.sourcePath).toBe(
        'packages/os/tools/' + sourceDirectory + '/manifest.ts',
      );
      expect(toolPackage.definitions.map((definition) => definition.name).sort())
        .toEqual(toolPackage.handlers.map((handler) => handler.name).sort());
      expect(toolPackage.definitions.map((definition) => definition.name).sort())
        .toEqual(toolPackage.schemas.map((schema) => schema.name).sort());
    }
  });

  it('generates full, core, and workflow outputs deterministically with no committed drift', () => {
    const built = buildToolManifest({ write: false });
    expect(built.full.tools.map((entry) => entry.definition)).toEqual(baseline.definitions);
    expect(built.full.tools).toHaveLength(baseline.definitions.length);
    expect(built.core.tools).toHaveLength(14);
    expect(built.workflows.workflows.map((workflow) => workflow.id)).toEqual(workflows.map((workflow) => workflow.id));
    expect(manifestConfig.outputs).toEqual({
      full: 'packages/os/manifests/generated/tool.manifest.json',
      core: 'packages/os/manifests/generated/core.manifest.json',
      workflows: 'packages/os/workflows/generated/workflow-bundles.json',
    });
    expect(checkToolManifestDrift()).toEqual([]);

    const tempRoot = mkdtempSync(join(tmpdir(), 'consuelo-tool-packages-'));
    tempRoots.push(tempRoot);
    const outputPaths = {
      fullOutputPath: join(tempRoot, 'tool.json'),
      coreOutputPath: join(tempRoot, 'core.json'),
      workflowsOutputPath: join(tempRoot, 'workflows.json'),
    };
    const first = generateToolManifest(outputPaths);
    const firstBytes = {
      full: readFileSync(first.fullOutputPath),
      core: readFileSync(first.coreOutputPath),
      workflows: readFileSync(first.workflowsOutputPath),
    };
    const second = generateToolManifest(outputPaths);
    expect(readFileSync(second.fullOutputPath)).toEqual(firstBytes.full);
    expect(readFileSync(second.coreOutputPath)).toEqual(firstBytes.core);
    expect(readFileSync(second.workflowsOutputPath)).toEqual(firstBytes.workflows);
  });

  it('removes superseded authorities, stale actions, and the classified Python collection', () => {
    expect(existsSync(join(packageRoot, 'tooling'))).toBe(false);
    for (const path of Object.keys(pythonClassifications.files)) {
      expect(existsSync(join(packageRoot, path)), path).toBe(false);
    }

    const generated = buildToolManifest({ write: false });
    const names = generated.full.tools.map((entry) => entry.name);
    expect(names).toHaveLength(baseline.definitions.length);
    expect(generated.full.tools.every((entry) => entry.kind === 'facade-tool')).toBe(true);
    expect(generated.full.tools.some((entry) => entry.sourcePath.includes('/tooling/'))).toBe(false);
  });
});
