type DetailBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'steps'; items: { label: string; text: string }[] };
export type HomeFaqItem = {
  question: string;
  answer: string;
  details?: DetailBlock[];
  linkLabel?: string;
  linkHref?: string;
};
export const dialerHero = {
  title: ['Turn more leads', 'into live conversations.'],
  description:
    'Multi-line dialing and inbound call routing, built into GoHighLevel. Reach out, pick up, and keep the customer record close.',
  primaryLabel: 'GET STARTED',
  secondaryLabel: 'SEE HOW IT WORKS',
};
export const homeFeaturePreviewItems = [
  {
    number: 1,
    label: 'INBOUND',
    title: 'Be there when\nthey call.',
    body: 'Give incoming calls a path to the right rep. Route by availability and queue rules, answer in the browser or on a phone, and offer a callback or voicemail when the team is busy.',
    ctaLabel: 'Explore inbound calling',
    ctaHref: '/how-it-works#inbound',
    icon: 'inbound',
  },
  {
    number: 2,
    label: 'OUTBOUND',
    title: 'Less dialing.\nMore talking.',
    body: 'Work your GoHighLevel contact and opportunity queues with multi-line dialing. Connect a live answer to an available rep, with local presence and the customer record close at hand.',
    ctaLabel: 'Explore outbound calling',
    ctaHref: '/how-it-works#outbound',
    icon: 'outbound',
  },
  {
    number: 3,
    label: 'ANALYTICS',
    title: 'Know what\nhappened next.',
    body: 'Review call activity, outcomes and history without losing the customer context. See who needs a follow-up and use the record of each conversation to plan the next one.',
    ctaLabel: 'Explore call history',
    ctaHref: '/how-it-works#analytics',
    icon: 'analytics',
  },
  {
    number: 4,
    label: 'AI ASSISTANT',
    title: 'Your playbook.\nRight on cue.',
    body: 'Add Mercury coaching to bring scripts into the conversation, get a suggested response in AI mode, and review uploaded transcripts with your team. A little help while the rep does the selling.',
    ctaLabel: 'Meet Mercury coaching',
    ctaHref: '/pricing#addons',
    icon: 'mercury',
  },
] as const;
export const homeFaqItems: HomeFaqItem[] = [
  {
    question: 'What does Consuelo Dialer do?',
    answer: 'Consuelo brings sales calling into GoHighLevel.',
    details: [
      {
        type: 'paragraph',
        text: 'One calling workspace for the people reaching out and the customers calling in.',
      },
      {
        type: 'list',
        items: [
          'Outbound: work contact and opportunity queues with multi-line dialing.',
          'Inbound: route callers to eligible reps and give missed calls a next step.',
          'Analytics: review call activity and outcomes alongside customer context.',
          'Mercury: add scripts, AI suggestions and transcript review to the workflow.',
        ],
      },
    ],
  },
  {
    question: 'What is the difference between inbound, outbound and callbacks?',
    answer:
      'Inbound starts with a customer calling you. Outbound starts with your team calling a lead. A callback is an outbound call the customer requested.',
    details: [
      {
        type: 'steps',
        items: [
          {
            label: 'Inbound — they call you.',
            text: 'The customer calls your routing number. Consuelo offers the live call to an eligible rep; the customer does not need a second call.',
          },
          {
            label: 'Outbound — you reach out.',
            text: 'A rep works a lead queue. The dialer can try several leads while that rep is available, then connect a live answer.',
          },
          {
            label: 'Callback — agree to try later.',
            text: 'A customer asks to be called back. The team returns the call through the routing number; both sides still need to answer.',
          },
        ],
      },
    ],
  },
  {
    question: 'How does multi-line dialing work?',
    answer:
      'The dialer can try several leads while a rep is available and connect a live answer to that rep.',
    details: [
      {
        type: 'steps',
        items: [
          {
            label: 'Choose your queue.',
            text: 'Work the contacts or opportunities your team wants to reach in GoHighLevel.',
          },
          {
            label: 'Dial within your capacity.',
            text: 'The active calling limit depends on your plan, phone numbers, team capacity and calling policies. A fixed caller ID limits that attempt to one line.',
          },
          {
            label: 'Talk, then follow up.',
            text: 'Connect the selected live answer to the rep and keep the call history with the customer context.',
          },
        ],
      },
    ],
  },
  {
    question: 'What does local presence change?',
    answer:
      'Local presence selects an available caller ID for the area you are calling.',
    details: [
      {
        type: 'paragraph',
        text: 'Professional, Agency and Enterprise include local presence. It works with the phone numbers available to your workspace.',
      },
      {
        type: 'list',
        items: [
          'It helps select an appropriate available caller ID.',
          'It does not guarantee pickup or a fixed increase in answer rate.',
          'Timing, number reputation, your audience and the reason for the call still matter.',
        ],
      },
    ],
  },
  {
    question: 'How do we get started in GoHighLevel?',
    answer:
      'Choose your plan, check out with Stripe, then connect your GoHighLevel location.',
    details: [
      {
        type: 'steps',
        items: [
          {
            label: 'Pick a plan.',
            text: 'Choose the plan and number of rep seats on the pricing page. Starter provides 100 connected minutes to try.',
          },
          {
            label: 'Pay securely with Stripe.',
            text: 'Paid plans use hosted Stripe Checkout. You connect your team afterward.',
          },
          {
            label: 'Connect your location.',
            text: 'An administrator connects GoHighLevel and sets up users and phone numbers.',
          },
          {
            label: 'Open the dialer.',
            text: 'Use Consuelo Dialer from your GoHighLevel menu, with contacts and opportunity queues in reach.',
          },
        ],
      },
    ],
    linkLabel: 'Compare plans',
    linkHref: '/pricing',
  },
  {
    question: 'Can reps answer in the browser or on a phone?',
    answer: 'Yes. Reps can use browser calling or a forwarding phone.',
    details: [
      {
        type: 'list',
        items: [
          'Browser: use a working microphone and allow microphone access.',
          'Phone: receive the offer on the forwarding number configured for the rep.',
          'Availability and queue eligibility determine which rep receives an inbound offer.',
        ],
      },
    ],
    linkLabel: 'See the calling flow',
    linkHref: '/how-it-works#inbound',
  },
  {
    question: 'What happens when nobody can answer?',
    answer: 'Your queue policy decides how callers wait and what happens next.',
    details: [
      {
        type: 'list',
        items: [
          'Set business hours and waiting limits.',
          'Offer a callback when the caller would rather leave the queue.',
          'Use voicemail when they prefer to leave a message.',
        ],
      },
      {
        type: 'paragraph',
        text: 'These are configured queue behaviors. A callback is a new call, so a missed callback still needs follow-up.',
      },
    ],
  },
  {
    question: 'What comes with Mercury coaching?',
    answer:
      'Mercury is an optional $25 per rep per month add-on. Agency and Enterprise include recording and transcripts in the base plan.',
    details: [
      {
        type: 'list',
        items: [
          'Script mode: bring the relevant part of your playbook into the call.',
          'AI mode: get a suggested response as the conversation develops.',
          'Transcript review: upload a transcript for reps and leaders to work through together.',
        ],
      },
      {
        type: 'paragraph',
        text: 'Mercury applies to every seat in the selected plan. Recording and transcription follow your company policy and the permissions configured for the call.',
      },
    ],
    linkLabel: 'See the add-on',
    linkHref: '/pricing#addons',
  },
  {
    question: 'How are plans, seats and minutes billed?',
    answer:
      'Professional is $99, Agency is $149 and Enterprise is $199 per rep per month in USD.',
    details: [
      {
        type: 'list',
        items: [
          'Professional: 1,000 connected minutes per rep each month, with 3 calling lines and numbers.',
          'Agency: 5,000 connected minutes per rep each month, with 10 calling lines and numbers.',
          'Enterprise: 5,000 connected minutes per rep each month, with 30 calling lines and numbers.',
        ],
      },
      {
        type: 'paragraph',
        text: 'Annual billing charges 12 months upfront with no discount; included minutes still renew monthly. Extra number packs use a separate subscription and invoice. You can manage billing in Stripe.',
      },
    ],
    linkLabel: 'Compare all plans and features',
    linkHref: '/pricing',
  },
  {
    question: 'Can I build outside GoHighLevel?',
    answer:
      'Yes. The Dialer SDK and standalone service separate calling and routing logic from the CRM interface.',
    details: [
      {
        type: 'paragraph',
        text: 'GoHighLevel is the first embedded interface. Developers can use the SDK or API for a custom connection; another CRM needs its own integration.',
      },
      {
        type: 'list',
        items: [
          'Use the SDK for provider-neutral calling and routing semantics.',
          'Use the standalone service for the runtime and persistence boundary.',
          'Keep CRM-specific behavior in its integration adapter.',
        ],
      },
    ],
    linkLabel: 'Read the developer overview',
    linkHref: 'https://docs.consuelohq.com/reference/sdk/',
  },
];
export const homeWorkspaceClose = {
  eyebrow: 'CONSUELO DIALER',
  title: 'Spend the day\nin conversation.',
  description:
    'Outbound dialing. Inbound routing. One place for your team to work the call.',
  primaryLabel: 'GET STARTED',
  primaryHref: '/get-started',
  secondaryLabel: 'COMPARE PLANS',
  secondaryHref: '/pricing',
};
