import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildSettingsSnapshot } from '../scripts/lib/settings-snapshot';
import { renderSettingsSite } from '../scripts/lib/settings-site';

describe('configuration site', () => {
  it('renders a public shell without embedding private workspace state', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-settings-public-shell-'));
    fs.writeFileSync(
      path.join(home, 'config.json'),
      JSON.stringify({
        version: 1,
        mode: 'managed',
        home,
        port: 8787,
        artifactStorage: 'local',
        workspace: {
          id: 'private_workspace_marker',
          slug: 'private-workspace-marker',
          host: 'private-workspace-marker.consuelohq.com',
        },
        agents: [],
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T00:00:00.000Z',
      }),
      'utf8',
    );
    const snapshot = buildSettingsSnapshot(home);
    const html = renderSettingsSite();

    expect(html).toContain('<title>Configuration - Consuelo OS</title>');
    expect(html).toContain('aria-label="Configuration navigation"');
    expect(html).toContain('href="#configuration"');
    expect(html).toContain('href="#connections"');
    expect(html).toContain('href="#tools"');
    expect(html).toContain('href="#skills"');
    expect(html).toContain('href="#run-books"');
    expect(html).toContain('href="#capabilities"');
    expect(html).toContain('/gateway/configuration/snapshot');
    expect(html).toContain('Loading workspace configuration');
    expect(html).toContain('Configuration unavailable');
    expect(html).toContain('/gateway/configuration/overlay');
    expect(html).not.toContain('/gateway/settings/');
    expect(html).not.toContain('Settings');
    expect(html).not.toContain('window.__CONSUELO_SETTINGS__');
    expect(html).not.toContain(snapshot.workspace.workspaceId ?? 'private_workspace_marker');
    expect(html).not.toContain(snapshot.workspace.workspaceHost ?? 'private-workspace-marker.consuelohq.com');
    expect(html).not.toContain(snapshot.overlay.path);
    expect(html).not.toContain('"cloudConnectors"');
    expect(html).not.toContain('"disabledTools"');
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    expect(script).toBeTruthy();
    expect(() => new Function(script!)).not.toThrow();
  });

  it('marks ChatGPT connected when chatgpt-mcp.json exists', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-settings-site-'));
    fs.mkdirSync(path.join(home, 'security', 'generated'), { recursive: true });
    fs.writeFileSync(
      path.join(home, 'config.json'),
      JSON.stringify({
        version: 1,
        mode: 'local',
        home,
        port: 8787,
        artifactStorage: 'local',
        workspace: { id: 'ws_test', slug: 'test', host: 'test.consuelohq.com' },
        agents: [],
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T00:00:00.000Z',
      }),
      'utf8',
    );
    fs.writeFileSync(
      path.join(home, 'security', 'generated', 'chatgpt-mcp.json'),
      JSON.stringify({ url: 'https://test.consuelohq.com/mcp' }),
      'utf8',
    );

    const snapshot = buildSettingsSnapshot(home);
    const html = renderSettingsSite();

    expect(snapshot.cloudConnectors.find((connector) => connector.id === 'chatgpt')).toMatchObject({
      status: 'connected',
      mcpUrl: 'https://test.consuelohq.com/mcp',
      placeholder: false,
    });
    expect(snapshot.cloudConnectors.find((connector) => connector.id === 'grok')).toMatchObject({
      status: 'not_configured',
      placeholder: true,
    });
    expect(html).not.toContain('https://test.consuelohq.com/mcp');
    expect(html).toContain('Cloud agents');
  });
});
