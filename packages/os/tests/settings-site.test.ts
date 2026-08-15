import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { readFullToolManifest } from '../scripts/lib/manifest';
import { patchManifestOverlay } from '../scripts/lib/manifest-overlay';
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

    expect(snapshot.skills).toEqual([]);
    expect(snapshot.runBooks.length).toBeGreaterThan(0);
    expect(html).toContain('<title>Home - Consuelo OS</title>');
    expect(html).toContain('data-workspace-shell');
    expect(html).toContain('data-workspace-route-trigger');
    expect(html).toContain('aria-label="Workspace routes"');
    expect(html).toContain('class="workspace-route-option workspace-route-primary"');
    expect(html).toContain('href="/configuration"');
    expect(html).toContain('aria-current="page" href="/configuration"');
    expect(html).toContain('href="/tracing"');
    expect(html).toContain('href="/artifacts"');
    expect(html).toContain('href="/diffs"');
    expect(html).toContain('href="/tools"');
    expect(html).toContain('href="/nodes"');
    expect(html).toContain('href="/secrets"');
    expect(html).toContain('href="/docs"');
    expect(html).toContain('>Home</span><small>Workspace health and operating context.</small>');
    expect(html).toContain('>Artifacts</span><small>Browse agent work and generated outputs.</small>');
    expect(html).toContain('>Code</span><small>Review code diffs and changes.</small>');
    expect(html).toContain('data-route-group="Connect"');
    expect(html).toContain('href="https://chatgpt.com/plugins#settings/Connectors?create-connector=true&amp;redirectAfter=%2Fplugins"');
    expect(html).toContain('href="https://claude.ai/customize/connectors"');
    expect(html.indexOf('workspace-route-primary')).toBeLessThan(html.indexOf('>Observe</p>'));
    expect(html.indexOf('>Observe</p>')).toBeLessThan(html.indexOf('>Configure</p>'));
    expect(html.indexOf('>Configure</p>')).toBeLessThan(html.indexOf('>Connect</p>'));
    expect(html.indexOf('>Connect</p>')).toBeLessThan(html.indexOf('>Guides</p>'));
    expect(html.indexOf('href="/artifacts"')).toBeLessThan(html.indexOf('>Configure</p>'));
    expect(html.indexOf('href="/diffs"')).toBeLessThan(html.indexOf('>Configure</p>'));
    expect(html).toContain("warmRoute('/configuration')");
    expect(html).toContain('data-workspace-prefetch');
    expect(html).toContain('includeRawPayload=false');
    expect(html).toContain('sessionStorage.setItem(TRACE_PREFETCH_KEY');
    expect(html).toContain('const TRACE_PREFETCH_TTL_MS = 20000');
    expect(html).toContain('Number(cached.savedAt || 0) === savedAt');
    expect(html).not.toContain('.workspace-route-trigger:focus-visible { outline: 1px solid');
    expect(html).toContain('box-shadow: inset 0 -2px 0 var(--workspace-menu-accent)');
    expect(html).toContain('--workspace-chrome-bg:');
    expect(html).toContain('--workspace-menu-bg:');
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('left: 50vw;');
    expect(html).toContain('transform: translateX(-50%);');
    expect(html).not.toContain('aria-label="Configuration sidebar"');
    expect(html).toContain('/gateway/configuration/snapshot');
    expect(html).toContain('Loading workspace configuration');
    expect(html).toContain('Configuration unavailable');
    expect(html).toContain('/gateway/configuration/overlay');
    expect(html).toContain('Source control');
    expect(html).toContain('id="overview-readiness-title"');
    expect(html).toContain('id="overview-readiness-plot"');
    expect(html).toContain('aria-label="Workspace readiness by operating area"');
    expect(html).toContain('renderOverviewReadiness');
    expect(html).toContain('id="source-control-form"');
    expect(html).toContain('id="source-control-repository-list"');
    expect(html).toContain('/gateway/configuration/source-control');
    expect(html).toContain('connection binding');
    expect(html).toContain('href="/secrets"');
    expect(html).not.toContain('credentialValue');
    expect(html).not.toContain('githubToken');
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


  it('keeps disabled tools in the private snapshot so the Tools inventory can re-enable them', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-settings-disabled-tool-'));
    fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({
      version: 1,
      mode: 'local',
      home,
      port: 8787,
      artifactStorage: 'local',
      workspace: { id: 'ws_tools', slug: 'tools', host: 'tools.consuelohq.com' },
      agents: [],
      createdAt: '2026-08-15T00:00:00.000Z',
      updatedAt: '2026-08-15T00:00:00.000Z',
    }));
    const tool = readFullToolManifest().tools.find((entry) => entry.kind === 'facade-tool');
    expect(tool).toBeTruthy();
    patchManifestOverlay(home, { kind: 'tool', name: tool!.name, enabled: false });

    const snapshot = buildSettingsSnapshot(home);
    expect(snapshot.overlay.disabledTools).toContain(tool!.name);
    expect(snapshot.tools.find((item) => item.name === tool!.name)).toMatchObject({
      name: tool!.name,
      enabled: false,
      configurable: true,
    });

    const html = renderConfigurationSite('tools');
    expect(html).toContain("const action = item.enabled ? 'Disable' : 'Re-enable'");
    expect(html).toContain("const state = item.enabled ? 'Enabled' : 'Available to re-enable'");
    expect(html).toContain('toolInventoryItems = inventoryItems(snapshot)');
  });

  it('renders route-aware Tools, Nodes, and Secrets shells without private embedded data', () => {
    const toolsHtml = renderConfigurationSite('tools');
    const nodesHtml = renderConfigurationSite('nodes' as never);
    const secretsHtml = renderConfigurationSite('secrets');

    expect(toolsHtml).toContain('<title>Tools - Consuelo OS</title>');
    expect(toolsHtml).toContain('<h1>Tools</h1>');
    expect(toolsHtml).toContain('data-workspace-route-trigger');
    expect(toolsHtml).toContain('aria-current="page" href="/tools"');
    expect(toolsHtml).toContain('/gateway/configuration/snapshot');
    expect(toolsHtml).toContain('/gateway/configuration/overlay');
    expect(toolsHtml).toContain('id="tool-search"');
    expect(toolsHtml).toContain('data-tool-kind-filter');
    expect(toolsHtml).toContain('data-tool-state-filter');
    expect(toolsHtml).toContain('id="tool-availability-plot"');
    expect(toolsHtml).toContain('id="tool-inventory"');
    expect(toolsHtml).toContain('Re-enable');
    expect(toolsHtml).toContain('Available to re-enable');
    expect(toolsHtml).toContain('aria-label="Tool availability by surface"');
    expect(toolsHtml).not.toContain('id="connections"');
    expect(toolsHtml).not.toContain('window.__CONSUELO_SETTINGS__');

    expect(nodesHtml).toContain('<title>Nodes - Consuelo OS</title>');
    expect(nodesHtml).toContain('<h1>Nodes</h1>');
    expect(nodesHtml).toContain('aria-current="page" href="/nodes"');
    expect(nodesHtml).toContain('id="node-list"');
    expect(nodesHtml).toContain('id="node-search"');
    expect(nodesHtml).toContain('id="node-rows"');
    expect(nodesHtml).toContain('aria-label="Workspace nodes"');
    expect(nodesHtml).toContain('id="add-node-dialog"');
    expect(nodesHtml).toContain('Create cloud node');
    expect(nodesHtml).toContain('Always available');
    expect(nodesHtml).toContain('Starter');
    expect(nodesHtml).toContain('Standard');
    expect(nodesHtml).toContain('Recommended');
    expect(nodesHtml).toContain('Performance');
    expect(nodesHtml).toContain('Power');
    expect(nodesHtml).toContain('Max');
    expect(nodesHtml).toContain('/gateway/nodes/snapshot');
    expect(nodesHtml).toContain('/gateway/nodes/default');
    expect(nodesHtml).toContain('/gateway/nodes/pricing');
    expect(nodesHtml).toContain('data-plan-price=');
    expect(nodesHtml).not.toContain('Price available soon');
    expect(nodesHtml).not.toContain('Always available. One flat monthly price.');
    expect(nodesHtml).toContain('Make default');
    expect(nodesHtml).not.toContain('Provisioning coming soon');
    expect(nodesHtml).toContain('/gateway/nodes/provision');
    expect(nodesHtml).toContain('/gateway/nodes/provisioning');
    expect(nodesHtml).toContain('Create cloud node');
    expect(nodesHtml).toContain('aria-live');
    expect(nodesHtml).not.toContain('e2-standard-');
    expect(nodesHtml).not.toContain('e2-medium');
    expect(nodesHtml).toContain('currentProvisioningKey = null; updateCreateButton(); return;');
    expect(nodesHtml).not.toMatch(/e2-(?:medium|standard)/);
    expect(nodesHtml).not.toContain('machineType');
    expect(nodesHtml).not.toContain('providerCost');
    expect(nodesHtml).not.toContain('targetGrossMargin');
    expect(nodesHtml).not.toContain('/gateway/configuration/snapshot');
    expect(nodesHtml).not.toContain('window.__CONSUELO_SETTINGS__');
    const nodesScript = nodesHtml.match(/<script>([\s\S]*)<\/script>/)?.[1];
    expect(nodesScript).toBeTruthy();
    expect(nodesScript).toContain('pricingRequestGeneration');
    expect(nodesScript).toContain('const requestGeneration = ++pricingRequestGeneration');
    expect(nodesScript).toContain('requestGeneration !== pricingRequestGeneration');
    expect(() => new Function(nodesScript!)).not.toThrow();

    expect(secretsHtml).toContain('<title>Secrets - Consuelo OS</title>');
    expect(secretsHtml).toContain('<h1>Secrets</h1>');
    expect(secretsHtml).toContain('aria-current="page" href="/secrets"');
    expect(secretsHtml).toContain('Connected credentials');
    expect(secretsHtml).toContain('/gateway/secrets/bindings');
    expect(secretsHtml).toContain('Values are never returned to this page or to an agent');
    expect(secretsHtml).not.toContain('/gateway/configuration/snapshot');
    expect(secretsHtml).not.toContain('window.__CONSUELO_SETTINGS__');
  });

  it('recovers expired workspace sessions on every private configuration page', () => {
    for (const page of ['configuration', 'tools', 'nodes', 'environments', 'secrets'] as const) {
      const html = renderConfigurationSite(page as never);

      expect(html).toContain('response.status !== 401');
      expect(html).toContain("payload.error !== 'workspace_session_required'");
      expect(html).toContain("'/login/google/start'");
      expect(html).toContain("searchParams.set('purpose', 'web')");
      expect(html).toContain(
        'window.location.pathname + window.location.search + window.location.hash',
      );
      expect(html).toContain('window.location.assign(loginUrl.toString())');
    }
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

  it('reads selected and legacy custom skills from the canonical component index', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-settings-component-index-'));
    fs.mkdirSync(path.join(home, 'components'), { recursive: true });
    fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({
      version: 1,
      mode: 'local',
      home,
      port: 8787,
      artifactStorage: 'local',
      selectedSkills: ['task'],
      agents: [],
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T00:00:00.000Z',
    }));
    fs.writeFileSync(path.join(home, 'components', 'installed-skills.json'), JSON.stringify({
      schemaVersion: 1,
      kind: 'consuelo-installed-skill-index',
      sourceBundle: { bundleId: 'sha256:test', version: '1.2.0' },
      selected: [{ id: 'task', kind: 'skill', ownership: 'bundled-managed', permission: 'operator' }],
      legacyCustom: [{ id: 'local-research', kind: 'skill', ownership: 'custom', legacyPath: 'skills/local-research', migrationRequired: true }],
    }));

    const snapshot = buildSettingsSnapshot(home);
    expect(snapshot.skills.map((skill) => skill.name)).toEqual(['local-research', 'task']);
    expect(snapshot.skills.find((skill) => skill.name === 'task')).toMatchObject({
      category: 'operator',
      configurable: true,
    });
    expect(snapshot.skills.find((skill) => skill.name === 'local-research')).toMatchObject({
      configurable: false,
      enabled: true,
    });
  });

  it('reports selected bundled skills and installed local skills only', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-settings-skills-'));
    fs.mkdirSync(path.join(home, 'skills'), { recursive: true });
    fs.writeFileSync(
      path.join(home, 'config.json'),
      JSON.stringify({
        version: 1,
        mode: 'local',
        home,
        port: 8787,
        artifactStorage: 'local',
        selectedSkills: ['task'],
        agents: [],
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T00:00:00.000Z',
      }),
      'utf8',
    );
    fs.writeFileSync(
      path.join(home, 'skills', 'skills.json'),
      JSON.stringify({
        version: 1,
        skills: [
          { name: 'task', permission: 'operator' },
          { name: 'sites', permission: 'operator' },
          { name: 'local-research', permission: 'read' },
        ],
      }),
      'utf8',
    );

    const snapshot = buildSettingsSnapshot(home);

    expect(snapshot.skills.map((skill) => skill.name)).toEqual([
      'local-research',
      'task',
    ]);
    expect(snapshot.skills.find((skill) => skill.name === 'task')).toMatchObject({
      configurable: true,
    });
    expect(snapshot.skills.find((skill) => skill.name === 'local-research')).toMatchObject({
      configurable: false,
      enabled: true,
    });
    expect(snapshot.skills.find((skill) => skill.name === 'sites')).toBeUndefined();
  });
});
