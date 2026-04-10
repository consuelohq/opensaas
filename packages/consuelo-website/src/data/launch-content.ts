import { launchDocsMenuTabs } from './launch-docs';
import {
  type LaunchAnnouncement,
  type LaunchFaqContent,
  type LaunchFaqItem,
  type LaunchFooterSignup,
  type LaunchHeroContent,
  type LaunchLink,
  type LaunchMercuryContent,
  type LaunchMercuryHighlight,
  type LaunchMetric,
  type LaunchNavLink,
  type LaunchOverviewContent,
  type LaunchOverviewFeature,
  type LaunchPageSection,
  type LaunchPrivacyContent,
  type LaunchStatsContent,
  type LaunchTab,
  type MercuryProblem,
  type MercuryStep,
  footerLinks as fallbackFooterLinks,
  ghlMarketplaceUrl as fallbackGhlMarketplaceUrl,
  launchAnnouncement as fallbackLaunchAnnouncement,
  launchFaq as fallbackLaunchFaq,
  launchFaqItems as fallbackLaunchFaqItems,
  launchFooterSignup as fallbackLaunchFooterSignup,
  launchHeaderLinks as fallbackLaunchHeaderLinks,
  launchHero as fallbackLaunchHero,
  launchMercury as fallbackLaunchMercury,
  launchMercuryHighlights as fallbackLaunchMercuryHighlights,
  launchMetrics as fallbackLaunchMetrics,
  launchMobileMenuLinks as fallbackLaunchMobileMenuLinks,
  launchOverview as fallbackLaunchOverview,
  launchOverviewFeatures as fallbackLaunchOverviewFeatures,
  launchPageSections as fallbackLaunchPageSections,
  launchPrivacy as fallbackLaunchPrivacy,
  launchStats as fallbackLaunchStats,
  launchTabs as fallbackLaunchTabs,
  mercuryFaqItems as fallbackMercuryFaqItems,
  mercuryProblems as fallbackMercuryProblems,
  mercurySteps as fallbackMercurySteps,
  siteLinks,
} from './launch-content.local';
import { fetchSanityQuery } from '../lib/sanity';

export type {
  LaunchAnnouncement,
  LaunchFaqContent,
  LaunchFaqItem,
  LaunchFooterSignup,
  LaunchHeroContent,
  LaunchLink,
  LaunchMercuryContent,
  LaunchMercuryHighlight,
  LaunchMetric,
  LaunchNavLink,
  LaunchOverviewContent,
  LaunchOverviewFeature,
  LaunchPageSection,
  LaunchPrivacyContent,
  LaunchStatsContent,
  LaunchTab,
  MercuryProblem,
  MercuryStep,
} from './launch-content.local';

type SanityLaunchDocument = {
  announcement?: Partial<LaunchAnnouncement> | null;
  announcementBadge?: string | null;
  announcementText?: string | null;
  announcementLinkLabel?: string | null;
  announcementLinkHref?: string | null;
  hero?: Partial<LaunchHeroContent> | null;
  heroTitle?: string | null;
  heroDescription?: string | null;
  tabs?: LaunchTab[] | null;
  headerLinks?: LaunchNavLink[] | null;
  mobileMenuLinks?: LaunchNavLink[] | null;
  pageSections?: LaunchPageSection[] | null;
  overview?: Partial<LaunchOverviewContent> | null;
  overviewEyebrow?: string | null;
  overviewTitle?: string | null;
  overviewIntro?: string | null;
  overviewCtaLabel?: string | null;
  overviewCtaHref?: string | null;
  overviewFeatures?: LaunchOverviewFeature[] | null;
  stats?: Partial<LaunchStatsContent> | null;
  statsEyebrow?: string | null;
  statsTitle?: string | null;
  statsIntro?: string | null;
  metrics?: LaunchMetric[] | null;
  privacy?: Partial<LaunchPrivacyContent> | null;
  privacyEyebrow?: string | null;
  privacyTitle?: string | null;
  privacyDescription?: string | null;
  privacyLinkLabel?: string | null;
  privacyLinkHref?: string | null;
  faq?: Partial<LaunchFaqContent> | null;
  faqEyebrow?: string | null;
  faqTitle?: string | null;
  faqIntro?: string | null;
  faqItems?: LaunchFaqItem[] | null;
  mercury?: Partial<LaunchMercuryContent> | null;
  mercuryEyebrow?: string | null;
  mercuryTitle?: string | null;
  mercuryIntro?: string | null;
  mercuryPrimaryLabel?: string | null;
  mercuryPrimaryHref?: string | null;
  mercurySecondaryLabel?: string | null;
  mercurySecondaryHref?: string | null;
  mercuryHighlights?: LaunchMercuryHighlight[] | null;
  mercuryProblems?: MercuryProblem[] | null;
  mercurySteps?: MercuryStep[] | null;
  mercuryFaqItems?: LaunchFaqItem[] | null;
  footerSignup?: Partial<LaunchFooterSignup> | null;
  footerSignupEyebrow?: string | null;
  footerSignupTitle?: string | null;
  footerSignupIntro?: string | null;
  footerSignupButtonLabel?: string | null;
  footerLinks?: LaunchLink[] | null;
};

const LAUNCH_PAGE_QUERY = `
*[_type in ["landingPage", "launchPage"]] | order(_updatedAt desc)[0]{
  announcement{
    badge,
    text,
    linkLabel,
    linkHref
  },
  announcementBadge,
  announcementText,
  announcementLinkLabel,
  announcementLinkHref,
  hero{
    title,
    description
  },
  heroTitle,
  heroDescription,
  tabs[]{
    id,
    label,
    kind,
    value,
    href,
    imageSrc,
    darkImageSrc,
    imageAlt
  },
  headerLinks[]{
    label,
    href
  },
  mobileMenuLinks[]{
    label,
    href
  },
  pageSections[]{
    id,
    label
  },
  overview{
    eyebrow,
    title,
    intro,
    ctaLabel,
    ctaHref
  },
  overviewEyebrow,
  overviewTitle,
  overviewIntro,
  overviewCtaLabel,
  overviewCtaHref,
  overviewFeatures[]{
    title,
    text
  },
  stats{
    eyebrow,
    title,
    intro
  },
  statsEyebrow,
  statsTitle,
  statsIntro,
  metrics[]{
    value,
    label,
    caption,
    chart,
    points,
    filledDots,
    bars
  },
  privacy{
    eyebrow,
    title,
    description,
    linkLabel,
    linkHref
  },
  privacyEyebrow,
  privacyTitle,
  privacyDescription,
  privacyLinkLabel,
  privacyLinkHref,
  faq{
    eyebrow,
    title,
    intro
  },
  faqEyebrow,
  faqTitle,
  faqIntro,
  faqItems[]{
    question,
    answer
  },
  mercury{
    eyebrow,
    title,
    intro,
    primaryLabel,
    primaryHref,
    secondaryLabel,
    secondaryHref
  },
  mercuryEyebrow,
  mercuryTitle,
  mercuryIntro,
  mercuryPrimaryLabel,
  mercuryPrimaryHref,
  mercurySecondaryLabel,
  mercurySecondaryHref,
  mercuryHighlights[]{
    title,
    text
  },
  mercuryProblems[]{
    title,
    text
  },
  mercurySteps[]{
    step,
    title,
    text
  },
  mercuryFaqItems[]{
    question,
    answer
  },
  footerSignup{
    eyebrow,
    title,
    intro,
    buttonLabel
  },
  footerSignupEyebrow,
  footerSignupTitle,
  footerSignupIntro,
  footerSignupButtonLabel,
  footerLinks[]{
    label,
    href
  }
}
`;

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const mergeString = (value: string | null | undefined, fallback: string): string =>
  isNonEmptyString(value) ? value : fallback;

const mergeArray = <T>(value: T[] | null | undefined, fallback: T[]): T[] =>
  Array.isArray(value) && value.length > 0 ? value : fallback;

const remoteLaunchDocument = await fetchSanityQuery<SanityLaunchDocument>(
  LAUNCH_PAGE_QUERY,
).catch(() => null);

export const ghlMarketplaceUrl = fallbackGhlMarketplaceUrl;

export const launchHeaderLinks: LaunchNavLink[] = mergeArray(
  remoteLaunchDocument?.headerLinks,
  fallbackLaunchHeaderLinks,
);

export const launchMobileMenuLinks: LaunchNavLink[] = mergeArray(
  remoteLaunchDocument?.mobileMenuLinks,
  fallbackLaunchMobileMenuLinks,
);

export const launchPageSections: LaunchPageSection[] = mergeArray(
  remoteLaunchDocument?.pageSections,
  fallbackLaunchPageSections,
);

export const launchAnnouncement: LaunchAnnouncement = {
  badge: mergeString(
    remoteLaunchDocument?.announcement?.badge ?? remoteLaunchDocument?.announcementBadge,
    fallbackLaunchAnnouncement.badge,
  ),
  text: mergeString(
    remoteLaunchDocument?.announcement?.text ?? remoteLaunchDocument?.announcementText,
    fallbackLaunchAnnouncement.text,
  ),
  linkLabel: mergeString(
    remoteLaunchDocument?.announcement?.linkLabel ?? remoteLaunchDocument?.announcementLinkLabel,
    fallbackLaunchAnnouncement.linkLabel,
  ),
  linkHref: mergeString(
    remoteLaunchDocument?.announcement?.linkHref ?? remoteLaunchDocument?.announcementLinkHref,
    fallbackLaunchAnnouncement.linkHref,
  ),
};

export const launchHero: LaunchHeroContent = {
  title: mergeString(
    remoteLaunchDocument?.hero?.title ?? remoteLaunchDocument?.heroTitle,
    fallbackLaunchHero.title,
  ),
  description: mergeString(
    remoteLaunchDocument?.hero?.description ?? remoteLaunchDocument?.heroDescription,
    fallbackLaunchHero.description,
  ),
};

export const launchTabs: LaunchTab[] = mergeArray(remoteLaunchDocument?.tabs, fallbackLaunchTabs);

export const launchOverview: LaunchOverviewContent = {
  eyebrow: mergeString(
    remoteLaunchDocument?.overview?.eyebrow ?? remoteLaunchDocument?.overviewEyebrow,
    fallbackLaunchOverview.eyebrow,
  ),
  title: mergeString(
    remoteLaunchDocument?.overview?.title ?? remoteLaunchDocument?.overviewTitle,
    fallbackLaunchOverview.title,
  ),
  intro: mergeString(
    remoteLaunchDocument?.overview?.intro ?? remoteLaunchDocument?.overviewIntro,
    fallbackLaunchOverview.intro,
  ),
  ctaLabel: mergeString(
    remoteLaunchDocument?.overview?.ctaLabel ?? remoteLaunchDocument?.overviewCtaLabel,
    fallbackLaunchOverview.ctaLabel,
  ),
  ctaHref: mergeString(
    remoteLaunchDocument?.overview?.ctaHref ?? remoteLaunchDocument?.overviewCtaHref,
    fallbackLaunchOverview.ctaHref,
  ),
};

export const launchOverviewFeatures: LaunchOverviewFeature[] = mergeArray(
  remoteLaunchDocument?.overviewFeatures,
  fallbackLaunchOverviewFeatures,
);

export const launchStats: LaunchStatsContent = {
  eyebrow: mergeString(
    remoteLaunchDocument?.stats?.eyebrow ?? remoteLaunchDocument?.statsEyebrow,
    fallbackLaunchStats.eyebrow,
  ),
  title: mergeString(
    remoteLaunchDocument?.stats?.title ?? remoteLaunchDocument?.statsTitle,
    fallbackLaunchStats.title,
  ),
  intro: mergeString(
    remoteLaunchDocument?.stats?.intro ?? remoteLaunchDocument?.statsIntro,
    fallbackLaunchStats.intro,
  ),
};

export const launchMetrics: LaunchMetric[] = mergeArray(
  remoteLaunchDocument?.metrics,
  fallbackLaunchMetrics,
);

export const launchPrivacy: LaunchPrivacyContent = {
  eyebrow: mergeString(
    remoteLaunchDocument?.privacy?.eyebrow ?? remoteLaunchDocument?.privacyEyebrow,
    fallbackLaunchPrivacy.eyebrow,
  ),
  title: mergeString(
    remoteLaunchDocument?.privacy?.title ?? remoteLaunchDocument?.privacyTitle,
    fallbackLaunchPrivacy.title,
  ),
  description: mergeString(
    remoteLaunchDocument?.privacy?.description ?? remoteLaunchDocument?.privacyDescription,
    fallbackLaunchPrivacy.description,
  ),
  linkLabel: mergeString(
    remoteLaunchDocument?.privacy?.linkLabel ?? remoteLaunchDocument?.privacyLinkLabel,
    fallbackLaunchPrivacy.linkLabel,
  ),
  linkHref: mergeString(
    remoteLaunchDocument?.privacy?.linkHref ?? remoteLaunchDocument?.privacyLinkHref,
    fallbackLaunchPrivacy.linkHref,
  ),
};

export const launchFaq: LaunchFaqContent = {
  eyebrow: mergeString(
    remoteLaunchDocument?.faq?.eyebrow ?? remoteLaunchDocument?.faqEyebrow,
    fallbackLaunchFaq.eyebrow,
  ),
  title: mergeString(
    remoteLaunchDocument?.faq?.title ?? remoteLaunchDocument?.faqTitle,
    fallbackLaunchFaq.title,
  ),
  intro: mergeString(
    remoteLaunchDocument?.faq?.intro ?? remoteLaunchDocument?.faqIntro,
    fallbackLaunchFaq.intro,
  ),
};

export const launchFaqItems: LaunchFaqItem[] = mergeArray(
  remoteLaunchDocument?.faqItems,
  fallbackLaunchFaqItems,
);

export const launchMercury: LaunchMercuryContent = {
  eyebrow: mergeString(
    remoteLaunchDocument?.mercury?.eyebrow ?? remoteLaunchDocument?.mercuryEyebrow,
    fallbackLaunchMercury.eyebrow,
  ),
  title: mergeString(
    remoteLaunchDocument?.mercury?.title ?? remoteLaunchDocument?.mercuryTitle,
    fallbackLaunchMercury.title,
  ),
  intro: mergeString(
    remoteLaunchDocument?.mercury?.intro ?? remoteLaunchDocument?.mercuryIntro,
    fallbackLaunchMercury.intro,
  ),
  primaryLabel: mergeString(
    remoteLaunchDocument?.mercury?.primaryLabel ?? remoteLaunchDocument?.mercuryPrimaryLabel,
    fallbackLaunchMercury.primaryLabel,
  ),
  primaryHref: mergeString(
    remoteLaunchDocument?.mercury?.primaryHref ?? remoteLaunchDocument?.mercuryPrimaryHref,
    fallbackLaunchMercury.primaryHref,
  ),
  secondaryLabel: mergeString(
    remoteLaunchDocument?.mercury?.secondaryLabel ?? remoteLaunchDocument?.mercurySecondaryLabel,
    fallbackLaunchMercury.secondaryLabel,
  ),
  secondaryHref: mergeString(
    remoteLaunchDocument?.mercury?.secondaryHref ?? remoteLaunchDocument?.mercurySecondaryHref,
    fallbackLaunchMercury.secondaryHref,
  ),
};

export const launchMercuryHighlights: LaunchMercuryHighlight[] = mergeArray(
  remoteLaunchDocument?.mercuryHighlights,
  fallbackLaunchMercuryHighlights,
);

export const mercuryProblems: MercuryProblem[] = mergeArray(
  remoteLaunchDocument?.mercuryProblems,
  fallbackMercuryProblems,
);

export const mercurySteps: MercuryStep[] = mergeArray(
  remoteLaunchDocument?.mercurySteps,
  fallbackMercurySteps,
);

export const mercuryFaqItems: LaunchFaqItem[] = mergeArray(
  remoteLaunchDocument?.mercuryFaqItems,
  fallbackMercuryFaqItems,
);

export const launchFooterSignup: LaunchFooterSignup = {
  eyebrow: mergeString(
    remoteLaunchDocument?.footerSignup?.eyebrow ?? remoteLaunchDocument?.footerSignupEyebrow,
    fallbackLaunchFooterSignup.eyebrow,
  ),
  title: mergeString(
    remoteLaunchDocument?.footerSignup?.title ?? remoteLaunchDocument?.footerSignupTitle,
    fallbackLaunchFooterSignup.title,
  ),
  intro: mergeString(
    remoteLaunchDocument?.footerSignup?.intro ?? remoteLaunchDocument?.footerSignupIntro,
    fallbackLaunchFooterSignup.intro,
  ),
  buttonLabel: mergeString(
    remoteLaunchDocument?.footerSignup?.buttonLabel ??
      remoteLaunchDocument?.footerSignupButtonLabel,
    fallbackLaunchFooterSignup.buttonLabel,
  ),
};

export const footerLinks: LaunchLink[] = mergeArray(
  remoteLaunchDocument?.footerLinks,
  fallbackFooterLinks,
);

export { launchDocsMenuTabs, siteLinks };
