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

export const dialerHero = {
  eyebrow: 'FOUNDING AGENCY PROGRAM · EARLY ACCESS',
  title: 'STOP PAYING SALES REPS TO LISTEN TO PHONES RING.',
  subtitle:
    'Predictive dialing, inbound routing, callbacks, and call intelligence — embedded in the CRM your sales team already uses.',
  primaryLabel: 'GET EARLY ACCESS',
  primaryHref: '#founding-agency',
  secondaryLabel: 'WATCH THE DEMO',
  secondaryHref: '#demo',
  proofLine:
    'Your CRM stays the system of record. Consuelo makes the phone work inside it.',
} as const;

export const dialerStats = [
  {
    value: '3×',
    label: 'LINES AT ONCE',
    caption: 'maximum current predictive fanout per rep session',
  },
  {
    value: '500ms',
    label: 'STAGGER',
    caption: 'balanced launch stagger between parallel call attempts',
  },
  {
    value: '0',
    label: 'CSV HANDOFFS',
    caption: 'CSV imports required when the connected CRM is the queue source',
  },
  {
    value: '100%',
    label: 'SERVER-OWNED',
    caption: 'candidate selection and call lifecycle decisions owned by the backend',
  },
] as const;

export const dialerFeatureItems = [
  {
    number: 1,
    label: 'EMBED',
    title: 'STAY\nIN YOUR CRM',
    body:
      'Open the dialer where your reps already work. Queue membership, contact context, and outcomes stay attached to the CRM instead of becoming another disconnected sales tool.',
    visualTitle: 'CRM-EMBEDDED',
    visualMeta: 'Connector-first architecture',
    visualRows: [
      'PIPELINE / STAGE',
      'CONTACT CONTEXT',
      'CALL CONTROLS',
      'OUTCOME SYNC',
    ],
  },
  {
    number: 2,
    label: 'DIAL',
    title: 'MORE\nCONVERSATIONS',
    body:
      'Choose one, two, or three lines. Consuelo works the queue in parallel, keeps one winner, and gets the rep to the live conversation instead of the ringing.',
    visualTitle: 'PREDICTIVE',
    visualMeta: '1 / 2 / 3 line fanout',
    visualRows: [
      'LINE 01 · DIALING',
      'LINE 02 · RINGING',
      'LINE 03 · READY',
      'WINNER · CONNECT',
    ],
  },
  {
    number: 3,
    label: 'ROUTE',
    title: 'INBOUND +\nCALLBACKS',
    body:
      'Outbound is only half the phone system. Route inbound callers to available reps, preserve capacity, and keep callback obligations in the same durable workflow.',
    visualTitle: 'ROUTING',
    visualMeta: 'One capacity authority',
    visualRows: [
      'INBOUND REQUEST',
      'REP CAPACITY',
      'OFFER / BRIDGE',
      'CALLBACK FALLBACK',
    ],
  },
  {
    number: 4,
    label: 'KNOW',
    title: 'CALL\nINTELLIGENCE',
    body:
      'Turn call audio into useful sales context. Transcripts, outcomes, and post-call analysis can feed the next action without forcing reps to reconstruct the conversation.',
    visualTitle: 'INTELLIGENCE',
    visualMeta: 'Provider-neutral signals',
    visualRows: ['LIVE AUDIO', 'TRANSCRIPT', 'OUTCOME', 'NEXT ACTION'],
  },
  {
    number: 5,
    label: 'WORK',
    title: 'THE\nFOLLOW-UP',
    body:
      'The call is part of the workflow, not the end of it. Keep dispositions, CRM updates, callbacks, and next steps connected to the same sales record.',
    visualTitle: 'WORKFLOW',
    visualMeta: 'Call → outcome → action',
    visualRows: ['CALL ENDS', 'DISPOSITION', 'CRM UPDATE', 'NEXT STEP'],
  },
  {
    number: 6,
    label: 'SCALE',
    title: 'AGENCY\nREADY',
    body:
      'Start with one location, then expand the same phone system across client accounts. Consuelo is being built for agencies that want calling to become part of the service they sell.',
    visualTitle: 'AGENCY',
    visualMeta: 'Multi-location path',
    visualRows: ['AGENCY', 'LOCATION 01', 'LOCATION 02', 'LOCATION 03'],
  },
] as const;

export const dialerAgency = {
  eyebrow: 'FOUNDING AGENCY',
  title: 'ONE AGENCY. MORE THAN ONE SALES FLOOR.',
  body:
    'We are opening the first Consuelo Dialer pilots with agencies that already run client revenue operations. Start with a controlled rollout, prove the workflow, then expand location by location.',
  points: [
    'Embedded in the client CRM instead of another tab reps have to learn.',
    'Commercial controls are built around seats, phone numbers, calling usage, and workspace isolation.',
    'HighLevel is the first connector; the Dialer architecture is not locked to one CRM.',
  ],
  primaryLabel: 'GET EARLY ACCESS',
  primaryHref:
    'mailto:support@consuelohq.com?subject=Consuelo%20Dialer%20Founding%20Agency',
} as const;

export const dialerFounder = {
  eyebrow: 'WHY WE BUILT IT',
  title: 'WE BUILT THE DIALER WE WANTED OUR OWN SALES TEAM TO HAVE.',
  body:
    'Consuelo Dialer grew out of working alongside a real insurance sales team. The recurring problem was not a shortage of software. It was reps losing time between the CRM, unanswered calls, callbacks, follow-up, and the administrative work surrounding every conversation.',
  note:
    'The first public page is intentionally showing product truth and technical proof while customer case-study data is still being collected.',
} as const;

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
      'That is part of the Dialer architecture now being completed. Inbound routing, rep availability, shared capacity, and callback obligations use the same durable call system rather than a separate inbound product.',
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
  eyebrow: 'CONSUELO DIALER',
  title: 'YOUR LEADS ARE ALREADY IN YOUR CRM.',
  secondLine: 'START CALLING THEM.',
  description:
    'Less ringing. Less tab switching. More time in live conversations.',
  label: 'GET EARLY ACCESS',
  href: '#founding-agency',
} as const;
