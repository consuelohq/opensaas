export const createLeadConnectorMarketplaceBootstrap = (input: {
  assetOrigin: string;
}): string => {
  const origin = new URL(input.assetOrigin);
  if (origin.protocol !== 'https:') {
    throw new Error('Marketplace asset origin must use HTTPS');
  }
  const css = new URL(
    '/consuelo-lead-connector-click-to-call.css',
    origin,
  ).toString();
  const javascript = new URL(
    '/consuelo-lead-connector-click-to-call.js',
    origin,
  ).toString();
  return `<link rel="stylesheet" href="${css}">\n<script src="${javascript}" defer></script>\n`;
};
