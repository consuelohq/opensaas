export type ContactFaqItem = {
  question: string;
  answer: string;
};

export const contactFaqItems: ContactFaqItem[] = [
  {
    question: 'How do we get help with Consuelo?',
    answer:
      'Send us the context on your team, workflow, or integration need. We will route the request to the right person and follow up with next steps.',
  },
  {
    question: 'Can we talk about enterprise deployment?',
    answer:
      'Yes. Use the contact form for questions about SSO, internal AI gateways, self-hosting, compliance, or organization-wide rollout planning.',
  },
  {
    question: 'Where should support requests go?',
    answer:
      'For now, use this page for support, implementation, partnership, and product questions. Include the workspace or integration you are asking about when relevant.',
  },
];
