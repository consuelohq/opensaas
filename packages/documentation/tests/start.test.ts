import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const packageFile = (path: string) => new URL(`../${path}`, import.meta.url);
const repoFile = (path: string) => new URL(`../../../${path}`, import.meta.url);
const read = (path: string) => readFileSync(packageFile(path), 'utf8');

const startPages = [
  ['start/index.mdx', 'Overview'],
  ['start/install-consuelo-os.mdx', 'Install Consuelo OS'],
  ['start/create-a-workspace.mdx', 'Create a workspace'],
  ['start/connect-your-first-agent.mdx', 'Connect your first agent'],
  ['start/local-and-consuelo-cloud.mdx', 'Local and Consuelo Cloud'],
  ['start/core-concepts.mdx', 'Core concepts'],
] as const;

describe('Start documentation contract', () => {
  test('publishes the complete approved Start journey in navigation order', () => {
    const navigation = read('src/lib/docs-navigation.ts');
    let previousIndex = -1;

    for (const [sourcePath, label] of startPages) {
      expect(existsSync(packageFile(`src/content/docs/${sourcePath}`))).toBe(true);
      const currentIndex = navigation.indexOf(`label: '${label}'`);
      expect(currentIndex).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }
  });

  test('marks every Start page as preview and records verifiable evidence', () => {
    for (const [sourcePath] of startPages) {
      const source = read(`src/content/docs/${sourcePath}`);
      expect(source).toContain('status: preview');
      expect(source).toContain('verifiedAt: 2026-07-13');
      expect(source).toContain('evidence:');
      expect(source).toContain('source:');
      expect(source).toContain('tests:');
      expect(source).toContain('runtime:');
      expect(source).not.toContain('Begin here when you are setting up Consuelo OS for the first time.');
    }
  });

  test('references evidence files that exist in the current repository', () => {
    for (const [sourcePath] of startPages) {
      const source = read(`src/content/docs/${sourcePath}`);
      const evidencePaths = [
        ...source.matchAll(/^\s*- source: (packages\/[^\n]+)$/gm),
        ...source.matchAll(/^\s+- (packages\/[^\n]+)$/gm),
      ].map((match) => match[1]);

      expect(evidencePaths.length).toBeGreaterThan(0);
      for (const evidencePath of evidencePaths) {
        expect(existsSync(repoFile(evidencePath))).toBe(true);
      }
    }
  });

  test('documents the verified installer and first successful local path', () => {
    const install = read('src/content/docs/start/install-consuelo-os.mdx');
    expect(install).toContain('curl -fsSL https://install.consuelohq.com/os | bash');
    expect(install).toContain('macOS');
    expect(install).toContain('Apple silicon');
    expect(install).toContain('Intel');
    expect(install).toContain('~/.consuelo');
    expect(install).toContain('doctor');

    const workspace = read('src/content/docs/start/create-a-workspace.mdx');
    expect(workspace).toContain('browser');
    expect(workspace).toContain('workspace name');
    expect(workspace).toContain('.consuelohq.com');
    expect(workspace).toContain('local workspace');

    const agent = read('src/content/docs/start/connect-your-first-agent.mdx');
    expect(agent).toContain('detected');
    expect(agent).toContain('MCP');
    expect(agent).toContain('verified');
    expect(agent).toContain('OpenCode');
  });

  test('states the current local and Cloud boundary without implying self-service Cloud install', () => {
    const source = read('src/content/docs/start/local-and-consuelo-cloud.mdx');
    expect(source).toContain('Local');
    expect(source).toContain('Consuelo Cloud');
    expect(source).toContain('handled by the Consuelo team');
    expect(source).toContain('https://consuelohq.com/contact/');
    expect(source).not.toContain('cloud setup completes automatically');
    expect(source).not.toContain('Cloud installation is self-service');
  });

  test('replaces the directly superseded CRM and legacy OS pages with redirects', () => {
    const redirects = read('src/lib/legacy-redirects.mjs');
    const replacements = [
      ['os/overview.mdx', "'/os/overview': '/start/'"],
      ['os/how-it-works.mdx', "'/os/how-it-works': '/start/core-concepts/'"],
      ['os/getting-started/install.mdx', "'/os/getting-started/install': '/start/install-consuelo-os/'"],
      ['os/getting-started/connect-agents.mdx', "'/os/getting-started/connect-agents': '/start/connect-your-first-agent/'"],
      ['os/getting-started/workspace-launcher.mdx', "'/os/getting-started/workspace-launcher': '/start/create-a-workspace/'"],
      ['os/concepts/local-and-cloud.mdx', "'/os/concepts/local-and-cloud': '/start/local-and-consuelo-cloud/'"],
      ['user-guide/introduction.mdx', "'/user-guide/introduction': '/start/'"],
      ['user-guide/getting-started/capabilities/what-is-consuelo.mdx', "'/user-guide/getting-started/capabilities/what-is-consuelo': '/start/'"],
      ['user-guide/getting-started/how-tos/create-workspace.mdx', "'/user-guide/getting-started/how-tos/create-workspace': '/start/create-a-workspace/'"],
    ] as const;

    for (const [sourcePath, redirect] of replacements) {
      expect(existsSync(packageFile(`src/content/docs/${sourcePath}`))).toBe(false);
      expect(redirects).toContain(redirect);
    }
  });
});
