import * as Sentry from '@sentry/node';
import type { GHLClient, GHLContact } from './ghl-client.js';

type Pool = {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
};

const SQL_FIND_BY_TWENTY_ID =
  'SELECT ghl_contact_id FROM ghl_sync_mappings WHERE workspace_id = $1 AND twenty_person_id = $2';

export interface GHLPushMappingService {
  findMappingByTwentyId(
    workspaceId: string,
    twentyPersonId: string,
  ): Promise<{ ghlContactId: string } | null>;
  mapTwentyToGhl(changes: Record<string, unknown>): Partial<GHLContact>;
}

export class GHLPushMappingServiceImpl implements GHLPushMappingService {
  constructor(private db: Pool) {}

  async findMappingByTwentyId(
    workspaceId: string,
    twentyPersonId: string,
  ): Promise<{ ghlContactId: string } | null> {
    try {
      const result = await this.db.query(SQL_FIND_BY_TWENTY_ID, [
        workspaceId,
        twentyPersonId,
      ]);
      if (result.rowCount === 0) return null;
      return { ghlContactId: result.rows[0].ghl_contact_id as string };
    } catch (err: unknown) {
      Sentry.captureException(err);
      return null;
    }
  }

  mapTwentyToGhl(changes: Record<string, unknown>): Partial<GHLContact> {
    const mapped: Partial<GHLContact> = {};

    if (changes.firstName !== undefined)
      mapped.firstName = changes.firstName as string;
    if (changes.lastName !== undefined)
      mapped.lastName = changes.lastName as string;
    if (changes.email !== undefined) mapped.email = changes.email as string;
    if (changes.phone !== undefined) mapped.phone = changes.phone as string;
    if (changes.address1 !== undefined)
      mapped.address1 = changes.address1 as string;
    if (changes.city !== undefined) mapped.city = changes.city as string;
    if (changes.state !== undefined) mapped.state = changes.state as string;
    if (changes.postalCode !== undefined)
      mapped.postalCode = changes.postalCode as string;

    return mapped;
  }
}

export interface CallOutcomeData {
  contactId: string; // twenty person ID
  outcome: string; // answered, no-answer, busy, voicemail
  duration: number;
  notes?: string;
  recordingUrl?: string;
}

export class GHLPushService {
  private client: GHLClient;
  private mappings: GHLPushMappingService;

  constructor(client: GHLClient, mappings: GHLPushMappingService) {
    this.client = client;
    this.mappings = mappings;
  }

  async pushCallOutcome(
    workspaceId: string,
    data: CallOutcomeData,
  ): Promise<boolean> {
    try {
      const mapping = await this.mappings.findMappingByTwentyId(
        workspaceId,
        data.contactId,
      );
      if (!mapping) return false;

      const lines = [`\u{1F4DE} Call ${data.outcome} (${data.duration}s)`];
      if (data.notes) lines.push(`Notes: ${data.notes}`);
      if (data.recordingUrl) lines.push(`Recording: ${data.recordingUrl}`);

      await this.client.createNote(mapping.ghlContactId, lines.join('\n'));
      return true;
    } catch (err: unknown) {
      Sentry.captureException(err);
      return false;
    }
  }

  async pushTagUpdate(
    workspaceId: string,
    contactId: string,
    tags: string[],
  ): Promise<boolean> {
    try {
      const mapping = await this.mappings.findMappingByTwentyId(
        workspaceId,
        contactId,
      );
      if (!mapping) return false;

      await this.client.updateContact(mapping.ghlContactId, {
        tags,
      } as Partial<GHLContact>); // HACK: tags is a valid GHLContact field but Partial<GHLContact> is strict
      return true;
    } catch (err: unknown) {
      Sentry.captureException(err);
      return false;
    }
  }

  async pushContactUpdate(
    workspaceId: string,
    contactId: string,
    changes: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      const mapping = await this.mappings.findMappingByTwentyId(
        workspaceId,
        contactId,
      );
      if (!mapping) return false;

      const ghlData = this.mappings.mapTwentyToGhl(changes);
      await this.client.updateContact(mapping.ghlContactId, ghlData);
      return true;
    } catch (err: unknown) {
      Sentry.captureException(err);
      return false;
    }
  }
}
