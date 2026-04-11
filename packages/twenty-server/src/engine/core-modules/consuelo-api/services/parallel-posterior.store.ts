import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import type { PosteriorStore, ProfileKey, ProfilePosterior } from '@consuelo/dialer';
import { DataSource } from 'typeorm';

const GLOBAL_SCOPE = 'global';
const WORKSPACE_SCOPE = 'workspace';

@Injectable()
export class ParallelPosteriorStore implements PosteriorStore {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async loadPosteriors(workspaceId?: string): Promise<ProfilePosterior[]> {
    const scope = workspaceId ? WORKSPACE_SCOPE : GLOBAL_SCOPE;

    const rows = await this.dataSource.query(
      `SELECT profile_id, alpha, beta
       FROM profile_posteriors
       WHERE scope = $1
         AND (($2::uuid IS NULL AND workspace_id IS NULL) OR workspace_id = $2::uuid)`,
      [scope, workspaceId ?? null],
    );

    return rows
      .filter((row: Record<string, unknown>) =>
        this.isProfileKey(row.profile_id),
      )
      .map((row: Record<string, unknown>) => ({
        profileId: row.profile_id,
        alpha: Number(row.alpha),
        beta: Number(row.beta),
      }));
  }

  async updatePosterior(
    profileId: ProfileKey,
    success: boolean,
    workspaceId?: string,
  ): Promise<void> {
    const scope = workspaceId ? WORKSPACE_SCOPE : GLOBAL_SCOPE;

    await this.dataSource.query(
      `INSERT INTO profile_posteriors (scope, workspace_id, profile_id, alpha, beta)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (
         scope,
         COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid),
         profile_id
       )
       DO UPDATE SET
         alpha = profile_posteriors.alpha + EXCLUDED.alpha,
         beta = profile_posteriors.beta + EXCLUDED.beta,
         updated_at = NOW()`,
      [scope, workspaceId ?? null, profileId, success ? 1 : 0, success ? 0 : 1],
    );
  }

  private isProfileKey(profileId: unknown): profileId is ProfileKey {
    return (
      profileId === 'balanced' ||
      profileId === 'aggressive' ||
      profileId === 'conservative'
    );
  }
}
