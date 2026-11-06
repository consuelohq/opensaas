import { siteLinks, type SiteLink } from './site-links';
export type SiteNavLink = SiteLink;
export type HomePageSection = { id: string; label: string };
export const siteHeaderLinks: SiteNavLink[] = [
  { label: 'Docs', href: siteLinks.docs },
  { label: 'Interactive demo', href: '/demo' },
  { label: 'Get started', href: '/pricing' },
];
export const osSiteHeaderLinks = {
  cloudHref: '/pricing',
  desktop: [
    { label: 'CAPABILITIES', href: '/#features' },
    { label: 'DOCS', href: siteLinks.docs },
    { label: 'PRICING', href: '/pricing' },
    { label: 'GET STARTED', href: '/pricing' },
  ],
  mobile: [
    { label: 'DOCS', href: siteLinks.docs },
    { label: 'GET STARTED', href: '/pricing' },
  ],
  wordmarkAriaLabel: 'Consuelo Dialer home',
  communityAriaLabel: 'Community links',
  primaryAriaLabel: 'Primary',
  mobilePrimaryAriaLabel: 'Mobile primary',
};
export const siteMobileMenuLinks = [
  { label: 'Interactive demo', href: '/demo' },
  { label: 'Open GoHighLevel', href: siteLinks.login },
];
export const homePageSections: HomePageSection[] = [
  { id: 'intro', label: 'Intro' },
  { id: 'features', label: 'Capabilities' },
  { id: 'faq', label: 'FAQ' },
];
export const footerLinks: SiteLink[] = [
  { label: 'Interactive demo', href: '/demo' },
  { label: 'Docs', href: siteLinks.docs },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Contact', href: '/contact' },
];
export const siteFooterGroups = [
  {
    name: 'Product',
    links: [
      { label: 'Inbound calling', href: '/#inbound' },
      { label: 'Outbound dialing', href: '/#outbound' },
      { label: 'Analytics', href: '/#analytics' },
      { label: 'Mercury coaching', href: '/#mercury' },
    ],
  },
  {
    name: 'Get started',
    links: [
      { label: 'Plans & pricing', href: '/pricing' },
      { label: 'Documentation', href: siteLinks.docs },
      { label: 'Interactive demo', href: '/demo' },
      { label: 'Talk to us', href: '/contact' },
    ],
  },
  {
    name: 'Your account',
    links: [
      { label: 'Open GoHighLevel', href: siteLinks.login },
      { label: 'Manage your plan', href: siteLinks.billing },
      { label: 'Manage number packs', href: siteLinks.numberBilling },
      { label: 'Get support', href: '/support' },
    ],
  },
  {
    name: 'Community',
    links: [
      { label: 'GitHub', href: siteLinks.github },
      { label: 'Discord', href: siteLinks.discord },
      { label: 'X / Twitter', href: siteLinks.x },
    ],
  },
];
