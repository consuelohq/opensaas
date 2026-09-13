import { decodeCallbackPolicy } from '@consuelo/dialer';
import type { InboundNumber, InboundEndpoint } from './telephony-contracts';

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected telephony configuration object');
  return value as Record<string, unknown>;
};
const text = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 160)
    throw new Error('Invalid telephony configuration text');
  return value;
};
const id = (value: unknown) => {
  const valueText = text(value);
  if (!/^[a-zA-Z0-9_.:-]+$/.test(valueText))
    throw new Error('Invalid telephony identity');
  return valueText;
};
const integer = (value: unknown, min: number, max: number) => {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    throw new Error('Invalid telephony configuration bound');
  return value;
};
const phone = (value: unknown) => {
  const number = text(value);
  if (!/^\+[1-9]\d{7,14}$/.test(number))
    throw new Error('Telephone endpoints require canonical E.164');
  return number;
};
const unique = (values: readonly string[]) => {
  if (new Set(values).size !== values.length)
    throw new Error('Ambiguous telephony configuration');
};
export const parseTelephonyConfig = (
  raw: string,
  accountSid: string,
): { numbers: InboundNumber[]; endpoints: InboundEndpoint[] } => {
  const config = record(JSON.parse(raw));
  if (
    config.schemaVersion !== 1 ||
    !Array.isArray(config.numbers) ||
    !Array.isArray(config.endpoints)
  )
    throw new Error('Expected telephony configuration version 1');
  if (config.numbers.length > 100 || config.endpoints.length > 1000)
    throw new Error('Telephony configuration exceeds runtime bounds');
  const numbers = config.numbers.map((value): InboundNumber => {
    const number = record(value);
    if (typeof number.enabled !== 'boolean')
      throw new Error('Number enabled must be explicit');
    const callback =
      number.callback === null || number.callback === undefined
        ? null
        : decodeCallbackPolicy(record(number.callback));
    let voicemail: InboundNumber['voicemail'] = null;
    if (number.voicemail !== null && number.voicemail !== undefined) {
      const policy = record(number.voicemail);
      voicemail = {
        disclosure: text(policy.disclosure),
        maxSeconds: integer(policy.maxSeconds, 5, 300),
        retentionMilliseconds: integer(
          policy.retentionMilliseconds,
          60000,
          90 * 86400000,
        ),
      };
    }
    return {
      numberId: id(number.numberId),
      workspaceId: id(number.workspaceId),
      queueId: id(number.queueId),
      accountSid,
      did: phone(number.did),
      enabled: number.enabled,
      maxActiveRequests: integer(number.maxActiveRequests, 1, 1000),
      callback,
      voicemail,
    };
  });
  const endpoints = config.endpoints.map((value): InboundEndpoint => {
    const endpoint = record(value);
    if (endpoint.kind !== 'browser' && endpoint.kind !== 'phone')
      throw new Error('Invalid endpoint kind');
    return {
      workspaceId: id(endpoint.workspaceId),
      repId: id(endpoint.repId),
      endpointId: id(endpoint.endpointId),
      kind: endpoint.kind,
      address:
        endpoint.kind === 'phone'
          ? phone(endpoint.address)
          : id(endpoint.address),
    };
  });
  unique(numbers.map((number) => number.numberId));
  unique(numbers.map((number) => number.did));
  unique(
    endpoints.map(
      (endpoint) =>
        endpoint.workspaceId + ':' + endpoint.repId + ':' + endpoint.endpointId,
    ),
  );
  unique(
    endpoints
      .filter((endpoint) => endpoint.kind === 'browser')
      .map((endpoint) => endpoint.address),
  );
  if (
    endpoints.some(
      (endpoint) =>
        !numbers.some((number) => number.workspaceId === endpoint.workspaceId),
    )
  )
    throw new Error('Endpoint workspace has no configured number');
  if (
    endpoints.some(
      (endpoint) =>
        endpoint.kind === 'browser' && endpoint.address !== endpoint.repId,
    )
  )
    throw new Error(
      'Browser identity must match the existing authenticated voice identity',
    );
  return { numbers, endpoints };
};
