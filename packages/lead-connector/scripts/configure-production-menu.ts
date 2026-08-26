import { updateLeadConnectorProductionMenu } from '../src/deployment/custom-menu.js';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const result = await updateLeadConnectorProductionMenu({
  accessToken: required('LEADCONNECTOR_PRODUCTION_PRIVATE_INTEGRATION_TOKEN'),
  customMenuId: required('LEADCONNECTOR_PRODUCTION_CUSTOM_MENU_ID'),
  locationId: required('LEADCONNECTOR_PRODUCTION_LOCATION_ID'),
  embedUrl: required('LEADCONNECTOR_PRODUCTION_EMBED_URL'),
});

process.stdout.write(
  `${JSON.stringify({
    ok: true,
    customMenuId: result.customMenuId,
    readBackVerified: true,
    url: result.menu.url,
  })}\n`,
);
