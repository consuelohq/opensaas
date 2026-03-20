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

export type LaunchTab = {
  id: string;
  label: string;
  kind: 'link' | 'command';
  value: string;
  href?: string;
  actionLabel: string;
  description: string;
  note?: string;
  mediaEyebrow: string;
  mediaTitle: string;
  mediaText: string;
  imageSrc: string;
  imageAlt: string;
};

export type LaunchOverviewSection = {
  title: string;
  text: string;
  items: string[];
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
};

export const ghlMarketplaceUrl = 'https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=https%3A%2F%2Ffluffy-space-spork-w4j6vvvvwpxh6rw-3000.app.github.dev%2Fapi%2Foauth%2Fcallback&client_id=690cbca9af44827eb89887b1-mhpq9v7i&scope=contacts.readonly+contacts.write+opportunities.readonly+opportunities.write+calendars.readonly+users.readonly+conversations.readonly+conversations.write+conversations%2Fmessage.readonly+conversations%2Fmessage.write+locations.readonly&version_id=690cbca9af44827eb89887b1';

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
  { id: 'overview', label: 'overview' },
  { id: 'deployment', label: 'deployment' },
  { id: 'faq', label: 'faq' },
  { id: 'mercury', label: 'mercury' },
  { id: 'waitlist', label: 'waitlist' },
];

export const launchTabs: LaunchTab[] = [
  {
    id: 'web',
    label: 'web',
    kind: 'link',
    value: siteLinks.app,
    href: siteLinks.app,
    actionLabel: 'open app',
    description: 'launch the hosted workspace and sign in from the browser.',
    mediaEyebrow: 'browser workspace',
    mediaTitle: 'start in the crm and move straight into calling.',
    mediaText: 'consuelo keeps the crm, dialer, queue, and coaching in one surface so reps do not bounce between tools.',
    imageSrc: '/previews/ai-crm.webp',
    imageAlt: 'Consuelo browser workspace preview',
  },
  {
    id: 'embed',
    label: 'embed',
    kind: 'link',
    value: 'https://www.consuelohq.com/ghl',
    href: '/ghl',
    actionLabel: 'install in ghl',
    description: 'open the clean install link for the gohighlevel embedded app.',
    note: 'clean redirect to the marketplace install flow.',
    mediaEyebrow: 'ghl embed',
    mediaTitle: 'run the dialer inside gohighlevel without leaving the sidebar.',
    mediaText: 'the embedded flow keeps click-to-call, call logging, and context mapped to the current location.',
    imageSrc: '/previews/power-dialer.webp',
    imageAlt: 'Consuelo embedded dialer preview',
  },
  {
    id: 'slack',
    label: 'slack',
    kind: 'link',
    value: siteLinks.slackDocs,
    href: siteLinks.slackDocs,
    actionLabel: 'read docs',
    description: 'route alerts, handoffs, and workflow updates into the channels your team already lives in.',
    note: 'chat sdk surfaces are rolling out across work channels.',
    mediaEyebrow: 'work channels',
    mediaTitle: 'bring consuelo into the places your team already collaborates.',
    mediaText: 'queue updates, handoffs, and operating signals can reach slack-style workflows without building a separate ops layer.',
    imageSrc: '/previews/analytics.webp',
    imageAlt: 'Consuelo work channel analytics preview',
  },
  {
    id: 'discord',
    label: 'discord',
    kind: 'link',
    value: siteLinks.discordDocs,
    href: siteLinks.discordDocs,
    actionLabel: 'read docs',
    description: 'manage queues, call controls, and collaboration from the discord bot.',
    mediaEyebrow: 'discord bot',
    mediaTitle: 'queue management and call controls without leaving chat.',
    mediaText: 'search contacts, start queues, transfer calls, and coordinate with your team from a command surface reps already know.',
    imageSrc: '/previews/coaching.webp',
    imageAlt: 'Consuelo discord bot style coaching preview',
  },
  {
    id: 'claude-code',
    label: 'claude code',
    kind: 'command',
    value: 'npm install -g @consuelo/cli',
    actionLabel: 'copy command',
    description: 'install the cli once, then hand consuelo to coding agents and terminal workflows.',
    note: 'same install path, different surface.',
    mediaEyebrow: 'agent workflows',
    mediaTitle: 'connect consuelo to agent-first workflows and build around the api.',
    mediaText: 'the cli gives coding agents and internal tools a clean entry point into your workspace, contacts, and call operations.',
    imageSrc: '/previews/ai-crm.webp',
    imageAlt: 'Consuelo cli and agent workflow preview',
  },
  {
    id: 'chatgpt',
    label: 'chatgpt',
    kind: 'command',
    value: 'npm install -g @consuelo/cli',
    actionLabel: 'copy command',
    description: 'use the same cli install path to plug consuelo into assistant-driven internal workflows.',
    note: 'same install path, different assistant surface.',
    mediaEyebrow: 'assistant hooks',
    mediaTitle: 'move from chat to workflow without rebuilding your stack for every assistant.',
    mediaText: 'consuelo is designed to show up in the browser, in the embed, and in assistant-led flows with the same core platform underneath.',
    imageSrc: '/previews/coaching.webp',
    imageAlt: 'Consuelo assistant workflow preview',
  },
  {
    id: 'cli',
    label: 'cli',
    kind: 'command',
    value: 'npm install -g @consuelo/cli',
    actionLabel: 'copy command',
    description: 'install the cli globally and work against consuelo from the terminal.',
    mediaEyebrow: 'terminal access',
    mediaTitle: 'work from the terminal when the browser is not the right surface.',
    mediaText: 'install once, authenticate, and run consuelo from command-line flows, internal automation, and agent sessions.',
    imageSrc: '/previews/power-dialer.webp',
    imageAlt: 'Consuelo cli preview',
  },
];

export const launchOverviewIntro = 'Consuelo is open-source sales infrastructure that brings the crm, dialer, coaching layer, and work-channel entry points into one operating system. It is designed for teams that need to move from browser work to calling to assistant-driven workflows without stitching together five separate products.';

export const launchOverviewSections: LaunchOverviewSection[] = [
  {
    title: 'Integrated dialer',
    text: 'The dialer is built into the workflow instead of bolted on after the fact.',
    items: ['click-to-call from contacts', 'cold and warm transfers', 'hold and mute controls', 'dtmf tone entry', 'local presence for better answer rates'],
  },
  {
    title: 'CRM and queue system',
    text: 'The platform keeps contact data, queue state, and activity history in the same system.',
    items: ['contact import from csv', 'automatic phone normalization', 'do not call filtering', 'queue management for parallel dialing', 'workspace-level organization'],
  },
  {
    title: 'AI coaching',
    text: 'Consuelo can guide reps in the moment and summarize what happened after the call.',
    items: ['real-time call analysis', 'post-call transcription and summary', 'objection handling suggestions', 'coaching prompts tied to live calls'],
  },
  {
    title: 'Work channels and agents',
    text: 'The browser app is only one entry point. The same platform can show up in embeds, bots, and terminal flows.',
    items: ['gohighlevel embed', 'discord bot workflows', 'cli access for agents', 'channel-driven operating loops'],
  },
];

export const launchFaqItems: LaunchFaqItem[] = [
  {
    question: 'What is Consuelo?',
    answer: 'Consuelo is telecommunication infrastructure for teams that need their crm, dialer, coaching, and workflow surfaces to work as one product instead of a loose stack of integrations.',
  },
  {
    question: 'Who is it for?',
    answer: 'It is built for operators and revenue teams that need to work from the browser, embedded crm surfaces, work channels, and assistant-led workflows without rebuilding their process every time the surface changes.',
  },
  {
    question: 'Is the crm free?',
    answer: 'Yes. The crm layer can stay free while teams decide whether they want to self-host or use Mercury for hosted telephony and AI usage.',
  },
  {
    question: 'What is Mercury?',
    answer: 'Mercury is the hosted plan for teams that do not want to manage infrastructure, Twilio provisioning, or provider keys themselves. It is the convenience layer on top of the open platform.',
  },
  {
    question: 'Can I self-host?',
    answer: 'Yes. Self-hosting stays first-class. You can bring your own Twilio and AI keys, run the open platform yourself, and move between hosted and self-managed setups as your needs change.',
  },
  {
    question: 'Does it work with GoHighLevel?',
    answer: 'Yes. Consuelo supports an embedded GoHighLevel experience, and the clean install path on this site routes through /ghl so teams do not have to deal with the raw marketplace url.',
  },
  {
    question: 'How do cli and assistant workflows fit in?',
    answer: 'The cli gives you a single install path for terminal and assistant-driven workflows. That means the same platform can power browser work, embeds, bots, and agent tooling.',
  },
  {
    question: 'What about privacy and control?',
    answer: 'The core platform is open-source, and the deployment model is flexible. Use Mercury when convenience matters more, or self-host when you need to keep providers and infrastructure fully in your own hands.',
  },
];

export const mercuryProblems: MercuryProblem[] = [
  {
    title: 'Too many moving parts',
    text: 'Most teams do not want to provision telephony, wire up providers, tune assistant flows, and maintain a crm stack before they can even place a call.',
  },
  {
    title: 'Billing friction everywhere',
    text: 'Hosted usage gets messy fast when telephony, AI, and application access all live in different dashboards with different rules and surprise costs.',
  },
  {
    title: 'Speed matters more than infra',
    text: 'Some teams want to get live quickly, learn from usage, and only move to self-hosting later if they actually need it.',
  },
];

export const mercurySteps: MercuryStep[] = [
  {
    step: '01',
    title: 'Start with the hosted workspace',
    text: 'Sign in, connect your workspace, and skip the part where you stand up the whole stack yourself before testing the product.',
  },
  {
    step: '02',
    title: 'Use hosted telephony and AI usage',
    text: 'Mercury is designed for teams that want hosted Twilio and AI usage instead of bringing and rotating provider keys on day one.',
  },
  {
    step: '03',
    title: 'Scale or self-host later',
    text: 'Move from hosted convenience to self-managed infrastructure when it becomes worth it. The platform stays open either way.',
  },
];

export const mercuryFaqItems: LaunchFaqItem[] = [
  {
    question: 'What is Mercury?',
    answer: "Mercury is Consuelo's hosted plan. It is meant for teams that want the product without taking on infrastructure work up front.",
  },
  {
    question: 'How is Mercury priced?',
    answer: 'Mercury starts around the hosted platform layer and then adds usage where telephony and AI are involved. The point is a clean hosted path, not hiding the fact that usage exists.',
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
    question: 'Is the crm still free if I do not want Mercury yet?',
    answer: 'Yes. The crm can stand on its own while teams decide whether they want hosted usage, self-hosting, or a staged rollout between the two.',
  },
];

export const footerLinks: LaunchLink[] = [
  { label: 'github', href: siteLinks.github },
  { label: 'docs', href: siteLinks.docs },
  { label: 'changelog', href: siteLinks.changelog },
  { label: 'ghl', href: '/ghl' },
];

export { launchDocsMenuTabs };
