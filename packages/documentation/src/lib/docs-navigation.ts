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
      { label: 'Other agents', slug: 'connect/agents/other-agents' },
    ],
  },
  {
    label: 'Connectors',
    items: [
      { label: 'Overview', slug: 'connect/connectors' },
      { label: 'GitHub', slug: 'connect/connectors/github' },
      { label: 'Google Drive', slug: 'connect/connectors/google-drive' },
      { label: 'Gmail', slug: 'connect/connectors/gmail' },
      { label: 'Google Calendar', slug: 'connect/connectors/google-calendar' },
      { label: 'Slack', slug: 'connect/connectors/slack' },
      { label: 'Additional connectors', slug: 'connect/connectors/additional-connectors' },
    ],
  },
  {
    label: 'Nodes',
    items: [
      { label: 'How nodes work', slug: 'connect/nodes/how-nodes-work' },
      { label: 'Home node', slug: 'connect/nodes/home-node' },
      { label: 'Local nodes', slug: 'connect/nodes/local-nodes' },
      { label: 'Cloud nodes', slug: 'connect/nodes/cloud-nodes' },
    ],
  },
];

const buildItems: SidebarItem[] = [
  { label: 'Overview', slug: 'build' },
  {
    label: 'Tools',
    items: [
      { label: 'How tools work', slug: 'build/tools/how-tools-work' },
      { label: 'Workspace', slug: 'build/tools/workspace' },
      { label: 'Browser', slug: 'build/tools/browser' },
      { label: 'Office', slug: 'build/tools/office' },
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

const secureItems: SidebarItem[] = [
  { label: 'Overview', slug: 'secure' },
  { label: 'Security model', slug: 'secure/security-model' },
  { label: 'Access and permissions', slug: 'secure/access-and-permissions' },
  { label: 'Credentials', slug: 'secure/credentials' },
  { label: 'Approvals', slug: 'secure/approvals' },
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
  { label: 'Connect', slug: 'connect', description: 'Connect agents, services, and nodes to the same workspace.' },
  { label: 'Build with OS', slug: 'build', description: 'Use tools, skills, steering, workflows, memory, files, and approvals.' },
  { label: 'Sites', slug: 'sites', description: 'Create, preview, and publish pages from your workspace.' },
  { label: 'Observe', slug: 'observe', description: 'Inspect runs, traces, tool calls, artifacts, and logs.' },
  { label: 'Secure', slug: 'secure', description: 'Understand access, credentials, approvals, nodes, and network boundaries.' },
  { label: 'Reference', slug: 'reference', description: 'Look up exact CLI, configuration, MCP, manifest, and error contracts.' },
] as const;

const startItems = [
  { label: 'Overview', slug: 'start' },
  { label: 'Install Consuelo OS', slug: 'start/install-consuelo-os' },
  { label: 'Create a workspace', slug: 'start/create-a-workspace' },
  { label: 'Connect your first agent', slug: 'start/connect-your-first-agent' },
  { label: 'Local and Consuelo Cloud', slug: 'start/local-and-consuelo-cloud' },
  { label: 'Core concepts', slug: 'start/core-concepts' },
];

export const docsSidebar = docsSections.map(({ label, slug }) => ({
  label,
  collapsed: true,
  items:
    slug === 'start'
      ? startItems
      : slug === 'connect'
        ? connectItems
        : slug === 'build'
          ? buildItems
          : slug === 'sites'
            ? sitesItems
            : slug === 'observe'
              ? observeItems
              : slug === 'secure'
                ? secureItems
                : slug === 'reference'
                  ? referenceItems
                  : [{ label: 'Overview', slug }],
}));

const sectionBySlug = new Map(docsSections.map((section) => [section.slug, section]));

function expandEntry(entry: DocsSidebarEntry): DocsSidebarEntry {
  if (entry.type === 'link') return { ...entry };
  return {
    ...entry,
    collapsed: false,
    entries: entry.entries.map(expandEntry),
  };
}

export function selectSectionSidebar(
  entries: DocsSidebarEntry[],
  pathname: string,
):
  | { mode: 'global'; entries: DocsSidebarEntry[] }
  | { mode: 'section'; sectionLabel: string; entries: DocsSidebarEntry[] } {
  const firstSegment = pathname.split('/').filter(Boolean)[0];
  const section = firstSegment ? sectionBySlug.get(firstSegment) : undefined;
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
