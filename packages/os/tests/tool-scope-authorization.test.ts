import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import manifestJson from '../manifests/generated/tool.manifest.json';
import { MCP_OAUTH_SCOPES } from '../cloudflare/os-device-authority/src/constants';
import { normalizeScopes } from '../cloudflare/os-device-authority/src/utils';
import { resolveToolScope } from '../scripts/lib/security-gateway';
import { emptyManifestOverlay, writeManifestOverlay } from '../scripts/lib/manifest-overlay';
import {
  STANDARD_OS_MCP_SCOPES,
  grantsRequiredScope,
} from '../scripts/lib/tool-scope-authorization';

type ManifestTool = {
  name: string;
  kind: 'os-skill' | 'facade-tool';
};

type ToolManifest = {
  tools: ManifestTool[];
};

const manifest = manifestJson as ToolManifest;
const previousConsueloHome = process.env.CONSUELO_HOME;
const previousConsueloOsHome = process.env.CONSUELO_OS_HOME;
const previousSwampBin = process.env.CONSUELO_SWAMP_BIN;
const previousSwampRepoDir = process.env.SWAMP_REPO_DIR;
const previousCallerCwd = process.env.CONSUELO_TOOL_CALLER_CWD;
const isolatedConsueloHome = mkdtempSync(join(tmpdir(), 'consuelo-tool-scope-'));

beforeAll(() => {
  process.env.CONSUELO_HOME = isolatedConsueloHome;
});

afterAll(() => {
  if (previousConsueloHome === undefined) delete process.env.CONSUELO_HOME;
  else process.env.CONSUELO_HOME = previousConsueloHome;
  if (previousConsueloOsHome === undefined) delete process.env.CONSUELO_OS_HOME;
  else process.env.CONSUELO_OS_HOME = previousConsueloOsHome;
  if (previousSwampBin === undefined) delete process.env.CONSUELO_SWAMP_BIN;
  else process.env.CONSUELO_SWAMP_BIN = previousSwampBin;
  if (previousSwampRepoDir === undefined) delete process.env.SWAMP_REPO_DIR;
  else process.env.SWAMP_REPO_DIR = previousSwampRepoDir;
  if (previousCallerCwd === undefined) delete process.env.CONSUELO_TOOL_CALLER_CWD;
  else process.env.CONSUELO_TOOL_CALLER_CWD = previousCallerCwd;
  rmSync(isolatedConsueloHome, { recursive: true, force: true });
});

describe('central OS tool-scope authorization', () => {
  it('authorizes every known OS tool through the standard connected-client grants', () => {
    const resolutions = manifest.tools.map((tool) => resolveToolScope(tool.name));
    const unknown = resolutions.filter((resolution) => !resolution.ok);
    expect(unknown).toEqual([]);

    for (const resolution of resolutions) {
      if (!resolution.ok) continue;
      expect(
        grantsRequiredScope(STANDARD_OS_MCP_SCOPES, resolution.requiredScope),
        `${resolution.toolName} should be available to a connected OS client`,
      ).toBe(true);
    }

    expect(resolveToolScope('task.push')).toMatchObject({
      ok: true,
      category: 'dangerous',
      requiredScope: 'tool:task.push:dangerous',
    });
  });

  it('treats os:tools and mcp:call as facade grants across every tool category', () => {
    for (const grant of ['os:tools', 'mcp:call']) {
      expect(grantsRequiredScope([grant], 'tool:status:read')).toBe(true);
      expect(grantsRequiredScope([grant], 'tool:fs.write:write')).toBe(true);
      expect(grantsRequiredScope([grant], 'tool:task.push:dangerous')).toBe(true);
      expect(grantsRequiredScope([grant], 'route:/mcp:read')).toBe(false);
    }
  });

  it('preserves exact and category wildcard credentials while denying unrelated scopes', () => {
    expect(grantsRequiredScope(['tool:status:read'], 'tool:status:read')).toBe(true);
    expect(grantsRequiredScope(['tool:*:write'], 'tool:fs.write:write')).toBe(true);
    expect(grantsRequiredScope(['tool:*:*'], 'tool:task.push:dangerous')).toBe(true);

    expect(grantsRequiredScope(['tool:*:read'], 'tool:fs.write:write')).toBe(false);
    expect(grantsRequiredScope(['workspace:read'], 'tool:status:read')).toBe(false);
    expect(grantsRequiredScope(['os:tools'], 'route:/gateway/settings:write')).toBe(false);
  });

  it('keeps unknown tools fail-closed before umbrella authorization applies', () => {
    expect(resolveToolScope('missing.local.tool')).toMatchObject({
      ok: false,
      status: 403,
      error: { code: 'UNKNOWN_TOOL_SCOPE' },
    });
  });

  it('keeps disabled bundled tools fail-closed', () => {
    writeManifestOverlay(isolatedConsueloHome, {
      ...emptyManifestOverlay(),
      disabledTools: ['status'],
    });

    expect(resolveToolScope('status')).toMatchObject({
      ok: false,
      status: 403,
      error: { code: 'UNKNOWN_TOOL_SCOPE' },
    });

    writeManifestOverlay(isolatedConsueloHome, emptyManifestOverlay());
  });

  it('advertises and issues the canonical umbrella scope for new OAuth grants', () => {
    expect(MCP_OAUTH_SCOPES).toContain('os:tools');
    expect(normalizeScopes('')).toEqual(expect.arrayContaining([
      'mcp:read',
      'mcp:call',
      'os:tools',
      'route:/mcp:read',
    ]));
  });

  it('resolves runtime-provider scopes from the configured active workspace project', () => {
    const project = join(isolatedConsueloHome, 'active-project');
    const fakeSwamp = join(isolatedConsueloHome, 'fake-swamp');
    mkdirSync(project, { recursive: true });
    writeFileSync(join(project, '.swamp.yaml'), 'version: 1\n');
    expect(spawnSync('git', ['init'], { cwd: project }).status).toBe(0);

    writeFileSync(fakeSwamp, `#!/usr/bin/env node\nconst args = process.argv.slice(2);\nif (args[0] === 'model' && args[1] === 'search') {\n  process.stdout.write(JSON.stringify({results:[{id:'scope-model',name:'scope-model',methods:[{name:'run',arguments:{type:'object',properties:{},additionalProperties:false}}]}]}) + '\\n');\n  process.exit(0);\n}\nif (args[0] === 'workflow' && args[1] === 'search') {\n  process.stdout.write(JSON.stringify({results:[]}) + '\\n');\n  process.exit(0);\n}\nprocess.exit(2);\n`);
    chmodSync(fakeSwamp, 0o755);

    writeFileSync(join(isolatedConsueloHome, 'consuelo.yaml'), [
      'version: 1',
      'activeWorkspace: workspace-scope',
      'activeNode: node-scope',
      'runtime: {}',
      'updates:',
      '  channel: stable',
      '  notifications:',
      '    mode: on',
      '',
    ].join('\n'));
    const workspaceConfig = join(
      isolatedConsueloHome,
      'workspaces',
      'workspace-scope',
      'shared',
      'workspace.yaml',
    );
    mkdirSync(join(isolatedConsueloHome, 'workspaces', 'workspace-scope', 'shared'), { recursive: true });
    writeFileSync(workspaceConfig, [
      'version: 1',
      'workspace:',
      '  id: workspace-scope',
      '  name: scope',
      '  slug: scope',
      'defaults:',
      '  project: opensaas',
      'projects:',
      '  - id: opensaas',
      '    repo: consuelohq/opensaas',
      '    localPaths:',
      `      node-scope: ${project}`,
      'routing: {}',
      'policy: {}',
      'sites: {}',
      '',
    ].join('\n'));

    process.env.CONSUELO_HOME = isolatedConsueloHome;
    process.env.CONSUELO_OS_HOME = isolatedConsueloHome;
    process.env.CONSUELO_SWAMP_BIN = fakeSwamp;
    delete process.env.SWAMP_REPO_DIR;
    delete process.env.CONSUELO_TOOL_CALLER_CWD;

    expect(resolveToolScope('swamp.model.scope-model.run')).toMatchObject({
      ok: true,
      category: 'write',
      requiredScope: 'tool:swamp.model.scope-model.run:write',
    });
  });
});
