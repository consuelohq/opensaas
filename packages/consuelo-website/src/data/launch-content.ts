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
  text: 'browser workspace, ghl embed, and assistant-ready workflows in one stack.',
  linkLabel: 'see the docs',
  linkHref: siteLinks.docs,
};

export const launchHero: LaunchHeroContent = {
  title: 'telecommunication infrastructure that integrates everywhere.',
  description: 'software that shows up in the browser, inside your crm, in work channels, and in agent workflows without splitting the system apart.',
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
  title: 'one sales system that can show up in the browser, inside your crm, in chat, and in terminal workflows.',
  intro: 'consuelo brings the crm, dialer, coaching, queue state, and assistant hooks into one open stack, so teams stop rebuilding the same workflow for every surface.',
  ctaLabel: 'read docs',
  ctaHref: siteLinks.docs,
};

export const launchOverviewFeatures: LaunchOverviewFeature[] = [
  {
    title: 'browser crm',
    text: 'work contacts, queue state, and call controls in one workspace.',
  },
  {
    title: 'ghl embed',
    text: 'run the same dialer inside gohighlevel sidebars when the crm lives there.',
  },
  {
    title: 'work channels',
    text: 'push alerts, handoffs, and operating signals into the channels your team already watches.',
  },
  {
    title: 'agent-ready cli',
    text: 'give internal tools and assistants one clean install path into the platform.',
  },
  {
    title: 'conference calling',
    text: 'use warm transfer, hold, mute, dtmf, and local presence without bolting extras on later.',
  },
  {
    title: 'open deployment',
    text: 'self-host when control matters most or use mercury when speed matters more.',
  },
];

export const launchStats: LaunchStatsContent = {
  eyebrow: 'the open sales infrastructure layer',
  title: 'designed for throughput, traceability, and sales teams that need the same system across every surface.',
  intro: 'placeholder platform metrics for now. we can swap these for real numbers later without changing the structure.',
};

export const launchMetrics: LaunchMetric[] = [
  {
    value: '18.4k',
    label: 'weekly dials routed',
    caption: 'rolling seven day outbound volume',
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
    caption: 'rolling 30 day conversation minutes',
    chart: 'bars',
    bars: [18, 26, 21, 33, 28, 41, 37, 49, 43, 56, 47, 61],
  },
];

export const launchPrivacy: LaunchPrivacyContent = {
  eyebrow: 'built for privacy first',
  title: 'keep provider access, call data, and workflow context under your control.',
  description: 'self-host when you need full ownership of telephony, ai, and workspace infrastructure. use mercury when you want hosted convenience without giving up the open path.',
  linkLabel: 'learn about privacy',
  linkHref: siteLinks.docs,
};

export const launchFaq: LaunchFaqContent = {
  eyebrow: 'faq',
  title: 'answers people usually need before they trust the stack.',
  intro: 'the landing page should answer the questions that decide whether someone keeps going into docs or bounces.',
};

export const launchFaqItems: LaunchFaqItem[] = [
  {
    question: 'what is consuelo?',
    answer: 'consuelo is open-source sales infrastructure for teams that need their crm, dialer, coaching, and workflow surfaces to behave like one product instead of a loose pile of integrations.',
  },
  {
    question: 'who is it for?',
    answer: 'it is built for operators and revenue teams that need to move between browser work, embedded crm surfaces, work channels, and assistant-led workflows without rebuilding the process each time.',
  },
  {
    question: 'is the crm free?',
    answer: 'yes. the crm can stay free while teams decide whether they want to self-host everything or move onto mercury for hosted telephony and ai usage.',
  },
  {
    question: 'what is mercury?',
    answer: 'mercury is the hosted layer for teams that do not want to manage infrastructure, twilio provisioning, or provider keys themselves on day one.',
  },
  {
    question: 'can i self-host?',
    answer: 'yes. self-hosting stays first-class. you can run the open platform yourself, bring your own providers, and keep full control over the stack.',
  },
  {
    question: 'does it work with gohighlevel?',
    answer: 'yes. consuelo supports an embedded gohighlevel experience, and the clean install path on this site routes through /ghl so teams do not have to stare at the raw marketplace url.',
  },
  {
    question: 'how do cli and assistant workflows fit in?',
    answer: 'the cli gives you a single install path for terminal and assistant-driven workflows, so the same platform can power browser work, embeds, bots, and agent tooling.',
  },
  {
    question: 'what about privacy and control?',
    answer: 'the core platform stays open-source and deployment stays flexible. use mercury when convenience matters more, or self-host when ownership and provider control matter more.',
  },
];

export const launchMercury: LaunchMercuryContent = {
  eyebrow: 'mercury',
  title: 'hosted telephony and ai usage without making infrastructure your first project.',
  intro: 'mercury is for teams that want consuelo live quickly. keep the crm free, self-host when you need deeper control, or use the hosted layer when speed and convenience win.',
  primaryLabel: 'learn about mercury',
  primaryHref: siteLinks.mercury,
  secondaryLabel: 'launch workspace',
  secondaryHref: siteLinks.app,
};

export const launchMercuryHighlights: LaunchMercuryHighlight[] = [
  {
    title: 'hosted telephony',
    text: 'skip provider setup and get straight to usage when your team needs momentum more than infra work.',
  },
  {
    title: 'ai usage included',
    text: 'keep coaching and automation live without managing every model key before you know what the team actually needs.',
  },
  {
    title: 'open exit path',
    text: 'move to self-hosting later without rewriting the product around a closed hosted plan.',
  },
];

export const mercuryProblems: MercuryProblem[] = [
  {
    title: 'too many moving parts',
    text: 'most teams do not want to provision telephony, wire up providers, tune assistant flows, and maintain a crm stack before they can even place a call.',
  },
  {
    title: 'billing friction everywhere',
    text: 'hosted usage gets messy fast when telephony, ai, and application access all live in different dashboards with different rules and surprise costs.',
  },
  {
    title: 'speed matters more than infra',
    text: 'some teams want to get live quickly, learn from usage, and only move to self-hosting later if they actually need it.',
  },
];

export const mercurySteps: MercuryStep[] = [
  {
    step: '01',
    title: 'start with the hosted workspace',
    text: 'sign in, connect your workspace, and skip the part where you stand up the whole stack yourself before testing the product.',
  },
  {
    step: '02',
    title: 'use hosted telephony and ai usage',
    text: 'mercury is designed for teams that want hosted twilio and ai usage instead of bringing and rotating provider keys on day one.',
  },
  {
    step: '03',
    title: 'scale or self-host later',
    text: 'move from hosted convenience to self-managed infrastructure when it becomes worth it. the platform stays open either way.',
  },
];

export const mercuryFaqItems: LaunchFaqItem[] = [
  {
    question: 'what is mercury?',
    answer: "mercury is consuelo's hosted plan. it is meant for teams that want the product without taking on infrastructure work up front.",
  },
  {
    question: 'how is mercury priced?',
    answer: 'mercury starts around the hosted platform layer and then adds usage where telephony and ai are involved. the point is a clean hosted path, not hiding the fact that usage exists.',
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
