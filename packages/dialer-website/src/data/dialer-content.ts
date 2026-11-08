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
  secondaryLabel: 'INTERACTIVE DEMO',
};
export const homeFeaturePreviewItems = [
  {
    number: 1,
    label: 'INBOUND',
    title: 'Be there when\nthey call.',
    body: 'Give incoming calls a path to the right rep. Route by availability and queue rules, answer in the browser or on a phone, and offer a callback or voicemail when the team is busy.',
    icon: 'inbound',
  },
  {
    number: 2,
    label: 'OUTBOUND',
    title: 'Less dialing.\nMore talking.',
    body: 'Work your GoHighLevel contact and opportunity queues with multi-line dialing. Connect a live answer to an available rep, with local presence and the customer record close at hand.',
    icon: 'outbound',
  },
  {
    number: 3,
    label: 'ANALYTICS',
    title: 'Know what\nhappened next.',
    body: 'Review call activity, outcomes and history without losing the customer context. See who needs a follow-up and use the record of each conversation to plan the next one.',
    icon: 'analytics',
  },
  {
    number: 4,
    label: 'AI ASSISTANT',
    title: 'Your playbook.\nRight on cue.',
    body: 'Add Mercury coaching to bring scripts into the conversation, get a suggested response in AI mode, and review uploaded transcripts with your team. A little help while the rep does the selling.',
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
    linkHref: '/#inbound',
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
  primaryHref: '/pricing',
  secondaryLabel: 'INTERACTIVE DEMO',
  secondaryHref: '/demo',
};

export type InteractiveDemoFlow = 'outbound' | 'inbound' | 'mercury';
export type InteractiveDemoStory = {
  step: string; title: string; description: string; tip: string; percent: number;
};
export const interactiveDemoStories: Record<InteractiveDemoFlow, Record<string, InteractiveDemoStory>> = {
    outbound: {
      ready: { step: '01 — READY TO CALL', title: 'Three lines. One conversation.', description: 'Pick a list and press Start calling. Watch how the dialer finds a human answer and clears the other lines.', tip: 'Open Calling options to change the number of lines and caller ID. The controls come directly from the actual dialer.', percent: 16 },
      dialing: { step: '02 — CALLING IN PARALLEL', title: 'You focus on the talk.', description: 'Three fictional prospects are being dialed. The simulated pickup will automatically focus the winning line.', tip: 'This is a timer-driven simulation—not a Twilio call. No customer is contacted.', percent: 40 },
      connected: { step: '03 — LIVE ANSWER', title: 'A person picked up.', description: 'Avery answered. The other lines ended, and your Mercury script appeared beside the conversation.', tip: 'Try Next in the script, then Hang up to save a disposition.', percent: 70 },
      'wrap-up': { step: '04 — THE NEXT STEP', title: 'Close the loop.', description: 'Select a call outcome and leave a note. Just as in the real workflow, the activity is ready to be written back to the CRM.', tip: 'Choose Follow up, write a note, and press Save and close.', percent: 85 },
      saved: { step: '05 — CRM UPDATED', title: 'The call is handled.', description: 'Your fictional call now appears in the call history, with its disposition and note. The GHL sample pipeline reflects it too.', tip: 'Open Call history to inspect the activity or restart the demo to try again.', percent: 100 },
    },
    inbound: {
      ready: { step: '01 — RECEIVE INBOUND', title: 'Never lose the handoff.', description: 'Your team can be ready to receive inbound calls in the browser or on a forwarding phone.', tip: 'Press Start receiving calls. A fictional inbound offer will appear shortly.', percent: 16 },
      available: { step: '02 — YOU ARE AVAILABLE', title: 'Stay in your CRM.', description: 'The operator is available. You can keep working while the routing system finds the right rep.', tip: 'The simulation will present Jordan Blake as an incoming caller.', percent: 32 },
      offering: { step: '03 — INCOMING CALL', title: 'The right rep gets the ring.', description: 'The lead has been routed to your browser. You can answer without switching to a separate call application.', tip: 'Press Answer call to connect the simulated caller.', percent: 56 },
      connected: { step: '04 — CONNECTED', title: 'Pick up and get to work.', description: 'You are on the call. The workspace shows live status and keeps your script at hand.', tip: 'Press End call to wrap up the conversation.', percent: 75 },
      'wrap-up': { step: '05 — WRAP-UP', title: 'Every call has an outcome.', description: 'Save the result before the next inbound call. Your activity stays attached to the fictional customer record.', tip: 'Choose a disposition and Save and finish.', percent: 88 },
      saved: { step: '06 — FINISHED', title: 'Recorded in the CRM.', description: 'The example inbound call is in the history. Your team can move directly to the next conversation.', tip: 'Switch to outbound dialing or explore Mercury.', percent: 100 },
    },
    mercury: {
      ready: { step: '01 — MERCURY', title: 'Your script, in the moment.', description: 'Mercury organizes the talking points for your team. Script mode shows one cue at a time while you speak.', tip: 'Open First conversation to read the playbook. AI mode is marked coming soon in the actual interface.', percent: 35 },
    },
  };
export const interactiveDemoPage = {
  eyebrow: 'THE REAL WORKSPACE. A SAFE SIMULATION.',
  titleLead: 'See how a good',
  titleEmphasis: 'calling day',
  titleTail: 'feels.',
  description: 'Explore the same Consuelo Dialer interface your team uses inside GoHighLevel. Fictional leads, simulated calls, and no account required.',
  badge: 'WORKING SIMULATION',
  getStartedLabel: 'TRY CONSUELO WITH YOUR TEAM',
  safetyLabel: 'No sign-in. No live phone calls. No real customer data.',
  closingEyebrow: 'READY FOR THE REAL THING?',
  closingTitleLead: 'Less dialing.',
  closingTitleEmphasis: 'More talking.',
} as const;
