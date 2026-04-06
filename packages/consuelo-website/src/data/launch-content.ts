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
  title: 'Sales infrastructure that integrates everywhere.',
  description: 'Software that shows up in the browser, inside your CRM, in work channels, and in agent workflows.',
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
  title: '',
  intro: 'The unified sales platform where reps work alongside AI agents to run outbound, automate workflows, and scale pipeline.',
  ctaLabel: 'Read docs',
  ctaHref: siteLinks.docs,
};

export const launchOverviewFeatures: LaunchOverviewFeature[] = [
  {
    title: 'Power dialer',
    text: 'Parallel dial with spam protection, local presence, and zero latency.',
  },
  {
    title: 'Signals & intelligence',
    text: 'Prioritize leads based on real-time intent signals.',
  },
  {
    title: 'CRM',
    text: 'Manage contacts, queue states, and call controls together in one workspace.',
  },
  {
    title: 'Automations',
    text: 'Let agents handle the manual busywork.',
  },
  {
    title: 'AI whisper',
    text: 'Surfaces live context and tells you what to say.',
  },
  {
    title: 'Secure integrations',
    text: 'Enterprise-grade sync with your existing stack.',
  },
];

export const launchStats: LaunchStatsContent = {
  eyebrow: 'The open sales infrastructure layer',
  title: 'Built for teams that need throughput, traceability, and one system across every surface.',
  intro: '',
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
    answer: 'Consuelo is open-source sales infrastructure for teams that need their CRM, dialer, coaching, and workflow surfaces to behave like one product.',
  },
  {
    question: 'Who is it for?',
    answer: 'It is built for operators and revenue teams that need browser work, embedded CRM surfaces, work channels, and assistant-led workflows to connect cleanly.',
  },
  {
    question: 'Is the CRM free?',
    answer: 'Yes. The CRM can stay free while teams decide whether they want to self-host everything or move onto Mercury for hosted calling and AI usage.',
  },
  {
    question: 'What is Mercury?',
    answer: 'Mercury is the hosted layer for teams that do not want to manage infrastructure, Twilio provisioning, or provider keys on day one.',
  },
  {
    question: 'Do I need to buy the whole system at once?',
    answer: 'No. Consuelo is built as one connected system, but teams can start with the part that solves the problem in front of them right now. You can buy CRM, calling, AI coaching, or hosted infrastructure one step at a time, while everything still compounds because the system is designed to work together.',
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
    answer: 'The CLI gives you a single install path for terminal and assistant-driven workflows, so the same platform can power browser work, embeds, bots, and agent tooling.',
  },
  {
    question: 'What about privacy and control?',
    answer: 'The core platform stays open-source and deployment stays flexible. Use Mercury when convenience matters more, or self-host when ownership matters more.',
  },
];

export const launchMercury: LaunchMercuryContent = {
  eyebrow: 'Mercury',
  title: 'Hosted calling and AI, ready to go.',
  intro: 'Mercury gives you Twilio calling, AI models from OpenAI and Groq, and hosting on Railway — tested and configured for sales teams. Skip provider setup and API key management, use validated infrastructure that works.',
  primaryLabel: 'Learn about Mercury',
  primaryHref: siteLinks.mercury,
  secondaryLabel: '',
  secondaryHref: '',
};

export const launchMercuryHighlights: LaunchMercuryHighlight[] = [];

export const mercuryProblems: MercuryProblem[] = [
  {
    title: 'Too many moving parts',
    text: 'Most teams do not want to provision calling, wire up providers, and maintain infrastructure before they can even place a call.',
  },
  {
    title: 'Billing friction everywhere',
    text: 'Usage gets messy fast when calling, AI, and app access all live in different dashboards.',
  },
  {
    title: 'Speed matters more than infra',
    text: 'Some teams want to get live quickly and only think about self-hosting later if they really need it.',
  },
];

export const mercurySteps: MercuryStep[] = [
  {
    step: '01',
    title: 'Start with the hosted workspace',
    text: 'Sign in, connect your workspace, and skip the part where you stand up the whole stack yourself first.',
  },
  {
    step: '02',
    title: 'Use hosted calling and AI usage',
    text: 'Mercury is built for teams that want hosted Twilio calling and AI usage instead of rotating provider keys on day one.',
  },
  {
    step: '03',
    title: 'Scale or self-host later',
    text: 'Move from hosted convenience to self-managed infrastructure when it actually becomes worth it.',
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
