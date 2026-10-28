import { siteLinks, type SiteLink } from './site-links';

export type SiteNavLink = {
  label: string;
  href: string;
};

export type HomePageSection = {
  id: string;
  label: string;
};

export const siteHeaderLinks: SiteNavLink[] = [
  { label: 'Docs', href: siteLinks.docs },
  { label: 'Mercury', href: siteLinks.mercury },
  { label: 'Enterprise', href: siteLinks.enterprise },
];

/** Primary OS marketing header (5-link desktop layout). */
export const osSiteHeaderLinks = {
  cloudHref: 'https://os.consuelohq.com',
  desktop: [
    { label: 'CONSUELO', href: '/blog' },
    { label: 'DOCS', href: siteLinks.docs },
    { label: 'PRICING', href: '/pricing' },
    { label: 'CLOUD', href: 'https://os.consuelohq.com' },
  ] as const satisfies readonly SiteNavLink[],
  mobile: [
    { label: 'DOCS', href: siteLinks.docs },
    { label: 'CLOUD', href: 'https://os.consuelohq.com' },
  ] as const satisfies readonly SiteNavLink[],
  wordmarkAriaLabel: 'Consuelo OS home',
  communityAriaLabel: 'Community links',
  primaryAriaLabel: 'Primary',
  mobilePrimaryAriaLabel: 'Mobile primary',
} as const;

export const siteMobileMenuLinks: SiteNavLink[] = [
  ...siteHeaderLinks.filter((link) => link.label !== 'Docs'),
  { label: 'Login', href: siteLinks.login },
  { label: 'Free', href: siteLinks.free },
];

export const homePageSections: HomePageSection[] = [
  { id: 'intro', label: 'Intro' },
  { id: 'overview', label: 'What is Consuelo?' },
  { id: 'proof', label: 'Proof' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'faq', label: 'FAQ' },
  { id: 'mercury', label: 'Mercury' },
  { id: 'waitlist', label: 'Waitlist' },
];

export const footerLinks: SiteLink[] = [
  { label: 'Mercury', href: '/mercury' },
  { label: 'Docs', href: siteLinks.docs },
  { label: 'Changelog', href: siteLinks.changelog },
  { label: 'Discord', href: siteLinks.discord },
  { label: 'X', href: siteLinks.x },
];
