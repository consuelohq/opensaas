import * as Sentry from '@sentry/node';
import * as crypto from 'node:crypto';
import type { GHLContact, GHLOpportunity } from './ghl-client.js';

// region — types

type Pool = {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
};

export type GHLWebhookEventType =
  | 'ContactCreate'
  | 'ContactUpdate'
  | 'ContactDelete'
  | 'ContactDndUpdate'
  | 'OpportunityCreate'
  | 'OpportunityUpdate'
  | 'OpportunityStatusUpdate';

export interface GHLWebhookPayload {
  type: GHLWebhookEventType;
  locationId: string;
  body: Record<string, unknown>;
  // GHL includes these on most webhook payloads
  id?: string;
  timestamp?: string;
}

// sync service interface — actual implementation is DEV-782
export interface GHLSyncServiceInterface {
  findMapping(workspaceId: string, ghlId: string): Promise<{ id: string; twentyPersonId: string } | null>;
  createTwentyPerson(workspaceId: string, data: Record<string, unknown>): Promise<{ id: string }>;
  updateTwentyPerson(twentyPersonId: string, data: Record<string, unknown>): Promise<void>;
  createSyncMapping(workspaceId: string, ghlId: string, twentyPersonId: string): Promise<void>;
  updateSyncMapping(mappingId: string): Promise<void>;
  mapGhlContactToTwenty(contact: GHLContact): Record<string, unknown>;
  handleOpportunitySync(workspaceId: string, opportunity: GHLOpportunity, eventType: string): Promise<void>;
}

// endregion

// region — signature verification

export const verifyWebhookSignature = (
  rawBody: string,
  signature: string | undefined,
  secret: string,
): boolean => {
  if (!signature) return false;
  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (err: unknown) {
    Sentry.captureException(err);
    return false;
  }
};

// endregion

// region — handler

export class GHLWebhookHandler {
  constructor(
    private syncService: GHLSyncServiceInterface,
    private db: Pool,
  ) {}

  async handleWebhook(payload: GHLWebhookPayload): Promise<void> {
    try {
      // idempotency — skip if we've already processed this event
      if (payload.id) {
        const existing = await this.db.query(
          'SELECT 1 FROM ghl_webhook_events WHERE event_id = $1',
          [payload.id],
        );
        if (existing.rowCount > 0) return;
      }

      const workspaceId = await this.getWorkspaceByLocation(payload.locationId);
      if (!workspaceId) return;

      switch (payload.type) {
        case 'ContactCreate':
          await this.handleContactCreate(workspaceId, payload.body);
          break;
        case 'ContactUpdate':
          await this.handleContactUpdate(workspaceId, payload.body);
          break;
        case 'ContactDelete':
          await this.handleContactDelete(workspaceId, payload.body);
          break;
        case 'ContactDndUpdate':
          await this.handleDndUpdate(workspaceId, payload.body);
          break;
        case 'OpportunityCreate':
        case 'OpportunityUpdate':
        case 'OpportunityStatusUpdate':
          await this.handleOpportunityEvent(workspaceId, payload);
          break;
      }

      // record processed event for idempotency
      if (payload.id) {
        await this.db.query(
          'INSERT INTO ghl_webhook_events (event_id, event_type, location_id, processed_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (event_id) DO NOTHING',
          [payload.id, payload.type, payload.locationId],
        );
      }
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  private async getWorkspaceByLocation(locationId: string): Promise<string | null> {
    try {
      const result = await this.db.query(
        'SELECT workspace_id FROM ghl_connections WHERE location_id = $1 AND disconnected_at IS NULL',
        [locationId],
      );
      if (result.rowCount === 0) return null;
      return result.rows[0].workspace_id as string;
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  private async handleContactCreate(workspaceId: string, body: Record<string, unknown>): Promise<void> {
    try {
      const ghlContact = body as unknown as GHLContact;
      const existing = await this.syncService.findMapping(workspaceId, ghlContact.id);
      if (existing) return;

      const twentyData = this.syncService.mapGhlContactToTwenty(ghlContact);
      const person = await this.syncService.createTwentyPerson(workspaceId, twentyData);
      await this.syncService.createSyncMapping(workspaceId, ghlContact.id, person.id);
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  private async handleContactUpdate(workspaceId: string, body: Record<string, unknown>): Promise<void> {
    try {
      const ghlContact = body as unknown as GHLContact;
      const mapping = await this.syncService.findMapping(workspaceId, ghlContact.id);
      if (!mapping) return;

      const twentyData = this.syncService.mapGhlContactToTwenty(ghlContact);
      await this.syncService.updateTwentyPerson(mapping.twentyPersonId, twentyData);
      await this.syncService.updateSyncMapping(mapping.id);
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  private async handleContactDelete(workspaceId: string, body: Record<string, unknown>): Promise<void> {
    try {
      const { id } = body as { id: string };
      const mapping = await this.syncService.findMapping(workspaceId, id);
      if (!mapping) return;
      // remove mapping only — don't delete the twenty record
      await this.db.query('DELETE FROM ghl_sync_mappings WHERE id = $1', [mapping.id]);
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  private async handleDndUpdate(workspaceId: string, body: Record<string, unknown>): Promise<void> {
    try {
      const { id, dnd } = body as { id: string; dnd: boolean };
      const mapping = await this.syncService.findMapping(workspaceId, id);
      if (!mapping) return;
      await this.syncService.updateTwentyPerson(mapping.twentyPersonId, { dncStatus: dnd });
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  private async handleOpportunityEvent(workspaceId: string, payload: GHLWebhookPayload): Promise<void> {
    try {
      const opportunity = payload.body as unknown as GHLOpportunity;
      await this.syncService.handleOpportunitySync(workspaceId, opportunity, payload.type);
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }
}

// endregion
