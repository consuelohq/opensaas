export type HomeFaqItem = {
  question: string;
  answer: string;
  details?: Array<
    | { type: 'paragraph'; text: string }
    | { type: 'list'; items: string[] }
    | { type: 'steps'; items: Array<{ label: string; text: string }> }
  >;
  linkLabel?: string;
  linkHref?: string;
};

const foundingAgencyHref =
  'mailto:support@consuelohq.com?subject=Consuelo%20Dialer%20Founding%20Agency';

export const dialerHero = {
  title: 'Stop Paying Sales Reps to Listen to Phones Ring.',
  subtitle:
    'Predictive dialing, inbound routing, callbacks, and call intelligence — embedded in the CRM your sales team already uses.',
  primaryLabel: 'Get Early Access',
  primaryHref: foundingAgencyHref,
  secondaryLabel: 'See How It Works',
  secondaryHref: '#features',
  proofLine:
    'Your CRM stays the system of record. Consuelo makes the phone work inside it.',
} as const;

export const dialerFeatureItems = [
  {
    number: 1,
    label: 'Embedded',
    title: 'Stay\nin Your CRM',
    body:
      'Open the dialer where your reps already work. Pipeline stages become callable queues, contact context stays attached to the record, and no CSV handoff is required when the connected CRM is the queue source.',
    visualTitle: 'CRM Embedded',
    visualMeta: 'Your CRM stays the system of record',
    visualRows: [
      'Pipeline / stage',
      'Contact context',
      'Call controls',
      'Outcome sync',
    ],
  },
  {
    number: 2,
    label: 'Predictive',
    title: 'Stop Listening\nto Ringing',
    body:
      'The current dialer can run one, two, or three lines per rep session. The server owns candidate selection and call lifecycle, launches parallel attempts with a 500ms balanced stagger, connects one live winner, and cleans up the rest.',
    visualTitle: 'Predictive Dialing',
    visualMeta: '3× max line fanout · 500ms stagger',
    visualRows: [
      'Line 01 · Dialing',
      'Line 02 · Ringing',
      'Line 03 · Ready',
      'Winner · Connect',
    ],
  },
  {
    number: 3,
    label: 'Routing',
    title: 'Inbound +\nCallbacks',
    body:
      'Outbound is only half the phone system. Inbound requests, rep availability, shared capacity, offers, bridges, and callback obligations belong in the same durable call workflow instead of a second disconnected product.',
    visualTitle: 'Inbound Routing',
    visualMeta: 'One shared capacity authority',
    visualRows: [
      'Inbound request',
      'Rep capacity',
      'Offer / bridge',
      'Callback fallback',
    ],
  },
  {
    number: 4,
    label: 'Intelligence',
    title: 'Know What\nHappened',
    body:
      'Recordings and transcripts are plan-controlled capabilities. Call intelligence can turn the conversation into useful context for the next action without pushing provider credentials or raw media into the browser.',
    visualTitle: 'Call Intelligence',
    visualMeta: 'Provider-neutral call signals',
    visualRows: ['Call media', 'Transcript', 'Outcome', 'Next action'],
  },
  {
    number: 5,
    label: 'Follow-up',
    title: 'Work the\nNext Step',
    body:
      'The call is part of the workflow, not the end of it. Keep dispositions, CRM updates, callbacks, and next steps connected to the same sales record so reps do not have to reconstruct the work after every conversation.',
    visualTitle: 'Follow-Up',
    visualMeta: 'Call → outcome → action',
    visualRows: ['Call ends', 'Disposition', 'CRM update', 'Next step'],
  },
  {
    number: 6,
    label: 'Agencies',
    title: 'One Agency.\nMore Sales Floors.',
    body:
      'Start with one location, then expand the same phone system across client accounts. Commercial controls are built around seats, phone numbers, calling usage, and workspace isolation. HighLevel is the first connector; the Dialer core is not locked to one CRM.',
    visualTitle: 'Agency Scale',
    visualMeta: 'Multi-location · connector-neutral',
    visualRows: ['Agency', 'Location 01', 'Location 02', 'Location 03'],
  },
] as const;

export const dialerFaqItems: HomeFaqItem[] = [
  {
    question: 'Does Consuelo replace my CRM?',
    answer:
      'No. Consuelo Dialer is designed to be embedded in the CRM your team already uses. The CRM remains the system of record while Consuelo owns calling, routing, and the phone workflow around it.',
  },
  {
    question: 'Which CRMs does Consuelo support?',
    answer:
      'HighLevel is the first production connector. The Dialer core is provider-neutral, and additional CRM connectors are planned so the product does not depend on one vendor.',
  },
  {
    question: 'Do reps need to import a CSV before they call?',
    answer:
      'Not when the connected CRM is the queue source. Consuelo can resolve the callable queue directly from CRM records and keep outcomes attached to those records.',
  },
  {
    question: 'How does predictive dialing work?',
    answer:
      'The current commercial flow supports one, two, or three parallel lines. The server owns candidate selection and call lifecycle, then commits one winning conversation while the remaining attempts are cleaned up.',
  },
  {
    question: 'Does Consuelo handle inbound calls and callbacks too?',
    answer:
      'Inbound routing, rep availability, shared capacity, and callback obligations are built around the same durable call system rather than a separate inbound product.',
  },
  {
    question: 'What about recordings and transcripts?',
    answer:
      'Recording and transcription are plan-controlled capabilities. The media pipeline is designed so call intelligence can be processed without exposing raw audio to the browser, with retention and storage controls handled separately.',
  },
  {
    question: 'How is pricing structured?',
    answer:
      'The commercial model supports per-seat plans, included phone-number capacity, paid additional numbers, and calling usage. Public launch prices are being finalized during the founding-agency pilot.',
    linkLabel: 'View the current plan structure',
    linkHref: '/pricing',
  },
];

export const dialerFinalCta = {
  eyebrow: 'Consuelo Dialer',
  title: 'Your Leads Are Already in Your CRM.',
  secondLine: 'Start Calling Them.',
  description:
    'Less ringing. Less tab switching. More time in live conversations.',
  label: 'Get Early Access',
  href: foundingAgencyHref,
} as const;
