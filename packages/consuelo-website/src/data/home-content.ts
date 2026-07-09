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
  assetSrc?: string;
};

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

export const homeTabs: HomeTab[] = [
  {
    id: 'terminal',
    label: 'macOS / Linux',
    kind: 'command',
    value: 'curl -fsSL https://os.consuelohq.com/install.sh | bash',
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
    question: 'What is Consuelo?',
    answer: 'Consuelo is open-source sales infrastructure that gives your team and your AI agents one shared system for CRM data, calling, workflow execution, and go-to-market context.',
  },
  {
    question: 'Who is it for?',
    answer: 'It is built for revenue teams, operators, and AI-native companies that need reps and agents working from the same system instead of spreading execution across disconnected tools.',
  },
  {
    question: 'Is the CRM free?',
    answer: 'Yes. The CRM can stay free while teams decide whether they want to self-host everything or move onto Mercury for hosted calling and AI usage.',
  },
  {
    question: 'What is Mercury?',
    answer: 'Mercury is the hosted plan for teams that do not want to manage dialing infrastructure, legal and compliance overhead, spam risk, or AI agent setup on day one.',
  },
  {
    question: 'Do I need to buy the whole system at once?',
    answer: 'No. Consuelo is built as one connected system, but teams can start with the part that solves the problem in front of them right now. You can adopt CRM, calling, AI coaching, workflow automation, or hosted infrastructure in stages while all of the context keeps compounding in the same place.',
  },
  {
    question: 'Can I self-host?',
    answer: 'Yes. Self-hosting stays first-class. You can run the open platform yourself, bring your own providers, and keep full control over the stack.',
  },
  {
    question: 'Does it work with GoHighLevel?',
    answer: 'Yes. Consuelo supports an embedded GoHighLevel experience, and native sync. <a href="https://marketplace.gohighlevel.com" class="launch-inline-link">View our marketplace listing here</a>.',
  },
  {
    question: 'How do CLI and assistant workflows fit in?',
    answer: 'The CLI gives assistants and terminal workflows access to the same platform your team uses, so browser work, embeds, bots, and agent tooling can all operate on shared revenue context instead of separate stacks.',
  },
  {
    question: 'Why does one shared system matter for AI agents?',
    answer: 'Agents are only useful when they can work from real context. Consuelo gives them one place to read customer data, workflow state, calling activity, and operational history, so they can do useful GTM work instead of guessing from fragments.',
  },
  {
    question: 'What about privacy and control?',
    answer: 'The core platform stays open-source and deployment stays flexible. Use Mercury when convenience matters more, or self-host when ownership matters more.',
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
    body: 'ChatGPT, Codex, Claude, Cursor, and whatever is next all enter the same house.',
    motif: 'connect',
    imageAlt: 'Sacred table with signals converging on one center',
    assetSrc: '/images/features/connect.svg',
  },
  {
    number: 2,
    label: 'REMEMBER',
    title: 'SHARED\nMEMORY',
    body: 'You should not be the memory layer. Consuelo remembers and reports so your agent never forgets.',
    motif: 'remember',
    imageAlt: 'Inner memory chamber with glowing alcoves',
    assetSrc: '/images/features/remember.svg',
  },
  {
    number: 3,
    label: 'MULTIPLAYER',
    title: 'SAME\nROOM',
    body: 'Invite collaborators when the work needs more hands. The room is already there.',
    motif: 'multiplayer',
    imageAlt: 'Shared sacred room with multiple entrances',
    assetSrc: '/images/features/multiplayer.svg',
  },
  {
    number: 4,
    label: 'OBSERVE',
    title: 'READ\nRECEIPTS',
    body: 'If an agent touched the work, there should be proof. See the traces without digging through a dead chat.',
    motif: 'observe',
    imageAlt: 'Hand reaching toward visible traces of work',
    assetSrc: '/images/features/observe.svg',
  },
  {
    number: 5,
    label: 'SECURE',
    title: 'STAYS\nLOCKED',
    body: 'Effective agents without handing over keys to the whole house. Only the doors you choose.',
    motif: 'secure',
    imageAlt: 'Lift-off scene with guarded threshold',
    assetSrc: '/images/features/secure.svg',
  },
  {
    number: 6,
    label: 'SWITCH',
    title: 'NO\nLOCK-IN',
    body: 'The best agent will keep changing. Your work should not have to move every time it does.',
    motif: 'switch',
    imageAlt: 'Many portals returning to the same palace',
    assetSrc: '/images/features/switch.svg',
  },
];

export const homeFooterSignup: HomeFooterSignup = {
  eyebrow: 'Be the first to know when we release new products',
  title: 'Join the waitlist for early access.',
  intro: 'We will send the important launches, not a pile of filler.',
  buttonLabel: 'Subscribe',
};
