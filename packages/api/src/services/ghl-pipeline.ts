import * as Sentry from '@sentry/node';
import type { GHLClient, GHLOpportunity } from './ghl-client.js';

type Pool = {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
};

export interface StageMapping {
  ghlStageId: string;
  twentyStageId: string;
}

export interface PipelineMapping {
  id: string;
  ghlPipelineId: string;
  ghlStageId: string;
  twentyPipelineId: string;
  twentyStageId: string;
}

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// region — SQL

const SQL_UPSERT_MAPPING = [
  'INSERT INTO ghl_pipeline_mappings (workspace_id, ghl_pipeline_id, ghl_stage_id, twenty_pipeline_id, twenty_stage_id)',
  'VALUES ($1, $2, $3, $4, $5)',
  'ON CONFLICT (workspace_id, ghl_stage_id) DO UPDATE SET',
  'ghl_pipeline_id = $2, twenty_pipeline_id = $4, twenty_stage_id = $5',
].join(' ');

const SQL_SELECT_MAPPINGS = [
  'SELECT id, ghl_pipeline_id AS "ghlPipelineId", ghl_stage_id AS "ghlStageId",',
  'twenty_pipeline_id AS "twentyPipelineId", twenty_stage_id AS "twentyStageId"',
  'FROM ghl_pipeline_mappings WHERE workspace_id = $1',
].join(' ');

const SQL_SELECT_STAGE = [
  'SELECT id, ghl_pipeline_id AS "ghlPipelineId", ghl_stage_id AS "ghlStageId",',
  'twenty_pipeline_id AS "twentyPipelineId", twenty_stage_id AS "twentyStageId"',
  'FROM ghl_pipeline_mappings WHERE workspace_id = $1 AND ghl_stage_id = $2',
].join(' ');

const SQL_DELETE_MAPPINGS = 'DELETE FROM ghl_pipeline_mappings WHERE workspace_id = $1 AND ghl_pipeline_id = $2';

const SQL_SELECT_OPP_SYNC = [
  'SELECT id, ghl_stage_id AS "ghlStageId" FROM ghl_opportunity_sync',
  'WHERE workspace_id = $1 AND ghl_opportunity_id = $2',
].join(' ');

const SQL_UPDATE_OPP_SYNC = [
  'UPDATE ghl_opportunity_sync SET ghl_stage_id = $1, twenty_stage_id = $2, updated_at = NOW()',
  'WHERE workspace_id = $3 AND ghl_opportunity_id = $4',
].join(' ');

const SQL_INSERT_OPP_SYNC = [
  'INSERT INTO ghl_opportunity_sync',
  '(workspace_id, ghl_opportunity_id, ghl_pipeline_id, ghl_stage_id, twenty_pipeline_id, twenty_stage_id, ghl_contact_id, monetary_value, status)',
  'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
].join(' ');

// endregion

export class GHLPipelineSync {
  private client: GHLClient;
  private db: Pool;

  constructor(client: GHLClient, db: Pool) {
    this.client = client;
    this.db = db;
  }

  async mapPipelineStages(
    workspaceId: string,
    ghlPipelineId: string,
    twentyPipelineId: string,
    stageMappings: StageMapping[],
  ): Promise<void> {
    try {
      for (const mapping of stageMappings) {
        await this.db.query(SQL_UPSERT_MAPPING, [
          workspaceId, ghlPipelineId, mapping.ghlStageId, twentyPipelineId, mapping.twentyStageId,
        ]);
      }
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async getMappedPipelines(workspaceId: string): Promise<PipelineMapping[]> {
    try {
      const result = await this.db.query(SQL_SELECT_MAPPINGS, [workspaceId]);
      return result.rows as unknown as PipelineMapping[];
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async getStageMapping(workspaceId: string, ghlStageId: string): Promise<PipelineMapping | null> {
    try {
      const result = await this.db.query(SQL_SELECT_STAGE, [workspaceId, ghlStageId]);
      return result.rows.length > 0 ? (result.rows[0] as unknown as PipelineMapping) : null;
    } catch (err: unknown) {
      Sentry.captureException(err);
      return null;
    }
  }

  async deletePipelineMappings(workspaceId: string, ghlPipelineId: string): Promise<void> {
    try {
      await this.db.query(SQL_DELETE_MAPPINGS, [workspaceId, ghlPipelineId]);
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }
  }

  async syncOpportunities(workspaceId: string): Promise<SyncResult> {
    const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };

    try {
      const mappings = await this.getMappedPipelines(workspaceId);
      if (mappings.length === 0) return result;

      const pipelineIds = [...new Set(mappings.map((m) => m.ghlPipelineId))];

      for (const pipelineId of pipelineIds) {
        try {
          const oppList = await this.client.getOpportunities(pipelineId);

          for (const opp of oppList.opportunities) {
            try {
              await this.syncSingleOpportunity(workspaceId, opp, result);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'unknown error';
              result.errors.push('opportunity ' + opp.id + ': ' + msg);
              Sentry.captureException(err);
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'unknown error';
          result.errors.push('pipeline ' + pipelineId + ': ' + msg);
          Sentry.captureException(err);
        }
      }
    } catch (err: unknown) {
      Sentry.captureException(err);
      throw err;
    }

    return result;
  }

  private async syncSingleOpportunity(
    workspaceId: string,
    opp: GHLOpportunity,
    result: SyncResult,
  ): Promise<void> {
    const stageMapping = await this.getStageMapping(workspaceId, opp.pipelineStageId);
    if (!stageMapping) {
      result.skipped++;
      return;
    }

    const existing = await this.db.query(SQL_SELECT_OPP_SYNC, [workspaceId, opp.id]);

    if (existing.rows.length > 0) {
      const prev = existing.rows[0] as unknown as { id: string; ghlStageId: string };
      if (prev.ghlStageId !== opp.pipelineStageId) {
        await this.db.query(SQL_UPDATE_OPP_SYNC, [
          opp.pipelineStageId, stageMapping.twentyStageId, workspaceId, opp.id,
        ]);
        result.updated++;
      } else {
        result.skipped++;
      }
    } else {
      await this.db.query(SQL_INSERT_OPP_SYNC, [
        workspaceId, opp.id, opp.pipelineId, opp.pipelineStageId,
        stageMapping.twentyPipelineId, stageMapping.twentyStageId,
        opp.contactId, opp.monetaryValue, opp.status,
      ]);
      result.created++;
    }
  }
}
