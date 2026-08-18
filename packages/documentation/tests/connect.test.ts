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
  ['connect/agents/create-your-own.mdx', 'Create your own'],
  ['connect/apps-and-services/index.mdx', 'Applications'],
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
  ['connect/apps-and-services/leadconnector-dialer.mdx', 'LeadConnector dialer'],
  ['connect/apps-and-services/salesforce.mdx', 'Salesforce'],
  ['connect/apps-and-services/hubspot.mdx', 'HubSpot'],
  ['connect/apps-and-services/stripe.mdx', 'Stripe'],
  ['connect/apps-and-services/twilio.mdx', 'Twilio'],
  ['connect/apps-and-services/create-your-own.mdx', 'Create your own'],
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
      "label: 'Cloudflare'",
      "label: 'Datadog'",
      "label: 'GitHub'",
      "label: 'Gmail'",
      "label: 'GoHighLevel'",
      "label: 'Google Calendar'",
      "label: 'Google Drive'",
      "label: 'Google Workspace'",
      "label: 'HubSpot'",
      "label: 'LeadConnector dialer'",
      "label: 'Linear'",
      "label: 'Notion'",
      "label: 'Railway'",
      "label: 'Salesforce'",
      "label: 'Sentry'",
      "label: 'Slack'",
      "label: 'Snowflake'",
      "label: 'Stripe'",
      "label: 'Supabase'",
      "label: 'Twilio'",
      "label: 'Vercel'",
      "label: 'Create your own'",
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
    expect(navigation).toContain("label: 'Applications'");
    for (const removedGroup of [
      'Productivity and communication',
      'Code and development',
      'Deploy and infrastructure',
      'Observe and monitor',
      'Data and analytics',
      'Sales and CRM',
      'Payments and communication',
    ]) {
      expect(navigation).not.toContain(`label: '${removedGroup}'`);
    }
    expect(navigation).not.toContain("label: 'Overview', slug: 'connect/apps-and-services'");
  });

  test('marks every Connect page as preview and records current evidence', () => {
    for (const [sourcePath] of connectPages) {
      const source = read(`src/content/docs/${sourcePath}`);
      expect(source).toContain('status: preview');
      expect(source).toMatch(/verifiedAt: 2026-07-\d{2}/);
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
    expect(pages['connect/agents/create-your-own.mdx']).toContain('Factory Droid');
    expect(pages['connect/agents/create-your-own.mdx']).toContain('Pi');
    expect(pages['connect/agents/create-your-own.mdx']).toContain('unsupported');
  });

  test('teaches available-today paths without presenting planned native tools as shipped', () => {
    const overview = read('src/content/docs/connect/apps-and-services/index.mdx');
    expect(overview).toContain('Applications');
    expect(overview).toContain('Available today');
    expect(overview).toContain('Native Consuelo tool');
    expect(overview).not.toContain('Productivity and communication');
    const applicationTitles = [...overview.matchAll(/<Card title="([^"]+)"/g)].map((match) => match[1]);
    const appOnly = applicationTitles.filter((label) => label !== 'Create your own');
    expect(appOnly).toEqual([...appOnly].sort((left, right) => left.localeCompare(right)));

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
    expect(railway).toContain('deployment.logs');
    expect(railway).toContain('deployment.deploy');
    expect(railway).toContain('Native Consuelo tool: Available');

    const cloudflare = read('src/content/docs/connect/apps-and-services/cloudflare.mdx');
    expect(cloudflare).toContain('deployment.logs');
    expect(cloudflare).toContain('provider: \"cloudflare\"');
    expect(cloudflare).toContain('Native Consuelo tool: Available');

    const vercel = read('src/content/docs/connect/apps-and-services/vercel.mdx');
    expect(vercel).toContain('deployment.deploy');
    expect(vercel).toContain('provider: \"vercel\"');
    expect(vercel).toContain('Native Consuelo tool: Available');

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
    expect(ledger).not.toContain('| Node pages |');
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
    expect(redirects).toContain("'/connect/agents/other-agents': '/connect/agents/create-your-own/'");
    expect(redirects).toContain("'/connect/apps-and-services/additional-services': '/connect/apps-and-services/create-your-own/'");
    expect(redirects).toContain("'/user-guide/highlevel/embedded/getting-started':");
    expect(redirects).toContain("'/connect/apps-and-services/leadconnector-dialer/'");

    const guide = read('src/content/docs/connect/apps-and-services/leadconnector-dialer.mdx');
    expect(guide).toContain('LeadConnector');
    expect(guide).toContain('/admin');
    expect(guide).toContain('/overlay');
    expect(guide).not.toContain('calls.consuelohq.com');
    expect(guide).not.toMatch(/GoHighLevel|HighLevel|\bGHL\b/);
  });
});
