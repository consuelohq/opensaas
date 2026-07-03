import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildSettingsSnapshot } from '../scripts/lib/settings-snapshot';
import { renderSettingsSite } from '../scripts/lib/settings-site';

describe('settings site', () => {
  it('renders read-only settings shell with nav, cloud placeholders, and embedded snapshot JSON', () => {
    const snapshot = buildSettingsSnapshot(path.join(os.homedir(), '.consuelo', 'os'));
    const html = renderSettingsSite(snapshot);

    expect(html).toContain('<title>Settings - Consuelo OS</title>');
    expect(html).toContain('aria-label="Settings navigation"');
    expect(html).toContain('href="#configuration"');
    expect(html).toContain('href="#connections"');
    expect(html).toContain('href="#tools"');
    expect(html).toContain('href="#skills"');
    expect(html).toContain('href="#run-books"');
    expect(html).toContain('href="#capabilities"');
    expect(html).toContain('ChatGPT');
    expect(html).toContain('Grok');
    expect(html).toContain('Coming soon');
    expect(html).toContain('window.__CONSUELO_SETTINGS__');
    expect(html).toContain('/gateway/settings/snapshot');
    expect(html).toContain('embedded snapshot');
    expect(html).toContain('"version":1');
    expect(html).toContain('"cloudConnectors"');
    expect(html).toContain('"runBooks"');
    expect(html).toContain('"overlay"');
    expect(html).toContain('settings-toggle');
    expect(html).toContain('/gateway/settings/overlay');
    expect(html).toContain('manifest.overlay.json');
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
    const html = renderSettingsSite(snapshot);

    expect(snapshot.cloudConnectors.find((connector) => connector.id === 'chatgpt')).toMatchObject({
      status: 'connected',
      mcpUrl: 'https://test.consuelohq.com/mcp',
      placeholder: false,
    });
    expect(snapshot.cloudConnectors.find((connector) => connector.id === 'grok')).toMatchObject({
      status: 'not_configured',
      placeholder: true,
    });
    expect(html).toContain('https://test.consuelohq.com/mcp');
    expect(html).toContain('status-connected');
  });
});