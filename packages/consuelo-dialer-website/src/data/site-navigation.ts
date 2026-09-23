import { siteLinks } from './site-links';

export type SiteNavLink = {
  label: string;
  href: string;
};

export const dialerSiteHeaderLinks = {
  desktop: [
    { label: 'CONSUELO', href: siteLinks.consuelo },
    { label: 'DOCS', href: siteLinks.dialerDocs },
    { label: 'PRICING', href: '/pricing' },
    { label: 'FEATURES', href: '/#features' },
  ] as const satisfies readonly SiteNavLink[],
  mobile: [
    { label: 'DOCS', href: siteLinks.dialerDocs },
    { label: 'PRICING', href: '/pricing' },
  ] as const satisfies readonly SiteNavLink[],
  wordmarkAriaLabel: 'Consuelo Dialer home',
  primaryAriaLabel: 'Primary',
  mobilePrimaryAriaLabel: 'Mobile primary',
} as const;
