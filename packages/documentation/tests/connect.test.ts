import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const packageFile = (path: string) => new URL(`../${path}`, import.meta.url);
const repoFile = (path: string) => new URL(`../../../${path}`, import.meta.url);
const read = (path: string) => readFileSync(packageFile(path), 'utf8');

const connectPages = [
  ['connect/index.mdx', 'Overview'],
  ['connect/agents/chatgpt.mdx', 'ChatGPT'],
  ['connect/agents/codex.mdx', 'Codex'],
  ['connect/agents/claude-code.mdx', 'Claude Code'],
  ['connect/agents/cursor.mdx', 'Cursor'],
  ['connect/agents/opencode.mdx', 'OpenCode'],
  ['connect/agents/gemini.mdx', 'Gemini'],
  ['connect/agents/other-agents.mdx', 'Other agents'],
  ['connect/connectors/index.mdx', 'Overview'],
  ['connect/connectors/github.mdx', 'GitHub'],
  ['connect/connectors/google-drive.mdx', 'Google Drive'],
  ['connect/connectors/gmail.mdx', 'Gmail'],
  ['connect/connectors/google-calendar.mdx', 'Google Calendar'],
  ['connect/connectors/slack.mdx', 'Slack'],
  ['connect/connectors/additional-connectors.mdx', 'Additional connectors'],
  ['connect/nodes/how-nodes-work.mdx', 'How nodes work'],
  ['connect/nodes/home-node.mdx', 'Home node'],
  ['connect/nodes/local-nodes.mdx', 'Local nodes'],
  ['connect/nodes/cloud-nodes.mdx', 'Cloud nodes'],
] as const;

describe('Connect documentation contract', () => {
  test('publishes the complete approved Connect hierarchy in navigation order', () => {
    const navigation = read('src/lib/docs-navigation.ts');
    const orderedLabels = [
      "label: 'Overview', slug: 'connect'",
      "label: 'Agents'",
      "label: 'ChatGPT'",
      "label: 'Codex'",
      "label: 'Claude Code'",
      "label: 'Cursor'",
      "label: 'OpenCode'",
      "label: 'Gemini'",
      "label: 'Other agents'",
      "label: 'Connectors'",
      "label: 'Overview', slug: 'connect/connectors'",
      "label: 'GitHub'",
      "label: 'Google Drive'",
      "label: 'Gmail'",
      "label: 'Google Calendar'",
      "label: 'Slack'",
      "label: 'Additional connectors'",
      "label: 'Nodes'",
      "label: 'How nodes work'",
      "label: 'Home node'",
      "label: 'Local nodes'",
      "label: 'Cloud nodes'",
    ];
    let previousIndex = -1;
    for (const needle of orderedLabels) {
      const currentIndex = navigation.indexOf(needle, previousIndex + 1);
      expect(currentIndex).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }

    for (const [sourcePath] of connectPages) {
      expect(existsSync(packageFile(`src/content/docs/${sourcePath}`))).toBe(true);
    }
  });

  test('marks every Connect page as preview and records current evidence', () => {
    for (const [sourcePath] of connectPages) {
      const source = read(`src/content/docs/${sourcePath}`);
      expect(source).toContain('status: preview');
      expect(source).toContain('verifiedAt: 2026-07-13');
      expect(source).toContain('evidence:');
      expect(source).toContain('source:');
      expect(source).toContain('tests:');
      expect(source).toContain('runtime:');
      expect(source).not.toContain('Use this section to find the setup path');
    }
  });

  test('references evidence files that exist in the current repository', () => {
    for (const [sourcePath] of connectPages) {
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

  test('documents verified local agent configuration and honest support boundaries', () => {
    const pages = Object.fromEntries(
      connectPages
        .filter(([path]) => path.startsWith('connect/agents/'))
        .map(([path]) => [path, read(`src/content/docs/${path}`)]),
    );
    for (const path of [
      'connect/agents/codex.mdx',
      'connect/agents/claude-code.mdx',
      'connect/agents/cursor.mdx',
      'connect/agents/opencode.mdx',
      'connect/agents/gemini.mdx',
    ]) {
      expect(pages[path]).toContain('consuelo-os-mcp');
      expect(pages[path]).toContain('verified');
      expect(pages[path]).toContain('Troubleshooting');
      expect(pages[path]).toContain('Disconnect');
    }
    expect(pages['connect/agents/chatgpt.mdx']).toContain('https://os.consuelohq.com/mcp');
    expect(pages['connect/agents/chatgpt.mdx']).toContain('OAuth');
    expect(pages['connect/agents/other-agents.mdx']).toContain('Factory Droid');
    expect(pages['connect/agents/other-agents.mdx']).toContain('Pi');
    expect(pages['connect/agents/other-agents.mdx']).toContain('unsupported');
  });

  test('does not present service connectors as self-service when current OS does not wire them', () => {
    const overview = read('src/content/docs/connect/connectors/index.mdx');
    expect(overview).toContain('not the same thing as connecting an agent');
    for (const file of ['google-drive', 'gmail', 'google-calendar']) {
      const source = read(`src/content/docs/connect/connectors/${file}.mdx`);
      expect(source).toContain('not currently self-service');
      expect(source).toContain('Consuelo team');
    }
    const github = read('src/content/docs/connect/connectors/github.mdx');
    expect(github).toContain('GITHUB_TOKEN');
    expect(github).toContain('workspace.github');
    const slack = read('src/content/docs/connect/connectors/slack.mdx');
    expect(slack).toContain('SLACK_WEBHOOK_URL');
    expect(slack).toContain('outbound');
  });

  test('documents the current home, member, local, and cloud-node boundary', () => {
    const how = read('src/content/docs/connect/nodes/how-nodes-work.mdx');
    expect(how).toContain('home');
    expect(how).toContain('member');
    expect(how).toContain('created');
    expect(how).toContain('reconnected');
    const local = read('src/content/docs/connect/nodes/local-nodes.mdx');
    expect(local).toContain('cloudflare-tunnel');
    expect(local).toContain('websocket-relay');
    const cloud = read('src/content/docs/connect/nodes/cloud-nodes.mdx');
    expect(cloud).toContain('handled by the Consuelo team');
    expect(cloud).not.toContain('Create a cloud node now');
  });

  test('keeps a checked-in Connect claim ledger', () => {
    const ledger = read('evidence/connect-claims.md');
    for (const heading of [
      'Claim',
      'Public page',
      'Source code',
      'Tests',
      'Runtime verification',
      'Status',
    ]) {
      expect(ledger).toContain(heading);
    }
    expect(ledger).toContain('ChatGPT');
    expect(ledger).toContain('service connectors');
    expect(ledger).toContain('home node');
  });

  test('removes directly superseded integration pages and preserves useful redirects', () => {
    const redirects = read('src/lib/legacy-redirects.mjs');
    const replacements = [
      ['developers/agent/integrations.mdx', "'/developers/agent/integrations': '/connect/connectors/'"],
      ['os/concepts/integrations-and-capabilities.mdx', "'/os/concepts/integrations-and-capabilities': '/connect/connectors/'"],
    ] as const;
    for (const [sourcePath, redirect] of replacements) {
      expect(existsSync(packageFile(`src/content/docs/${sourcePath}`))).toBe(false);
      expect(redirects).toContain(redirect);
    }
    expect(redirects).toContain("'/user-guide/integrations/overview': '/connect/connectors/'");
  });
});
