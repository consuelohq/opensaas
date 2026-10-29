export type SiteLink = { label: string; href: string };
const docs = 'https://docs.consuelohq.com/';
export const siteLinks = {
  app: '/get-started', docs, github: 'https://github.com/consuelohq/opensaas',
  changelog: '/how-it-works', mercury: '/how-it-works', pricing: '/pricing', enterprise: '/contact',
  login: 'https://app.gohighlevel.com/', free: '/get-started',
  newsletter: 'mailto:support@consuelohq.com?subject=Consuelo%20Dialer',
  discordDocs: docs, slackDocs: docs, privacy: '/privacy', terms: '/terms',
  discord: 'https://discord.gg/87YtkVUBvc', x: 'https://x.com/consuelohq_',
};
export type SiteLinks = typeof siteLinks;
// Onboarding is owned here until Branch 3 validates the production Marketplace install flow.
export const ghlMarketplaceUrl = '/get-started';
