import { siteLinks } from './site-links';

export type HomeAnnouncement = {
  badge: string;
  text: string;
  linkLabel: string;
  linkHref: string;
};

export type HomeHeroContent = {
  title: string;
  description: string;
};

export type HomeTab = {
  id: string;
  label: string;
  kind: 'link' | 'command';
  value: string;
  href?: string;
  imageSrc: string;
  darkImageSrc?: string;
  imageAlt: string;
};

export type HomeOverviewContent = {
  eyebrow: string;
  title: string;
  intro: string;
  ctaLabel: string;
  ctaHref: string;
};

export type HomeOverviewFeature = {
  title: string;
  text: string;
};

export type HomeStatsContent = {
  eyebrow: string;
  title: string;
  intro: string;
};

export type HomeMetric = {
  value: string;
  label: string;
  caption: string;
  chart: 'line' | 'dots' | 'bars';
  points?: number[];
  filledDots?: number;
  bars?: number[];
};

export type HomePrivacyContent = {
  eyebrow: string;
  title: string;
  description: string;
  linkLabel: string;
  linkHref: string;
};

export type HomeFaqContent = {
  eyebrow: string;
  title: string;
  intro: string;
};

export type HomeFaqDetailBlock =
  | {
      type: 'paragraph';
      text: string;
    }
  | {
      type: 'list';
      items: string[];
    }
  | {
      type: 'steps';
      items: Array<{
        label: string;
        text: string;
      }>;
    };

export type HomeFaqItem = {
  question: string;
  answer: string;
  details?: HomeFaqDetailBlock[];
  linkLabel?: string;
  linkHref?: string;
};

export type HomeMercuryPromoContent = {
  eyebrow: string;
  title: string;
  intro: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
};

export type HomeMercuryHighlight = {
  title: string;
  text: string;
};

export type FeatureArtworkMotif =
  | 'connect'
  | 'remember'
  | 'multiplayer'
  | 'observe'
  | 'secure'
  | 'switch';

export type HomeFeaturePreviewItem = {
  number: number;
  label: string;
  title: string;
  body: string;
  motif: FeatureArtworkMotif;
  imageAlt: string;
  assetSrc: string;
};

export type HomePlatformCardCtaIcon = 'terminal' | 'sign-in' | 'cloud';

export type HomePlatformCard = {
  id: string;
  eyebrow: string;
  title: string;
  imageSrc: string;
  imageAlt: string;
  ctaLabel: string;
  ctaHref: string;
  ctaIcon: HomePlatformCardCtaIcon;
};

export const homePlatformCards: HomePlatformCard[] = [
  {
    id: 'macos',
    eyebrow: 'macOS 12+',
    title: 'Mac OS',
    imageSrc: '/images/platforms/macos-art.svg',
    imageAlt: 'Consuelo terminal install on macOS',
    ctaLabel: 'Install via terminal',
    ctaHref: '#install',
    ctaIcon: 'terminal',
  },
  {
    id: 'chat-native',
    eyebrow: 'Chat native',
    title: 'ChatGPT / Claude',
    imageSrc: '/images/platforms/chat-native-art.svg',
    imageAlt: 'Connect ChatGPT and Claude to Consuelo',
    ctaLabel: 'Sign in to connect',
    ctaHref: 'https://os.consuelohq.com',
    ctaIcon: 'sign-in',
  },
  {
    id: 'cloud-workspace',
    eyebrow: 'Always on',
    title: 'Cloud Workspace',
    imageSrc: '/images/platforms/cloud-workspace-art.svg',
    imageAlt: 'Deploy Consuelo to the cloud',
    ctaLabel: 'Deploy to Consuelo Cloud',
    ctaHref: 'https://os.consuelohq.com',
    ctaIcon: 'cloud',
  },
];

export type HomeFooterSignup = {
  eyebrow: string;
  title: string;
  intro: string;
  buttonLabel: string;
};

export const homeAnnouncement: HomeAnnouncement = {
  badge: 'New',
  text: 'App in beta for Chrome and Safari.',
  linkLabel: 'Sign up now',
  linkHref: siteLinks.app,
};

export const homeHero: HomeHeroContent = {
  title: 'Decision infrastructure for revenue teams.',
  description:
        'Bring calls, GTM data, files, analytics, and agents into one workspace built to help your team decide what to do next.',
};

export const INSTALL_COMMAND = 'curl -fsSL https://install.consuelohq.com/os | bash';

export const homeTabs: HomeTab[] = [
  {
    id: 'terminal',
    label: 'macOS / Linux',
    kind: 'command',
    value: INSTALL_COMMAND,
    imageSrc: '/images/gifs/demo-light.gif',
    darkImageSrc: '/images/gifs/demo-dark.gif',
    imageAlt: 'Consuelo terminal install preview',
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    kind: 'command',
    value: 'consuelo connect chatgpt --workspace os-cloud',
    imageSrc: '/images/gifs/demo-light.gif',
    darkImageSrc: '/images/gifs/demo-dark.gif',
    imageAlt: 'Consuelo ChatGPT workspace preview',
  },
];

export const homeOverview: HomeOverviewContent = {
  eyebrow: 'What is Consuelo?',
  title: 'One place for your GTM data, workflows, and agent execution.',
  intro:
        'Consuelo is the operating tool for revenue teams. Your CRM, dialer, workflows, and AI agents all work against the same context, so execution compounds instead of breaking across tools.',
  ctaLabel: 'Read docs',
  ctaHref: siteLinks.docs,
};

export const homeOverviewFeatures: HomeOverviewFeature[] = [
  {
    title: 'Shared system of context',
    text: 'Keep contacts, sales activity, shared files, and workflows in one place that both reps and agents can use.',
  },
  {
       title: 'Predictive dialer',
    text: 'Multi-line dial with spam protection, local presence, and zero latency.',
  },
  {
    title: 'Signals & intelligence',
    text: 'Prioritize leads based on real-time intent signals and live sales context.',
  },
  {
    title: 'CRM',
    text: 'Manage contacts, pipeline, and call controls.',
  },
  {
    title: 'Automations',
    text: 'Let agents handle the manual busywork while your team stays on the highest-leverage work.',
  },
  {
    title: 'Secure integrations',
        text: 'Enterprise-grade sync with your existing stack.',
  },
  {
    title: 'AI whisper',
    text: 'Surface live context, coaching, and what to say next while calls are happening.',
  },
  {
    title: 'Agent-native workflows',
    text: 'Give AI agents the same revenue system your team uses.',
  },
];

export const homeStats: HomeStatsContent = {
  eyebrow: 'The open sales infrastructure layer',
  title:
    'Built for teams that need one revenue system across browser work, CRM, dialing, coaching, automations, and AI agents.',
  intro:
    '',
};

export const homeMetrics: HomeMetric[] = [
  {
    value: '18.4K',
    label: 'Weekly dials routed',
    caption: 'Seven day outbound volume',
    chart: 'line',
    points: [12, 16, 19, 26, 34, 46, 54, 67, 72, 86],
  },
  {
    value: '41',
    label: 'Teams operating live',
    caption: 'Active workspaces on the stack',
    chart: 'dots',
    filledDots: 41,
  },
  {
    value: '2.7M',
    label: 'Call minutes tracked',
    caption: 'Rolling 30 day minutes',
    chart: 'bars',
    bars: [18, 26, 21, 33, 28, 41, 37, 49, 43, 56, 47, 61],
  },
];

export const homePrivacy: HomePrivacyContent = {
  eyebrow: 'Built for privacy first',
  title: 'Consuelo does not store provider keys or call recordings on shared infrastructure,',
  description: 'so that it can operate in privacy-sensitive environments. Learn more about',
  linkLabel: 'privacy.',
  linkHref: siteLinks.privacy,
};

export const homeFaq: HomeFaqContent = {
  eyebrow: 'FAQ',
  title: 'Answers people usually need before they trust the stack.',
  intro: '',
};

export const homeFaqItems: HomeFaqItem[] = [
  {
    question: 'What is Consuelo OS?',
    answer:
      'Consuelo OS is an open workspace layer that gives different AI agents the same tools, memory, workflows, and access to the machines where your work lives. It keeps the workspace stable even when you switch agents.',
    details: [
      {
        type: 'paragraph',
        text: 'Consuelo OS is the shared layer between your agents and your work. Instead of rebuilding context and integrations inside every chat, you define them once in a workspace.',
      },
      {
        type: 'list',
        items: [
          'Tools stay available across ChatGPT, Codex, Claude, Cursor, and local runtimes.',
          'Memory and workflow rules belong to the workspace, not one conversation.',
          'Nodes let approved agents reach the computers where work can actually run.',
        ],
      },
    ],
  },
  {
    question: 'How does Consuelo Cloud work?',
    answer:
      'Consuelo Cloud runs your home node for you, so the workspace stays available without requiring you to maintain an always-on machine. Local and cloud nodes use the same workspace model.',
    details: [
      {
        type: 'paragraph',
        text: 'Consuelo Cloud is the managed home for a workspace. It keeps routing, tools, and shared context available while your laptop is closed, without changing how agents connect.',
      },
      {
        type: 'list',
        items: [
          'Start with a managed home node that is always available.',
          'Add your own computers as extra nodes when work must run near local files or apps.',
          'Keep the same tools, memory, and policies whichever node handles the work.',
        ],
      },
    ],
  },
  {
    question: 'Which agents can I connect?',
    answer:
      'Connect ChatGPT, Codex, Claude, Cursor, and local agent runtimes. Consuelo is designed around the workspace rather than one model vendor, so you can change agents without rebuilding your operating layer.',
    details: [
      {
        type: 'paragraph',
        text: 'Use the agent that fits the job. Consuelo gives each approved agent a consistent way to discover the workspace, call tools, continue from shared context, and hand work to a node.',
      },
      {
        type: 'list',
        items: [
          'Chat agents such as ChatGPT and Claude',
          'Coding agents such as Codex and Cursor',
          'Local or custom runtimes connected through the same workspace contracts',
        ],
      },
    ],
  },
  {
    question: 'What belongs in a workspace?',
    answer:
      'A workspace is the shared boundary for your tools, memory, workflows, policies, nodes, and teammates. It keeps the way you work consistent across agents and devices.',
    details: [
      {
        type: 'paragraph',
        text: 'Think of a workspace as the durable operating context for a project or team. Chats can end and models can change; the workspace remains.',
      },
      {
        type: 'list',
        items: [
          'Tools and integrations agents are allowed to use',
          'Shared memory, instructions, and workflow conventions',
          'Registered nodes, members, and access rules',
          'The trace of what ran, what changed, and where it happened',
        ],
      },
    ],
  },
  {
    question: 'How do nodes work?',
    answer:
      'A node is a computer or cloud runner registered to your workspace. Start with one home node, then add more machines when agents need to reach work in different places.',
    details: [
      {
        type: 'steps',
        items: [
          {
            label: 'Home node',
            text: 'The default place that keeps the workspace available and routes work.',
          },
          {
            label: 'Additional nodes',
            text: 'Your laptop, desktop, server, or another runner can join the same workspace.',
          },
          {
            label: 'Routing',
            text: 'A task runs on the node that has the right files, tools, and permission. Adding another computer does not create another workspace.',
          },
        ],
      },
    ],
  },
  {
    question: 'How do tools work?',
    answer:
      'Tools are capabilities and integrations an agent can use through the workspace. Consuelo includes useful starting tools, and you can customize them or add tools that match your stack.',
    details: [
      {
        type: 'paragraph',
        text: 'A tool turns an integration or repeatable action into something every approved agent can use consistently. Configure it once, then expose it through the workspace instead of wiring it into each agent separately.',
      },
      {
        type: 'list',
        items: [
          'Start with built-in tools that cover common workspace actions.',
          'Connect the services and internal systems your team already relies on.',
          'Add guidance, permissions, and defaults without forking the tool for every model.',
        ],
      },
    ],
  },
  {
    question: 'Can I bring my team?',
    answer:
      'Yes. A workspace is designed for teammates to share tools, context, nodes, and workflows while keeping permissions and responsibilities clear.',
    details: [
      {
        type: 'paragraph',
        text: 'Invite teammates into the same workspace so human and agent work builds on one operating context. A teammate can pick up a trace, reuse a tool, or continue a workflow without reconstructing the project from a private chat.',
      },
      {
        type: 'list',
        items: [
          'Share the tools and conventions the team has approved.',
          'Keep project memory with the workspace instead of one person.',
          'Control which members and agents can reach sensitive nodes or actions.',
        ],
      },
    ],
  },
  {
    question: 'Will Consuelo replace my existing stack?',
    answer:
      'No. Consuelo connects to the tools and integrations you already use, so you can add a shared agent workspace without rebuilding everything at once.',
    details: [
      {
        type: 'paragraph',
        text: 'Adopt Consuelo from the edge inward. Connect one agent, tool, or node first, then expand as the shared workspace becomes useful. Your existing systems can remain the systems of record.',
      },
      {
        type: 'paragraph',
        text: 'The goal is to give every agent one consistent way to work with your stack, not force your stack into a new shape.',
      },
    ],
  },
  {
    question: 'How does pricing work?',
    answer:
      'Consuelo OS can run on your own hardware for free. Paid Consuelo Cloud plans add managed infrastructure and capacity, so you can choose between operating nodes yourself and having Consuelo keep the home node online.',
    details: [
      {
        type: 'list',
        items: [
          'Local: run Consuelo OS on hardware you operate.',
          'Cloud: pay for managed nodes and the capacity your workspace needs.',
          'Hybrid: keep a managed home node and add your own computers when work needs local access.',
        ],
      },
    ],
    linkLabel: 'View pricing',
    linkHref: '/pricing',
  },
];

export const homeMercuryPromo: HomeMercuryPromoContent = {
  eyebrow: 'Mercury',
  title: 'Managed telephony and AI without the setup work.',
  intro: 'Mercury handles hosted dialing, AI models, and infrastructure so your team can start executing instead of configuring providers.',
  primaryLabel: 'Learn about Mercury',
  primaryHref: siteLinks.mercury,
  secondaryLabel: '',
  secondaryHref: '',
};

export const homeMercuryHighlights: HomeMercuryHighlight[] = [];

export const homeFeaturePreviewItems: HomeFeaturePreviewItem[] = [
  {
    number: 1,
    label: 'CONNECT',
    title: 'SAME\nTOOLS',
    body: 'Build your tools once. Use them from ChatGPT, Codex, Claude, Cursor, and whatever comes next.',
    motif: 'connect',
    imageAlt: 'Sacred table with signals converging on one center',
    assetSrc: '/images/home/connect.svg',
  },
  {
    number: 2,
    label: 'REMEMBER',
    title: 'SHARED\nMEMORY',
    body: 'The memory stays with your workspace, not one chat or one agent. Pick up where the work left off.',
    motif: 'remember',
    imageAlt: 'Inner memory chamber with glowing alcoves',
    assetSrc: '/images/home/remember.svg',
  },
  {
    number: 3,
    label: 'CONTROL',
    title: 'YOUR\nWORKFLOW',
    body: 'Define how work gets done once. Every agent starts, checks, and ships work the same way.',
    motif: 'multiplayer',
    imageAlt: 'Shared workflow room with a single path through the work',
    assetSrc: '/images/home/workflow.svg',
  },
  {
    number: 4,
    label: 'OBSERVE',
    title: 'FULL\nTRACE',
    body: 'Every action leaves a trace. See what ran, what changed, and why.',
    motif: 'observe',
    imageAlt: 'Hand reaching toward visible traces of work',
    assetSrc: '/images/home/trace.svg',
  },
  {
    number: 5,
    label: 'SECURE',
    title: 'YOUR\nRULES',
    body: 'Choose which tools, files, and machines each agent can reach. Everything else stays closed.',
    motif: 'secure',
    imageAlt: 'Lift-off scene with guarded threshold',
    assetSrc: '/images/home/rules.svg',
  },
  {
    number: 6,
    label: 'SWITCH',
    title: 'NO\nLOCK-IN',
    body: 'Use the best agent for the job. Your workspace stays put.',
    motif: 'switch',
    imageAlt: 'Many portals returning to the same palace',
    assetSrc: '/images/home/switch.svg',
  },
];

export const homeFooterSignup: HomeFooterSignup = {
  eyebrow: 'Be the first to know when we release new products',
  title: 'Join the waitlist for early access.',
  intro: 'We will send the important launches, not a pile of filler.',
  buttonLabel: 'Subscribe',
};
