import * as Sentry from '@sentry/node';
import { getSharedPool } from '../shared/db.js';
import { redisService } from './redis.js';

const SQL_GET_CALLBACK_NUMBER = `
  SELECT preferences -> 'dialer' ->> 'callbackNumber' AS callback_number
  FROM user_settings
  WHERE user_id = $1 AND workspace_id = $2
`;

type CallbackNumberRow = Record<string, unknown> & {
  callback_number: string | null;
};

type Pool = {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
};

export type RecentCallbackRoute = {
  workspaceId: string;
  userId: string;
  twilioNumber: string;
  prospectNumber: string;
  callbackNumber: string | null;
  createdAt: string;
  updatedAt: string;
};

const normalizePhone = (phone: string): string => {
  if (!phone) return '';

  const digits = phone.replace(/\D/g, '');

  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;

  return `+${digits}`;
};

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

const normalizeRoutePhone = (phone: string): string | null => {
  const normalized = normalizePhone(phone);

  return E164_REGEX.test(normalized) ? normalized : null;
};

export const getCurrentCallbackNumber = async (
  userId: string,
  workspaceId: string,
): Promise<string | null> => {
  try {
    const pool = (await getSharedPool()) as Pool;
    const { rows } = await pool.query<CallbackNumberRow>(SQL_GET_CALLBACK_NUMBER, [
      userId,
      workspaceId,
    ]);

    if (rows.length === 0) {
      return null;
    }

    const callbackNumber = rows[0]?.callback_number ?? '';
    const normalizedCallbackNumber = normalizeRoutePhone(callbackNumber);

    return normalizedCallbackNumber;
  } catch (err: unknown) {
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
      extra: {
        context: 'getCurrentCallbackNumber',
        userId,
        workspaceId,
      },
    });

    return null;
  }
};

export const storeRecentCallbackRoute = async ({
  workspaceId,
  userId,
  twilioNumber,
  prospectNumber,
}: {
  workspaceId: string;
  userId: string;
  twilioNumber: string;
  prospectNumber: string;
}): Promise<boolean> => {
  const normalizedTwilioNumber = normalizeRoutePhone(twilioNumber);
  const normalizedProspectNumber = normalizeRoutePhone(prospectNumber);

  if (
    normalizedTwilioNumber === null ||
    normalizedProspectNumber === null ||
    workspaceId.length === 0 ||
    userId.length === 0
  ) {
    return false;
  }

  try {
    const callbackNumber = await getCurrentCallbackNumber(userId, workspaceId);
    const timestamp = new Date().toISOString();

    await redisService.setRecentCallbackRoute({
      workspaceId,
      userId,
      twilioNumber: normalizedTwilioNumber,
      prospectNumber: normalizedProspectNumber,
      callbackNumber,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return true;
  } catch (err: unknown) {
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
      extra: {
        context: 'storeRecentCallbackRoute',
        workspaceId,
        userId,
        twilioNumber: normalizedTwilioNumber,
        prospectNumber: normalizedProspectNumber,
      },
    });

    return false;
  }
};

export const findRecentCallbackRoute = async ({
  twilioNumber,
  prospectNumber,
}: {
  twilioNumber: string;
  prospectNumber: string;
}): Promise<RecentCallbackRoute | null> => {
  const normalizedTwilioNumber = normalizeRoutePhone(twilioNumber);
  const normalizedProspectNumber = normalizeRoutePhone(prospectNumber);

  if (normalizedTwilioNumber === null || normalizedProspectNumber === null) {
    return null;
  }

  try {
    const routes = await redisService.getRecentCallbackRoutes(
      normalizedTwilioNumber,
      normalizedProspectNumber,
    );

    if (routes.length !== 1) {
      if (routes.length > 1) {
        Sentry.captureMessage('ambiguous recent callback route match', {
          level: 'warning',
          extra: {
            context: 'findRecentCallbackRoute',
            twilioNumber: normalizedTwilioNumber,
            prospectNumber: normalizedProspectNumber,
            routeCount: routes.length,
          },
        });
      }

      return null;
    }

    return routes[0] as RecentCallbackRoute;
  } catch (err: unknown) {
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
      extra: {
        context: 'findRecentCallbackRoute',
        twilioNumber: normalizedTwilioNumber,
        prospectNumber: normalizedProspectNumber,
      },
    });

    return null;
  }
};
