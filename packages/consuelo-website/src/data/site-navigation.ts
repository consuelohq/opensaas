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

export const siteMobileMenuLinks: SiteNavLink[] = [
  ...siteHeaderLinks.filter((link) => link.label !== 'docs'),
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
