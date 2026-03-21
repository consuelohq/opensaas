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
};

export const ghlMarketplaceUrl =
  'https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=https%3A%2F%2Ffluffy-space-spork-w4j6vvvvwpxh6rw-3000.app.github.dev%2Fapi%2Foauth%2Fcallback&client_id=690cbca9af44827eb89887b1-mhpq9v7i&scope=contacts.readonly+contacts.write+opportunities.readonly+opportunities.write+calendars.readonly+users.readonly+conversations.readonly+conversations.write+conversations%2Fmessage.readonly+conversations%2Fmessage.write+locations.readonly&version_id=690cbca9af44827eb89887b1';

export const launchHeaderLinks: LaunchNavLink[] = [
  { label: 'docs', href: siteLinks.docs },
  { label: 'mercury', href: siteLinks.mercury },
  { label: 'enterprise', href: siteLinks.enterprise },
];

export const launchMobileMenuLinks: LaunchNavLink[] = [
  ...launchHeaderLinks,
  { label: 'login', href: siteLinks.login },
  { label: 'free', href: siteLinks.free },
];

export const launchPageSections: LaunchPageSection[] = [
  { id: 'intro', label: 'intro' },
  { id: 'overview', label: 'what is consuelo' },
  { id: 'proof', label: 'proof' },
  { id: 'privacy', label: 'privacy' },
  { id: 'faq', label: 'faq' },
  { id: 'mercury', label: 'mercury' },
  { id: 'waitlist', label: 'waitlist' },
];

export const launchAnnouncement: LaunchAnnouncement = {
  badge: 'new',
  text: 'app available in beta for chrome, safari, and firefox.',
  linkLabel: 'sign up now',
  linkHref: siteLinks.app,
};

export const launchHero: LaunchHeroContent = {
  title: 'sales infrastructure that integrates everywhere.',
  description: 'software that shows up in the browser, inside your crm, in work channels, and in agent workflows.',
};

export const launchTabs: LaunchTab[] = [
  {
    id: 'web',
    label: 'web',
    kind: 'link',
    value: siteLinks.app,
    href: siteLinks.app,
    imageSrc: '/previews/ai-crm.webp',
    imageAlt: 'Consuelo browser workspace preview',
  },
  {
    id: 'embed',
    label: 'embed',
    kind: 'link',
    value: 'https://www.consuelohq.com/ghl',
    href: '/ghl',
    imageSrc: '/previews/power-dialer.webp',
    imageAlt: 'Consuelo embedded dialer preview',
  },
  {
    id: 'slack',
    label: 'slack',
    kind: 'link',
    value: siteLinks.slackDocs,
    href: siteLinks.slackDocs,
    imageSrc: '/previews/analytics.webp',
    imageAlt: 'Consuelo work channel preview',
  },
  {
    id: 'discord',
    label: 'discord',
    kind: 'link',
    value: siteLinks.discordDocs,
    href: siteLinks.discordDocs,
    imageSrc: '/previews/coaching.webp',
    imageAlt: 'Consuelo discord workflow preview',
  },
  {
    id: 'claude-code',
    label: 'claude code',
    kind: 'command',
    value: 'npm install -g @consuelo/cli',
    imageSrc: '/previews/ai-crm.webp',
    imageAlt: 'Consuelo agent workflow preview',
  },
  {
    id: 'chatgpt',
    label: 'chatgpt',
    kind: 'command',
    value: 'npm install -g @consuelo/cli',
    imageSrc: '/previews/coaching.webp',
    imageAlt: 'Consuelo assistant preview',
  },
  {
    id: 'cli',
    label: 'cli',
    kind: 'command',
    value: 'npm install -g @consuelo/cli',
    imageSrc: '/previews/power-dialer.webp',
    imageAlt: 'Consuelo cli preview',
  },
];

export const launchOverview: LaunchOverviewContent = {
  eyebrow: 'what is consuelo?',
  title: '',
  intro: 'open-source platform that helps you run your crm, dialer, coaching, and workflows from one system.',
  ctaLabel: 'read docs',
  ctaHref: siteLinks.docs,
};

export const launchOverviewFeatures: LaunchOverviewFeature[] = [
  {
    title: 'browser crm',
    text: 'work contacts, queue state, and call controls in one workspace.',
  },
  {
    title: 'conference dialing',
    text: 'use warm transfer, hold, mute, dtmf, and local presence in the same call flow.',
  },
  {
    title: 'multi-surface',
    text: 'run the same workflow in the browser, in ghl, and in work channels.',
  },
  {
    title: 'queue + history',
    text: 'keep contacts, queue state, and activity history in one system.',
  },
  {
    title: 'assistant hooks',
    text: 'give internal tools and agents one clean cli entry point into the platform.',
  },
  {
    title: 'open deployment',
    text: 'self-host when you want control or use mercury when you want the hosted path.',
  },
];

export const launchStats: LaunchStatsContent = {
  eyebrow: 'the open sales infrastructure layer',
  title: 'built for teams that need throughput, traceability, and one system across every surface.',
  intro: 'with over 18,000 weekly dials routed, 41 teams operating live, and 2.7 million call minutes tracked, consuelo is built for real sales volume.',
};

export const launchMetrics: LaunchMetric[] = [
  {
    value: '18.4k',
    label: 'weekly dials routed',
    caption: 'seven day outbound volume',
    chart: 'line',
    points: [12, 16, 19, 26, 34, 46, 54, 67, 72, 86],
  },
  {
    value: '41',
    label: 'teams operating live',
    caption: 'active workspaces on the stack',
    chart: 'dots',
    filledDots: 41,
  },
  {
    value: '2.7m',
    label: 'call minutes tracked',
    caption: 'rolling 30 day minutes',
    chart: 'bars',
    bars: [18, 26, 21, 33, 28, 41, 37, 49, 43, 56, 47, 61],
  },
];

export const launchPrivacy: LaunchPrivacyContent = {
  eyebrow: 'built for privacy first',
  title: 'consuelo does not store provider keys or call recordings on shared infrastructure,',
  description: 'so that it can operate in privacy-sensitive environments. learn more about',
  linkLabel: 'privacy.',
  linkHref: siteLinks.docs,
};

export const launchFaq: LaunchFaqContent = {
  eyebrow: 'faq',
  title: 'answers people usually need before they trust the stack.',
  intro: '',
};

export const launchFaqItems: LaunchFaqItem[] = [
  {
    question: 'what is consuelo?',
    answer: 'consuelo is open-source sales infrastructure for teams that need their crm, dialer, coaching, and workflow surfaces to behave like one product.',
  },
  {
    question: 'who is it for?',
    answer: 'it is built for operators and revenue teams that need browser work, embedded crm surfaces, work channels, and assistant-led workflows to connect cleanly.',
  },
  {
    question: 'is the crm free?',
    answer: 'yes. the crm can stay free while teams decide whether they want to self-host everything or move onto mercury for hosted calling and ai usage.',
  },
  {
    question: 'what is mercury?',
    answer: 'mercury is the hosted layer for teams that do not want to manage infrastructure, twilio provisioning, or provider keys on day one.',
  },
  {
    question: 'can i self-host?',
    answer: 'yes. self-hosting stays first-class. you can run the open platform yourself, bring your own providers, and keep full control over the stack.',
  },
  {
    question: 'does it work with gohighlevel?',
    answer: 'yes. consuelo supports an embedded gohighlevel experience, and native sync. <a href="https://marketplace.gohighlevel.com" class="launch-inline-link">view our marketplace listing here</a>.',
  },
  {
    question: 'how do cli and assistant workflows fit in?',
    answer: 'the cli gives you a single install path for terminal and assistant-driven workflows, so the same platform can power browser work, embeds, bots, and agent tooling.',
  },
  {
    question: 'what about privacy and control?',
    answer: 'the core platform stays open-source and deployment stays flexible. use mercury when convenience matters more, or self-host when ownership matters more.',
  },
];

export const launchMercury: LaunchMercuryContent = {
  eyebrow: 'mercury',
  title: 'hosted calling and ai, ready to go.',
  intro: 'mercury gives you twilio calling, ai models from openai and groq, and hosting on railway — tested and configured for sales teams. skip provider setup and api key management, use validated infrastructure that works.',
  primaryLabel: 'learn about mercury',
  primaryHref: siteLinks.mercury,
  secondaryLabel: '',
  secondaryHref: '',
};

export const launchMercuryHighlights: LaunchMercuryHighlight[] = [];

export const mercuryProblems: MercuryProblem[] = [
  {
    title: 'too many moving parts',
    text: 'most teams do not want to provision calling, wire up providers, and maintain infrastructure before they can even place a call.',
  },
  {
    title: 'billing friction everywhere',
    text: 'usage gets messy fast when calling, ai, and app access all live in different dashboards.',
  },
  {
    title: 'speed matters more than infra',
    text: 'some teams want to get live quickly and only think about self-hosting later if they really need it.',
  },
];

export const mercurySteps: MercuryStep[] = [
  {
    step: '01',
    title: 'start with the hosted workspace',
    text: 'sign in, connect your workspace, and skip the part where you stand up the whole stack yourself first.',
  },
  {
    step: '02',
    title: 'use hosted calling and ai usage',
    text: 'mercury is built for teams that want hosted twilio calling and ai usage instead of rotating provider keys on day one.',
  },
  {
    step: '03',
    title: 'scale or self-host later',
    text: 'move from hosted convenience to self-managed infrastructure when it actually becomes worth it.',
  },
];

export const mercuryFaqItems: LaunchFaqItem[] = [
  {
    question: 'what is mercury?',
    answer: "mercury is consuelo's hosted plan. it is meant for teams that want the product without taking on infrastructure work up front.",
  },
  {
    question: 'how is mercury priced?',
    answer: 'mercury starts at $20 pay as you go. usage is tracked per request — call minutes, coaching requests, and transcription. auto-top-up adds $20 when your balance hits $5.',
  },
  {
    question: 'when should i pick mercury instead of self-hosted?',
    answer: 'pick mercury when speed, convenience, and fewer moving pieces matter more than owning every provider integration yourself on day one.',
  },
  {
    question: 'do i still need my own twilio or ai keys?',
    answer: 'not for the hosted mercury path. self-hosted teams can still bring their own keys when they want full provider control.',
  },
  {
    question: 'can i move from mercury to self-hosted later?',
    answer: 'yes. the platform is built so hosted and self-managed deployment models can coexist instead of locking you into one forever choice.',
  },
  {
    question: 'is the crm still free if i do not want mercury yet?',
    answer: 'yes. the crm can stand on its own while teams decide whether they want hosted usage, self-hosting, or a staged rollout between the two.',
  },
];

export const launchFooterSignup: LaunchFooterSignup = {
  eyebrow: 'be the first to know when we release new products',
  title: 'join the waitlist for early access.',
  intro: 'we will send the important launches, not a pile of filler.',
  buttonLabel: 'subscribe',
};

export const footerLinks: LaunchLink[] = [
  { label: 'github', href: siteLinks.github },
  { label: 'docs', href: siteLinks.docs },
  { label: 'changelog', href: siteLinks.changelog },
  { label: 'ghl', href: '/ghl' },
];

export { launchDocsMenuTabs };
