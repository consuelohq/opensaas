export type StructuredData = {
  [key: string]: unknown;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export const siteMetadata = {
  siteUrl: 'https://consuelohq.com',
  siteName: 'Consuelo',
  defaultTitle: 'Consuelo OS | Your workspace, connected to every agent',
  defaultDescription:
    'Connect ChatGPT, Codex, Claude, and the agents that come next to the same tools, memory, workflows, and machines.',
  blogTitle: 'Consuelo Blog',
  blogDescription:
    'Product updates, implementation notes, and technical writing from the Consuelo team.',
  defaultOgImage: '/og.png',
  robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
  themeColorLight: '#0000F2',
  themeColorDark: '#0000F2',
  twitterHandle: '@consuelohq',
  docsUrl: 'https://docs.consuelohq.com',
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
  logo: resolveImageUrl('/images/home/consuelo-mark.svg'),
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
