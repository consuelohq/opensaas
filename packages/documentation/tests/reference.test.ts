import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const packageFile = (path: string) => new URL(`../${path}`, import.meta.url);
const repoFile = (path: string) => new URL(`../../../${path}`, import.meta.url);
const read = (path: string) => readFileSync(packageFile(path), 'utf8');

const referencePages = [
  ['reference/index.mdx', 'Overview'],
  ['reference/cli.mdx', 'CLI'],
  ['reference/configuration.mdx', 'Configuration'],
  ['reference/mcp.mdx', 'MCP'],
  ['reference/tools.mdx', 'Tools'],
  ['reference/skills-and-manifests.mdx', 'Skills and manifests'],
  ['reference/result-and-error-formats.mdx', 'Result and error formats'],
  ['reference/environment-variables.mdx', 'Environment variables'],
  ['reference/urls-and-ports.mdx', 'URLs and ports'],
  ['reference/glossary.mdx', 'Glossary'],
] as const;

describe('Reference documentation contract', () => {
  test('publishes the complete approved Reference hierarchy in navigation order', () => {
    const navigation = read('src/lib/docs-navigation.ts');
    const orderedLabels = [
      "label: 'Overview', slug: 'reference'",
      "label: 'CLI', slug: 'reference/cli'",
      "label: 'Configuration', slug: 'reference/configuration'",
      "label: 'MCP', slug: 'reference/mcp'",
      "label: 'Tools', slug: 'reference/tools'",
      "label: 'Skills and manifests', slug: 'reference/skills-and-manifests'",
      "label: 'Result and error formats', slug: 'reference/result-and-error-formats'",
      "label: 'Environment variables', slug: 'reference/environment-variables'",
      "label: 'URLs and ports', slug: 'reference/urls-and-ports'",
      "label: 'Glossary', slug: 'reference/glossary'",
    ];
    let previousIndex = -1;
    for (const needle of orderedLabels) {
      const currentIndex = navigation.indexOf(needle, previousIndex + 1);
      expect(currentIndex).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }
    for (const [sourcePath] of referencePages) {
      expect(existsSync(packageFile(`src/content/docs/${sourcePath}`))).toBe(true);
    }
  });

  test('marks every Reference page as preview and records current evidence', () => {
    for (const [sourcePath] of referencePages) {
      const source = read(`src/content/docs/${sourcePath}`);
      expect(source).toContain('status: preview');
      expect(source).toContain('verifiedAt: 2026-07-13');
      expect(source).toContain('evidence:');
      expect(source).toContain('source:');
      expect(source).toContain('tests:');
      expect(source).toContain('runtime:');
    }
  });

  test('references evidence files that exist in the current repository', () => {
    for (const [sourcePath] of referencePages) {
      const source = read(`src/content/docs/${sourcePath}`);
      const evidencePaths = [
        ...source.matchAll(/^\s*- source: (packages\/[^\n]+)$/gm),
        ...source.matchAll(/^\s+- (packages\/[^\n]+)$/gm),
      ].map((match) => match[1]);
      expect(evidencePaths.length).toBeGreaterThan(0);
      for (const evidencePath of evidencePaths) expect(existsSync(repoFile(evidencePath))).toBe(true);
    }
  });

  test('documents the exact current CLI and configuration contracts', () => {
    const cli = read('src/content/docs/reference/cli.mdx');
    for (const term of ['get-steering', 'get-raw-steering', 'call', 'sites publish', 'settings status', '--json']) expect(cli).toContain(term);
    expect(cli).toContain('bun ./scripts/os.ts');
    expect(cli).not.toContain('consuelo os --');

    const config = read('src/content/docs/reference/configuration.mdx');
    for (const term of ['~/.consuelo', 'consuelo.yaml', 'node.yaml', 'workspace.yaml', 'config.json', 'manifest.overlay.json']) expect(config).toContain(term);
    expect(config).toContain('version: 1');
    expect(config).toContain('0600');
  });

  test('documents the MCP protocol and callable surface without overclaiming', () => {
    const mcp = read('src/content/docs/reference/mcp.mdx');
    for (const term of ['2024-11-05', 'initialize', 'tools/list', 'tools/call', 'prompts/list', 'resources/list', 'route:/mcp:read', 'UNSUPPORTED_MCP_TOOL']) expect(mcp).toContain(term);
    expect(mcp).toContain('prompts: []');
    expect(mcp).toContain('resources: []');
    expect(mcp).toContain('OS skills');
  });

  test('documents generated tool, skill, and manifest contracts', () => {
    const tools = read('src/content/docs/reference/tools.mdx');
    for (const term of ['facade-tool', 'methodPath', 'defaultTimeout', 'readOnly', 'mutating', 'safeToRetry', 'sessionRequired']) expect(tools).toContain(term);

    const skills = read('src/content/docs/reference/skills-and-manifests.mdx');
    for (const term of ['skill.json', 'SKILL.md', 'permission', 'requiresApproval', 'consuelo-os-tool-manifest', 'consuelo-os-core-manifest']) expect(skills).toContain(term);
  });

  test('documents stable result envelopes and error semantics', () => {
    const results = read('src/content/docs/reference/result-and-error-formats.mdx');
    for (const term of ['apiVersion', '1.0.0', 'traceId', 'VALIDATION_ERROR', 'TASK_SESSION_REQUIRED', 'TIMEOUT', 'CallOutput', 'requiresApproval']) expect(results).toContain(term);
    expect(results).toContain('stderr');
    expect(results).toContain('exitCode');
  });

  test('documents curated environment, URL, port, and terminology contracts', () => {
    const environment = read('src/content/docs/reference/environment-variables.mdx');
    for (const term of ['CONSUELO_HOME', 'CONSUELO_OS_HOME', 'CONSUELO_OS_PORT', 'PORT', 'CONSUELO_WORKSPACE_CONFIG', 'CONSUELO_REPO']) expect(environment).toContain(term);
    expect(environment).toContain('secret');
    expect(environment).not.toContain('MCP_BEARER_TOKEN');

    const urls = read('src/content/docs/reference/urls-and-ports.mdx');
    for (const term of ['127.0.0.1:46321', '/health', '/mcp', '/get_steering', '/call', 'https://os.consuelohq.com/mcp', '8960']) expect(urls).toContain(term);

    const glossary = read('src/content/docs/reference/glossary.mdx');
    for (const term of ['home node', 'facade tool', 'skill', 'steering', 'task session', 'trace', 'artifact', 'static snapshot', 'live OS']) expect(glossary.toLowerCase()).toContain(term.toLowerCase());
  });

  test('keeps a claim ledger and retires superseded legacy pages', () => {
    const ledger = read('evidence/reference-claims.md');
    for (const heading of ['Claim', 'Public page', 'Source code', 'Tests', 'Runtime verification', 'Status']) expect(ledger).toContain(heading);
    for (const term of ['46321', '2024-11-05', 'ToolResult', 'manifest.overlay.json', 'CONSUELO_HOME']) expect(ledger).toContain(term);

    expect(existsSync(packageFile('src/content/docs/os/concepts/configuration.mdx'))).toBe(false);
    expect(existsSync(packageFile('src/content/docs/os/glossary.mdx'))).toBe(false);
    const redirects = read('src/lib/legacy-redirects.mjs');
    expect(redirects).toContain("'/os/concepts/configuration': '/reference/configuration/'");
    expect(redirects).toContain("'/os/glossary': '/reference/glossary/'");

    const packageJson = JSON.parse(read('package.json'));
    expect(packageJson.scripts?.['test:reference']).toBe('bun test tests/reference.test.ts');
    expect(packageJson.scripts?.['test:reference-browser']).toBe('bun scripts/test-reference-browser.mjs');
  });
});
