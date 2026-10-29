const production = import.meta.env.PUBLIC_SITE_CHANNEL === 'production';
import { homepageSeo } from './homepage-seo';
import { siteLinks } from '../data/site-links';

export type StructuredData = {
  [key: string]: unknown;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export const siteMetadata = {
  siteUrl: production ? 'https://consuelohq.com' : 'https://consuelo-dialer-website-preview.pages.dev',
  siteName: 'Consuelo Dialer',
  defaultTitle: homepageSeo.title,
  defaultDescription: homepageSeo.description,
  blogTitle: 'The Consuelo Blog',
  blogDescription:
    'Product updates, implementation notes, and technical writing from the Consuelo team.',
  defaultOgImage: homepageSeo.image,
  robots: production ? 'index,follow,max-image-preview:large' : 'noindex,nofollow',
  themeColorLight: '#0000F2',
  themeColorDark: '#0000F2',
  twitterHandle: '@consuelohq',
  docsUrl: siteLinks.docs,
  appUrl: 'https://app.gohighlevel.com/',
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

  return new URL(pathOrUrl, siteMetadata.siteUrl).toString();
};

export const resolveImageUrl = (image?: string) => {
  return new URL(image ?? siteMetadata.defaultOgImage, siteMetadata.siteUrl).toString();
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
  name: siteMetadata.siteName,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: siteMetadata.siteUrl,
  description: siteMetadata.defaultDescription,
  author: { '@id': `${siteMetadata.siteUrl}/#organization` },
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
