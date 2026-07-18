import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildSettingsSnapshot } from '../scripts/lib/settings-snapshot';
import { buildConfigurationSite, renderConfigurationSite, renderSettingsSite } from '../scripts/lib/settings-site';

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
    expect(html).toContain('href="/configuration" class="is-active"');
    expect(html).toContain('href="/tools"');
    expect(html).toContain('href="/environments"');
    expect(html).toContain('href="/secrets"');
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


  it('renders route-aware Tools, Environments, and Secrets shells without private embedded data', () => {
    const toolsHtml = renderConfigurationSite('tools');
    const environmentsHtml = renderConfigurationSite('environments');
    const secretsHtml = renderConfigurationSite('secrets');

    expect(toolsHtml).toContain('<title>Tools - Consuelo OS</title>');
    expect(toolsHtml).toContain('<h1>Tools</h1>');
    expect(toolsHtml).toContain('href="/tools" class="is-active"');
    expect(toolsHtml).toContain('/gateway/configuration/snapshot');
    expect(toolsHtml).toContain('/gateway/configuration/overlay');
    expect(toolsHtml).toContain('id="tools"');
    expect(toolsHtml).toContain('id="skills"');
    expect(toolsHtml).toContain('id="run-books"');
    expect(toolsHtml).not.toContain('id="connections"');
    expect(toolsHtml).not.toContain('window.__CONSUELO_SETTINGS__');

    expect(environmentsHtml).toContain('<title>Environments - Consuelo OS</title>');
    expect(environmentsHtml).toContain('<h1>Environments</h1>');
    expect(environmentsHtml).toContain('href="/environments" class="is-active"');
    expect(environmentsHtml).toContain('id="environment-form"');
    expect(environmentsHtml).toContain('id="environment-list"');
    expect(environmentsHtml).toContain('/gateway/environments/snapshot');
    expect(environmentsHtml).toContain('/gateway/environments/upsert');
    expect(environmentsHtml).toContain('/gateway/environments/delete');
    expect(environmentsHtml).not.toContain('Environment registry is not available yet');
    expect(environmentsHtml).not.toContain('/gateway/configuration/snapshot');
    expect(environmentsHtml).not.toContain('window.__CONSUELO_SETTINGS__');
    const environmentScript = environmentsHtml.match(/<script>([\s\S]*)<\/script>/)?.[1];
    expect(environmentScript).toBeTruthy();
    expect(() => new Function(environmentScript!)).not.toThrow();

    expect(secretsHtml).toContain('<title>Secrets - Consuelo OS</title>');
    expect(secretsHtml).toContain('<h1>Secrets</h1>');
    expect(secretsHtml).toContain('href="/secrets" class="is-active"');
    expect(secretsHtml).toContain('Secret connections are not available yet');
    expect(secretsHtml).not.toContain('/gateway/configuration/snapshot');
    expect(secretsHtml).not.toContain('window.__CONSUELO_SETTINGS__');
  });

  it('does not embed persisted environment records in the public environments shell', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-environments-public-shell-'));
    fs.mkdirSync(path.join(home, 'config'), { recursive: true });
    fs.writeFileSync(path.join(home, 'config', 'environments.json'), JSON.stringify({
      version: 1,
      workspaceId: 'private_workspace_environment',
      environments: [{
        environmentId: 'env_private_marker',
        workspaceId: 'private_workspace_environment',
        name: 'Private production marker',
        slug: 'private-production-marker',
        labels: ['private-label-marker'],
        scope: { kind: 'workspace' },
        status: 'active',
        metadata: { PRIVATE_REGION_MARKER: 'private-value-marker' },
        createdAt: '2026-07-18T00:00:00.000Z',
        updatedAt: '2026-07-18T00:00:00.000Z',
      }],
    }));

    const html = buildConfigurationSite(home, 'environments');
    expect(html).toContain('/gateway/environments/snapshot');
    expect(html).not.toContain('Private production marker');
    expect(html).not.toContain('private-label-marker');
    expect(html).not.toContain('PRIVATE_REGION_MARKER');
    expect(html).not.toContain('private-value-marker');
    expect(html).not.toContain('private_workspace_environment');
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
