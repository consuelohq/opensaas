type DetailBlock = {type:'paragraph';text:string} | {type:'list';items:string[]} | {type:'steps';items:{label:string;text:string}[]};
type HomeFaqItem = {question:string;answer:string;details?:DetailBlock[];linkLabel?:string;linkHref?:string};
export const dialerHero = {
  title: ['Turn more leads', 'into live conversations.'],
  description: 'Multi-line dialing and inbound call routing, built into GoHighLevel. Reach out, pick up, and keep the customer record close.',
  primaryLabel: 'GET STARTED',
  secondaryLabel: 'SEE HOW IT WORKS',
};
export const homeFeaturePreviewItems = [
  { number: 1, label: 'OUTBOUND', title: 'Work the list.\nReach the person.', body: 'Call multiple leads at once and connect a live answer to your rep. Local presence selects an available number for the area you are calling. Spend the call on the customer, with their context already in reach.', ctaLabel: 'Explore outbound calling', ctaHref: '/how-it-works#outbound' },
  { number: 2, label: 'INBOUND · CONTROLLED ROLLOUT', title: 'Give incoming calls\na clear next step.', body: 'Route a caller to an eligible rep based on availability and queue rules. When the team cannot answer, callback and voicemail policies give the caller another way forward. Inbound is being introduced through controlled onboarding.', ctaLabel: 'See how inbound works', ctaHref: '/how-it-works#inbound' },
  { number: 3, label: 'GOHIGHLEVEL', title: 'Keep the call\nwith the customer.', body: 'Open Consuelo inside GoHighLevel. Work from contacts and opportunity queues, see call history, and move from one conversation to the next without a separate calling workspace.', ctaLabel: 'See the setup guide', ctaHref: '/guides' },
  { number: 4, label: 'CALL ANALYTICS', title: 'See what happens\nafter you dial.', body: 'Review call outcomes and activity alongside the people you reached. Use the record of a call to decide who needs a follow-up and what your team should work next.', ctaLabel: 'Explore call history', ctaHref: '/how-it-works#analytics' },
  { number: 5, label: 'AI ASSISTANCE', title: 'Learn from\nthe calls you make.', body: 'Optional transcripts give reps and managers a conversation they can review. Live coaching and feedback on uploaded transcripts are in development; they are not included as available features in this preview.', ctaLabel: 'See transcription details', ctaHref: '/how-it-works#transcripts' },
];
export const homeFaqItems: HomeFaqItem[] = [
  { question: 'What does Consuelo Dialer do?', answer: 'Consuelo brings outbound dialing and inbound routing into a sales calling workflow. The first embedded experience is in GoHighLevel, with call history and customer context close to the rep.' },
  { question: 'What is the difference between inbound and outbound?', answer: 'Outbound starts when your rep calls a lead. Multi-line dialing can try several leads while a rep is available. Inbound starts when a customer calls your number; the router looks for an eligible rep and applies your waiting and fallback rules. A callback is a separate outbound call made after a customer asks to be called back.' },
  { question: 'How does multi-line dialing work?', answer: 'The dialer starts more than one lead call while the rep is available, then selects a live answer for that rep. The line limit depends on the plan and active phone numbers. Choosing a fixed caller ID limits that calling attempt to one line. Calling policies and team capacity still apply.' },
  { question: 'Will local presence guarantee more answers?', answer: 'No. Local presence chooses an available caller ID for the area you are calling. Pickup also depends on timing, number reputation, your audience, and the reason for the call. We do not promise a fixed increase in answer rate.' },
  { question: 'Do I need to leave GoHighLevel?', answer: 'Consuelo opens as an embedded calling interface in your GoHighLevel location. An administrator sets up the integration, users, and phone numbers. Existing users can open their location and select Consuelo Dialer from the menu.', linkLabel: 'Open GoHighLevel', linkHref: 'https://app.gohighlevel.com/' },
  { question: 'Can my team answer on a browser or a phone?', answer: 'The inbound design supports browser and forwarding-phone endpoints. Readiness, media registration, and phone reachability must be checked during setup. Availability depends on your rollout configuration; request onboarding before relying on inbound routing.' },
  { question: 'What happens if nobody can answer an incoming call?', answer: 'Queue policies can limit waiting and offer callbacks or voicemail when configured. Inbound, callback execution, and voicemail are enabled and validated during controlled onboarding; they are not automatically active for every installation.' },
  { question: 'Are AI coaching and transcripts included?', answer: 'Standard and Power support optional recording and transcription when enabled for the workspace. Live on-call coaching and feedback on uploaded transcripts are in development. Recording and transcription must follow your company policy and the permissions configured for the call.' },
  { question: 'How are the monthly plans priced?', answer: 'Single is $59, Standard is $99, and Power is $159 per seat per month in USD. One phone number is included per seat; additional numbers are $1.99 per month each within plan limits. Single includes 1,388 connected minutes. Review usage and setup with us before subscribing.', linkLabel: 'Compare plans', linkHref: '/pricing' },
  { question: 'Can I build on the dialer outside GoHighLevel?', answer: 'The Dialer SDK and standalone service separate calling and routing logic from the CRM interface. GoHighLevel is the first embedded interface. Other integrations require their own setup; this preview does not claim one-click support for other CRMs.', linkLabel: 'Read the developer overview', linkHref: '/guides#developers' },
];
export const homeWorkspaceClose = {
  eyebrow: 'CONSUELO DIALER',
  title: 'Ready for\nthe next call?',
  description: 'Bring your team, your leads, and your calling workflow together.',
  primaryLabel: 'GET STARTED', primaryHref: '/get-started',
  secondaryLabel: 'COMPARE PLANS', secondaryHref: '/pricing',
};
