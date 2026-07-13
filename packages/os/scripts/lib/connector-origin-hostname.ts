import { createHash } from 'node:crypto';

const CONNECTOR_ID_PATTERN = /^[a-z0-9](?:[a-z0-9._:-]{0,253}[a-z0-9])?$/;
const CONNECTOR_ORIGIN_DIGEST_HEX_LENGTH = 32;
const CONNECTOR_ORIGIN_LABEL_PATTERN = /^c-[0-9a-f]{32}$/;
const DNS_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const MAX_DNS_HOSTNAME_LENGTH = 253;

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const normalizeConnectorOriginBaseDomain = (baseDomain: string): string => {
  const normalized = baseDomain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  const labels = normalized.split('.');

  if (
    normalized.length > MAX_DNS_HOSTNAME_LENGTH ||
    labels.length < 2 ||
    labels.some((label) => !DNS_LABEL_PATTERN.test(label))
  ) {
    throw new Error('base domain must be a valid DNS hostname');
  }

  return normalized;
};

const normalizeConnectorId = (connectorId: string): string => {
  const normalized = connectorId.trim().toLowerCase();
  if (!CONNECTOR_ID_PATTERN.test(normalized)) {
    throw new Error('connector id must be a stable DNS-independent identifier');
  }
  return normalized;
};

export const createConnectorOriginHostnameRegexSource = (input: {
  baseDomain: string;
}): string => {
  const baseDomain = normalizeConnectorOriginBaseDomain(input.baseDomain);
  return `^c-[0-9a-f]{${CONNECTOR_ORIGIN_DIGEST_HEX_LENGTH}}\\.${escapeRegex(baseDomain)}$`;
};

export const createConnectorOriginHostname = (input: {
  connectorId: string;
  baseDomain: string;
}): string => {
  const connectorId = normalizeConnectorId(input.connectorId);
  const baseDomain = normalizeConnectorOriginBaseDomain(input.baseDomain);
  const digest = createHash('sha256')
    .update(`consuelo:connector-origin:v1\0${connectorId}`)
    .digest('hex')
    .slice(0, CONNECTOR_ORIGIN_DIGEST_HEX_LENGTH);
  const label = `c-${digest}`;
  const hostname = `${label}.${baseDomain}`;

  if (
    !CONNECTOR_ORIGIN_LABEL_PATTERN.test(label) ||
    label.length > 63 ||
    hostname.length > MAX_DNS_HOSTNAME_LENGTH
  ) {
    throw new Error('connector origin hostname exceeds DNS limits');
  }

  return hostname;
};

export const isConnectorOriginHostname = (input: {
  hostname: string;
  baseDomain: string;
}): boolean => {
  const hostname = input.hostname.trim().toLowerCase();
  return new RegExp(
    createConnectorOriginHostnameRegexSource({ baseDomain: input.baseDomain }),
  ).test(hostname);
};
