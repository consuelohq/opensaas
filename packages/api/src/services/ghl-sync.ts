import * as Sentry from '@sentry/node';
import { normalizePhone } from '@consuelo/contacts';
import type { GHLContact } from './ghl-client.js';

// region — types

type Pool = {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
};

export type ConflictResolution = 'use-ghl' | 'use-twenty' | 'merge';

export interface SyncOptions {
  tags?: string[]; // filter by tags
  skipExisting?: boolean; // skip contacts that already have mappings
  incremental?: boolean; // only sync contacts updated since last_synced_at
  conflictResolution?: ConflictResolution; // how to resolve conflicts
}

export interface SyncResult {
  totalContacts: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  conflictCount: number;
  errors: Array<{ ghlContactId: string; error: string }>;
}

export interface SyncLogEntry {
  id: string;
  workspaceId: string;
  syncType: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  totalContacts: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  conflictCount: number;
  errorMessage?: string;
  details?: Record<string, unknown>;
}

export interface FieldMapping {
  ghlField: string;
  twentyField: string;
  transform?: 'phone' | 'date' | 'boolean' | 'string';
}

// endregion

// region — FieldMapper

export class FieldMapper {
  private mappings: FieldMapping[];

  constructor(mappings: FieldMapping[] = []) {
    this.mappings = mappings;
  }

  // default field mappings from GHL to Twenty person fields
  static getDefaultMappings(): FieldMapping[] {
    return [
      { ghlField: 'firstName', twentyField: 'firstName', transform: 'string' },
      { ghlField: 'lastName', twentyField: 'lastName', transform: 'string' },
      { ghlField: 'email', twentyField: 'email', transform: 'string' },
      { ghlField: 'phone', twentyField: 'phone', transform: 'phone' },
      { ghlField: 'address1', twentyField: 'address', transform: 'string' },
      { ghlField: 'city', twentyField: 'city', transform: 'string' },
      { ghlField: 'state', twentyField: 'state', transform: 'string' },
      { ghlField: 'postalCode', twentyField: 'zip', transform: 'string' },
      { ghlField: 'source', twentyField: 'source', transform: 'string' },
      { ghlField: 'dnd', twentyField: 'dncStatus', transform: 'boolean' },
    ];
  }

  mapGhlToTwenty(contact: GHLContact): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const mappings =
      this.mappings.length > 0
        ? this.mappings
        : FieldMapper.getDefaultMappings();

    for (const mapping of mappings) {
      const ghlValue = (contact as Record<string, unknown>)[mapping.ghlField];
      if (ghlValue === undefined || ghlValue === null || ghlValue === '')
        continue;

      let value: unknown = ghlValue;

      // apply transformation
      switch (mapping.transform) {
        case 'phone':
          value = normalizePhone(String(ghlValue));
          break;
        case 'boolean':
          value = Boolean(ghlValue);
          break;
        case 'date':
          value = new Date(String(ghlValue)).toISOString();
          break;
        case 'string':
        default:
          value = String(ghlValue);
      }

      result[mapping.twentyField] = value;
    }

    // handle custom fields from GHL
    if (contact.customFields && Array.isArray(contact.customFields)) {
      for (const field of contact.customFields) {
        if (field.id && field.value) {
          result[`custom_${field.id}`] = field.value;
        }
      }
    }

    return result;
  }

  // map custom fields configuration
  setMappings(mappings: FieldMapping[]): void {
    this.mappings = mappings;
  }

  getMappings(): FieldMapping[] {
    return this.mappings;
  }
}

// endregion

// region — GHLSyncService

export class GHLSyncService {
  private db: Pool;
  private fieldMapper: FieldMapper;

  // SQL statements
  private static readonly SQL_FIND_MAPPING =
    'SELECT id, twenty_person_id, last_synced_at FROM ghl_sync_mappings WHERE workspace_id = $1 AND ghl_contact_id = $2';

  private static readonly SQL_CREATE_MAPPING =
    'INSERT INTO ghl_sync_mappings (workspace_id, ghl_contact_id, twenty_person_id, last_synced_at) VALUES ($1, $2, $3, NOW()) RETURNING id';

  private static readonly SQL_UPDATE_MAPPING =
    'UPDATE ghl_sync_mappings SET last_synced_at = NOW() WHERE id = $1';

  private static readonly SQL_DELETE_MAPPING =
    'DELETE FROM ghl_sync_mappings WHERE id = $1';

  private static readonly SQL_CREATE_SYNC_LOG =
    'INSERT INTO ghl_sync_logs (workspace_id, sync_type, status, started_at, total_contacts) VALUES ($1, $2, $3, NOW(), $4) RETURNING id';

  private static readonly SQL_UPDATE_SYNC_LOG =
    'UPDATE ghl_sync_logs SET status = $2, completed_at = NOW(), imported_count = $3, updated_count = $4, skipped_count = $5, conflict_count = $6, error_message = $7, details = $8 WHERE id = $1';

  private static readonly SQL_GET_SYNC_LOGS =
    'SELECT id, workspace_id, sync_type, status, started_at, completed_at, total_contacts, imported_count, updated_count, skipped_count, conflict_count, error_message, details FROM ghl_sync_logs WHERE workspace_id = $1 ORDER BY started_at DESC LIMIT $2 OFFSET $3';

  private static readonly SQL_GET_PERSON_BY_PHONE =
    'SELECT id, first_name, last_name, email, phone, updated_at FROM people WHERE workspace_id = $1 AND phone = $2 LIMIT 1';

  private static readonly SQL_GET_PERSON_BY_EMAIL =
    'SELECT id, first_name, last_name, email, phone, updated_at FROM people WHERE workspace_id = $1 AND email = $2 LIMIT 1';

  private static readonly SQL_CREATE_PERSON =
    'INSERT INTO people (workspace_id, first_name, last_name, email, phone, address, city, state, zip, source, dnc_status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()) RETURNING id';

  private static readonly SQL_UPDATE_PERSON =
    'UPDATE people SET first_name = COALESCE($2, first_name), last_name = COALESCE($3, last_name), email = COALESCE($4, email), phone = COALESCE($5, phone), address = COALESCE($6, address), city = COALESCE($7, city), state = COALESCE($8, state), zip = COALESCE($9, zip), source = COALESCE($10, source), dnc_status = COALESCE($11, dnc_status), updated_at = NOW() WHERE id = $1 RETURNING id';

  private static readonly SQL_GET_LAST_SYNC =
    'SELECT last_sync_at FROM ghl_connections WHERE workspace_id = $1';

  constructor(db: Pool, fieldMapper?: FieldMapper) {
    this.db = db;
    this.fieldMapper = fieldMapper ?? new FieldMapper();
  }

  // implements GHLSyncServiceInterface.findMapping
  async findMapping(
    workspaceId: string,
    ghlContactId: string,
  ): Promise<{ id: string; twentyPersonId: string } | null> {
    try {
      const { rows } = await this.db.query(GHLSyncService.SQL_FIND_MAPPING, [
        workspaceId,
        ghlContactId,
      ]);
      if (rows.length === 0) return null;
      return {
        id: String(rows[0].id),
        twentyPersonId: String(rows[0].twenty_person_id),
      };
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  // implements GHLSyncServiceInterface.createTwentyPerson
  async createTwentyPerson(
    workspaceId: string,
    data: Record<string, unknown>,
  ): Promise<{ id: string }> {
    try {
      const { rows } = await this.db.query(GHLSyncService.SQL_CREATE_PERSON, [
        workspaceId,
        data.firstName ?? null,
        data.lastName ?? null,
        data.email ?? null,
        data.phone ?? null,
        data.address ?? null,
        data.city ?? null,
        data.state ?? null,
        data.zip ?? null,
        data.source ?? null,
        data.dncStatus ?? false,
      ]);
      return { id: String(rows[0].id) };
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  // implements GHLSyncServiceInterface.updateTwentyPerson
  async updateTwentyPerson(
    twentyPersonId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.db.query(GHLSyncService.SQL_UPDATE_PERSON, [
        twentyPersonId,
        data.firstName ?? null,
        data.lastName ?? null,
        data.email ?? null,
        data.phone ?? null,
        data.address ?? null,
        data.city ?? null,
        data.state ?? null,
        data.zip ?? null,
        data.source ?? null,
        data.dncStatus ?? null,
      ]);
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  // implements GHLSyncServiceInterface.createSyncMapping
  async createSyncMapping(
    workspaceId: string,
    ghlContactId: string,
    twentyPersonId: string,
  ): Promise<void> {
    try {
      await this.db.query(GHLSyncService.SQL_CREATE_MAPPING, [
        workspaceId,
        ghlContactId,
        twentyPersonId,
      ]);
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  // implements GHLSyncServiceInterface.updateSyncMapping
  async updateSyncMapping(mappingId: string): Promise<void> {
    try {
      await this.db.query(GHLSyncService.SQL_UPDATE_MAPPING, [mappingId]);
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  // implements GHLSyncServiceInterface.mapGhlContactToTwenty
  mapGhlContactToTwenty(contact: GHLContact): Record<string, unknown> {
    return this.fieldMapper.mapGhlToTwenty(contact);
  }

  // implements GHLSyncServiceInterface.handleOpportunitySync
  async handleOpportunitySync(
    workspaceId: string,
    opportunity: Record<string, unknown>,
    eventType: string,
  ): Promise<void> {
    // HACK: opportunity sync implemented in DEV-783 (ghl-webhook.ts routes)
    // this stub logs the event but doesn't process opportunities
    try {
      Sentry.captureMessage('Opportunity sync event received', {
        level: 'info',
        tags: { eventType, workspaceId: String(workspaceId) },
        extra: { opportunityId: String(opportunity.id ?? 'unknown') },
      });
    } catch (err: unknown) {
      Sentry.captureException(err);
    }
  }

  // check if contact has conflicts (modified in both systems)
  async detectConflict(
    workspaceId: string,
    ghlContact: GHLContact,
    twentyPersonId: string,
  ): Promise<boolean> {
    try {
      // check if twenty record was updated after last sync
      const mapping = await this.findMapping(workspaceId, ghlContact.id);
      if (!mapping) return false;

      const { rows } = await this.db.query(
        'SELECT updated_at FROM people WHERE id = $1',
        [twentyPersonId],
      );
      if (rows.length === 0) return false;

      const twentyUpdatedAt = new Date(String(rows[0].updated_at));
      const ghlUpdatedAt = new Date(ghlContact.dateUpdated);
      const lastSyncedAt = mapping.id
        ? await this.getMappingLastSynced(workspaceId, ghlContact.id)
        : null;

      // conflict exists if both systems have updates since last sync
      if (!lastSyncedAt) return false;
      return twentyUpdatedAt > lastSyncedAt && ghlUpdatedAt > lastSyncedAt;
    } catch (err: unknown) {
      Sentry.captureException(err);
      return false;
    }
  }

  private async getMappingLastSynced(
    workspaceId: string,
    ghlContactId: string,
  ): Promise<Date | null> {
    try {
      const { rows } = await this.db.query(
        'SELECT last_synced_at FROM ghl_sync_mappings WHERE workspace_id = $1 AND ghl_contact_id = $2',
        [workspaceId, ghlContactId],
      );
      if (rows.length === 0 || !rows[0].last_synced_at) return null;
      return new Date(String(rows[0].last_synced_at));
    } catch (err: unknown) {
      Sentry.captureException(err);
      return null;
    }
  }

  // resolve conflict based on strategy
  async resolveConflict(
    workspaceId: string,
    ghlContact: GHLContact,
    twentyPersonId: string,
    strategy: ConflictResolution,
  ): Promise<void> {
    try {
      switch (strategy) {
        case 'use-ghl':
          // overwrite twenty with GHL data
          await this.updateTwentyPerson(
            twentyPersonId,
            this.mapGhlContactToTwenty(ghlContact),
          );
          break;
        case 'use-twenty':
          // keep twenty data, just update sync timestamp
          break;
        case 'merge':
          // merge data: prefer non-null values from both
          const existing = await this.getTwentyPerson(twentyPersonId);
          const ghlData = this.mapGhlContactToTwenty(ghlContact);
          const merged = { ...existing, ...ghlData };
          await this.updateTwentyPerson(twentyPersonId, merged);
          break;
      }
      await this.updateSyncMappingForContact(workspaceId, ghlContact.id);
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  private async getTwentyPerson(
    personId: string,
  ): Promise<Record<string, unknown>> {
    try {
      const { rows } = await this.db.query(
        'SELECT first_name, last_name, email, phone, address, city, state, zip, source, dnc_status FROM people WHERE id = $1',
        [personId],
      );
      if (rows.length === 0) return {};
      return {
        firstName: rows[0].first_name,
        lastName: rows[0].last_name,
        email: rows[0].email,
        phone: rows[0].phone,
        address: rows[0].address,
        city: rows[0].city,
        state: rows[0].state,
        zip: rows[0].zip,
        source: rows[0].source,
        dncStatus: rows[0].dnc_status,
      };
    } catch (err: unknown) {
      Sentry.captureException(err);
      return {};
    }
  }

  private async updateSyncMappingForContact(
    workspaceId: string,
    ghlContactId: string,
  ): Promise<void> {
    try {
      await this.db.query(
        'UPDATE ghl_sync_mappings SET last_synced_at = NOW() WHERE workspace_id = $1 AND ghl_contact_id = $2',
        [workspaceId, ghlContactId],
      );
    } catch (err: unknown) {
      Sentry.captureException(err);
    }
  }

  // find existing person by phone or email (for deduplication)
  async findExistingPerson(
    workspaceId: string,
    contact: GHLContact,
  ): Promise<{ id: string } | null> {
    try {
      // try phone first
      if (contact.phone) {
        const normalizedPhone = normalizePhone(contact.phone);
        const { rows } = await this.db.query(
          GHLSyncService.SQL_GET_PERSON_BY_PHONE,
          [workspaceId, normalizedPhone],
        );
        if (rows.length > 0) return { id: String(rows[0].id) };
      }

      // try email
      if (contact.email) {
        const { rows } = await this.db.query(
          GHLSyncService.SQL_GET_PERSON_BY_EMAIL,
          [workspaceId, contact.email],
        );
        if (rows.length > 0) return { id: String(rows[0].id) };
      }

      return null;
    } catch (err: unknown) {
      Sentry.captureException(err);
      return null;
    }
  }

  // import contacts with pagination support
  async importContacts(
    workspaceId: string,
    contacts: GHLContact[],
    options: SyncOptions = {},
  ): Promise<SyncResult> {
    const result: SyncResult = {
      totalContacts: contacts.length,
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      conflictCount: 0,
      errors: [],
    };

    try {
      for (const contact of contacts) {
        try {
          // tag filtering
          if (options.tags && options.tags.length > 0) {
            const hasTag = contact.tags?.some((tag) =>
              options.tags?.includes(tag),
            );
            if (!hasTag) {
              result.skippedCount++;
              continue;
            }
          }

          // check for existing mapping
          const existingMapping = await this.findMapping(
            workspaceId,
            contact.id,
          );
          if (existingMapping && options.skipExisting) {
            result.skippedCount++;
            continue;
          }

          // incremental sync: skip if not updated since last sync
          if (options.incremental) {
            const { rows } = await this.db.query(
              GHLSyncService.SQL_GET_LAST_SYNC,
              [workspaceId],
            );
            const lastSync = rows[0]?.last_sync_at
              ? new Date(String(rows[0].last_sync_at))
              : null;
            const contactUpdated = new Date(contact.dateUpdated);
            if (lastSync && contactUpdated <= lastSync) {
              result.skippedCount++;
              continue;
            }
          }

          const mappedData = this.mapGhlContactToTwenty(contact);

          if (existingMapping) {
            // check for conflicts
            const hasConflict = await this.detectConflict(
              workspaceId,
              contact,
              existingMapping.twentyPersonId,
            );
            if (hasConflict) {
              result.conflictCount++;
              const strategy = options.conflictResolution ?? 'merge';
              await this.resolveConflict(
                workspaceId,
                contact,
                existingMapping.twentyPersonId,
                strategy,
              );
              result.updatedCount++;
            } else {
              // no conflict, just update
              await this.updateTwentyPerson(
                existingMapping.twentyPersonId,
                mappedData,
              );
              await this.updateSyncMapping(existingMapping.id);
              result.updatedCount++;
            }
          } else {
            // check for duplicate by phone/email
            const existingPerson = await this.findExistingPerson(
              workspaceId,
              contact,
            );
            if (existingPerson && options.skipExisting) {
              result.skippedCount++;
              continue;
            }

            if (existingPerson) {
              // link to existing person
              await this.updateTwentyPerson(existingPerson.id, mappedData);
              await this.createSyncMapping(
                workspaceId,
                contact.id,
                existingPerson.id,
              );
              result.updatedCount++;
            } else {
              // create new person
              const person = await this.createTwentyPerson(
                workspaceId,
                mappedData,
              );
              await this.createSyncMapping(workspaceId, contact.id, person.id);
              result.importedCount++;
            }
          }
        } catch (contactErr: unknown) {
          const errorMessage =
            contactErr instanceof Error ? contactErr.message : 'Unknown error';
          result.errors.push({ ghlContactId: contact.id, error: errorMessage });
          Sentry.captureException(contactErr, {
            extra: { ghlContactId: contact.id, workspaceId },
          });
        }
      }

      // update last_sync_at on connection
      await this.db.query(
        'UPDATE ghl_connections SET last_sync_at = NOW() WHERE workspace_id = $1',
        [workspaceId],
      );
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }

    return result;
  }

  // create sync log entry
  async createSyncLog(
    workspaceId: string,
    syncType: string,
    totalContacts: number,
  ): Promise<string> {
    try {
      const { rows } = await this.db.query(GHLSyncService.SQL_CREATE_SYNC_LOG, [
        workspaceId,
        syncType,
        'pending',
        totalContacts,
      ]);
      return String(rows[0].id);
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  // update sync log with results
  async updateSyncLog(
    logId: string,
    status: string,
    result: Partial<SyncResult>,
    errorMessage?: string,
  ): Promise<void> {
    try {
      await this.db.query(GHLSyncService.SQL_UPDATE_SYNC_LOG, [
        logId,
        status,
        result.importedCount ?? 0,
        result.updatedCount ?? 0,
        result.skippedCount ?? 0,
        result.conflictCount ?? 0,
        errorMessage ?? null,
        JSON.stringify(result.errors ?? []),
      ]);
    } catch (err: unknown) {
      Sentry.captureException(err);
    }
  }

  // get sync logs for workspace
  async getSyncLogs(
    workspaceId: string,
    limit = 50,
    offset = 0,
  ): Promise<SyncLogEntry[]> {
    try {
      const { rows } = await this.db.query(GHLSyncService.SQL_GET_SYNC_LOGS, [
        workspaceId,
        limit,
        offset,
      ]);

      return rows.map((row) => ({
        id: String(row.id),
        workspaceId: String(row.workspace_id),
        syncType: String(row.sync_type),
        status: String(row.status),
        startedAt: String(row.started_at),
        completedAt: row.completed_at ? String(row.completed_at) : undefined,
        totalContacts: Number(row.total_contacts),
        importedCount: Number(row.imported_count),
        updatedCount: Number(row.updated_count),
        skippedCount: Number(row.skipped_count),
        conflictCount: Number(row.conflict_count),
        errorMessage: row.error_message ? String(row.error_message) : undefined,
        details: row.details
          ? (row.details as Record<string, unknown>)
          : undefined,
      }));
    } catch (err: unknown) {
      Sentry.captureException(err);
      return [];
    }
  }

  // implements GHLPushMappingService for bidirectional sync
  async findMappingByTwentyId(
    workspaceId: string,
    twentyPersonId: string,
  ): Promise<{ ghlContactId: string } | null> {
    try {
      const { rows } = await this.db.query(
        'SELECT ghl_contact_id FROM ghl_sync_mappings WHERE workspace_id = $1 AND twenty_person_id = $2',
        [workspaceId, twentyPersonId],
      );
      if (rows.length === 0) return null;
      return { ghlContactId: String(rows[0].ghl_contact_id) };
    } catch (err: unknown) {
      Sentry.captureException(err);
      return null;
    }
  }

  mapTwentyToGhl(changes: Record<string, unknown>): Partial<GHLContact> {
    const result: Partial<GHLContact> = {};
    const mappings =
      this.fieldMapper.getMappings().length > 0
        ? this.fieldMapper.getMappings()
        : FieldMapper.getDefaultMappings();

    for (const mapping of mappings) {
      const twentyValue = changes[mapping.twentyField];
      if (twentyValue === undefined || twentyValue === null) continue;
      (result as Record<string, unknown>)[mapping.ghlField] = twentyValue;
    }

    return result;
  }
}

// endregion
