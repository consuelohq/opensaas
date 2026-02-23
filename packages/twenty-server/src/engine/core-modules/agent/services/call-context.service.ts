import { Injectable, Logger } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { type NoteWorkspaceEntity } from 'src/modules/note/standard-objects/note.workspace-entity';
import { type NoteTargetWorkspaceEntity } from 'src/modules/note/standard-objects/note-target.workspace-entity';
import { type OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

type ContactContext = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
};

type DealContext = {
  dealId: string;
  dealName: string;
  stage: string;
  value: number;
  lastActivityAt: Date;
  daysInStage: number;
};

type CallContextResult = {
  contact: ContactContext | null;
  deal: DealContext | null;
  recentNotes: string[];
};

const CACHE_TTL_MS = 5 * 60 * 1000;

// strip newlines and backtick fences from untrusted fields
const sanitizeField = (value: string): string =>
  value.replace(/[\n\r]/g, ' ').replace(/```/g, '');

const daysBetween = (a: Date, b: Date): number =>
  Math.max(0, Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));

@Injectable()
export class CallContextService {
  private readonly logger = new Logger(CallContextService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    @InjectCacheStorage(CacheStorageNamespace.EngineWorkspace)
    private readonly cacheStorage: CacheStorageService,
  ) {}

  async getCallContext(
    workspaceId: string,
    callSid: string,
    contactId: string,
  ): Promise<CallContextResult> {
    try {
      const cacheKey = `call:context:${callSid}:${contactId}`;
      const cached = await this.cacheStorage.get<CallContextResult>(cacheKey);

      if (cached) return cached;

      const [contact, deal, recentNotes] = await Promise.all([
        this.loadContactContext(workspaceId, contactId),
        this.loadDealContext(workspaceId, contactId),
        this.loadRecentNotes(workspaceId, contactId),
      ]);

      const result: CallContextResult = { contact, deal, recentNotes };

      await this.cacheStorage.set(cacheKey, result, CACHE_TTL_MS);

      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      this.logger.error(
        `call context failed for callSid ${callSid}: ${message}`,
      );

      return { contact: null, deal: null, recentNotes: [] };
    }
  }

  async loadContactContext(
    workspaceId: string,
    contactId: string,
  ): Promise<ContactContext | null> {
    try {
      const personRepository =
        await this.globalWorkspaceOrmManager.getRepository<PersonWorkspaceEntity>(
          workspaceId,
          'person',
          { shouldBypassPermissionChecks: true },
        );

      const person = await personRepository.findOne({
        where: { id: contactId },
      });

      if (!person) return null;

      const firstName = person.name?.firstName ?? '';
      const lastName = person.name?.lastName ?? '';
      const name = `${firstName} ${lastName}`.trim() || 'Unknown';

      const primaryEmail = person.emails?.primaryEmail;
      const primaryPhone = person.phones?.primaryPhoneNumber;

      return {
        id: person.id,
        name,
        email: primaryEmail ?? undefined,
        phone: primaryPhone ?? undefined,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      this.logger.error(`contact context failed for ${contactId}: ${message}`);

      return null;
    }
  }

  async loadDealContext(
    workspaceId: string,
    contactId: string,
  ): Promise<DealContext | null> {
    try {
      const opportunityRepository =
        await this.globalWorkspaceOrmManager.getRepository<OpportunityWorkspaceEntity>(
          workspaceId,
          'opportunity',
          { shouldBypassPermissionChecks: true },
        );

      const opportunities = await opportunityRepository.find({
        where: { pointOfContactId: contactId },
        order: { updatedAt: 'DESC' },
      });

      const openDeal = opportunities.find(
        (opp) => opp.stage !== 'CLOSED_WON' && opp.stage !== 'CLOSED_LOST',
      );

      if (!openDeal) return null;

      const now = new Date();
      const value = openDeal.amount?.amountMicros
        ? Number(openDeal.amount.amountMicros) / 1_000_000
        : 0;

      return {
        dealId: openDeal.id,
        dealName: openDeal.name || 'Unnamed deal',
        stage: openDeal.stage || 'QUALIFICATION',
        value,
        lastActivityAt: new Date(openDeal.updatedAt),
        daysInStage: daysBetween(new Date(openDeal.updatedAt), now),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      this.logger.error(`deal context failed for ${contactId}: ${message}`);

      return null;
    }
  }

  async loadRecentNotes(
    workspaceId: string,
    contactId: string,
    limit = 3,
  ): Promise<string[]> {
    try {
      const noteTargetRepository =
        await this.globalWorkspaceOrmManager.getRepository<NoteTargetWorkspaceEntity>(
          workspaceId,
          'noteTarget',
          { shouldBypassPermissionChecks: true },
        );

      const targets = await noteTargetRepository.find({
        where: { targetPersonId: contactId },
        order: { createdAt: 'DESC' },
        take: limit,
      });

      if (targets.length === 0) return [];

      const noteIds = targets
        .map((t) => t.noteId)
        .filter((id): id is string => id != null);

      if (noteIds.length === 0) return [];

      const noteRepository =
        await this.globalWorkspaceOrmManager.getRepository<NoteWorkspaceEntity>(
          workspaceId,
          'note',
          { shouldBypassPermissionChecks: true },
        );

      const notes = await noteRepository.find({
        where: noteIds.map((id) => ({ id })),
        order: { createdAt: 'DESC' },
        take: limit,
      });

      return notes
        .map((note) => sanitizeField(note.title || ''))
        .filter((title) => title.length > 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';

      this.logger.error(`recent notes failed for ${contactId}: ${message}`);

      return [];
    }
  }
}
