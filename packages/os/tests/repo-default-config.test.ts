import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tempHome: string;
let previousConsueloHome: string | undefined;
let previousConsueloOsHome: string | undefined;
let previousConsueloRepo: string | undefined;
let previousWorkspaceConfig: string | undefined;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-repo-default-'));
  previousConsueloHome = process.env.CONSUELO_HOME;
  previousConsueloOsHome = process.env.CONSUELO_OS_HOME;
  previousConsueloRepo = process.env.CONSUELO_REPO;
  previousWorkspaceConfig = process.env.CONSUELO_WORKSPACE_CONFIG;
  delete process.env.CONSUELO_OS_HOME;
  delete process.env.CONSUELO_REPO;
  delete process.env.CONSUELO_WORKSPACE_CONFIG;
  process.env.CONSUELO_HOME = tempHome;
});

afterEach(() => {
  if (previousConsueloHome === undefined) delete process.env.CONSUELO_HOME;
  else process.env.CONSUELO_HOME = previousConsueloHome;
  if (previousConsueloOsHome === undefined) delete process.env.CONSUELO_OS_HOME;
  else process.env.CONSUELO_OS_HOME = previousConsueloOsHome;
  if (previousConsueloRepo === undefined) delete process.env.CONSUELO_REPO;
  else process.env.CONSUELO_REPO = previousConsueloRepo;
  if (previousWorkspaceConfig === undefined) delete process.env.CONSUELO_WORKSPACE_CONFIG;
  else process.env.CONSUELO_WORKSPACE_CONFIG = previousWorkspaceConfig;
  rmSync(tempHome, { recursive: true, force: true });
});

function writeWorkspaceConfig(workspaceId: string): void {
  mkdirSync(join(tempHome, 'workspaces', workspaceId, 'shared'), { recursive: true });
  writeFileSync(
    join(tempHome, 'consuelo.yaml'),
    [
      'version: 1',
      `activeWorkspace: ${workspaceId}` ,
      '',
    ].join('\n'),
  );
  writeFileSync(
    join(tempHome, 'workspaces', workspaceId, 'shared', 'workspace.yaml'),
    [
      'version: 1',
      'workspace:',
      `  id: ${workspaceId}` ,
      '  name: Test Workspace',
      'defaults:',
      '  project: docs',
      'projects:',
      '  - id: app',
      '    repo: consuelohq/app',
      '  - id: docs',
      '    repo: consuelohq/docs',
      '',
    ].join('\n'),
  );
}

describe('repo defaults from workspace YAML', () => {
  it('resolves OS and workspace script defaults from the active workspace config', async () => {
    writeWorkspaceConfig('ws_docs');

    const osPaths = await import('../scripts/lib/paths.js');
    const workspacePaths = await import('../../workspace/scripts/lib/paths.js');

    expect(osPaths.resolveDefaultRepo()).toBe('consuelohq/docs');
    expect(workspacePaths.resolveDefaultRepo()).toBe('consuelohq/docs');
  });

  it('allows explicit environment override and otherwise keeps the existing fallback', async () => {
    const osPaths = await import('../scripts/lib/paths.js');

    expect(osPaths.resolveDefaultRepo()).toBe('consuelohq/opensaas');
    process.env.CONSUELO_REPO = 'consuelohq/custom';
    expect(osPaths.resolveDefaultRepo()).toBe('consuelohq/custom');
  });
});
