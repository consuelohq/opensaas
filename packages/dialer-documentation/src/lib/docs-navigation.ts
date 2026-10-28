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

export const docsSections = [
  {
    "label": "Start",
    "slug": "start",
    "description": "Set up GoHighLevel and make your first call."
  },
  {
    "label": "Outbound",
    "slug": "outbound",
    "description": "Call a contact or work through a pipeline-stage queue."
  },
  {
    "label": "Inbound",
    "slug": "inbound",
    "description": "Prepare your team to receive and route incoming calls."
  },
  {
    "label": "Team",
    "slug": "team",
    "description": "Coordinate availability, devices and call capacity."
  },
  {
    "label": "Analytics",
    "slug": "analytics",
    "description": "Understand outcomes and use call history."
  },
  {
    "label": "Billing",
    "slug": "billing",
    "description": "Understand plans, seats and usage."
  },
  {
    "label": "Troubleshooting",
    "slug": "troubleshooting",
    "description": "Recover from connection, audio and setup problems."
  },
  {
    "label": "Reference",
    "slug": "reference",
    "description": "Look up SDK, HTTP and configuration contracts."
  }
] as const;

const sectionItemsBySlug: Record<string, SidebarItem[]> = {
  "start": [
    {
      "label": "Overview",
      "slug": "start"
    },
    {
      "label": "Set up GoHighLevel",
      "slug": "start/install"
    },
    {
      "label": "Make your first call",
      "slug": "start/first-call"
    },
    {
      "label": "Core concepts",
      "slug": "start/concepts"
    },
    {
      "label": "Feature availability",
      "slug": "start/availability"
    }
  ],
  "outbound": [
    {
      "label": "Overview",
      "slug": "outbound"
    },
    {
      "label": "Pipeline-stage queues",
      "slug": "outbound/queues"
    },
    {
      "label": "Local presence",
      "slug": "outbound/local-presence"
    },
    {
      "label": "Wrap-up and outcomes",
      "slug": "outbound/wrap-up"
    }
  ],
  "inbound": [
    {
      "label": "Overview",
      "slug": "inbound"
    },
    {
      "label": "How routing works",
      "slug": "inbound/routing"
    },
    {
      "label": "Go ready for calls",
      "slug": "inbound/readiness"
    },
    {
      "label": "Callbacks",
      "slug": "inbound/callbacks"
    },
    {
      "label": "Voicemail and overflow",
      "slug": "inbound/voicemail"
    }
  ],
  "team": [
    {
      "label": "Overview",
      "slug": "team"
    },
    {
      "label": "Browser and phone devices",
      "slug": "team/devices"
    }
  ],
  "analytics": [
    {
      "label": "Overview",
      "slug": "analytics"
    },
    {
      "label": "Call history",
      "slug": "analytics/history"
    },
    {
      "label": "Transcripts and AI",
      "slug": "analytics/transcripts"
    }
  ],
  "billing": [
    {
      "label": "Overview",
      "slug": "billing"
    },
    {
      "label": "Compare plans",
      "slug": "billing/plans"
    }
  ],
  "troubleshooting": [
    {
      "label": "Overview",
      "slug": "troubleshooting"
    },
    {
      "label": "Microphone and audio",
      "slug": "troubleshooting/audio"
    },
    {
      "label": "Session and connection",
      "slug": "troubleshooting/connection"
    }
  ],
  "reference": [
    {
      "label": "Overview",
      "slug": "reference"
    },
    {
      "label": "Dialer SDK",
      "slug": "reference/sdk"
    },
    {
      "label": "HTTP API",
      "slug": "reference/http-api"
    },
    {
      "label": "Server configuration",
      "slug": "reference/configuration"
    },
    {
      "label": "Glossary",
      "slug": "reference/glossary"
    }
  ]
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
