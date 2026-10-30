import { siteLinks } from './site-links';

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
  { number: 2, label: 'INBOUND', title: 'Give incoming calls\na clear next step.', body: 'Route a caller to an eligible rep based on availability and queue rules. When the team cannot answer, callback and voicemail policies give the caller another way forward.', ctaLabel: 'See how inbound works', ctaHref: '/how-it-works#inbound' },
  { number: 3, label: 'INTEGRATIONS', title: 'Keep the tools\nyour team knows.', body: 'Open Consuelo inside GoHighLevel. Work from contacts and opportunity queues, see call history, and move from one conversation to the next without a separate calling workspace.', ctaLabel: 'See the setup guide', ctaHref: siteLinks.docs + 'start/install/' },
  { number: 4, label: 'CALL ANALYTICS', title: 'See what happens\nafter you dial.', body: 'Review call outcomes and activity alongside the people you reached. Use the record of a call to decide who needs a follow-up and what your team should work next.', ctaLabel: 'Explore call history', ctaHref: '/how-it-works#analytics' },
  { number: 5, label: 'MERCURY COACHING', title: 'Your playbook.\nIn the conversation.', body: 'Bring up the right part of your script as the call develops, or get a suggested response with AI mode. Reps and leaders can review uploaded transcripts together and put the next conversation on a better footing.', ctaLabel: 'See transcription details', ctaHref: '/how-it-works#transcripts' },
];
export const homeFaqItems: HomeFaqItem[] = [
  { question: 'What does Consuelo Dialer do?', answer: 'Consuelo brings outbound dialing and inbound routing into a sales calling workflow. The first embedded experience is in GoHighLevel, with call history and customer context close to the rep.' },
  { question: 'What is the difference between inbound and outbound?', answer: 'Outbound starts when your rep calls a lead. Multi-line dialing can try several leads while a rep is available. Inbound starts when a customer calls your number; the router looks for an eligible rep and applies your waiting and fallback rules. A callback is a separate outbound call made after a customer asks to be called back.' },
  { question: 'How does multi-line dialing work?', answer: 'The dialer starts more than one lead call while the rep is available, then selects a live answer for that rep. The line limit depends on the plan and active phone numbers. Choosing a fixed caller ID limits that calling attempt to one line. Calling policies and team capacity still apply.' },
  { question: 'Will local presence guarantee more answers?', answer: 'No. Local presence chooses an available caller ID for the area you are calling. Pickup also depends on timing, number reputation, your audience, and the reason for the call. We do not promise a fixed increase in answer rate.' },
  { question: 'Do I need to leave GoHighLevel?', answer: 'Consuelo opens as an embedded calling interface in your GoHighLevel location. An administrator sets up the integration, users, and phone numbers. Existing users can open their location and select Consuelo Dialer from the menu.', linkLabel: 'Open GoHighLevel', linkHref: 'https://app.gohighlevel.com/' },
  { question: 'Can my team answer on a browser or a phone?', answer: 'Reps can answer in the browser or on a forwarding phone. Choose how each rep receives calls during setup, then let availability and queue rules route incoming callers.' },
  { question: 'What happens if nobody can answer an incoming call?', answer: 'Choose waiting limits, callback options and voicemail for your queues. Set business hours and fallback rules so a caller still has a clear next step when the team is busy.' },
  { question: 'Are AI coaching and transcripts included?', answer: 'Agency and Enterprise include recording and transcripts. Mercury coaching is an optional add-on with script mode, AI mode and transcript review. Recording and transcription must follow your company policy and the permissions configured for the call.' },
  { question: 'How are the monthly plans priced?', answer: 'Starter includes 100 trial minutes. Professional is $99, Agency is $149, and Enterprise is $199 per seat per month in USD. Paid plans include 3, 10 and 30 calling lines and numbers respectively. Professional includes 1,000 monthly connected minutes; Agency and Enterprise include 5,000 per seat. Additional numbers start at $3 per month.', linkLabel: 'Compare plans', linkHref: '/pricing' },
  { question: 'Can I build on the dialer outside GoHighLevel?', answer: 'The Dialer SDK and standalone service separate calling and routing logic from the CRM interface. GoHighLevel is the first embedded interface. Use the SDK or API to build a custom connection; other CRMs require their own integration.', linkLabel: 'Read the developer overview', linkHref: siteLinks.docs + 'reference/sdk/' },
];
export const homeWorkspaceClose = {
  eyebrow: 'CONSUELO DIALER',
  title: 'Ready for\nthe next call?',
  description: 'Bring your team, your leads, and your calling workflow together.',
  primaryLabel: 'GET STARTED', primaryHref: '/get-started',
  secondaryLabel: 'COMPARE PLANS', secondaryHref: '/pricing',
};
