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
  ['connect/nodes/how-nodes-work.mdx', 'How nodes work'],
  ['connect/nodes/home-node.mdx', 'Home node'],
  ['connect/nodes/local-nodes.mdx', 'Local nodes'],
  ['connect/nodes/cloud-nodes.mdx', 'Cloud nodes'],
  ['connect/apps-and-services/index.mdx', 'Apps and services'],
  ['connect/apps-and-services/google-workspace.mdx', 'Google Workspace'],
  ['connect/apps-and-services/gmail.mdx', 'Gmail'],
  ['connect/apps-and-services/google-drive.mdx', 'Google Drive'],
  ['connect/apps-and-services/google-calendar.mdx', 'Google Calendar'],
  ['connect/apps-and-services/slack.mdx', 'Slack'],
  ['connect/apps-and-services/notion.mdx', 'Notion'],
  ['connect/apps-and-services/github.mdx', 'GitHub'],
  ['connect/apps-and-services/linear.mdx', 'Linear'],
  ['connect/apps-and-services/cloudflare.mdx', 'Cloudflare'],
  ['connect/apps-and-services/railway.mdx', 'Railway'],
  ['connect/apps-and-services/vercel.mdx', 'Vercel'],
  ['connect/apps-and-services/datadog.mdx', 'Datadog'],
  ['connect/apps-and-services/sentry.mdx', 'Sentry'],
  ['connect/apps-and-services/snowflake.mdx', 'Snowflake'],
  ['connect/apps-and-services/supabase.mdx', 'Supabase'],
  ['connect/apps-and-services/gohighlevel.mdx', 'GoHighLevel'],
  ['connect/apps-and-services/salesforce.mdx', 'Salesforce'],
  ['connect/apps-and-services/hubspot.mdx', 'HubSpot'],
  ['connect/apps-and-services/stripe.mdx', 'Stripe'],
  ['connect/apps-and-services/twilio.mdx', 'Twilio'],
  ['connect/apps-and-services/additional-services.mdx', 'Additional services'],
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
      "label: 'Nodes'",
      "label: 'How nodes work'",
      "label: 'Home node'",
      "label: 'Local nodes'",
      "label: 'Cloud nodes'",
      "label: 'Apps and services'",
      "label: 'Overview', slug: 'connect/apps-and-services'",
      "label: 'Productivity and communication'",
      "label: 'Google Workspace'",
      "label: 'Gmail'",
      "label: 'Google Drive'",
      "label: 'Google Calendar'",
      "label: 'Slack'",
      "label: 'Notion'",
      "label: 'Code and development'",
      "label: 'GitHub'",
      "label: 'Linear'",
      "label: 'Deploy and infrastructure'",
      "label: 'Cloudflare'",
      "label: 'Railway'",
      "label: 'Vercel'",
      "label: 'Observe and monitor'",
      "label: 'Datadog'",
      "label: 'Sentry'",
      "label: 'Data and analytics'",
      "label: 'Snowflake'",
      "label: 'Supabase'",
      "label: 'Sales and CRM'",
      "label: 'GoHighLevel'",
      "label: 'Salesforce'",
      "label: 'HubSpot'",
      "label: 'Payments and communication'",
      "label: 'Stripe'",
      "label: 'Twilio'",
      "label: 'Additional services'",
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
      expect(source).toMatch(/verifiedAt: 2026-07-(13|14)/);
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

  test('teaches available-today paths without presenting planned native tools as shipped', () => {
    const overview = read('src/content/docs/connect/apps-and-services/index.mdx');
    expect(overview).toContain('Apps and services');
    expect(overview).toContain('Available today');
    expect(overview).toContain('Native Consuelo tool');

    const google = read('src/content/docs/connect/apps-and-services/google-workspace.mdx');
    for (const term of [
      'openclaw/gogcli',
      'Native Consuelo tool: Planned',
      'Available today: Yes',
      '--readonly',
      '--gmail-no-send',
      '--no-input',
      '--json',
      'gog auth doctor --check',
      'Ask your agent',
      'google.gmail.search',
    ]) {
      expect(google).toContain(term);
    }

    for (const file of [
      'cloudflare',
      'vercel',
      'datadog',
      'snowflake',
      'gohighlevel',
      'salesforce',
      'supabase',
      'stripe',
      'twilio',
      'hubspot',
      'notion',
    ]) {
      const source = read(`src/content/docs/connect/apps-and-services/${file}.mdx`);
      expect(source).toContain('Native Consuelo tool: Planned');
      expect(source).toContain('Available today: Yes');
      expect(source).toContain('Ask your agent');
      expect(source).toContain('Official documentation');
    }
  });

  test('documents current built-in provider support separately from planned provider families', () => {
    const railway = read('src/content/docs/connect/apps-and-services/railway.mdx');
    expect(railway).toContain('railway.logs');
    expect(railway).toContain('railway.redeploy');
    expect(railway).toContain('Partially available');

    const linear = read('src/content/docs/connect/apps-and-services/linear.mdx');
    expect(linear).toContain('linear.search');
    expect(linear).toContain('linear.createIssue');
    expect(linear).toContain('Available now');

    const sentry = read('src/content/docs/connect/apps-and-services/sentry.mdx');
    expect(sentry).toContain('sentry.issues');
    expect(sentry).toContain('sentry.trace');
    expect(sentry).toContain('Available now');

    const github = read('src/content/docs/connect/apps-and-services/github.mdx');
    expect(github).toContain('GITHUB_TOKEN');
    expect(github).toContain('workspace.github');

    const slack = read('src/content/docs/connect/apps-and-services/slack.mdx');
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
    expect(ledger).toContain('Google Workspace');
    expect(ledger).toContain('Railway');
    expect(ledger).toContain('Apple Keychain');
    expect(ledger).toContain('home node');
  });

  test('removes directly superseded integration pages and preserves useful redirects', () => {
    const redirects = read('src/lib/legacy-redirects.mjs');
    const replacements = [
      ['developers/agent/integrations.mdx', "'/developers/agent/integrations': '/connect/apps-and-services/'"],
      ['os/concepts/integrations-and-capabilities.mdx', "'/os/concepts/integrations-and-capabilities': '/connect/apps-and-services/'"],
    ] as const;
    for (const [sourcePath, redirect] of replacements) {
      expect(existsSync(packageFile(`src/content/docs/${sourcePath}`))).toBe(false);
      expect(redirects).toContain(redirect);
    }
    expect(redirects).toContain("'/user-guide/integrations/overview': '/connect/apps-and-services/'");
    expect(redirects).toContain("'/connect/connectors': '/connect/apps-and-services/'");
    expect(redirects).toContain("'/connect/connectors/google-drive': '/connect/apps-and-services/google-drive/'");
  });
});
