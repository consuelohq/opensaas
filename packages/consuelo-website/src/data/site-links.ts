export type SiteLink = {
  label: string;
  href: string;
};

export const siteLinks = {
  app: 'https://app.consuelohq.com',
  docs: 'https://docs.consuelohq.com',
  github: 'https://github.com/consuelohq/opensaas',
  changelog: '/changelog',
  mercury: '/mercury',
  pricing: '/mercury',
  enterprise: '/contact',
  login: 'https://app.consuelohq.com',
  free: 'https://app.consuelohq.com',
  newsletter: 'mailto:support@consuelohq.com?subject=Consuelo%20newsletter',
  discordDocs: 'https://docs.consuelohq.com/user-guide/discord-bot/overview',
  slackDocs: 'https://docs.consuelohq.com',
  privacy: '/privacy',
  terms: '/terms',
  discord: 'https://discord.gg/87YtkVUBvc',
  x: 'https://x.com/consuelohq_?s=21',
};

export type SiteLinks = typeof siteLinks;

const ghlMarketplaceClientId = '690cbca9af44827eb89887b1-mhpq9v7i';
const ghlMarketplaceVersionId = '690cbca9af44827eb89887b1';
const ghlOAuthRedirectUri = siteLinks.app + '/api/oauth/callback';
const ghlMarketplaceSearchParams = new URLSearchParams({
  response_type: 'code',
  redirect_uri: ghlOAuthRedirectUri,
  client_id: ghlMarketplaceClientId,
  scope:
    'contacts.readonly contacts.write opportunities.readonly opportunities.write calendars.readonly users.readonly conversations.readonly conversations.write conversations/message.readonly conversations/message.write locations.readonly',
  version_id: ghlMarketplaceVersionId,
});

export const ghlMarketplaceUrl =
  'https://marketplace.gohighlevel.com/oauth/chooselocation?' +
  ghlMarketplaceSearchParams.toString();
