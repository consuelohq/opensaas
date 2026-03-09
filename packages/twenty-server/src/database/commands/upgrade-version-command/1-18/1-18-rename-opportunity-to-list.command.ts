import { InjectRepository } from '@nestjs/typeorm';

import { Command } from 'nest-commander';
import { Repository } from 'typeorm';

import { ActiveOrSuspendedWorkspacesMigrationCommandRunner } from 'src/database/commands/command-runners/active-or-suspended-workspaces-migration.command-runner';
import { RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspaces-migration.command-runner';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { ObjectMetadataEntity } from 'src/engine/metadata-modules/object-metadata/object-metadata.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';

@Command({
  name: 'upgrade:1-18:rename-opportunity-to-list',
  description:
    'Rename opportunity object labels to List/Lists for existing workspaces',
})
export class RenameOpportunityToListCommand extends ActiveOrSuspendedWorkspacesMigrationCommandRunner {
  constructor(
    @InjectRepository(WorkspaceEntity)
    protected readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(ObjectMetadataEntity)
    private readonly objectMetadataRepository: Repository<ObjectMetadataEntity>,
    protected readonly twentyORMGlobalManager: GlobalWorkspaceOrmManager,
    protected readonly dataSourceService: DataSourceService,
  ) {
    super(workspaceRepository, twentyORMGlobalManager, dataSourceService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const opportunityMetadata =
      await this.objectMetadataRepository.findOne({
        where: {
          nameSingular: 'opportunity',
          workspaceId,
        },
      });

    if (!opportunityMetadata) {
      this.logger.log(
        `No opportunity object found for workspace ${workspaceId}. Skipping.`,
      );

      return;
    }

    if (
      opportunityMetadata.labelSingular === 'List' &&
      opportunityMetadata.labelPlural === 'Lists'
    ) {
      this.logger.log(
        `Opportunity already renamed to List for workspace ${workspaceId}. Skipping.`,
      );

      return;
    }

    if (options.dryRun) {
      this.logger.log(
        `Would rename opportunity to List for workspace ${workspaceId}. Skipping (dry run).`,
      );

      return;
    }

    await this.objectMetadataRepository.update(opportunityMetadata.id, {
      labelSingular: 'List',
      labelPlural: 'Lists',
      description: 'A list',
      icon: 'IconList',
      shortcut: 'L',
    });

    this.logger.log(
      `Renamed opportunity to List for workspace ${workspaceId}`,
    );
  }
}
