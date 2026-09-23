export type PricingHeroContent = {
  title: string;
  subtitle: string;
};

export type PricingAccountLink = {
  prompt: string;
  label: string;
  href: string;
};

export type PricingPlan = {
  name: string;
  price: string;
  subtitle: string;
  href: string;
  badge?: string;
  placeholderTitle: string;
  placeholderMeta: string;
  bullets: string[];
};

const foundingAgencyHref =
  'mailto:support@consuelohq.com?subject=Consuelo%20Dialer%20Founding%20Agency';

export const pricingHero: PricingHeroContent = {
  title: 'Dialer Plans',
  subtitle:
    'Public launch prices are being finalized during the founding-agency pilot. The commercial model is built around seats, phone numbers, and measured calling usage.',
};

export const pricingAccountLink: PricingAccountLink = {
  prompt: 'Want founding-agency pricing?',
  label: 'Get Early Access',
  href: foundingAgencyHref,
};

export const pricingPlans: PricingPlan[] = [
  {
    name: 'Single',
    price: '1 Line',
    subtitle: 'Straightforward Calling',
    href: foundingAgencyHref,
    placeholderTitle: 'Single-Line Calling',
    placeholderMeta: 'Current product UI placeholder',
    bullets: [
      'CRM-embedded calling',
      'Single-line mode',
      'Included number capacity',
      'Measured calling usage',
    ],
  },
  {
    name: 'Standard',
    price: '3 Lines',
    subtitle: 'Predictive',
    href: foundingAgencyHref,
    badge: 'Early Access',
    placeholderTitle: 'Predictive Calling',
    placeholderMeta: 'Current product UI placeholder',
    bullets: [
      '1 / 2 / 3 line predictive dialing',
      'Recordings',
      'Transcripts',
      'Additional numbers available',
    ],
  },
  {
    name: 'Power',
    price: '3 Lines',
    subtitle: 'Predictive + Team Growth',
    href: foundingAgencyHref,
    badge: 'Agency',
    placeholderTitle: 'Team + Location Calling',
    placeholderMeta: 'Current product UI placeholder',
    bullets: [
      'Predictive dialing',
      'Recordings + transcripts',
      'Team / location growth',
      'Additional numbers billed separately',
    ],
  },
];
