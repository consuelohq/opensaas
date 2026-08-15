export type DocsSidebarEntry =
  | {
      type: 'link';
      label: string;
      href: string;
      isCurrent?: boolean;
      attrs?: Record<string, unknown>;
      [key: string]: unknown;
    }
  | {
      type: 'group';
      label: string;
      entries: DocsSidebarEntry[];
      collapsed: boolean;
      [key: string]: unknown;
    };

type SidebarItem =
  | { label: string; slug: string }
  | { label: string; items: SidebarItem[] };

const connectItems: SidebarItem[] = [
  { label: 'Overview', slug: 'connect' },
  {
    label: 'Agents',
    items: [
      { label: 'ChatGPT', slug: 'connect/agents/chatgpt' },
      { label: 'Codex', slug: 'connect/agents/codex' },
      { label: 'Claude Code', slug: 'connect/agents/claude-code' },
      { label: 'Cursor', slug: 'connect/agents/cursor' },
      { label: 'OpenCode', slug: 'connect/agents/opencode' },
      { label: 'Gemini', slug: 'connect/agents/gemini' },
      { label: 'Bring your own', slug: 'connect/agents/create-your-own' },
    ],
  },
  {
    label: 'Applications',
    items: [
      { label: 'Cloudflare', slug: 'connect/apps-and-services/cloudflare' },
      { label: 'Datadog', slug: 'connect/apps-and-services/datadog' },
      { label: 'GitHub', slug: 'connect/apps-and-services/github' },
      { label: 'Gmail', slug: 'connect/apps-and-services/gmail' },
      { label: 'GoHighLevel', slug: 'connect/apps-and-services/gohighlevel' },
      { label: 'Google Calendar', slug: 'connect/apps-and-services/google-calendar' },
      { label: 'Google Drive', slug: 'connect/apps-and-services/google-drive' },
      { label: 'Google Workspace', slug: 'connect/apps-and-services/google-workspace' },
      { label: 'HubSpot', slug: 'connect/apps-and-services/hubspot' },
      { label: 'LeadConnector dialer', slug: 'connect/apps-and-services/leadconnector-dialer' },
      { label: 'Linear', slug: 'connect/apps-and-services/linear' },
      { label: 'Notion', slug: 'connect/apps-and-services/notion' },
      { label: 'Railway', slug: 'connect/apps-and-services/railway' },
      { label: 'Salesforce', slug: 'connect/apps-and-services/salesforce' },
      { label: 'Sentry', slug: 'connect/apps-and-services/sentry' },
      { label: 'Slack', slug: 'connect/apps-and-services/slack' },
      { label: 'Snowflake', slug: 'connect/apps-and-services/snowflake' },
      { label: 'Stripe', slug: 'connect/apps-and-services/stripe' },
      { label: 'Supabase', slug: 'connect/apps-and-services/supabase' },
      { label: 'Twilio', slug: 'connect/apps-and-services/twilio' },
      { label: 'Vercel', slug: 'connect/apps-and-services/vercel' },
      { label: 'Bring your own', slug: 'connect/apps-and-services/create-your-own' },
    ],
  },
];

const nodesItems: SidebarItem[] = [
  { label: 'Overview', slug: 'nodes' },
  { label: 'Local nodes', slug: 'nodes/local' },
  { label: 'Cloud nodes', slug: 'nodes/cloud' },
  { label: 'Routing work', slug: 'nodes/routing' },
];

const buildItems: SidebarItem[] = [
  { label: 'Overview', slug: 'build' },
  {
    label: 'Tools',
    items: [
      { label: 'How tools work', slug: 'build/tools/how-tools-work' },
      { label: 'Workspace', slug: 'build/tools/workspace' },
      { label: 'Browser', slug: 'build/tools/browser' },
      { label: 'Artifacts', slug: 'build/tools/artifacts' },
      { label: 'Media', slug: 'build/tools/media' },
    ],
  },
  {
    label: 'Skills',
    items: [
      { label: 'How skills work', slug: 'build/skills/how-skills-work' },
      { label: 'Install a skill', slug: 'build/skills/install-a-skill' },
      { label: 'Create a skill', slug: 'build/skills/create-a-skill' },
      { label: 'Skill structure', slug: 'build/skills/skill-structure' },
      {
        label: 'Skill Templates',
        items: [
          { label: 'Overview', slug: 'build/skills/bundled' },
          { label: 'Artifacts', slug: 'build/skills/bundled/artifacts' },
          { label: 'Branch', slug: 'build/skills/bundled/branch' },
          { label: 'Browser', slug: 'build/skills/bundled/browser' },
          { label: 'Debugger', slug: 'build/skills/bundled/debugger' },
          { label: 'Handoff', slug: 'build/skills/bundled/handoff' },
          { label: 'Research Ingest', slug: 'build/skills/bundled/research-ingest' },
          { label: 'Senior Engineer', slug: 'build/skills/bundled/senior-engineer' },
          { label: 'Sites', slug: 'build/skills/bundled/sites' },
          { label: 'Skill Creator', slug: 'build/skills/bundled/skill-creator' },
          { label: 'Task', slug: 'build/skills/bundled/task' },
          { label: 'Teach', slug: 'build/skills/bundled/teach' },
        ],
      },
    ],
  },
  {
    label: 'Steering',
    items: [
      { label: 'How steering works', slug: 'build/steering/how-steering-works' },
      { label: 'Workspace steering', slug: 'build/steering/workspace-steering' },
      { label: 'Project steering', slug: 'build/steering/project-steering' },
    ],
  },
  { label: 'Workflows', slug: 'build/workflows' },
  { label: 'Shared memory and context', slug: 'build/shared-memory-and-context' },
  { label: 'Files and artifacts', slug: 'build/files-and-artifacts' },
  { label: 'Approvals', slug: 'build/approvals' },
];

const sitesItems: SidebarItem[] = [
  { label: 'Overview', slug: 'sites' },
  { label: 'Create a site', slug: 'sites/create-a-site' },
  { label: 'Pages and content', slug: 'sites/pages-and-content' },
  { label: 'Preview locally', slug: 'sites/preview-locally' },
  { label: 'Publish', slug: 'sites/publish' },
  { label: 'Domains', slug: 'sites/domains' },
  { label: 'Troubleshooting', slug: 'sites/troubleshooting' },
];

function buildGroupItems(label: string): SidebarItem[] {
  const group = buildItems.find(
    (item) => !('slug' in item) && item.label === label,
  );
  return group && 'items' in group ? group.items : [];
}

const buildToolItems = buildGroupItems('Tools');
const toolsItems: SidebarItem[] = [
  { label: 'Overview', slug: 'tools' },
  ...(buildToolItems.length > 0 ? [buildToolItems[0]] : []),
  { label: 'Tool List', slug: 'tools/tool-list' },
  { label: 'Subagents', slug: 'tools/subagents' },
  ...buildToolItems.slice(1),
  { label: 'Workflows', slug: 'build/workflows' },
];

const skillsItems: SidebarItem[] = [
  { label: 'Overview', slug: 'skills' },
  ...buildGroupItems('Skills'),
];

const workflowsItems: SidebarItem[] = [
  { label: 'Overview', slug: 'workflows' },
  { label: 'Branch Graph', slug: 'workflows/branch-graph' },
];

const steeringItems: SidebarItem[] = [
  { label: 'Overview', slug: 'steering' },
  ...buildGroupItems('Steering'),
];

const memoryItems: SidebarItem[] = [
  { label: 'Overview', slug: 'memory' },
  { label: 'Workpads', slug: 'memory/workpads' },
  { label: 'Handoffs', slug: 'memory/handoffs' },
  { label: 'Streams', slug: 'memory/streams' },
  { label: 'Memory tool and traces', slug: 'memory/saved-memory-and-traces' },
  { label: 'Shared memory and context', slug: 'build/shared-memory-and-context' },
  { label: 'Files and artifacts', slug: 'build/files-and-artifacts' },
];

const secureItems: SidebarItem[] = [
  { label: 'Overview', slug: 'secure' },
  { label: 'Security model', slug: 'secure/security-model' },
  { label: 'Access and permissions', slug: 'secure/access-and-permissions' },
  {
    label: 'Credentials',
    items: [
      { label: 'Overview', slug: 'secure/credentials' },
      { label: 'Apple Keychain and API keys', slug: 'secure/apple-keychain-and-api-keys' },
      { label: 'Credential detection', slug: 'secure/credential-detection' },
      { label: 'Other secret managers', slug: 'secure/other-secret-managers' },
    ],
  },
  { label: 'Approvals', slug: 'secure/approvals' },
  { label: 'Build approvals', slug: 'build/approvals' },
  { label: 'Nodes and network access', slug: 'secure/nodes-and-network-access' },
  { label: 'Tailscale', slug: 'secure/tailscale' },
  { label: 'Hosted MCP ingress', slug: 'secure/hosted-mcp-ingress' },
  { label: 'Security reference', slug: 'secure/security-reference' },
];


const referenceItems: SidebarItem[] = [
  { label: 'Overview', slug: 'reference' },
  { label: 'CLI', slug: 'reference/cli' },
  { label: 'Configuration', slug: 'reference/configuration' },
  { label: 'MCP', slug: 'reference/mcp' },
  { label: 'Tools', slug: 'reference/tools' },
  { label: 'Skills and manifests', slug: 'reference/skills-and-manifests' },
  { label: 'Result and error formats', slug: 'reference/result-and-error-formats' },
  { label: 'Environment variables', slug: 'reference/environment-variables' },
  { label: 'URLs and ports', slug: 'reference/urls-and-ports' },
  { label: 'Glossary', slug: 'reference/glossary' },
];

const observeItems: SidebarItem[] = [
  { label: 'Overview', slug: 'observe' },
  { label: 'Runs', slug: 'observe/runs' },
  { label: 'Traces', slug: 'observe/traces' },
  { label: 'Tool calls', slug: 'observe/tool-calls' },
  { label: 'Artifacts', slug: 'observe/artifacts' },
  { label: 'Logs', slug: 'observe/logs' },
  { label: 'Debugging failures', slug: 'observe/debugging-failures' },
];

export const docsSections = [
  { label: 'Start', slug: 'start', description: 'Install Consuelo OS, create a workspace, and connect your first agent.' },
  { label: 'Connect', slug: 'connect', description: 'Connect agents, apps, and services to the same workspace.' },
  { label: 'Nodes', slug: 'nodes', description: 'Choose where Consuelo runs and how work routes across local and cloud nodes.' },
  { label: 'Tools', slug: 'tools', description: 'Find the operations agents can call, including workspace, browser, media, workflows, and more.' },
  { label: 'Sites', slug: 'sites', description: 'Create, preview, publish, and manage sites from workspace content.' },
  { label: 'Skills', slug: 'skills', description: 'Install, use, and create reusable agent instructions and scripts.' },
  { label: 'Workflows', slug: 'workflows', description: 'Shape long-running work so people and agents can split context safely, execute in parallel, and rejoin cleanly.' },
  { label: 'Steering', slug: 'steering', description: 'Control the workspace and project instructions every agent starts from.' },
  { label: 'Memory', slug: 'memory', description: 'Carry durable work state across agents with workpads, handoffs, streams, files, and saved memory.' },
  { label: 'Observe', slug: 'observe', description: 'Inspect runs, traces, tool calls, artifacts, and logs.' },
  { label: 'Secure', slug: 'secure', description: 'Understand access, credentials, approvals, nodes, and network boundaries.' },
  { label: 'Reference', slug: 'reference', description: 'Look up exact CLI, configuration, MCP, manifest, and error contracts.' },
] as const;

const startItems = [
  { label: 'Overview', slug: 'start' },
  { label: 'Install Consuelo OS', slug: 'start/install-consuelo-os' },
  { label: 'Create a workspace', slug: 'start/create-a-workspace' },
  { label: 'Connect your first agent', slug: 'start/connect-your-first-agent' },
  { label: 'Core concepts', slug: 'start/core-concepts' },
];

const sectionItemsBySlug: Record<string, SidebarItem[]> = {
  start: startItems,
  connect: connectItems,
  nodes: nodesItems,
  tools: toolsItems,
  sites: sitesItems,
  skills: skillsItems,
  workflows: workflowsItems,
  steering: steeringItems,
  memory: memoryItems,
  observe: observeItems,
  secure: secureItems,
  reference: referenceItems,
};

export const globalSectionLinks = docsSections.map(({ label, slug }) => ({
  label,
  href: `/${slug}/`,
}));

export const docsSidebar = docsSections.map(({ label, slug }) => ({
  label,
  collapsed: true,
  items: sectionItemsBySlug[slug] ?? [{ label: 'Overview', slug }],
}));

export type DocsBreadcrumb = {
  label: string;
  href?: string;
  current?: boolean;
};

function findBreadcrumbTrail(
  items: SidebarItem[],
  targetSlug: string,
  parents: DocsBreadcrumb[] = [],
): DocsBreadcrumb[] | undefined {
  for (const item of items) {
    if ('slug' in item) {
      if (item.slug === targetSlug) {
        return [
          ...parents,
          { label: item.label, href: `/${item.slug}/`, current: true },
        ];
      }
      continue;
    }

    const found = findBreadcrumbTrail(item.items, targetSlug, [
      ...parents,
      { label: item.label },
    ]);
    if (found) return found;
  }
  return undefined;
}

function sectionForTargetSlug(targetSlug: string) {
  const direct = docsSections.find((section) => section.slug === targetSlug);
  if (direct) return direct;
  return docsSections.find((section) =>
    Boolean(findBreadcrumbTrail(sectionItemsBySlug[section.slug] ?? [], targetSlug)),
  );
}

export function getBreadcrumbs(pathname: string): DocsBreadcrumb[] {
  const targetSlug = pathname.split('?')[0]?.split('#')[0]?.replace(/^\/+|\/+$/g, '') ?? '';
  if (!targetSlug) return [];

  const section = sectionForTargetSlug(targetSlug);
  if (!section) return [];

  const sectionCrumb: DocsBreadcrumb = {
    label: section.label,
    href: `/${section.slug}/`,
  };
  if (targetSlug === section.slug) return [{ ...sectionCrumb, current: true }];

  const trail = findBreadcrumbTrail(
    sectionItemsBySlug[section.slug] ?? [],
    targetSlug,
  );
  if (!trail) return [sectionCrumb];

  return [
    sectionCrumb,
    ...trail.filter((crumb) => crumb.label !== 'Overview'),
  ];
}

function firstLeaf(item: SidebarItem): { label: string; slug: string } | undefined {
  if ('slug' in item) return item;
  for (const child of item.items) {
    const leaf = firstLeaf(child);
    if (leaf) return leaf;
  }
  return undefined;
}

export const footerSections = docsSections.map((section) => ({
  label: section.label,
  href: `/${section.slug}/`,
  links: (sectionItemsBySlug[section.slug] ?? [])
    .filter((item) => item.label !== 'Overview')
    .map((item) => {
      const leaf = firstLeaf(item);
      if (!leaf) return undefined;
      return {
        label: item.label,
        href: `/${leaf.slug}/`,
      };
    })
    .filter((link): link is { label: string; href: string } => Boolean(link)),
}));

function expandEntry(entry: DocsSidebarEntry): DocsSidebarEntry {
  if (entry.type === 'link') return { ...entry };
  return {
    ...entry,
    collapsed: false,
    entries: entry.entries.map(expandEntry),
  };
}

function entryContainsCurrent(entry: DocsSidebarEntry): boolean {
  if (entry.type === 'link') return Boolean(entry.isCurrent);
  return entry.entries.some(entryContainsCurrent);
}

export function expandCurrentSidebarPath(entries: DocsSidebarEntry[]): DocsSidebarEntry[] {
  return entries.map((entry) => {
    if (entry.type === 'link') return { ...entry };
    const expandedEntries = expandCurrentSidebarPath(entry.entries);
    return {
      ...entry,
      collapsed: entryContainsCurrent(entry) ? false : entry.collapsed,
      entries: expandedEntries,
    };
  });
}

export function selectSectionSidebar(
  entries: DocsSidebarEntry[],
  pathname: string,
):
  | { mode: 'global'; entries: DocsSidebarEntry[] }
  | { mode: 'section'; sectionLabel: string; entries: DocsSidebarEntry[] } {
  const targetSlug = pathname.split('?')[0]?.split('#')[0]?.replace(/^\/+|\/+$/g, '') ?? '';
  const section = targetSlug ? sectionForTargetSlug(targetSlug) : undefined;
  if (!section) return { mode: 'global', entries };

  const group = entries.find(
    (entry) => entry.type === 'group' && entry.label === section.label,
  );
  if (!group) return { mode: 'global', entries };

  return {
    mode: 'section',
    sectionLabel: section.label,
    entries: [expandEntry(group)],
  };
}
