export type BillingPeriod = 'monthly' | 'annual';
export type PlanCode = 'starter' | 'professional' | 'agency' | 'enterprise';
export const pricingHero = {
  title: 'More conversations. Room to grow.',
  subtitle:
    'Start with a few calls. Build a team that keeps every lead moving.',
};
export const pricingAccountLink = {
  prompt: 'Already set up?',
  label: 'OPEN YOUR DIALER',
  href: 'https://app.gohighlevel.com/',
};
export const pricingPlans = [
  {
    code: 'starter',
    name: 'Starter',
    price: '$0',
    monthlyCents: 0,
    includedMinutes: 100,
    numbers: 1,
    lines: 1,
    description: 'Get a feel for your next calling day.',
    href: '/get-started?plan=starter',
    action: 'Try Starter',
    bullets: [
      '100 connected minutes, once',
      'One calling line & number',
      'GoHighLevel integration',
      'Call history & analytics',
    ],
  },
  {
    code: 'professional',
    name: 'Professional',
    price: '$99',
    monthlyCents: 9900,
    includedMinutes: 1000,
    numbers: 3,
    lines: 3,
    description: 'For reps building a steady pipeline.',
    href: '/get-started?plan=professional',
    action: 'Choose Professional',
    bullets: [
      '3 calling lines & numbers',
      '1,000 minutes per seat / month',
      'Inbound & outbound calling',
      'Predictive dialing & local presence',
      'Spam protection & team analytics',
    ],
  },
  {
    code: 'agency',
    name: 'Agency',
    price: '$149',
    monthlyCents: 14900,
    includedMinutes: 5000,
    numbers: 10,
    lines: 10,
    description: 'For agencies working more opportunities.',
    href: '/get-started?plan=agency',
    action: 'Choose Agency',
    bullets: [
      '10 calling lines & numbers',
      '5,000 minutes per seat / month',
      'Predictive dialing & local presence',
      'Recordings, transcripts & spam protection',
    ],
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    price: '$199',
    monthlyCents: 19900,
    includedMinutes: 5000,
    numbers: 30,
    lines: 30,
    description: 'For teams with a wider reach.',
    href: '/get-started?plan=enterprise',
    action: 'Talk to us',
    bullets: [
      '30 calling lines & numbers',
      '5,000 minutes per seat / month',
      'Everything in Agency',
      'API access & rollout planning',
    ],
  },
] as const;
export const quotePlan = (code: string, billing: string, seats: number) => {
  const plan = pricingPlans.find((p) => p.code === code);
  if (
    !plan ||
    !['monthly', 'annual'].includes(billing) ||
    !Number.isInteger(seats) ||
    seats < 1 ||
    seats > 1000
  )
    throw new Error(
      'Choose a valid plan, billing period and whole seat count (1–1,000).',
    );
  const months = billing === 'annual' ? 12 : 1;
  return {
    totalCents: plan.monthlyCents * seats * months,
    monthlyCents: plan.monthlyCents * seats,
    months,
  };
};
export const minutePacks = [
  { priceCents: 1000, minutes: 100, label: 'A little extra' },
  { priceCents: 5000, minutes: 600, label: 'Keep the day moving' },
  { priceCents: 10000, minutes: 1400, label: 'More room to talk' },
] as const;
export const numberPacks = [
  { numbers: 1, priceCents: 300 },
  { numbers: 10, priceCents: 2800 },
  { numbers: 50, priceCents: 12500 },
] as const;
export type FeatureValue = boolean | string;
export type ComparisonRow = {
  id: string;
  name: string;
  detail: string;
  values: readonly FeatureValue[];
  key?: boolean;
};
export type ComparisonGroup = {
  id: string;
  name: string;
  icon: string;
  description: string;
  rows: ComparisonRow[];
};
export const comparisonGroups: ComparisonGroup[] = [
  {
    id: 'outbound',
    name: 'Consuelo Outbound',
    icon: 'outbound',
    description: 'Work your list. Spend more of the day in conversation.',
    rows: [
      {
        id: 'lines',
        name: 'Calling lines & numbers per seat',
        detail:
          'Included active phone numbers also set your parallel calling capacity. Choosing a fixed caller ID uses one line. More lines do not guarantee more simultaneous human conversations.',
        values: ['1', '3', '10', '30'],
        key: true,
      },
      {
        id: 'minutes',
        name: 'Connected calling minutes',
        detail:
          'Starter includes 100 minutes total. Paid allowances renew monthly per seat, including when billed annually. Each connected call is rounded up to a whole minute.',
        values: [
          '100 total',
          '1,000 / month',
          '5,000 / month',
          '5,000 / month',
        ],
        key: true,
      },
      {
        id: 'browser',
        name: 'Call from your browser',
        detail:
          'Make calls from the dialer without switching away from your customer record.',
        values: [true, true, true, true],
      },
      {
        id: 'queue',
        name: 'Calling queues',
        detail:
          'Move through contacts in order and keep outcomes with each call.',
        values: [true, true, true, true],
      },
      {
        id: 'predictive',
        name: 'Predictive dialing',
        detail: 'Adjust the calling pace as reps and lines become available.',
        values: [false, true, true, true],
        key: true,
      },
      {
        id: 'local-presence',
        name: 'Local presence',
        detail:
          'Choose an appropriate local caller ID from the numbers assigned to your team.',
        values: [false, true, true, true],
        key: true,
      },
      {
        id: 'spam',
        name: 'Spam protection',
        detail:
          'Monitor number health and manage caller IDs. Carrier labels and answer rates cannot be guaranteed.',
        values: [false, true, true, true],
      },
    ],
  },
  {
    id: 'inbound',
    name: 'Consuelo Inbound',
    icon: 'inbound',
    description: 'Give incoming interest a clear path to the right rep.',
    rows: [
      {
        id: 'routing',
        name: 'Rep routing',
        detail:
          'Route callers to eligible reps using availability and queue rules.',
        values: ['Basic', true, true, true],
        key: true,
      },
      {
        id: 'endpoints',
        name: 'Browser & phone answering',
        detail:
          'Reps can answer in their browser or on a forwarding phone. The first valid acceptance owns the call.',
        values: [true, true, true, true],
      },
      {
        id: 'fallback',
        name: 'Callback & voicemail',
        detail:
          'Offer callers a callback or a place to leave a message when the team cannot answer.',
        values: [false, true, true, true],
        key: true,
      },
      {
        id: 'hours',
        name: 'Business hours & overflow',
        detail:
          'Choose how incoming calls are handled after hours and when the primary team is busy.',
        values: [false, true, true, true],
      },
      {
        id: 'affinity',
        name: 'Assigned-rep preference',
        detail:
          'Try the existing salesperson when eligible, then follow the wider team routing policy.',
        values: [false, true, true, true],
      },
    ],
  },
  {
    id: 'integrations',
    name: 'Integrations',
    icon: 'connect',
    description: 'Keep the tools your team already knows.',
    rows: [
      {
        id: 'ghl',
        name: 'GoHighLevel',
        detail:
          'Use the embedded dialer with customer context in your GoHighLevel location.',
        values: [true, true, true, true],
        key: true,
      },
      {
        id: 'crm-history',
        name: 'Customer context & call history',
        detail: 'Keep contact details and call outcomes close while reps work.',
        values: [true, true, true, true],
      },
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics & recordings',
    icon: 'analytics',
    description: 'See the work behind the pipeline.',
    rows: [
      {
        id: 'analytics',
        name: 'Call volume & talk time',
        detail: 'See activity, connected call time and outcomes by rep.',
        values: [true, true, true, true],
        key: true,
      },
      {
        id: 'team-outcomes',
        name: 'Team performance & win rate',
        detail:
          'Compare rep and team outcomes. Win rate depends on consistently recorded dispositions and CRM deal data.',
        values: [false, true, true, true],
      },
      {
        id: 'recordings',
        name: 'Call recordings',
        detail:
          'Review calls your workspace records under its consent and retention policy.',
        values: [false, false, true, true],
      },
      {
        id: 'transcripts',
        name: 'Searchable transcripts',
        detail:
          'Read and revisit transcribed conversations alongside the call record.',
        values: [false, false, true, true],
        key: true,
      },
    ],
  },
  {
    id: 'coaching',
    name: 'Mercury coaching',
    icon: 'mercury',
    description: 'The right words, while the conversation is happening.',
    rows: [
      {
        id: 'script',
        name: 'Script mode',
        detail:
          'Upload your playbook and surface the relevant section as the conversation develops.',
        values: ['Add-on', 'Add-on', 'Add-on', 'Add-on'],
        key: true,
      },
      {
        id: 'ai-coach',
        name: 'AI mode',
        detail:
          'Get suggested responses based on the live conversation and your team context.',
        values: ['Add-on', 'Add-on', 'Add-on', 'Add-on'],
      },
      {
        id: 'transcript-review',
        name: 'Transcript review',
        detail:
          'Review uploaded conversations with reps and leaders to find better responses and coach the next call.',
        values: ['Add-on', 'Add-on', 'Add-on', 'Add-on'],
      },
    ],
  },
  {
    id: 'admin',
    name: 'Team management',
    icon: 'team',
    description: 'One place to organize your calling team.',
    rows: [
      {
        id: 'numbers',
        name: 'Phone number management',
        detail: 'Assign, organize and manage the numbers your reps use.',
        values: ['1 number', true, true, true],
        key: true,
      },
      {
        id: 'seats',
        name: 'Seat & usage management',
        detail: 'Manage rep access and review usage for your team.',
        values: ['1 seat', true, true, true],
      },
      {
        id: 'support',
        name: 'Unlimited support requests',
        detail:
          'Contact our team for help with setup and day-to-day use. This does not promise a 24/7 response-time SLA.',
        values: [true, true, true, true],
      },
      {
        id: 'rollout',
        name: 'Agency rollout planning',
        detail:
          'Plan seat setup, number assignment and calling workflows with our team.',
        values: [false, false, true, true],
      },
    ],
  },
  {
    id: 'security',
    name: 'Security & access',
    icon: 'shield',
    description: 'Keep calling access tied to your team.',
    rows: [
      {
        id: 'auth',
        name: 'Authenticated workspace access',
        detail:
          'Access the embedded dialer through your authorized workspace session.',
        values: [true, true, true, true],
        key: true,
      },
      {
        id: 'roles',
        name: 'Admin & rep permissions',
        detail: 'Limit administrative actions to authorized workspace roles.',
        values: [true, true, true, true],
      },
      {
        id: 'sso',
        name: 'Enterprise SSO & provisioning',
        detail:
          'Additional enterprise identity and automated provisioning are coming soon. Contact us to discuss your requirements.',
        values: [false, false, false, 'Coming soon'],
      },
    ],
  },
  {
    id: 'developer',
    name: 'Extensibility',
    icon: 'code',
    description: 'Build your calling workflow into the rest of your business.',
    rows: [
      {
        id: 'api',
        name: 'Dialer API',
        detail:
          'Connect calling and usage workflows to your own applications. Enterprise onboarding includes API setup.',
        values: [false, false, false, true],
        key: true,
      },
      {
        id: 'mcp',
        name: 'Analytics through MCP',
        detail:
          'Ask your agent about calling activity through a dedicated analytics connector. Coming soon.',
        values: ['Coming soon', 'Coming soon', 'Coming soon', 'Coming soon'],
      },
    ],
  },
];
export const pricingFaqItems = [
  {
    question: 'What is a seat?',
    answer:
      'A seat is one rep using Consuelo. The same seat can make outbound calls and receive routed inbound calls. Choose a plan for your team, then add the reps who need calling access. An administrator can help arrange a team with different requirements.',
  },
  {
    question: 'What does Starter include?',
    answer:
      'Starter gives you 100 connected calling minutes in total, one calling line and number, the GoHighLevel integration, and call history. The 100 minutes do not reset each month. Upgrade when you are ready to keep calling.',
  },
  {
    question: 'Are calling lines and phone numbers charged twice?',
    answer:
      'No. The plan lists them together: Professional includes 3, Agency includes 10, and Enterprise includes 30 per seat. An active number supplies a caller ID for a calling line. A fixed caller ID uses one line. Additional number packs expand your number pool; they do not automatically raise your plan’s parallel calling limit.',
  },
  {
    question: 'How are connected minutes counted?',
    answer:
      'Minutes measure connected customer-call time, rounded up to a whole minute for each call. Paid allowances are per seat and renew monthly. An annual payment does not put all twelve monthly allowances into one pool. The prices shown cover contiguous US local calling; other destinations and number types need a quote.',
  },
  {
    question: 'What if we use all our minutes?',
    answer:
      'Add a minute pack: $10 for 100 minutes, $50 for 600, or $100 for 1,400. Select a pack with your plan at checkout. Larger packs give you more minutes for the same spend. Contact us for higher-volume calling.',
  },
  {
    question: 'Can we use inbound and outbound together?',
    answer:
      'Yes. Your rep’s seat covers both. Outbound helps the team work a contact list; inbound routes customers who call your number. Filter the comparison above to see the features for each calling motion.',
  },
  {
    question: 'What is included in Mercury coaching?',
    answer:
      'Mercury is an optional coaching add-on at $25 per rep per month. Script mode brings up the relevant part of your uploaded playbook. AI mode suggests what to say based on the conversation. Reps and leaders can also upload transcripts for review. Add Mercury to your selected seats at checkout.',
  },
  {
    question: 'How do monthly and annual billing work?',
    answer:
      'Monthly billing covers one month at a time. Annual billing covers twelve months, paid up front. Both views show the per-seat monthly equivalent and the annual view shows the full yearly amount. No annual discount is applied to the prices shown.',
  },
  {
    question: 'Does Consuelo work with GoHighLevel?',
    answer:
      'Yes. GoHighLevel is included in every plan. Your administrator connects the location and sets up the reps and phone numbers. Calling activity stays close to your customer records.',
  },
  {
    question: 'Can our organization get help choosing?',
    answer:
      'Yes. Tell us your rep count, calling volume, inbound queues and integration needs. We will help choose the plan, numbers and coaching setup that fit. Taxes, specialized numbers and international calling are quoted separately.',
    linkHref: '/contact',
    linkLabel: 'Talk to our team',
  },
];
