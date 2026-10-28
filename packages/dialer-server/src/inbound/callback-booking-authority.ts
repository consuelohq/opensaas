import {
  decodeCallbackBookingResult,
  type CallbackBookingRequest,
  type CallbackBookingResult,
} from '@consuelo/dialer';
import type { Pool, PoolClient } from 'pg';
import type { CallbackCalendarAdapter } from './callbacks';
import { withInboundTransaction } from './postgres-journal';

export type PendingCallbackBooking = {
  readonly status: 'booking_pending';
  readonly providerReference: null;
  readonly evidenceReference: null;
};
const pending: PendingCallbackBooking = {
  status: 'booking_pending',
  providerReference: null,
  evidenceReference: null,
};
const unavailable: CallbackBookingResult = {
  status: 'unavailable',
  providerReference: null,
  evidenceReference: null,
};

export const createCallbackBookingAuthority = (
  pool: Pool,
  calendar?: CallbackCalendarAdapter,
) => {
  const persist = async (
    request: CallbackBookingRequest,
    result: CallbackBookingResult,
    database: Pool | PoolClient = pool,
  ) => {
    try {
      await database.query(
        `INSERT INTO dialer_callback_bookings(
         workspace_id,callback_id,revision,status,provider_reference,evidence_reference
       ) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [
          request.workspaceId,
          request.callbackId,
          request.revision,
          result.status,
          result.providerReference,
          result.evidenceReference,
        ],
      );
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Callback booking persistence failed', { cause });
    }
  };

  const readResult = async (
    workspaceId: string,
    callbackId: string,
    revision: number,
  ) => {
    try {
      const result = await pool.query<{
        status: CallbackBookingResult['status'];
        provider_reference: string | null;
        evidence_reference: string | null;
      }>(
        `SELECT status,provider_reference,evidence_reference FROM dialer_callback_bookings
       WHERE workspace_id=$1 AND callback_id=$2 AND revision=$3`,
        [workspaceId, callbackId, revision],
      );
      const row = result.rows[0];
      return row
        ? decodeCallbackBookingResult({
            status: row.status,
            providerReference: row.provider_reference,
            evidenceReference: row.evidence_reference,
          })
        : null;
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Callback booking persistence failed', { cause });
    }
  };

  const readPending = async (
    workspaceId: string,
    callbackId: string,
    revision: number,
  ): Promise<PendingCallbackBooking | CallbackBookingResult | null> => {
    try {
      const attempts = await pool.query<{ request: CallbackBookingRequest }>(
        `SELECT request FROM dialer_callback_booking_attempts
         WHERE workspace_id=$1 AND callback_id=$2 AND revision=$3`,
        [workspaceId, callbackId, revision],
      );
      const request = attempts.rows[0]?.request;
      if (!request) return null;
      const existing = await readResult(workspaceId, callbackId, revision);
      if (existing) return existing;
      if (!calendar?.reconcileBooking) return pending;
      const observed = await calendar.reconcileBooking(request);
      if (!observed) return pending;
      const result = decodeCallbackBookingResult(observed);
      if (result.status === 'requested') return pending;
      if (!result.evidenceReference)
        throw new Error(
          'Booking reconciliation requires durable provider evidence',
        );
      await persist(request, result);
      return await readResult(workspaceId, callbackId, revision);
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Callback booking reconciliation failed', { cause });
    }
  };

  const dispatch = async (request: CallbackBookingRequest) => {
    try {
      const claimed = await withInboundTransaction(
        pool,
        request.workspaceId,
        async (client) => {
          try {
            const callback = await client.query<{
              revision: number;
              status: string;
            }>(
              `SELECT (state->>'revision')::integer AS revision,state->>'status' AS status
           FROM dialer_callback_obligations WHERE workspace_id=$1 AND callback_id=$2 FOR UPDATE`,
              [request.workspaceId, request.callbackId],
            );
            const current = callback.rows[0];
            if (
              !current ||
              current.revision !== request.revision ||
              [
                'cancel_pending',
                'cancelled',
                'fulfilled',
                'expired',
                'exhausted',
              ].includes(current.status)
            )
              throw new Error('Callback revision is no longer bookable');
            const existing = await client.query(
              `SELECT 1 FROM dialer_callback_bookings WHERE workspace_id=$1 AND callback_id=$2 AND revision=$3`,
              [request.workspaceId, request.callbackId, request.revision],
            );
            if (existing.rowCount) return false;
            if (!calendar) {
              await persist(request, unavailable, client);
              return false;
            }
            const claim = await client.query(
              `INSERT INTO dialer_callback_booking_attempts(workspace_id,callback_id,revision,request)
           VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING revision`,
              [
                request.workspaceId,
                request.callbackId,
                request.revision,
                JSON.stringify(request),
              ],
            );
            return claim.rowCount === 1;
          } catch (cause: unknown) {
            if (cause instanceof Error) throw cause;
            throw new Error('Inbound authority transaction failed', { cause });
          }
        },
      );
      if (!claimed || !calendar) return;
      // A crash or timeout after this claim requires provider reconciliation, never another create.
      const result = decodeCallbackBookingResult(await calendar.book(request));
      if (result.status !== 'requested') await persist(request, result);
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Callback booking dispatch failed', { cause });
    }
  };

  const suppressUnstarted = async (
    workspaceId: string,
    callbackId: string,
    revision: number,
  ) => {
    try {
      await withInboundTransaction(pool, workspaceId, async (client) => {
        try {
          // Serialize management against the creation claim before any provider effect escapes.
          await client.query(
            `INSERT INTO dialer_callback_bookings(workspace_id,callback_id,revision,status,provider_reference,evidence_reference)
           SELECT $1,$2,$3,'unavailable',NULL,NULL WHERE NOT EXISTS(
             SELECT 1 FROM dialer_callback_booking_attempts WHERE workspace_id=$1 AND callback_id=$2 AND revision=$3
           ) ON CONFLICT DO NOTHING`,
            [workspaceId, callbackId, revision],
          );
        } catch (cause: unknown) {
          if (cause instanceof Error) throw cause;
          throw new Error('Inbound authority transaction failed', { cause });
        }
      });
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Callback booking suppression failed', { cause });
    }
  };

  return { dispatch, readPending, suppressUnstarted };
};
