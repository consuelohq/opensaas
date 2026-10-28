export type SiteLink = { label: string; href: string };
export const siteLinks = {
  app: '/get-started', docs: '/guides', github: 'https://github.com/consuelohq/opensaas',
  changelog: '/how-it-works', mercury: '/how-it-works', pricing: '/pricing', enterprise: '/contact',
  login: 'https://app.gohighlevel.com/', free: '/get-started',
  newsletter: 'mailto:support@consuelohq.com?subject=Consuelo%20Dialer',
  discordDocs: '/guides', slackDocs: '/guides', privacy: '/privacy', terms: '/terms',
  discord: 'https://discord.gg/87YtkVUBvc', x: 'https://x.com/consuelohq_',
};
export type SiteLinks = typeof siteLinks;
// Onboarding is owned here until Branch 3 validates the production Marketplace install flow.
export const ghlMarketplaceUrl = '/get-started';
