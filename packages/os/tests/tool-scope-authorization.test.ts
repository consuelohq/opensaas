import { describe, expect, it } from 'vitest';

import manifestJson from '../manifests/generated/tool.manifest.json';
import { MCP_OAUTH_SCOPES } from '../cloudflare/os-device-authority/src/constants';
import { normalizeScopes } from '../cloudflare/os-device-authority/src/utils';
import { resolveToolScope } from '../scripts/lib/security-gateway';
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

  it('advertises and issues the canonical umbrella scope for new OAuth grants', () => {
    expect(MCP_OAUTH_SCOPES).toContain('os:tools');
    expect(normalizeScopes('')).toEqual(expect.arrayContaining([
      'mcp:read',
      'mcp:call',
      'os:tools',
      'route:/mcp:read',
    ]));
  });
});
