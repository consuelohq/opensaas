export type SiteLink = { label: string; href: string };
const docs = 'https://docs.consuelohq.com/';
export const siteLinks = {
  billing: 'https://billing.stripe.com/p/login/eVqbJ39hodmf6mBaOD6c001',
  numberBilling: 'https://billing.stripe.com/p/login/5kQdRb8dk3LF7qFg8X6c002',
  app: '/pricing',
  docs,
  github: 'https://github.com/consuelohq/opensaas',
  changelog: '/how-it-works',
  mercury: '/how-it-works',
  pricing: '/pricing',
  enterprise: '/contact',
  login: 'https://app.gohighlevel.com/',
  free: '/pricing',
  newsletter: 'mailto:support@consuelohq.com?subject=Consuelo%20Dialer',
  discordDocs: docs,
  slackDocs: docs,
  privacy: '/privacy',
  terms: '/terms',
  discord: 'https://discord.gg/87YtkVUBvc',
  x: 'https://x.com/consuelohq_',
};
export type SiteLinks = typeof siteLinks;
// Onboarding is owned here until Branch 3 validates the production Marketplace install flow.
export const ghlMarketplaceUrl = '/pricing';
