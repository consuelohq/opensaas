import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const packageFile = (path: string) => new URL(`../${path}`, import.meta.url);
const repoFile = (path: string) => new URL(`../../../${path}`, import.meta.url);
const read = (path: string) => readFileSync(packageFile(path), 'utf8');

const securePages = [
  ['secure/index.mdx', 'Overview'],
  ['secure/security-model.mdx', 'Security model'],
  ['secure/access-and-permissions.mdx', 'Access and permissions'],
  ['secure/credentials.mdx', 'Credentials'],
  ['secure/approvals.mdx', 'Approvals'],
  ['secure/nodes-and-network-access.mdx', 'Nodes and network access'],
  ['secure/tailscale.mdx', 'Tailscale'],
  ['secure/hosted-mcp-ingress.mdx', 'Hosted MCP ingress'],
  ['secure/security-reference.mdx', 'Security reference'],
] as const;

describe('Secure documentation contract', () => {
  test('publishes the complete approved Secure hierarchy in navigation order', () => {
    const navigation = read('src/lib/docs-navigation.ts');
    const orderedLabels = [
      "label: 'Overview', slug: 'secure'",
      "label: 'Security model', slug: 'secure/security-model'",
      "label: 'Access and permissions', slug: 'secure/access-and-permissions'",
      "label: 'Credentials', slug: 'secure/credentials'",
      "label: 'Approvals', slug: 'secure/approvals'",
      "label: 'Nodes and network access', slug: 'secure/nodes-and-network-access'",
      "label: 'Tailscale', slug: 'secure/tailscale'",
      "label: 'Hosted MCP ingress', slug: 'secure/hosted-mcp-ingress'",
      "label: 'Security reference', slug: 'secure/security-reference'",
    ];
    let previousIndex = -1;
    for (const needle of orderedLabels) {
      const currentIndex = navigation.indexOf(needle, previousIndex + 1);
      expect(currentIndex).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }
    for (const [sourcePath] of securePages) {
      expect(existsSync(packageFile(`src/content/docs/${sourcePath}`))).toBe(true);
    }
  });

  test('marks every Secure page as preview and records current evidence', () => {
    for (const [sourcePath] of securePages) {
      const source = read(`src/content/docs/${sourcePath}`);
      expect(source).toContain('status: preview');
      expect(source).toContain('verifiedAt: 2026-07-13');
      expect(source).toContain('evidence:');
      expect(source).toContain('source:');
      expect(source).toContain('tests:');
      expect(source).toContain('runtime:');
      expect(source).not.toContain('Use this section to understand and configure the boundaries around your workspace.');
    }
  });

  test('references evidence files that exist in the current repository', () => {
    for (const [sourcePath] of securePages) {
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

  test('separates identity, authentication, authorization, approval, and transport', () => {
    const overview = read('src/content/docs/secure/index.mdx').toLowerCase();
    for (const term of ['identity', 'authentication', 'authorization', 'approval', 'transport']) {
      expect(overview).toContain(term);
    }

    const model = read('src/content/docs/secure/security-model.mdx');
    expect(model).toContain('static Sites snapshot');
    expect(model).toContain('live OS');
    expect(model).toContain('fail closed');
    expect(model).toContain('trust boundary');
  });

  test('documents current scoped access and credential lifecycle without legacy fallback', () => {
    const access = read('src/content/docs/secure/access-and-permissions.mdx');
    for (const term of ['workspace', 'caller', 'app', 'scope', 'read', 'draft', 'write', 'execute', 'external', 'admin']) {
      expect(access.toLowerCase()).toContain(term.toLowerCase());
    }
    expect(access).toContain('unknown tool');
    expect(access).toContain('fail closed');

    const credentials = read('src/content/docs/secure/credentials.mdx');
    expect(credentials).toContain('active');
    expect(credentials).toContain('rotated');
    expect(credentials).toContain('revoked');
    expect(credentials).toContain('MCP_BEARER_TOKEN');
    expect(credentials).toContain('not accepted');
    expect(credentials).toContain('raw credential');
  });

  test('documents verified device, node, network, and hosted MCP boundaries', () => {
    const approvals = read('src/content/docs/secure/approvals.mdx');
    expect(approvals).toContain('device public key');
    expect(approvals).toContain('stronger authentication');
    expect(approvals).toContain('username and password');
    expect(approvals).toContain('action approval');

    const nodes = read('src/content/docs/secure/nodes-and-network-access.mdx');
    expect(nodes).toContain('127.0.0.1');
    expect(nodes).toContain('46321');
    expect(nodes).toContain('outbound connector');
    expect(nodes).toContain('home node');

    const ingress = read('src/content/docs/secure/hosted-mcp-ingress.mdx');
    expect(ingress).toContain('PKCE');
    expect(ingress).toContain('OAuth');
    expect(ingress).toContain('route:/mcp:read');
    expect(ingress).toContain('signed');
    expect(ingress).toContain('provider IP');
    expect(ingress).not.toContain('provider IP allowlist is the authentication model');
  });

  test('positions Tailscale accurately and publishes an exact reference', () => {
    const tailscale = read('src/content/docs/secure/tailscale.mdx');
    expect(tailscale).toContain('private Tailnet');
    expect(tailscale).toContain('not the default public MCP ingress');
    expect(tailscale).toContain('Cloudflare');

    const reference = read('src/content/docs/secure/security-reference.mdx');
    for (const term of [
      'public',
      'required',
      'workspace-session',
      'signed-connector',
      'REPLAYED_NONCE',
      'EXPIRED_TIMESTAMP',
      'BAD_SIGNATURE',
      'MISSING_SCOPE',
      'active',
      'rotated',
      'revoked',
    ]) {
      expect(reference).toContain(term);
    }
  });

  test('keeps a checked-in Secure claim ledger and removes stale ingress guidance', () => {
    const ledger = read('evidence/secure-claims.md');
    for (const heading of ['Claim', 'Public page', 'Source code', 'Tests', 'Runtime verification', 'Status']) {
      expect(ledger).toContain(heading);
    }
    expect(ledger).toContain('OAuth');
    expect(ledger).toContain('signed');
    expect(ledger).toContain('Tailscale');
    expect(ledger).toContain('MCP_BEARER_TOKEN');

    expect(existsSync(packageFile('src/content/docs/os/concepts/mcp-ingress-security.mdx'))).toBe(false);
    const redirects = read('src/lib/legacy-redirects.mjs');
    expect(redirects).toContain("'/os/concepts/mcp-ingress-security': '/secure/hosted-mcp-ingress/'");
    expect(redirects).toContain("'/user-guide/permissions-access/overview': '/secure/access-and-permissions/'");

    const packageJson = JSON.parse(read('package.json'));
    expect(packageJson.scripts?.['test:secure']).toBe('bun test tests/secure.test.ts');
    expect(packageJson.scripts?.['test:secure-browser']).toBe('bun scripts/test-secure-browser.mjs');
  });
});
