import { type Response } from 'express';

type CorsOriginRule = {
  protocol: string;
  hostname: string;
  port: string;
  allowSubdomains: boolean;
};

const parseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const getNormalizedPort = (url: URL) => {
  if (url.port.length > 0) {
    return url.port;
  }

  if (url.protocol === 'https:') {
    return '443';
  }

  if (url.protocol === 'http:') {
    return '80';
  }

  return '';
};

const buildOriginRule = ({
  value,
  allowSubdomains,
}: {
  value?: string;
  allowSubdomains: boolean;
}): CorsOriginRule | null => {
  if (!value) {
    return null;
  }

  const parsed = parseUrl(value);

  if (!parsed) {
    return null;
  }

  return {
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: getNormalizedPort(parsed),
    allowSubdomains,
  };
};

const getAllowedCorsOriginRules = () => {
  const rules = [
    buildOriginRule({ value: process.env.SERVER_URL, allowSubdomains: false }),
    buildOriginRule({ value: process.env.FRONTEND_URL, allowSubdomains: true }),
    buildOriginRule({ value: process.env.PUBLIC_DOMAIN_URL, allowSubdomains: true }),
  ].filter((rule): rule is CorsOriginRule => rule !== null);

  return rules.filter(
    (rule, index, self) =>
      self.findIndex(
        (candidate) =>
          candidate.protocol === rule.protocol &&
          candidate.hostname === rule.hostname &&
          candidate.port === rule.port &&
          candidate.allowSubdomains === rule.allowSubdomains,
      ) === index,
  );
};

const isHostnameAllowed = ({
  hostname,
  rule,
}: {
  hostname: string;
  rule: CorsOriginRule;
}) => {
  return (
    hostname === rule.hostname ||
    (rule.allowSubdomains && hostname.endsWith(`.${rule.hostname}`))
  );
};

export const isCorsOriginAllowed = (origin: string | null | undefined) => {
  if (!origin) {
    return false;
  }

  const parsedOrigin = parseUrl(origin);

  if (!parsedOrigin) {
    return false;
  }

  const normalizedPort = getNormalizedPort(parsedOrigin);

  return getAllowedCorsOriginRules().some(
    (rule) =>
      parsedOrigin.protocol === rule.protocol &&
      normalizedPort === rule.port &&
      isHostnameAllowed({ hostname: parsedOrigin.hostname, rule }),
  );
};

export const applyCorsHeadersIfAllowed = ({
  response,
  origin,
  requestedHeaders,
}: {
  response: Response;
  origin: string | null | undefined;
  requestedHeaders: string | string[] | undefined;
}) => {
  if (!origin || !isCorsOriginAllowed(origin)) {
    return false;
  }

  response.header('Access-Control-Allow-Origin', origin);
  response.header('Vary', 'Origin');
  response.header('Access-Control-Allow-Credentials', 'true');
  response.header(
    'Access-Control-Allow-Headers',
    typeof requestedHeaders === 'string' && requestedHeaders.length > 0
      ? requestedHeaders
      : 'Authorization, Content-Type',
  );
  response.header(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  );

  return true;
};
