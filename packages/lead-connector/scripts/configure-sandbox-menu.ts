import { upsertLeadConnectorSandboxMenu } from '../src/deployment/custom-menu.js';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const result = await upsertLeadConnectorSandboxMenu({
  accessToken: required('LEADCONNECTOR_SANDBOX_ACCESS_TOKEN'),
  locationId: required('LEADCONNECTOR_SANDBOX_LOCATION_ID'),
  embedUrl: required('LEADCONNECTOR_SANDBOX_EMBED_URL'),
});

process.stdout.write(
  `${JSON.stringify({
    ok: true,
    action: result.action,
    customMenuId: result.customMenuId,
  })}\n`,
);
