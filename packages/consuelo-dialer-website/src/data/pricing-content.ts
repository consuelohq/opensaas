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
  imageLabel: string;
  imageSrc: string;
  bullets: string[];
};

const foundingAgencyHref =
  'mailto:support@consuelohq.com?subject=Consuelo%20Dialer%20Founding%20Agency';

export const pricingHero: PricingHeroContent = {
  title: 'DIALER PLANS',
  subtitle:
    'Public launch prices are being finalized during the founding-agency pilot. The commercial model is built around seats, phone numbers, and measured calling usage.',
};

export const pricingAccountLink: PricingAccountLink = {
  prompt: 'Want founding-agency pricing?',
  label: 'GET EARLY ACCESS',
  href: foundingAgencyHref,
};

export const pricingPlans: PricingPlan[] = [
  {
    name: 'Single',
    price: '1 LINE',
    subtitle: 'STRAIGHTFORWARD CALLING',
    href: foundingAgencyHref,
    imageLabel: 'Single-line CRM-embedded calling',
    imageSrc: '/previews/power-dialer.webp',
    bullets: [
      'CRM-EMBEDDED CALLING',
      'SINGLE-LINE MODE',
      'INCLUDED NUMBER CAPACITY',
      'MEASURED CALLING USAGE',
    ],
  },
  {
    name: 'Standard',
    price: '3 LINES',
    subtitle: 'PREDICTIVE',
    href: foundingAgencyHref,
    badge: 'EARLY ACCESS',
    imageLabel: 'Predictive multi-line calling',
    imageSrc: '/previews/analytics.webp',
    bullets: [
      '1 / 2 / 3 LINE PREDICTIVE DIALING',
      'RECORDINGS',
      'TRANSCRIPTS',
      'ADDITIONAL NUMBERS AVAILABLE',
    ],
  },
  {
    name: 'Power',
    price: '3 LINES',
    subtitle: 'PREDICTIVE + TEAM GROWTH',
    href: foundingAgencyHref,
    badge: 'AGENCY',
    imageLabel: 'Predictive calling for teams and locations',
    imageSrc: '/previews/coaching.webp',
    bullets: [
      'PREDICTIVE DIALING',
      'RECORDINGS + TRANSCRIPTS',
      'TEAM / LOCATION GROWTH',
      'ADDITIONAL NUMBERS BILLED SEPARATELY',
    ],
  },
];
