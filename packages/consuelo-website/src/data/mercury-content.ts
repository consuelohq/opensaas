export type MercuryFaqItem = {
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

export const mercuryFaqItems: MercuryFaqItem[] = [
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
