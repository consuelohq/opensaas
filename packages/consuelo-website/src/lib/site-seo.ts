import { withSiteBase } from './public-path';
import { homepageSeo } from './homepage-seo';

export type StructuredData = {
  [key: string]: unknown;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export const siteMetadata = {
  siteUrl: (import.meta.env.PUBLIC_SITE_ORIGIN ?? 'https://consuelohq.com').replace(/\/$/, '') + (import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '')),
  siteName: 'Consuelo',
  defaultTitle: homepageSeo.title,
  defaultDescription: homepageSeo.description,
  blogTitle: 'The Consuelo Blog',
  blogDescription:
    'Product updates, implementation notes, and technical writing from the Consuelo team.',
  defaultOgImage: homepageSeo.image,
  robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
  themeColorLight: '#0000F2',
  themeColorDark: '#0000F2',
  twitterHandle: '@consuelohq',
  docsUrl: import.meta.env.PUBLIC_DOCS_URL ?? 'https://docs.consuelohq.com',
  appUrl: 'https://app.consuelohq.com',
  githubUrl: 'https://github.com/consuelohq/opensaas',
} as const;

export const formatTitle = (title?: string, fallback = siteMetadata.defaultTitle) => {
  if (!title) {
    return fallback;
  }

  return title.includes(siteMetadata.siteName)
    ? title
    : `${title} | ${siteMetadata.siteName}`;
};

export const resolveCanonicalUrl = (pathOrUrl?: string) => {
  if (!pathOrUrl) {
    return siteMetadata.siteUrl;
  }

  return new URL(withSiteBase(pathOrUrl), siteMetadata.siteUrl).toString();
};

export const resolveImageUrl = (image?: string) => {
  return new URL(withSiteBase(image ?? siteMetadata.defaultOgImage), siteMetadata.siteUrl).toString();
};

export const getOrganizationSchema = (): StructuredData => ({
  '@type': 'Organization',
  '@id': `${siteMetadata.siteUrl}/#organization`,
  name: siteMetadata.siteName,
  url: siteMetadata.siteUrl,
  logo: resolveImageUrl('/favicon.svg'),
  sameAs: [siteMetadata.githubUrl, siteMetadata.docsUrl],
  description: siteMetadata.defaultDescription,
});

export const getWebsiteSchema = (): StructuredData => ({
  '@type': 'WebSite',
  '@id': `${siteMetadata.siteUrl}/#website`,
  url: siteMetadata.siteUrl,
  name: siteMetadata.siteName,
  publisher: { '@id': `${siteMetadata.siteUrl}/#organization` },
  inLanguage: 'en-US',
});

export const getSoftwareApplicationSchema = (
  overrides: Partial<StructuredData> = {},
): StructuredData => ({
  '@type': 'SoftwareApplication',
  '@id': `${siteMetadata.siteUrl}/#application`,
  name: 'Consuelo OS',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'macOS, Linux, Web',
  url: siteMetadata.siteUrl,
  description: siteMetadata.defaultDescription,
  author: { '@id': `${siteMetadata.siteUrl}/#organization` },
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  ...overrides,
});

export const getFaqSchema = (items: FaqItem[]): StructuredData => ({
  '@type': 'FAQPage',
  '@id': `${siteMetadata.siteUrl}/#faq`,
  mainEntity: items.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer.replace(/<[^>]+>/g, ' '),
    },
  })),
});
