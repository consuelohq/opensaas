import * as Sentry from '@sentry/node';
import type { PhoneNumber } from '@consuelo/dialer';
import { getSharedPool } from '../shared/db.js';
import { getNumberPackStatus } from './number-packs.js';
import { getPhoneNumberAddOnStatus } from './phone-number-addons.js';

type WorkspacePhoneNumberRow = {
  area_code: string;
  friendly_name: string;
  ownership_type: WorkspacePhoneNumberOwnershipType;
  phone_number: string;
  status: string;
  twilio_sid: string;
  workspace_id: string;
};

export type WorkspacePhoneNumberOwnershipType =
  | 'add_on'
  | 'included'
  | 'legacy_reserved'
  | 'pack';

export type WorkspacePhoneNumber = PhoneNumber & {
  ownershipType: WorkspacePhoneNumberOwnershipType;
  workspaceId: string;
};

export type PhoneNumberEntitlement = {
  canProvision: boolean;
  includedSlots: number;
  numberPackSlots: number;
  remainingSlots: number;
  singleNumberAddOnSlots: number;
  totalSlots: number;
  usedSlots: number;
};

const SQL_COUNT_ACTIVE_NUMBERS =
  "SELECT COUNT(*)::int AS count FROM workspace_phone_numbers WHERE workspace_id = $1 AND status = 'active'";

const SQL_FIND_NUMBER_BY_SID =
  "SELECT workspace_id, phone_number, friendly_name, area_code, twilio_sid, ownership_type, status FROM workspace_phone_numbers WHERE workspace_id = $1 AND twilio_sid = $2 AND status = 'active' LIMIT 1";

const SQL_INSERT_OR_UPDATE_NUMBER =
  "INSERT INTO workspace_phone_numbers (workspace_id, phone_number, friendly_name, area_code, twilio_sid, ownership_type, status) VALUES ($1, $2, $3, $4, $5, $6, 'active') ON CONFLICT (twilio_sid) DO UPDATE SET workspace_id = EXCLUDED.workspace_id, phone_number = EXCLUDED.phone_number, friendly_name = EXCLUDED.friendly_name, area_code = EXCLUDED.area_code, ownership_type = EXCLUDED.ownership_type, status = 'active', updated_at = NOW()";

const SQL_LIST_ACTIVE_NUMBERS =
  "SELECT workspace_id, phone_number, friendly_name, area_code, twilio_sid, ownership_type, status FROM workspace_phone_numbers WHERE workspace_id = $1 AND status = 'active' ORDER BY created_at ASC";

const SQL_LIST_GLOBAL_BY_SIDS =
  'SELECT twilio_sid FROM workspace_phone_numbers WHERE twilio_sid = ANY($1::text[])';

const SQL_MARK_RELEASED =
  "UPDATE workspace_phone_numbers SET status = 'released', updated_at = NOW() WHERE workspace_id = $1 AND twilio_sid = $2";

const SQL_SUBSCRIPTION_STATUS =
  'SELECT status FROM workspace_subscriptions WHERE workspace_id = $1';

const getIncludedSlots = (status: string | undefined): number => {
  return status === 'active' || status === 'trialing' ? 3 : 0;
};

const getLegacyWorkspaceId = (): string | null => {
  const workspaceId = process.env.LEGACY_PHONE_NUMBER_WORKSPACE_ID ?? '';
  return workspaceId.length > 0 ? workspaceId : null;
};

const getBackfillOwnershipType = (
  workspaceId: string,
): WorkspacePhoneNumberOwnershipType => {
  return workspaceId === getLegacyWorkspaceId() ? 'legacy_reserved' : 'included';
};

const mapToWorkspacePhoneNumber = (
  row: WorkspacePhoneNumberRow,
  dialerNumber: PhoneNumber,
  primarySid: string | null,
): WorkspacePhoneNumber => {
  return {
    areaCode: row.area_code,
    city: dialerNumber.city,
    friendlyName:
      row.friendly_name.length > 0
        ? row.friendly_name
        : (dialerNumber.friendlyName ?? ''),
    isActive: true,
    isPrimary: primarySid !== null && row.twilio_sid === primarySid,
    latitude: dialerNumber.latitude,
    longitude: dialerNumber.longitude,
    ownershipType: row.ownership_type,
    phoneNumber: row.phone_number,
    state: dialerNumber.state,
    twilioSid: row.twilio_sid,
    workspaceId: row.workspace_id,
  };
};

export const getPhoneNumberEntitlement = async (
  workspaceId: string,
): Promise<PhoneNumberEntitlement> => {
  try {
    const pool = await getSharedPool();
    const [{ rows: subscriptionRows }, numberPackStatus, addOnStatus] = await Promise.all([
      pool.query(SQL_SUBSCRIPTION_STATUS, [workspaceId]),
      getNumberPackStatus(workspaceId),
      getPhoneNumberAddOnStatus(workspaceId),
    ]);

    const subscriptionRow = subscriptionRows[0] as
      | {
          status?: string;
        }
      | undefined;

    const includedSlots = getIncludedSlots(subscriptionRow?.status);
    const numberPackSlots = numberPackStatus.totalPackSlots;
    const singleNumberAddOnSlots = addOnStatus.totalActiveQuantity;

    const { rows } = await pool.query(SQL_COUNT_ACTIVE_NUMBERS, [workspaceId]);
    const usedSlots = Number(
      (rows[0] as Record<string, unknown> | undefined)?.count ?? 0,
    );
    const totalSlots = includedSlots + numberPackSlots + singleNumberAddOnSlots;
    const remainingSlots = Math.max(totalSlots - usedSlots, 0);

    return {
      canProvision: remainingSlots > 0,
      includedSlots,
      numberPackSlots,
      remainingSlots,
      singleNumberAddOnSlots,
      totalSlots,
      usedSlots,
    };
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

const claimLegacyWorkspaceNumbers = async (
  workspaceId: string,
  dialerNumbers: PhoneNumber[],
): Promise<void> => {
  try {
    const twilioSids = dialerNumbers
      .map((number) => number.twilioSid)
      .filter((value): value is string => typeof value === 'string');

    if (twilioSids.length === 0) {
      return;
    }

    const pool = await getSharedPool();
    const { rows } = await pool.query(SQL_LIST_GLOBAL_BY_SIDS, [twilioSids]);
    const claimedSids = new Set(
      rows
        .map((row) => row as Record<string, unknown>)
        .map((row) => row.twilio_sid)
        .filter((value): value is string => typeof value === 'string'),
    );

    const ownershipType = getBackfillOwnershipType(workspaceId);

    for (const dialerNumber of dialerNumbers) {
      if (!dialerNumber.twilioSid || claimedSids.has(dialerNumber.twilioSid)) {
        continue;
      }

      await pool.query(SQL_INSERT_OR_UPDATE_NUMBER, [
        workspaceId,
        dialerNumber.phoneNumber,
        dialerNumber.friendlyName ?? '',
        dialerNumber.areaCode,
        dialerNumber.twilioSid,
        ownershipType,
      ]);
    }
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

export const listWorkspacePhoneNumbers = async (
  workspaceId: string,
  dialerNumbers: PhoneNumber[],
  primarySid: string | null,
): Promise<WorkspacePhoneNumber[]> => {
  try {
    await claimLegacyWorkspaceNumbers(workspaceId, dialerNumbers);

    const pool = await getSharedPool();
    const { rows } = await pool.query(SQL_LIST_ACTIVE_NUMBERS, [workspaceId]);
    const rowsBySid = new Map(
      (rows as WorkspacePhoneNumberRow[]).map((row) => [row.twilio_sid, row]),
    );

    return dialerNumbers.flatMap((dialerNumber) => {
      if (!dialerNumber.twilioSid) return [];

      const row = rowsBySid.get(dialerNumber.twilioSid);
      if (!row) return [];

      return [mapToWorkspacePhoneNumber(row, dialerNumber, primarySid)];
    });
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

export const findWorkspacePhoneNumberBySid = async (
  workspaceId: string,
  sid: string,
): Promise<WorkspacePhoneNumberRow | null> => {
  try {
    const pool = await getSharedPool();
    const { rows } = await pool.query(SQL_FIND_NUMBER_BY_SID, [workspaceId, sid]);
    const row = rows[0] as WorkspacePhoneNumberRow | undefined;

    return row ?? null;
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

export const recordProvisionedPhoneNumber = async (
  workspaceId: string,
  payload: {
    areaCode: string;
    friendlyName?: string;
    ownershipType: WorkspacePhoneNumberOwnershipType;
    phoneNumber: string;
    sid: string;
  },
): Promise<void> => {
  try {
    const pool = await getSharedPool();
    await pool.query(SQL_INSERT_OR_UPDATE_NUMBER, [
      workspaceId,
      payload.phoneNumber,
      payload.friendlyName ?? '',
      payload.areaCode,
      payload.sid,
      payload.ownershipType,
    ]);
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

export const releaseWorkspacePhoneNumber = async (
  workspaceId: string,
  sid: string,
): Promise<void> => {
  try {
    const pool = await getSharedPool();
    await pool.query(SQL_MARK_RELEASED, [workspaceId, sid]);
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};
