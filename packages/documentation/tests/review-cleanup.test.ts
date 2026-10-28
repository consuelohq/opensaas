import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const packageFile = (path: string) => new URL(`../${path}`, import.meta.url);
const repoFile = (path: string) => new URL(`../../../${path}`, import.meta.url);
const read = (path: string) => readFileSync(packageFile(path), 'utf8');

const browserScripts = [
  'scripts/test-foundation-browser.mjs',
  'scripts/test-connect-browser.mjs',
  'scripts/test-build-browser.mjs',
  'scripts/test-sites-browser.mjs',
  'scripts/test-observe-browser.mjs',
  'scripts/test-secure-browser.mjs',
  'scripts/test-reference-browser.mjs',
];

const ledgers = [
  'evidence/start-claims.md',
  'evidence/connect-claims.md',
  'evidence/build-claims.md',
  'evidence/sites-claims.md',
  'evidence/observe-claims.md',
  'evidence/secure-claims.md',
  'evidence/reference-claims.md',
];

describe('Documentation review cleanup contract', () => {
  test('uses one browser lifecycle helper and waits for the complete server process group', () => {
    const helperPath = 'scripts/lib/documentation-browser-test.mjs';
    expect(existsSync(packageFile(helperPath))).toBe(true);
    const helper = read(helperPath);
    expect(helper).toContain('node_modules/astro/bin/astro.mjs');
    expect(helper).toContain("detached: process.platform !== 'win32'");
    expect(helper).toContain("process.kill(-server.pid, 'SIGTERM')");
    expect(helper).toContain("process.kill(-server.pid, 'SIGKILL')");
    expect(helper).toContain("['install', 'chromium']");

    for (const scriptPath of browserScripts) {
      const source = read(scriptPath);
      expect(source).toContain("from './lib/documentation-browser-test.mjs'");
      expect(source).toContain('await launchDocumentationBrowser()');
      expect(source).toContain('startDocumentationServer(');
      expect(source).toContain('await stopDocumentationServer(server)');
      expect(source).not.toContain("spawn('bun', ['run', 'dev'");
      expect(source).not.toContain("server.kill('SIGTERM')");
    }
  });

  test('checks committed files against the correct pull-request or stream base', () => {
    const source = read('scripts/check-package-boundary.mjs');
    expect(source).toContain('DOCUMENTATION_BOUNDARY_BASE');
    expect(source).toContain('GITHUB_BASE_REF');
    expect(source).toContain("['merge-base', baseRef, 'HEAD']");
    expect(source).toContain("['diff', '--name-only', `${mergeBase}...HEAD`]");
  });

  test('keeps the page-action menu hidden until its details element is open', () => {
    const source = read('src/components/PageTitle.astro');
    expect(source).toContain('details:not([open]) .page-actions-menu');
    expect(source).toContain('display: none;');
    expect(source).toContain('details[open] .page-actions-menu');
  });

  test('publishes redirect responses for removed Markdown routes', () => {
    const source = read('src/pages/[...slug].md.ts');
    expect(source).toContain("import { legacyRedirects } from '../lib/legacy-redirects.mjs'");
    expect(source).toContain('pagePathToMarkdownHref');
    expect(source).toContain('redirectTo');
    expect(source).toContain("status: 308");
  });

  test('does not tell existing managed workspaces to rerun the installer without identity', () => {
    const source = read('src/content/docs/start/connect-your-first-agent.mdx');
    expect(source).not.toContain('bun ./scripts/install.ts');
    expect(source).not.toContain('--connect-agent opencode');
    expect(source).toContain('does not currently expose a safe standalone post-install agent command');
  });

  test('keeps every claim ledger on the AUTHORING contract', () => {
    const expected = '| Claim | Public page | Source code | Tests | Runtime verification | Directional artifact | Status | Notes |';
    for (const ledger of ledgers) expect(read(ledger)).toContain(expected);
  });

  test('references only existing repository test files in the Connect ledger', () => {
    const source = read('evidence/connect-claims.md');
    const testPaths = [...source.matchAll(/`(packages\/(?:os|workspace)\/tests\/[^`]+)`/g)].map((match) => match[1]);
    expect(testPaths.length).toBeGreaterThan(0);
    for (const testPath of testPaths) expect(existsSync(repoFile(testPath))).toBe(true);
  });
});
