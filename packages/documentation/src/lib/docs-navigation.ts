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

export const docsSections = [
  { label: 'Start', slug: 'start', description: 'Install Consuelo OS, create a workspace, and connect your first agent.' },
  { label: 'Connect', slug: 'connect', description: 'Connect agents, services, and nodes to the same workspace.' },
  { label: 'Build with OS', slug: 'build', description: 'Use tools, skills, steering, workflows, memory, files, and approvals.' },
  { label: 'Sites', slug: 'sites', description: 'Create, preview, and publish pages from your workspace.' },
  { label: 'Observe', slug: 'observe', description: 'Inspect runs, traces, tool calls, artifacts, and logs.' },
  { label: 'Secure', slug: 'secure', description: 'Understand access, credentials, approvals, nodes, and network boundaries.' },
  { label: 'Reference', slug: 'reference', description: 'Look up exact CLI, configuration, MCP, manifest, and error contracts.' },
] as const;

export const docsSidebar = docsSections.map(({ label, slug }) => ({
  label,
  collapsed: true,
  items: [{ label: 'Overview', slug }],
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
