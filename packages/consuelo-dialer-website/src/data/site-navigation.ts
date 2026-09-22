import { siteLinks } from './site-links';

export type SiteNavLink = {
  label: string;
  href: string;
};

export const dialerSiteHeaderLinks = {
  desktop: [
    { label: 'Consuelo', href: siteLinks.consuelo },
    { label: 'Docs', href: siteLinks.dialerDocs },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Features', href: '/#features' },
  ] as const satisfies readonly SiteNavLink[],
  mobile: [
    { label: 'Docs', href: siteLinks.dialerDocs },
    { label: 'Pricing', href: '/pricing' },
  ] as const satisfies readonly SiteNavLink[],
  wordmarkAriaLabel: 'Consuelo Dialer home',
  primaryAriaLabel: 'Primary',
  mobilePrimaryAriaLabel: 'Mobile primary',
} as const;
