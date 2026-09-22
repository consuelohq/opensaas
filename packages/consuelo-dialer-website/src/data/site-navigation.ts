export type SiteNavLink = {
  label: string;
  href: string;
};

export const dialerSiteHeaderLinks = {
  desktop: [
    { label: 'DEMO', href: '#demo' },
    { label: 'FEATURES', href: '#features' },
    { label: 'PRICING', href: '/pricing' },
    { label: 'AGENCIES', href: '#founding-agency' },
  ] as const satisfies readonly SiteNavLink[],
  mobile: [
    { label: 'DEMO', href: '#demo' },
    { label: 'AGENCIES', href: '#founding-agency' },
  ] as const satisfies readonly SiteNavLink[],
  wordmarkAriaLabel: 'Consuelo Dialer home',
  primaryAriaLabel: 'Primary',
  mobilePrimaryAriaLabel: 'Mobile primary',
} as const;
