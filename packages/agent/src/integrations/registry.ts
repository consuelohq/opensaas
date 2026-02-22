import type { IntegrationDefinition } from './types.js';

const BUILTIN: IntegrationDefinition[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'payments',
    description: 'Payment processing — charges, subscriptions, invoices, customers',
    authMethod: 'api_key',
    authConfig: {
      fields: [
        { name: 'apiKey', label: 'Secret Key', placeholder: 'sk_live_...', secret: true },
      ],
    },
    capabilities: [
      { name: 'list_charges', description: 'List recent charges', exampleCode: `const stripe = new Stripe(apiKey);\nconst charges = await stripe.charges.list({ limit: 10 });` },
      { name: 'list_subscriptions', description: 'List active subscriptions', exampleCode: `const subs = await stripe.subscriptions.list({ status: 'active' });` },
      { name: 'list_invoices', description: 'List invoices', exampleCode: `const invoices = await stripe.invoices.list({ limit: 10 });` },
      { name: 'get_customer', description: 'Retrieve customer details', exampleCode: `const customer = await stripe.customers.retrieve(customerId);` },
      { name: 'calculate_mrr', description: 'Calculate monthly recurring revenue from active subscriptions', exampleCode: `const subs = await stripe.subscriptions.list({ status: 'active' });\nconst mrr = subs.data.reduce((sum, s) => sum + (s.items.data[0]?.price?.unit_amount ?? 0), 0) / 100;` },
    ],
    sdkPackage: 'stripe',
    envVarPrefix: 'STRIPE',
    docsUrl: 'https://docs.stripe.com/api',
    iconUrl: 'https://cdn.brandfetch.io/stripe.com/icon',
  },
  {
    id: 'google-maps',
    name: 'Google Maps',
    category: 'maps',
    description: 'Places search, geocoding, business details',
    authMethod: 'api_key',
    authConfig: {
      fields: [
        { name: 'apiKey', label: 'API Key', placeholder: 'AIza...', secret: true },
      ],
    },
    capabilities: [
      { name: 'search_places', description: 'Search for businesses and places', exampleCode: `const res = await fetch(\`https://maps.googleapis.com/maps/api/place/textsearch/json?query=\${q}&key=\${apiKey}\`);` },
      { name: 'geocode', description: 'Convert address to coordinates', exampleCode: `const res = await fetch(\`https://maps.googleapis.com/maps/api/geocode/json?address=\${addr}&key=\${apiKey}\`);` },
      { name: 'place_details', description: 'Get detailed info about a place', exampleCode: `const res = await fetch(\`https://maps.googleapis.com/maps/api/place/details/json?place_id=\${id}&key=\${apiKey}\`);` },
    ],
    sdkPackage: null,
    envVarPrefix: 'GOOGLE_MAPS',
    docsUrl: 'https://developers.google.com/maps/documentation',
    iconUrl: 'https://cdn.brandfetch.io/google.com/icon',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'crm',
    description: 'CRM — contacts, deals, companies, notes, activities',
    authMethod: 'oauth2',
    authConfig: {
      authUrl: 'https://app.hubspot.com/oauth/authorize',
      tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
      scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.deals.read', 'crm.objects.deals.write'],
      pkce: false,
    },
    capabilities: [
      { name: 'list_contacts', description: 'List CRM contacts', exampleCode: `const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', { headers: { Authorization: \`Bearer \${token}\` } });` },
      { name: 'create_deal', description: 'Create a new deal', exampleCode: `await fetch('https://api.hubapi.com/crm/v3/objects/deals', { method: 'POST', headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' }, body: JSON.stringify({ properties: { dealname, amount } }) });` },
      { name: 'add_note', description: 'Add a note to a contact or deal', exampleCode: `await fetch('https://api.hubapi.com/crm/v3/objects/notes', { method: 'POST', headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' }, body: JSON.stringify({ properties: { hs_note_body: content } }) });` },
    ],
    sdkPackage: '@hubspot/api-client',
    envVarPrefix: 'HUBSPOT',
    docsUrl: 'https://developers.hubspot.com/docs/api',
    iconUrl: 'https://cdn.brandfetch.io/hubspot.com/icon',
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'communication',
    description: 'Team messaging — send messages, list channels, notifications',
    authMethod: 'oauth2',
    authConfig: {
      authUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      scopes: ['chat:write', 'channels:read'],
      pkce: false,
    },
    capabilities: [
      { name: 'send_message', description: 'Send a message to a channel', exampleCode: `await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' }, body: JSON.stringify({ channel, text }) });` },
      { name: 'list_channels', description: 'List available channels', exampleCode: `const res = await fetch('https://slack.com/api/conversations.list', { headers: { Authorization: \`Bearer \${token}\` } });` },
    ],
    sdkPackage: '@slack/web-api',
    envVarPrefix: 'SLACK',
    docsUrl: 'https://api.slack.com/methods',
    iconUrl: 'https://cdn.brandfetch.io/slack.com/icon',
  },
  {
    id: 'twilio',
    name: 'Twilio',
    category: 'communication',
    description: 'Voice calls, SMS, phone number lookup',
    authMethod: 'api_key',
    authConfig: {
      fields: [
        { name: 'accountSid', label: 'Account SID', placeholder: 'AC...', secret: false },
        { name: 'authToken', label: 'Auth Token', placeholder: '...', secret: true },
      ],
    },
    capabilities: [
      { name: 'send_sms', description: 'Send an SMS message', exampleCode: `const client = new (await import('twilio')).default(accountSid, authToken);\nawait client.messages.create({ body: text, from: fromNumber, to: toNumber });` },
      { name: 'lookup_phone', description: 'Look up phone number info', exampleCode: `const lookup = await twilio.lookups.v2.phoneNumbers(number).fetch();` },
      { name: 'list_calls', description: 'List recent calls', exampleCode: `const calls = await twilio.calls.list({ limit: 20 });` },
    ],
    sdkPackage: 'twilio',
    envVarPrefix: 'TWILIO',
    docsUrl: 'https://www.twilio.com/docs/api',
    iconUrl: 'https://cdn.brandfetch.io/twilio.com/icon',
  },
  {
    id: 'apollo',
    name: 'Apollo.io',
    category: 'enrichment',
    description: 'Contact enrichment, company data, email finder',
    authMethod: 'api_key',
    authConfig: {
      fields: [
        { name: 'apiKey', label: 'API Key', placeholder: '...', secret: true },
      ],
    },
    capabilities: [
      { name: 'enrich_contact', description: 'Enrich a contact with firmographic data', exampleCode: `const res = await fetch('https://api.apollo.io/v1/people/match', { method: 'POST', headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });` },
      { name: 'search_people', description: 'Search for people by title, company, location', exampleCode: `const res = await fetch('https://api.apollo.io/v1/mixed_people/search', { method: 'POST', headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ person_titles: [title] }) });` },
      { name: 'find_email', description: 'Find email address for a person', exampleCode: `const res = await fetch('https://api.apollo.io/v1/people/match', { method: 'POST', headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ first_name, last_name, organization_name }) });` },
    ],
    sdkPackage: null,
    envVarPrefix: 'APOLLO',
    docsUrl: 'https://apolloio.github.io/apollo-api-docs',
    iconUrl: 'https://cdn.brandfetch.io/apollo.io/icon',
  },
  {
    id: 'clearbit',
    name: 'Clearbit',
    category: 'enrichment',
    description: 'Company and person enrichment from email or domain',
    authMethod: 'bearer',
    authConfig: {
      fields: [
        { name: 'apiKey', label: 'API Key', placeholder: 'sk_...', secret: true },
      ],
    },
    capabilities: [
      { name: 'enrich_company', description: 'Enrich company data from domain', exampleCode: `const res = await fetch(\`https://company.clearbit.com/v2/companies/find?domain=\${domain}\`, { headers: { Authorization: \`Bearer \${apiKey}\` } });` },
      { name: 'enrich_person', description: 'Enrich person data from email', exampleCode: `const res = await fetch(\`https://person.clearbit.com/v2/people/find?email=\${email}\`, { headers: { Authorization: \`Bearer \${apiKey}\` } });` },
    ],
    sdkPackage: null,
    envVarPrefix: 'CLEARBIT',
    docsUrl: 'https://dashboard.clearbit.com/docs',
    iconUrl: 'https://cdn.brandfetch.io/clearbit.com/icon',
  },
  {
    id: 'gohighlevel',
    name: 'GoHighLevel',
    category: 'crm',
    description: 'CRM — contacts, deals, companies, notes, activities',
    authMethod: 'oauth2',
    authConfig: {
      authUrl: 'https://marketplace.gohighlevel.com/oauth/chooselocation',
      tokenUrl: 'https://services.leadconnectorhq.com/oauth/token',
      scopes: ['contacts.readonly', 'contacts.write', 'opportunities.readonly', 'opportunities.write'],
      pkce: true,
    },
    capabilities: [
      { name: 'list_contacts', description: 'List CRM contacts', exampleCode: `const res = await fetch('https://services.leadconnectorhq.com/contacts/', { headers: { Authorization: \`Bearer \${token}\`, Version: '2021-07-28' } });` },
      { name: 'create_opportunity', description: 'Create a deal/opportunity', exampleCode: `await fetch('https://services.leadconnectorhq.com/opportunities/', { method: 'POST', headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json', Version: '2021-07-28' }, body: JSON.stringify({ pipelineId, name, status: 'open', contactId }) });` },
      { name: 'add_note', description: 'Add a note to a contact', exampleCode: `await fetch(\`https://services.leadconnectorhq.com/contacts/\${contactId}/notes\`, { method: 'POST', headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json', Version: '2021-07-28' }, body: JSON.stringify({ body: content }) });` },
    ],
    sdkPackage: null,
    envVarPrefix: 'GHL',
    docsUrl: 'https://highlevel.stoplight.io/docs/integrations',
    iconUrl: 'https://cdn.brandfetch.io/gohighlevel.com/icon',
  },
];

export const INTEGRATION_REGISTRY: Map<string, IntegrationDefinition> = new Map(
  BUILTIN.map((def) => [def.id, def]),
);

// format connected integrations for agent system prompt
export const formatIntegrationContext = (
  connectedIds: string[],
): string => {
  const lines = connectedIds
    .map((id) => INTEGRATION_REGISTRY.get(id))
    .filter((definition): definition is IntegrationDefinition => definition !== undefined)
    .map((definition) => {
      const capabilityNames = definition.capabilities.map((capability) => capability.name.replace(/_/g, ' ')).join(', ');
      return `- ${definition.name} (${definition.category}): ${capabilityNames}`;
    });

  return lines.length > 0
    ? `\nAvailable integrations:\n${lines.join('\n')}`
    : '';
};
