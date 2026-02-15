import * as Sentry from '@sentry/node';
import type { GHLClient, GHLContact } from './ghl-client.js';

// reverse-direction mapping lookup (Twenty ID → GHL ID)
export interface GHLPushMappingService {
  findMappingByTwentyId(
    workspaceId: string,
    twentyPersonId: string,
  ): Promise<{ ghlContactId: string } | null>;
  mapTwentyToGhl(changes: Record<string, unknown>): Partial<GHLContact>;
}

export interface CallOutcomeData {
  contactId: string; // twenty person ID
  outcome: string;   // answered, no-answer, busy, voicemail
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

  async pushCallOutcome(workspaceId: string, data: CallOutcomeData): Promise<boolean> {
    try {
      const mapping = await this.mappings.findMappingByTwentyId(workspaceId, data.contactId);
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

  async pushTagUpdate(workspaceId: string, contactId: string, tags: string[]): Promise<boolean> {
    try {
      const mapping = await this.mappings.findMappingByTwentyId(workspaceId, contactId);
      if (!mapping) return false;

      await this.client.updateContact(mapping.ghlContactId, { tags } as Partial<GHLContact>); // HACK: tags is a valid GHLContact field but Partial<GHLContact> is strict
      return true;
    } catch (err: unknown) {
      Sentry.captureException(err);
      return false;
    }
  }

  async pushContactUpdate(workspaceId: string, contactId: string, changes: Record<string, unknown>): Promise<boolean> {
    try {
      const mapping = await this.mappings.findMappingByTwentyId(workspaceId, contactId);
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
