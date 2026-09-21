import { createHash, createHmac } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  isInboundQueueOpen,
  isRepCapacityEligible,
  type InboundQueuePolicy,
  type RepCapacityState,
} from '@consuelo/dialer';

import type {
  CallbackBookingRead,
  CallbackConsentAdapter,
  createPostgresCallbacks,
} from './callbacks';
import { withInboundTransaction } from './postgres-journal';
import { resolveInboundEnrichment } from './enrichment';
import type { InboundEnrichment, InboundNumber } from './telephony-contracts';

export type CustomerServiceWindow = {
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
};

export type InboundCustomerSnapshot = {
  publicId: string;
  phoneNumber: string;
  timezone: string;
  staffAvailableNow: boolean;
  callback: {
    available: boolean;
    disclosure: string | null;
    serviceWindows: CustomerServiceWindow[];
  };
};

export type CustomerCallbackResult = {
  managementToken: string;
  callback: {
    status: string;
    notBefore: string;
    deadline: string;
  };
  booking: CallbackBookingRead;
};

type CallbackService = ReturnType<typeof createPostgresCallbacks>;
type PublicCallbackInput = {
  phoneNumber: string;
  permissionAccepted: true;
  idempotencyKey: string;
  mode: 'immediate' | 'scheduled';
  serviceWindowId?: string;
};

type AdmissionRow = {
  workspace_id: string;
  number_id: string;
  request_key: string;
  request_digest: string;
  client_hash: string;
  callback_id: string;
  timezone: string;
  not_before: Date;
  deadline: Date;
  accepted_at: Date;
  management_token_hash: string;
  management_expires_at: Date;
};

type LocalDate = { year: number; month: number; day: number };
type Window = { startsAt: string; endsAt: string };

const DAY = 86_400_000;
const WINDOW_HORIZON_DAYS = 14;
const idPattern = /^[A-Za-z0-9_.:-]{1,160}$/;
const e164Pattern = /^\+[1-9]\d{7,14}$/;
const keyPattern = /^[A-Za-z0-9_.:-]{8,128}$/;

const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const hmac = (secret: string, purpose: string, parts: readonly string[]) =>
  createHmac('sha256', secret)
    .update(JSON.stringify([purpose, ...parts]))
    .digest('base64url');
const plus = (value: string, milliseconds: number) =>
  new Date(Date.parse(value) + milliseconds).toISOString();

const localParts = (at: number, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(at));
  const part = (name: string) =>
    parts.find((candidate) => candidate.type === name)!.value;
  return {
    year: Number(part('year')),
    month: Number(part('month')),
    day: Number(part('day')),
    hour: Number(part('hour')),
    minute: Number(part('minute')),
    second: Number(part('second')),
  };
};

const timezoneOffset = (at: number, timezone: string): number => {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(new Date(at))
    .find((part) => part.type === 'timeZoneName')?.value;
  if (!name || name === 'GMT' || name === 'UTC') return 0;
  const match = name.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) throw new Error('Timezone offset could not be resolved');
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return (match[1] === '+' ? 1 : -1) * minutes * 60_000;
};

const addLocalDays = (date: LocalDate, days: number): LocalDate => {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
};

const localDate = (at: string, timezone: string): LocalDate => {
  const parts = localParts(Date.parse(at), timezone);
  return { year: parts.year, month: parts.month, day: parts.day };
};

const dateKey = (date: LocalDate) =>
  `${date.year.toString().padStart(4, '0')}-${date.month
    .toString()
    .padStart(2, '0')}-${date.day.toString().padStart(2, '0')}`;

const localInstant = (
  date: LocalDate,
  minute: number,
  timezone: string,
  boundary: 'start' | 'end',
): string | null => {
  const adjusted = minute === 1440 ? addLocalDays(date, 1) : date;
  const adjustedMinute = minute === 1440 ? 0 : minute;
  const hour = Math.floor(adjustedMinute / 60);
  const localMinute = adjustedMinute % 60;
  const naive = Date.UTC(
    adjusted.year,
    adjusted.month - 1,
    adjusted.day,
    hour,
    localMinute,
  );
  const offsets = new Set(
    [-DAY, 0, DAY].map((delta) => timezoneOffset(naive + delta, timezone)),
  );
  const candidates = [...offsets]
    .map((offset) => naive - offset)
    .filter((candidate) => {
      const parts = localParts(candidate, timezone);
      return (
        parts.year === adjusted.year &&
        parts.month === adjusted.month &&
        parts.day === adjusted.day &&
        parts.hour === hour &&
        parts.minute === localMinute
      );
    })
    .sort((left, right) => left - right);
  const selected = boundary === 'start' ? candidates[0] : candidates.at(-1);
  return selected === undefined ? null : new Date(selected).toISOString();
};

const serviceWindows = (
  policy: InboundQueuePolicy,
  at: string,
): Window[] => {
  if (policy.emergencyClosed) return [];
  const first = localDate(at, policy.timezone);
  const result: Window[] = [];
  for (let offset = 0; offset <= WINDOW_HORIZON_DAYS; offset++) {
    const date = addLocalDays(first, offset);
    if (policy.closedDates.includes(dateKey(date))) continue;
    const day = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
    for (const window of policy.weekly.filter((candidate) => candidate.day === day)) {
      if (window.startMinute >= window.endMinute) continue;
      const startsAt = localInstant(
        date,
        window.startMinute,
        policy.timezone,
        'start',
      );
      const endsAt = localInstant(date, window.endMinute, policy.timezone, 'end');
      if (!startsAt || !endsAt || startsAt >= endsAt || endsAt <= at) continue;
      result.push({ startsAt, endsAt });
    }
  }
  return result.sort((left, right) => left.startsAt.localeCompare(right.startsAt));
};

const windowLabel = (window: Window, timezone: string) => {
  const start = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(window.startsAt));
  const end = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(window.endsAt));
  return `${start}–${end}`;
};

const requireSecret = (secret: string) => {
  if (secret.trim().length < 32)
    throw new Error('Customer entry capability secret must be at least 32 characters');
  return secret;
};

const requirePublicInput = (input: PublicCallbackInput) => {
  if (
    !e164Pattern.test(input.phoneNumber) ||
    input.permissionAccepted !== true ||
    !keyPattern.test(input.idempotencyKey) ||
    (input.mode !== 'immediate' && input.mode !== 'scheduled') ||
    (input.mode === 'scheduled' && !input.serviceWindowId) ||
    (input.mode === 'immediate' && input.serviceWindowId !== undefined)
  )
    throw new Error('CUSTOMER_CALLBACK_INVALID');
};

const readQueuePolicy = async (
  pool: Pool,
  number: InboundNumber,
): Promise<InboundQueuePolicy> => {
  try {
    const result = await pool.query<{ policy: InboundQueuePolicy }>(
      'SELECT policy FROM dialer_routing_queues WHERE workspace_id=$1 AND queue_id=$2',
      [number.workspaceId, number.queueId],
    );
    if (!result.rows[0]) throw new Error('Customer callback queue is unavailable');
    return result.rows[0].policy;
  } catch (cause: unknown) {
    if (cause instanceof Error) throw cause;
    throw new Error('Customer queue read rejected with a non-Error cause', { cause });
  }
};

const authorityTime = async (
  client: PoolClient,
  clock?: () => string,
): Promise<string> => {
  try {
    if (clock) return clock();
    const result = await client.query<{ now: Date }>(
      'SELECT clock_timestamp() AS now',
    );
    return result.rows[0]!.now.toISOString();
  } catch (cause: unknown) {
    if (cause instanceof Error) throw cause;
    throw new Error('Customer authority time rejected with a non-Error cause', {
      cause,
    });
  }
};

export const createCustomerEntryConsentAdapter = (options: {
  pool: Pool;
  clock?: () => string;
}): CallbackConsentAdapter =>
  async (input) => {
    try {
      const result = await options.pool.query<{
        activation_reference: string;
        evidence_reference: string;
        accepted_at: Date;
        expires_at: Date;
      }>(
        `SELECT activation_reference,evidence_reference,accepted_at,expires_at
         FROM dialer_customer_callback_consents
         WHERE workspace_id=$1 AND callback_id=$2 AND consent_reference=$3`,
        [input.workspaceId, input.callbackId, input.consentReference],
      );
      const row = result.rows[0];
      if (!row)
        return { allowed: false, evidenceReference: null, reason: 'missing' };
      if (row.activation_reference !== input.activationReference)
        return {
          allowed: false,
          evidenceReference: null,
          reason: 'policy_unavailable',
        };
      if (input.requestedAt > row.expires_at.toISOString())
        return { allowed: false, evidenceReference: null, reason: 'expired' };
      if (input.requestedAt < row.accepted_at.toISOString())
        return { allowed: false, evidenceReference: null, reason: 'missing' };
      return {
        allowed: true,
        evidenceReference: row.evidence_reference,
        reason: 'allowed',
      };
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Customer consent lookup rejected with a non-Error cause', {
        cause,
      });
    }
  };

export const createInboundCustomerApplication = (options: {
  pool: Pool;
  numbers: readonly InboundNumber[];
  callbacks: CallbackService | null;
  secret: string;
  clock?: () => string;
  enrich?: InboundEnrichment;
}) => {
  const secret = requireSecret(options.secret);
  const entries = new Map(
    options.numbers
      .filter((number) => number.enabled && number.customerEntry)
      .map((number) => [number.customerEntry!.publicId, number]),
  );
  if (entries.size !== options.numbers.filter((number) => number.enabled && number.customerEntry).length)
    throw new Error('Customer entry public identity is ambiguous');

  const entry = (publicId: string) => {
    if (!idPattern.test(publicId)) throw new Error('Customer entry unavailable');
    const number = entries.get(publicId);
    if (!number) throw new Error('Customer entry unavailable');
    return number;
  };

  const currentTime = () => options.clock?.() ?? new Date().toISOString();
  const windowId = (
    publicId: string,
    policy: InboundQueuePolicy,
    window: Window,
  ) =>
    'window_' +
    hmac(secret, 'service-window', [
      publicId,
      policy.policyVersion,
      window.startsAt,
      window.endsAt,
    ]);
  const publicWindows = (
    publicId: string,
    policy: InboundQueuePolicy,
    at: string,
  ): CustomerServiceWindow[] =>
    serviceWindows(policy, at)
      .filter((window) => window.startsAt > at)
      .map((window) => ({
        id: windowId(publicId, policy, window),
        label: windowLabel(window, policy.timezone),
        startsAt: window.startsAt,
        endsAt: window.endsAt,
      }));

  const staffAvailable = async (
    number: InboundNumber,
    policy: InboundQueuePolicy,
    at: string,
  ): Promise<boolean> => {
    try {
      if (!isInboundQueueOpen(policy, at) || policy.profiles.length === 0)
        return false;
      const result = await options.pool.query<{ snapshot: RepCapacityState }>(
        'SELECT snapshot FROM dialer_rep_capacity WHERE workspace_id=$1 ORDER BY capacity_id LIMIT 1001',
        [number.workspaceId],
      );
      if (result.rows.length > 1000)
        throw new Error('Customer capacity snapshot exceeds bound');
      const members = new Set(policy.profiles.map((profile) => profile.repId));
      return result.rows.some(
        ({ snapshot }) =>
          members.has(snapshot.repId) && isRepCapacityEligible(snapshot, at),
      );
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Customer availability rejected with a non-Error cause', {
        cause,
      });
    }
  };

  const snapshot = async (publicId: string): Promise<InboundCustomerSnapshot> => {
    try {
      const number = entry(publicId);
      const policy = await readQueuePolicy(options.pool, number);
      const at = currentTime();
      const windows = number.callback ? serviceWindows(policy, at) : [];
      const available = Boolean(number.callback && windows.length > 0);
      return {
        publicId,
        phoneNumber: number.did,
        timezone: policy.timezone,
        staffAvailableNow: await staffAvailable(number, policy, at),
        callback: {
          available,
          disclosure: available ? number.callback!.disclosure : null,
          serviceWindows: available ? publicWindows(publicId, policy, at) : [],
        },
      };
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Customer snapshot rejected with a non-Error cause', {
        cause,
      });
    }
  };

  const requestKey = (number: InboundNumber, idempotencyKey: string) =>
    hmac(secret, 'request-key', [
      number.workspaceId,
      number.numberId,
      idempotencyKey,
    ]);
  const requestDigest = (publicId: string, input: PublicCallbackInput) =>
    hmac(secret, 'request-digest', [
      publicId,
      input.phoneNumber,
      input.mode,
      input.serviceWindowId ?? '',
      String(input.permissionAccepted),
    ]);
  const clientHash = (publicId: string, clientAddress: string) =>
    hmac(secret, 'client', [publicId, clientAddress || 'unknown']);
  const callbackIdFor = (requestKeyValue: string) =>
    'customer:' + hash(requestKeyValue).slice(0, 56);
  const requestIdFor = (callbackId: string) =>
    'customer-request:' + hash(callbackId).slice(0, 48);
  const consentReferenceFor = (callbackId: string) =>
    'customer-consent:' + hash(callbackId).slice(0, 48);
  const evidenceReferenceFor = (callbackId: string) =>
    'customer-evidence:' + hash(callbackId).slice(0, 48);
  const operationIdFor = (callbackId: string) =>
    'customer-create:' + hash(callbackId).slice(0, 48);
  const tokenFor = (row: Pick<AdmissionRow, 'workspace_id' | 'number_id' | 'callback_id' | 'accepted_at'>) =>
    hmac(secret, 'management', [
      row.workspace_id,
      row.number_id,
      row.callback_id,
      row.accepted_at.toISOString(),
    ]);

  const findAdmission = async (
    number: InboundNumber,
    requestKeyValue: string,
  ): Promise<AdmissionRow | null> => {
    try {
      const result = await options.pool.query<AdmissionRow>(
        `SELECT * FROM dialer_customer_callback_admission
         WHERE workspace_id=$1 AND number_id=$2 AND request_key=$3`,
        [number.workspaceId, number.numberId, requestKeyValue],
      );
      return result.rows[0] ?? null;
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Customer admission read rejected with a non-Error cause', {
        cause,
      });
    }
  };

  const selectWindow = async (
    publicId: string,
    number: InboundNumber,
    input: PublicCallbackInput,
  ) => {
    try {
      if (!number.callback || !options.callbacks)
        throw new Error('CUSTOMER_CALLBACK_INVALID');
      const policy = await readQueuePolicy(options.pool, number);
      const at = currentTime();
      const windows = serviceWindows(policy, at);
      if (input.mode === 'immediate') {
        const selected =
          windows.find((window) => window.startsAt <= at && at < window.endsAt) ??
          windows.find((window) => window.startsAt > at);
        if (!selected) throw new Error('CUSTOMER_CALLBACK_INVALID');
        const notBefore = selected.startsAt <= at ? at : selected.startsAt;
        const deadline = [
          selected.endsAt,
          plus(notBefore, number.callback.immediateWindowMilliseconds),
        ].sort()[0]!;
        if (deadline <= notBefore) throw new Error('CUSTOMER_CALLBACK_INVALID');
        return { policy, notBefore, deadline };
      }
      const selected = publicWindows(publicId, policy, at).find(
        (window) => window.id === input.serviceWindowId,
      );
      if (!selected) throw new Error('CUSTOMER_CALLBACK_INVALID');
      return {
        policy,
        notBefore: selected.startsAt,
        deadline: selected.endsAt,
      };
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Customer service window rejected with a non-Error cause', {
        cause,
      });
    }
  };

  const admit = async (
    publicId: string,
    number: InboundNumber,
    clientAddress: string,
    schedule: { policy: InboundQueuePolicy; notBefore: string; deadline: string },
    requestKeyValue: string,
    digest: string,
  ): Promise<AdmissionRow> => {
    try {
      return await withInboundTransaction(
        options.pool,
        number.workspaceId,
        async (client) => {
          try {
            const existing = await client.query<AdmissionRow>(
              `SELECT * FROM dialer_customer_callback_admission
               WHERE workspace_id=$1 AND number_id=$2 AND request_key=$3`,
              [number.workspaceId, number.numberId, requestKeyValue],
            );
            if (existing.rows[0]) {
              if (existing.rows[0].request_digest !== digest)
                throw new Error('CUSTOMER_CALLBACK_INVALID');
              return existing.rows[0];
            }
            const policy = number.customerEntry!;
            const acceptedAt = await authorityTime(client, options.clock);
            const since = plus(acceptedAt, -policy.rateWindowMilliseconds);
            const clientFingerprint = clientHash(publicId, clientAddress);
            const counts = await client.query<{
              client_count: string;
              number_count: string;
            }>(
              `SELECT
                count(*) FILTER (WHERE client_hash=$4)::text AS client_count,
                count(*)::text AS number_count
               FROM dialer_customer_callback_admission
               WHERE workspace_id=$1 AND number_id=$2 AND accepted_at >= $3::timestamptz`,
              [number.workspaceId, number.numberId, since, clientFingerprint],
            );
            if (
              Number(counts.rows[0]?.client_count ?? 0) >=
                policy.maxRequestsPerClient ||
              Number(counts.rows[0]?.number_count ?? 0) >=
                policy.maxRequestsPerNumber
            )
              throw new Error('CUSTOMER_CALLBACK_RATE_LIMITED');

            const callbackId = callbackIdFor(requestKeyValue);
            const managementExpiresAt = plus(
              schedule.deadline,
              number.callback!.recipientRetentionMilliseconds,
            );
            const token = hmac(secret, 'management', [
              number.workspaceId,
              number.numberId,
              callbackId,
              acceptedAt,
            ]);
            await client.query(
              `INSERT INTO dialer_customer_callback_admission(
                workspace_id,number_id,request_key,request_digest,client_hash,callback_id,
                timezone,not_before,deadline,accepted_at,management_token_hash,management_expires_at
               ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
              [
                number.workspaceId,
                number.numberId,
                requestKeyValue,
                digest,
                clientFingerprint,
                callbackId,
                schedule.policy.timezone,
                schedule.notBefore,
                schedule.deadline,
                acceptedAt,
                hash(token),
                managementExpiresAt,
              ],
            );
            await client.query(
              `INSERT INTO dialer_customer_callback_consents(
                workspace_id,consent_reference,callback_id,number_id,activation_reference,
                evidence_reference,disclosure_hash,accepted_at,expires_at
               ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
              [
                number.workspaceId,
                consentReferenceFor(callbackId),
                callbackId,
                number.numberId,
                number.callback!.activationReference,
                evidenceReferenceFor(callbackId),
                hash(number.callback!.disclosure),
                acceptedAt,
                managementExpiresAt,
              ],
            );
            const inserted = await client.query<AdmissionRow>(
              `SELECT * FROM dialer_customer_callback_admission
               WHERE workspace_id=$1 AND number_id=$2 AND request_key=$3`,
              [number.workspaceId, number.numberId, requestKeyValue],
            );
            return inserted.rows[0]!;
          } catch (cause: unknown) {
            if (cause instanceof Error) throw cause;
            throw new Error(
              'Customer admission transaction rejected with a non-Error cause',
              { cause },
            );
          }
        },
      );
    } catch (cause: unknown) {
      if (cause instanceof Error && cause.cause instanceof Error)
        throw cause.cause;
      if (cause instanceof Error) throw cause;
      throw new Error('Customer admission rejected with a non-Error cause', {
        cause,
      });
    }
  };

  const ensureCallback = async (
    number: InboundNumber,
    row: AdmissionRow,
    recipient: string,
  ) => {
    try {
      if (!number.callback || !options.callbacks)
        throw new Error('CUSTOMER_CALLBACK_INVALID');
      const current = await options.callbacks.read(
        number.workspaceId,
        row.callback_id,
      );
      if (current) return current;
      const metadata = await resolveInboundEnrichment(options.enrich, {
        workspaceId: number.workspaceId,
        caller: recipient,
      });
      await options.callbacks.request({
        operationId: operationIdFor(row.callback_id),
        workspaceId: number.workspaceId,
        callbackId: row.callback_id,
        requestId: requestIdFor(row.callback_id),
        sourceRequestId: null,
        numberId: number.numberId,
        queueId: number.queueId,
        originalEnteredAt: row.accepted_at.toISOString(),
        consentReference: consentReferenceFor(row.callback_id),
        recipient,
        timezone: row.timezone,
        notBefore: row.not_before.toISOString(),
        deadline: row.deadline.toISOString(),
        metadata: {
          requiredSkills: metadata.requiredSkills,
          ownerRepId: metadata.ownerRepId,
          ownerStatus: metadata.ownerStatus,
        },
        policy: number.callback,
      });
      const created = await options.callbacks.read(
        number.workspaceId,
        row.callback_id,
      );
      if (!created) throw new Error('CUSTOMER_CALLBACK_INVALID');
      return created;
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Customer callback creation rejected with a non-Error cause', {
        cause,
      });
    }
  };

  const bookingFor = async (
    number: InboundNumber,
    callbackId: string,
    revision: number,
    ensure: boolean,
  ): Promise<CallbackBookingRead> => {
    try {
      if (!options.callbacks)
        return {
          status: 'unavailable',
          providerReference: null,
          evidenceReference: null,
        };
      const existing = await options.callbacks.readBooking(
        number.workspaceId,
        callbackId,
        revision,
      );
      if (existing) return existing;
      if (ensure) return await options.callbacks.book(number.workspaceId, callbackId);
      return {
        status: 'unavailable',
        providerReference: null,
        evidenceReference: null,
      };
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Customer booking lookup rejected with a non-Error cause', {
        cause,
      });
    }
  };

  const resultFor = async (
    number: InboundNumber,
    row: AdmissionRow,
    token: string,
    ensureBooking = false,
  ): Promise<CustomerCallbackResult> => {
    try {
      if (!options.callbacks) throw new Error('CUSTOMER_CALLBACK_INVALID');
      const callback = await options.callbacks.read(
        number.workspaceId,
        row.callback_id,
      );
      if (!callback || callback.numberId !== number.numberId)
        throw new Error('CUSTOMER_CALLBACK_INVALID');
      return {
        managementToken: token,
        callback: {
          status: callback.state.status,
          notBefore: callback.state.notBefore,
          deadline: callback.state.deadline,
        },
        booking: await bookingFor(number, row.callback_id, callback.state.revision, ensureBooking),
      };
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Customer callback result rejected with a non-Error cause', {
        cause,
      });
    }
  };

  const requestCallback = async (
    publicId: string,
    clientAddress: string,
    input: PublicCallbackInput,
  ): Promise<CustomerCallbackResult> => {
    try {
      requirePublicInput(input);
      const number = entry(publicId);
      if (!number.callback || !number.customerEntry || !options.callbacks)
        throw new Error('CUSTOMER_CALLBACK_INVALID');
      const key = requestKey(number, input.idempotencyKey);
      const digest = requestDigest(publicId, input);
      let row = await findAdmission(number, key);
      if (row && row.request_digest !== digest)
        throw new Error('CUSTOMER_CALLBACK_INVALID');
      if (!row) {
        const schedule = await selectWindow(publicId, number, input);
        row = await admit(
          publicId,
          number,
          clientAddress,
          schedule,
          key,
          digest,
        );
      }
      await ensureCallback(number, row, input.phoneNumber);
      return resultFor(number, row, tokenFor(row), true);
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Customer callback request rejected with a non-Error cause', {
        cause,
      });
    }
  };

  const capability = async (
    publicId: string,
    token: string,
  ): Promise<{ number: InboundNumber; row: AdmissionRow }> => {
    try {
      const number = entry(publicId);
      const at = currentTime();
      const result = await options.pool.query<AdmissionRow>(
        `SELECT * FROM dialer_customer_callback_admission
         WHERE workspace_id=$1 AND number_id=$2 AND management_token_hash=$3
           AND management_expires_at>$4::timestamptz`,
        [number.workspaceId, number.numberId, hash(token), at],
      );
      const row = result.rows[0];
      if (!row || tokenFor(row) !== token)
        throw new Error('Customer callback capability is invalid');
      return { number, row };
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Customer capability rejected with a non-Error cause', {
        cause,
      });
    }
  };

  const readCallback = async (publicId: string, token: string) => {
    try {
      const resolved = await capability(publicId, token);
      return resultFor(resolved.number, resolved.row, token);
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Customer callback read rejected with a non-Error cause', {
        cause,
      });
    }
  };

  const rescheduleCallback = async (
    publicId: string,
    token: string,
    serviceWindowId: string,
  ) => {
    try {
      const { number, row } = await capability(publicId, token);
      if (!number.callback || !options.callbacks)
        throw new Error('CUSTOMER_CALLBACK_INVALID');
      const policy = await readQueuePolicy(options.pool, number);
      const at = currentTime();
      const selected = publicWindows(publicId, policy, at).find(
        (window) => window.id === serviceWindowId,
      );
      if (!selected) throw new Error('CUSTOMER_CALLBACK_INVALID');
      const current = await options.callbacks.read(
        number.workspaceId,
        row.callback_id,
      );
      if (!current) throw new Error('CUSTOMER_CALLBACK_INVALID');
      const operationId =
        'customer-reschedule:' +
        hash(
          `${row.callback_id}:${current.state.revision}:${serviceWindowId}`,
        ).slice(0, 48);
      const alreadySelected =
        current.state.timezone === policy.timezone &&
        current.state.notBefore === selected.startsAt &&
        current.state.deadline === selected.endsAt;
      if (!alreadySelected) {
        await options.callbacks.reschedule({
          workspaceId: number.workspaceId,
          callbackId: row.callback_id,
          operationId,
          expectedRevision: current.state.revision,
          timezone: policy.timezone,
          notBefore: selected.startsAt,
          deadline: selected.endsAt,
        });
      }
      await options.pool.query(
        `UPDATE dialer_customer_callback_admission admission
         SET timezone=obligation.state->>'timezone',
             not_before=(obligation.state->>'notBefore')::timestamptz,
             deadline=(obligation.state->>'deadline')::timestamptz,
             management_expires_at=obligation.recipient_expires_at
         FROM dialer_callback_obligations obligation
         WHERE admission.workspace_id=$1 AND admission.callback_id=$2
           AND obligation.workspace_id=admission.workspace_id
           AND obligation.callback_id=admission.callback_id`,
        [number.workspaceId, row.callback_id],
      );
      return resultFor(number, row, token, true);
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Customer reschedule rejected with a non-Error cause', {
        cause,
      });
    }
  };

  const cancelCallback = async (publicId: string, token: string) => {
    try {
      const { number, row } = await capability(publicId, token);
      if (!options.callbacks) throw new Error('CUSTOMER_CALLBACK_INVALID');
      await options.callbacks.cancel({
        workspaceId: number.workspaceId,
        callbackId: row.callback_id,
        operationId:
          'customer-cancel:' + hash(row.callback_id).slice(0, 48),
        reconciled: false,
      });
      return resultFor(number, row, token);
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Customer cancellation rejected with a non-Error cause', {
        cause,
      });
    }
  };

  return {
    snapshot,
    requestCallback,
    readCallback,
    rescheduleCallback,
    cancelCallback,
  };
};
