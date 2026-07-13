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

export type HomeFaqItem = {
  question: string;
  answer: string;
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
    answer: 'Consuelo OS is an open workspace layer that gives different AI agents the same tools, memory, workflows, and access to the machines where your work lives.',
  },
  {
    question: 'What is Consuelo Cloud?',
    answer: 'Consuelo Cloud runs your home node for you, so the workspace stays available without requiring you to maintain an always-on machine.',
  },
  {
    question: 'Which agents can I connect?',
    answer: 'Connect ChatGPT, Codex, Claude, Cursor, and local agent runtimes. The workspace stays consistent even as the agent you use changes.',
  },
  {
    question: 'What is a workspace?',
    answer: 'A workspace is the shared boundary for your tools, memory, workflows, policies, and teammates. It keeps the way you work consistent across agents and devices.',
  },
  {
    question: 'What is a node?',
    answer: 'A node is a computer or cloud runner registered to your workspace. Start with one home node, then add more machines when agents need to reach work in different places.',
  },
  {
    question: 'What is a tool?',
    answer: 'A tool is a capability or integration an agent can use. Consuelo includes useful tools out of the box, and you can customize them or add tools that match your stack.',
  },
  {
    question: 'Can I bring my team?',
    answer: 'Yes. A workspace is designed for teammates to share tools, context, and workflows while keeping permissions and responsibilities clear.',
  },
  {
    question: 'Do I have to replace my existing stack?',
    answer: 'No. Consuelo connects to the tools and integrations you already use, so you can add a shared agent workspace without rebuilding everything at once.',
  },
  {
    question: 'What does it cost?',
    answer: 'You can run Consuelo OS locally for free. Paid Consuelo Cloud plans add managed infrastructure and capacity.',
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
