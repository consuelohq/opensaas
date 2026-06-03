import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  auditLocalScriptImports,
  auditOwnershipGuardrails,
  auditScriptTargets,
  loadConsueloCoreRegistry,
  validateConsueloCoreRegistry,
} from '../src/registry/index';
import type {
  ConsueloCoreRegistry,
  RegistryAuditCliOutput,
  ScriptRegistryEntry,
} from '../src/registry/types';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageRoot, '../..');
const fixtureRoots: string[] = [];

afterEach(() => {
  for (const fixtureRoot of fixtureRoots.splice(0)) {
    rmSync(fixtureRoot, { force: true, recursive: true });
  }
});

function makeFixtureRoot(): string {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'consuelo-core-registry-'));
  fixtureRoots.push(fixtureRoot);

  return fixtureRoot;
}

function makeScriptEntry(overrides: Partial<ScriptRegistryEntry>): ScriptRegistryEntry {
  return {
    id: 'research:ingest',
    ownerPackage: 'workspace',
    packageJsonPath: 'package.json',
    scriptName: 'research:ingest',
    command: 'bun packages/workspace/scripts/research-ingest.js',
    resolvedTargets: ['packages/workspace/scripts/research-ingest.js'],
    exposure: 'operator',
    migrationStatus: 'workspace-owned',
    sourceOfTruth: {
      ref: 'origin/stream/workspace-repair',
      commit: '57bdf02cae',
      path: 'packages/workspace/scripts/research-ingest.js',
      reason: 'workspace repair restored the current workspace-owned source',
    },
    validation: ['script-target-audit', 'ownership-guardrail'],
    ...overrides,
  };
}

describe('Consuelo core registry', () => {
  it('validates registry schema and required ownership entries', () => {
    const registry = loadConsueloCoreRegistry({ packageRoot, repoRoot });

    expect(validateConsueloCoreRegistry(registry)).toEqual(registry);

    expect(registry.packages.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['workspace', 'os', 'consuelo-core']),
    );
    expect(registry.scripts.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        'status',
        'code-run',
        'research:ingest',
        'task.start',
        'review.run',
        'verify',
        'os.install:local',
        'os.bootstrap',
        'os.release-install',
      ]),
    );
    expect(registry.tools.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['task.start', 'review.run', 'verify', 'os.call']),
    );
    expect(registry.skills.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['task', 'consuelo-design', 'daily-revenue-brief']),
    );

    for (const scriptEntry of registry.scripts) {
      expect(scriptEntry.sourceOfTruth.ref).toMatch(/^origin\//);
      expect(scriptEntry.sourceOfTruth.path).toBeTruthy();
      expect(scriptEntry.sourceOfTruth.reason).toBeTruthy();
      expect(scriptEntry.validation.length).toBeGreaterThan(0);
    }
  });

  it('resolves root, workspace, and OS package script file targets', () => {
    expect(auditScriptTargets({ repoRoot })).toEqual([]);
  });

  it('resolves workspace and OS local script imports', () => {
    expect(auditLocalScriptImports({ repoRoot })).toEqual([]);
  });

  it('flags the recent break pattern when a workspace-owned script has only an OS copy', () => {
    const fixtureRoot = makeFixtureRoot();
    mkdirSync(join(fixtureRoot, 'packages/os/scripts'), { recursive: true });
    writeFileSync(
      join(fixtureRoot, 'package.json'),
      JSON.stringify(
        {
          scripts: {
            'research:ingest': 'bun packages/workspace/scripts/research-ingest.js',
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(join(fixtureRoot, 'packages/os/scripts/research-ingest.js'), '#!/usr/bin/env node\n');

    const registry: ConsueloCoreRegistry = {
      version: 1,
      packages: [],
      scripts: [makeScriptEntry({})],
      tools: [],
      skills: [],
    };

    expect(auditOwnershipGuardrails({ repoRoot: fixtureRoot, registry })).toEqual([
      expect.objectContaining({
        code: 'WORKSPACE_SOURCE_MISSING_WITH_OS_COPY',
        path: 'packages/workspace/scripts/research-ingest.js',
        registryEntryId: 'research:ingest',
      }),
    ]);
  });

  it('prints deterministic drift report JSON for workspace and OS script copies', () => {
    const rawOutput = execFileSync('bun', ['scripts/audit-registry.ts', '--drift', '--json'], {
      cwd: packageRoot,
      encoding: 'utf8',
    });
    const report = JSON.parse(rawOutput) as RegistryAuditCliOutput;

    expect(report.ok).toBe(true);
    expect(report.drift.duplicates.length).toBeGreaterThan(0);

    const prLinksDrift = report.drift.duplicates.find(
      (entry) => entry.relativePath === 'lib/pr-links.js',
    );

    expect(prLinksDrift).toMatchObject({
      relativePath: 'lib/pr-links.js',
      workspacePath: 'packages/workspace/scripts/lib/pr-links.js',
      osPath: 'packages/os/scripts/lib/pr-links.js',
      workspaceOwner: 'workspace',
      osOwner: 'os',
    });
    expect(prLinksDrift?.workspaceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(prLinksDrift?.osHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
