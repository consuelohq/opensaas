import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import type { PosteriorStore, ProfileKey, ProfilePosterior } from '@consuelo/dialer';
import { DataSource } from 'typeorm';

@Injectable()
export class ParallelPosteriorStore implements PosteriorStore {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async loadPosteriors(workspaceId?: string): Promise<ProfilePosterior[]> {
    const rows = await this.dataSource.query(
      workspaceId
        ? 'SELECT profile_id, alpha, beta FROM parallel_profile_posteriors WHERE workspace_id = $1'
        : 'SELECT profile_id, alpha, beta FROM parallel_profile_posteriors WHERE workspace_id IS NULL',
      workspaceId ? [workspaceId] : [],
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
    await this.dataSource.query(
      `INSERT INTO parallel_profile_posteriors (workspace_id, profile_id, alpha, beta)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id, profile_id)
       DO UPDATE SET
         alpha = parallel_profile_posteriors.alpha + EXCLUDED.alpha,
         beta = parallel_profile_posteriors.beta + EXCLUDED.beta,
         updated_at = NOW()`,
      [workspaceId ?? null, profileId, success ? 1 : 0, success ? 0 : 1],
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
