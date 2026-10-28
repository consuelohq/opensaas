import { siteLinks, type SiteLink } from './site-links';
export type SiteNavLink = SiteLink;
export type HomePageSection = { id: string; label: string };
export const siteHeaderLinks: SiteNavLink[] = [{label:'Docs',href:siteLinks.docs},{label:'How it works',href:'/how-it-works'},{label:'Get started',href:'/get-started'}];
export const osSiteHeaderLinks = {
  cloudHref: '/get-started',
  desktop: [{label:'FEATURES',href:'/#features'},{label:'DOCS',href:siteLinks.docs},{label:'PRICING',href:'/pricing'},{label:'GET STARTED',href:'/get-started'}],
  mobile: [{label:'DOCS',href:siteLinks.docs},{label:'GET STARTED',href:'/get-started'}],
  wordmarkAriaLabel:'Consuelo Dialer home', communityAriaLabel:'Community links', primaryAriaLabel:'Primary', mobilePrimaryAriaLabel:'Mobile primary',
};
export const siteMobileMenuLinks = [{label:'How it works',href:'/how-it-works'},{label:'Open GoHighLevel',href:siteLinks.login}];
export const homePageSections: HomePageSection[] = [{id:'intro',label:'Intro'},{id:'features',label:'Features'},{id:'faq',label:'FAQ'}];
export const footerLinks: SiteLink[] = [{label:'How it works',href:'/how-it-works'},{label:'Docs',href:'/guides'},{label:'Pricing',href:'/pricing'},{label:'Contact',href:'/contact'}];
