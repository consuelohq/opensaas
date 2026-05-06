import { launchDocsMenuTabs } from './launch-docs';

export type LaunchLink = {
  label: string;
  href: string;
};

export type LaunchNavLink = {
  label: string;
  href: string;
};

export type LaunchPageSection = {
  id: string;
  label: string;
};

export type LaunchAnnouncement = {
  badge: string;
  text: string;
  linkLabel: string;
  linkHref: string;
};

export type LaunchHeroContent = {
  title: string;
  description: string;
};

export type LaunchTab = {
  id: string;
  label: string;
  kind: 'link' | 'command';
  value: string;
  href?: string;
  imageSrc: string;
  darkImageSrc?: string;
  imageAlt: string;
};

export type LaunchOverviewContent = {
  eyebrow: string;
  title: string;
  intro: string;
  ctaLabel: string;
  ctaHref: string;
};

export type LaunchOverviewFeature = {
  title: string;
  text: string;
};

export type LaunchStatsContent = {
  eyebrow: string;
  title: string;
  intro: string;
};

export type LaunchMetric = {
  value: string;
  label: string;
  caption: string;
  chart: 'line' | 'dots' | 'bars';
  points?: number[];
  filledDots?: number;
  bars?: number[];
};

export type LaunchPrivacyContent = {
  eyebrow: string;
  title: string;
  description: string;
  linkLabel: string;
  linkHref: string;
};

export type LaunchFaqContent = {
  eyebrow: string;
  title: string;
  intro: string;
};

export type LaunchFaqItem = {
  question: string;
  answer: string;
};

export type MercuryProblem = {
  title: string;
  text: string;
};

export type MercuryStep = {
  step: string;
  title: string;
  text: string;
};

export type LaunchMercuryContent = {
  eyebrow: string;
  title: string;
  intro: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
};

export type LaunchMercuryHighlight = {
  title: string;
  text: string;
};

export type LaunchFooterSignup = {
  eyebrow: string;
  title: string;
  intro: string;
  buttonLabel: string;
};

export const siteLinks = {
  app: 'https://app.consuelohq.com',
  docs: 'https://docs.consuelohq.com',
  github: 'https://github.com/consuelohq/opensaas',
  changelog: '/changelog',
  mercury: '/mercury',
  pricing: '/mercury',
  enterprise: '/contact',
  login: 'https://app.consuelohq.com',
  free: 'https://app.consuelohq.com',
  newsletter: 'mailto:support@consuelohq.com?subject=Consuelo%20newsletter',
  discordDocs: 'https://docs.consuelohq.com/user-guide/discord-bot/overview',
  slackDocs: 'https://docs.consuelohq.com',
  privacy: '/privacy',
  terms: '/terms',
  discord: 'https://discord.gg/87YtkVUBvc',
  x: 'https://x.com/consuelohq_?s=21',
};

export const ghlMarketplaceUrl =
  'https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=https%3A%2F%2Ffluffy-space-spork-w4j6vvvvwpxh6rw-3000.app.github.dev%2Fapi%2Foauth%2Fcallback&client_id=690cbca9af44827eb89887b1-mhpq9v7i&scope=contacts.readonly+contacts.write+opportunities.readonly+opportunities.write+calendars.readonly+users.readonly+conversations.readonly+conversations.write+conversations%2Fmessage.readonly+conversations%2Fmessage.write+locations.readonly&version_id=690cbca9af44827eb89887b1';

export const launchHeaderLinks: LaunchNavLink[] = [
  { label: 'Docs', href: siteLinks.docs },
  { label: 'Mercury', href: siteLinks.mercury },
  { label: 'Enterprise', href: siteLinks.enterprise },
];

export const launchMobileMenuLinks: LaunchNavLink[] = [
  ...launchHeaderLinks.filter((link) => link.label !== 'docs'),
  { label: 'Login', href: siteLinks.login },
  { label: 'Free', href: siteLinks.free },
];

export const launchPageSections: LaunchPageSection[] = [
  { id: 'intro', label: 'Intro' },
  { id: 'overview', label: 'What is Consuelo?' },
  { id: 'proof', label: 'Proof' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'faq', label: 'FAQ' },
  { id: 'mercury', label: 'Mercury' },
  { id: 'waitlist', label: 'Waitlist' },
];

export const launchAnnouncement: LaunchAnnouncement = {
  badge: 'New',
  text: 'App in beta for Chrome and Safari.',
  linkLabel: 'Sign up now',
  linkHref: siteLinks.app,
};

export const launchHero: LaunchHeroContent = {
  title: 'Decision infrastructure for revenue teams.',
  description:
        'Bring calls, GTM data, files, analytics, and agents into one workspace built to help your team decide what to do next.',
};

export const launchTabs: LaunchTab[] = [
  {
    id: 'web',
    label: 'Web',
    kind: 'link',
    value: siteLinks.app,
    href: siteLinks.app,
    imageSrc: '/images/gifs/demo-light.gif',
    darkImageSrc: '/images/gifs/demo-dark.gif',
    imageAlt: 'Consuelo browser workspace preview',
  },
  {
    id: 'embed',
    label: 'Embed',
    kind: 'link',
    value: 'https://consuelohq.com/ghl',
    href: '/ghl',
    imageSrc: '/images/gifs/demo-light.gif',
    darkImageSrc: '/images/gifs/demo-dark.gif',
    imageAlt: 'Consuelo embedded dialer preview',
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    kind: 'command',
    value: 'npm install -g @consuelo/cli',
    imageSrc: '/images/gifs/demo-light.gif',
    darkImageSrc: '/images/gifs/demo-dark.gif',
    imageAlt: 'Consuelo assistant preview',
  },
  {
    id: 'claude',
    label: 'Claude',
    kind: 'command',
    value: 'npm install -g @consuelo/cli',
    imageSrc: '/images/gifs/demo-light.gif',
    darkImageSrc: '/images/gifs/demo-dark.gif',
    imageAlt: 'Consuelo agent workflow preview',
  },
  {
    id: 'discord',
    label: 'Discord',
    kind: 'link',
    value: siteLinks.discordDocs,
    href: siteLinks.discordDocs,
    imageSrc: '/images/gifs/demo-light.gif',
    darkImageSrc: '/images/gifs/demo-dark.gif',
    imageAlt: 'Consuelo discord workflow preview',
  },
  {
    id: 'slack',
    label: 'Slack',
    kind: 'link',
    value: siteLinks.slackDocs,
    href: siteLinks.slackDocs,
    imageSrc: '/images/gifs/demo-light.gif',
    darkImageSrc: '/images/gifs/demo-dark.gif',
    imageAlt: 'Consuelo work channel preview',
  },
  {
    id: 'chrome',
    label: 'Chrome',
    kind: 'link',
    value: 'https://chromewebstore.google.com/detail/consuelo-dialer',
    href: 'https://chromewebstore.google.com/detail/consuelo-dialer',
    imageSrc: '/images/gifs/demo-light.gif',
    darkImageSrc: '/images/gifs/demo-dark.gif',
    imageAlt: 'Consuelo chrome extension preview',
  },
  {
    id: 'cli',
    label: 'CLI',
    kind: 'command',
    value: 'npm install -g @consuelo/cli',
    imageSrc: '/images/gifs/demo-light.gif',
    darkImageSrc: '/images/gifs/demo-dark.gif',
    imageAlt: 'Consuelo cli preview',
  },
];

export const launchOverview: LaunchOverviewContent = {
  eyebrow: 'What is Consuelo?',
  title: 'One place for your GTM data, workflows, and agent execution.',
  intro:
        'Consuelo is the operating tool for revenue teams. Your CRM, dialer, workflows, and AI agents all work against the same context, so execution compounds instead of breaking across tools.',
  ctaLabel: 'Read docs',
  ctaHref: siteLinks.docs,
};

export const launchOverviewFeatures: LaunchOverviewFeature[] = [
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

export const launchStats: LaunchStatsContent = {
  eyebrow: 'The open sales infrastructure layer',
  title:
    'Built for teams that need one revenue system across browser work, CRM, dialing, coaching, automations, and AI agents.',
  intro:
    '',
};

export const launchMetrics: LaunchMetric[] = [
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

export const launchPrivacy: LaunchPrivacyContent = {
  eyebrow: 'Built for privacy first',
  title: 'Consuelo does not store provider keys or call recordings on shared infrastructure,',
  description: 'so that it can operate in privacy-sensitive environments. Learn more about',
  linkLabel: 'privacy.',
  linkHref: siteLinks.docs,
};

export const launchFaq: LaunchFaqContent = {
  eyebrow: 'FAQ',
  title: 'Answers people usually need before they trust the stack.',
  intro: '',
};

export const launchFaqItems: LaunchFaqItem[] = [
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

export const launchMercury: LaunchMercuryContent = {
  eyebrow: 'Mercury',
  title: 'Hosted calling and AI, ready to go.',
  intro: 'Mercury is the hosted plan for teams that want to get live fast. It gives you Predictive dialer, AI models from OpenAI and Groq, and hosting on Railway without making you manage provider setup or infrastructure on day one.',
  primaryLabel: 'Learn about Mercury',
  primaryHref: siteLinks.mercury,
  secondaryLabel: '',
  secondaryHref: '',
};

export const launchMercuryHighlights: LaunchMercuryHighlight[] = [];

export const mercuryProblems: MercuryProblem[] = [
  {
    title: 'Too many moving parts',
    text: 'Most teams do not want to set up dialing, wire providers, and manage infrastructure before they can even start calling.',
  },
  {
    title: 'Spam and compliance drag',
    text: 'Teams waste weeks dealing with spam risk, legal overhead, and telecom setup instead of getting reps live.',
  },
  {
    title: 'Insurance chargebacks',
    text: 'For insurance teams, bad contact flow and weak process create downstream chargeback risk that cuts into revenue.',
  },
  {
    title: 'Speed matters more than infra',
    text: 'Some teams just want to launch quickly and think about self-hosting later if it becomes worth it.',
  },
];

export const mercurySteps: MercuryStep[] = [
  {
    step: '01',
    title: 'Start with the hosted workspace',
    text: 'Sign in, connect your workspace, and skip standing up the whole stack yourself first.',
  },
  {
    step: '02',
    title: 'Use hosted dialing and AI',
    text: 'Mercury is built for teams that want hosted dialing and AI usage instead of managing providers on day one.',
  },
  {
    step: '03',
    title: 'Scale or self-host later',
    text: 'Move from hosted convenience to self-managed infrastructure when it actually makes sense.',
  },
];

export const mercuryFaqItems: LaunchFaqItem[] = [
  {
    question: 'What is Mercury?',
    answer: "Mercury is Consuelo's hosted plan. It is meant for teams that want the product without taking on infrastructure work up front.",
  },
  {
    question: 'Do I need to buy the whole system at once?',
    answer: 'No. Consuelo is built as one connected system, but teams can start with the part that solves the problem in front of them right now. You can buy CRM, calling, AI coaching, or hosted infrastructure one step at a time, while everything still compounds because the system is designed to work together.',
  },
  {
    question: 'How is Mercury priced?',
    answer: 'mercury starts at $20 pay as you go. usage is tracked per request — call minutes, coaching requests, and transcription. auto-top-up adds $20 when your balance hits $5.',
  },
  {
    question: 'When should I pick Mercury instead of self-hosted?',
    answer: 'Pick Mercury when speed, convenience, and fewer moving pieces matter more than owning every provider integration yourself on day one.',
  },
  {
    question: 'Do I still need my own Twilio or AI keys?',
    answer: 'Not for the hosted Mercury path. Self-hosted teams can still bring their own keys when they want full provider control.',
  },
  {
    question: 'Can I move from Mercury to self-hosted later?',
    answer: 'Yes. The platform is built so hosted and self-managed deployment models can coexist instead of locking you into one forever choice.',
  },
  {
    question: 'Is the CRM still free if I do not want Mercury yet?',
    answer: 'Yes. The CRM can stand on its own while teams decide whether they want hosted usage, self-hosting, or a staged rollout between the two.',
  },
];

export const launchFooterSignup: LaunchFooterSignup = {
  eyebrow: 'Be the first to know when we release new products',
  title: 'Join the waitlist for early access.',
  intro: 'We will send the important launches, not a pile of filler.',
  buttonLabel: 'Subscribe',
};

export const footerLinks: LaunchLink[] = [
  { label: 'Mercury', href: '/mercury' },
  { label: 'Docs', href: siteLinks.docs },
  { label: 'Changelog', href: siteLinks.changelog },
  { label: 'Discord', href: siteLinks.discord },
  { label: 'X', href: siteLinks.x },
];

export { launchDocsMenuTabs };
