import { InjectRepository } from '@nestjs/typeorm';

import { Command } from 'nest-commander';
import { In, Repository } from 'typeorm';

import { ActiveOrSuspendedWorkspacesMigrationCommandRunner } from 'src/database/commands/command-runners/active-or-suspended-workspaces-migration.command-runner';
import { RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspaces-migration.command-runner';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { ObjectMetadataEntity } from 'src/engine/metadata-modules/object-metadata/object-metadata.entity';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { ViewEntity } from 'src/engine/metadata-modules/view/entities/view.entity';
import { ViewFieldEntity } from 'src/engine/metadata-modules/view-field/entities/view-field.entity';
import { ViewGroupEntity } from 'src/engine/metadata-modules/view-group/entities/view-group.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';

const VIEW_NAME_MAP: Record<string, string> = {
  'All Opportunities': 'All Lists',
  'By Stage': 'By Status',
  'Opportunity Record Page Fields': 'List Record Page Fields',
};

const OLD_FIELD_NAMES = [
  'amount',
  'closeDate',
  'stage',
  'company',
  'pointOfContact',
];

const ALL_LISTS_FIELDS = [
  'listStatus',
  'contactCount',
  'ordering',
  'owner',
  'sessionStartedAt',
  'elapsedSeconds',
];

const BY_STATUS_FIELDS = ['contactCount', 'ordering', 'owner'];

const RECORD_PAGE_FIELDS = [
  'listStatus',
  'ordering',
  'contactCount',
  'owner',
  'sessionStartedAt',
  'sessionEndedAt',
  'elapsedSeconds',
  'currentIndex',
];

const STATUS_GROUPS = ['idle', 'active', 'paused', 'completed'];

const DEFAULT_FIELD_SIZE = 150;

@Command({
  name: 'upgrade:1-18:update-list-views',
  description:
    'Update List views to show queue columns for existing workspaces',
})
export class UpdateListViewsCommand extends ActiveOrSuspendedWorkspacesMigrationCommandRunner {
  constructor(
    @InjectRepository(WorkspaceEntity)
    protected readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(ObjectMetadataEntity)
    private readonly objectMetadataRepository: Repository<ObjectMetadataEntity>,
    @InjectRepository(FieldMetadataEntity)
    private readonly fieldMetadataRepository: Repository<FieldMetadataEntity>,
    @InjectRepository(ViewEntity)
    private readonly viewRepository: Repository<ViewEntity>,
    @InjectRepository(ViewFieldEntity)
    private readonly viewFieldRepository: Repository<ViewFieldEntity>,
    @InjectRepository(ViewGroupEntity)
    private readonly viewGroupRepository: Repository<ViewGroupEntity>,
    protected readonly twentyORMGlobalManager: GlobalWorkspaceOrmManager,
    protected readonly dataSourceService: DataSourceService,
  ) {
    super(workspaceRepository, twentyORMGlobalManager, dataSourceService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const objectMetadata = await this.objectMetadataRepository.findOne({
      where: { nameSingular: 'opportunity', workspaceId },
    });

    if (!objectMetadata) {
      this.logger.log(
        `No opportunity object found for workspace ${workspaceId}, skipping`,
      );

      return;
    }

    const views = await this.viewRepository.find({
      where: { objectMetadataId: objectMetadata.id, workspaceId },
    });

    // Idempotency: skip if already migrated
    const alreadyMigrated = views.some((v) => v.name === 'All Lists');

    if (alreadyMigrated) {
      this.logger.log(
        `Workspace ${workspaceId} already has 'All Lists' view, skipping`,
      );

      return;
    }

    if (options.dryRun) {
      this.logger.log(
        `[DRY RUN] Would update ${views.length} views for workspace ${workspaceId}`,
      );

      return;
    }

    // Build field name → id map for this object
    const fieldMetadatas = await this.fieldMetadataRepository.find({
      where: { objectMetadataId: objectMetadata.id, workspaceId },
    });

    const fieldByName = new Map(fieldMetadatas.map((f) => [f.name, f]));

    // Build old field ID set for removal
    const oldFieldIds = OLD_FIELD_NAMES.map((name) => fieldByName.get(name)?.id)
      .filter((id): id is string => id !== undefined);

    for (const view of views) {
      const newName = VIEW_NAME_MAP[view.name];

      if (!newName) {
        continue;
      }

      // Rename view
      await this.viewRepository.update(view.id, { name: newName });
      this.logger.log(`Renamed view '${view.name}' → '${newName}'`);

      // Remove old viewFields
      if (oldFieldIds.length > 0) {
        await this.viewFieldRepository.delete({
          viewId: view.id,
          fieldMetadataId: In(oldFieldIds),
        });
      }

      // Determine which new fields to add based on view
      let newFieldNames: string[];

      if (newName === 'All Lists') {
        newFieldNames = ALL_LISTS_FIELDS;
      } else if (newName === 'By Status') {
        newFieldNames = BY_STATUS_FIELDS;
      } else {
        newFieldNames = RECORD_PAGE_FIELDS;
      }

      // Get existing viewFields to determine next position
      const existingFields = await this.viewFieldRepository.find({
        where: { viewId: view.id },
        order: { position: 'ASC' },
      });

      let nextPosition =
        existingFields.length > 0
          ? Math.max(...existingFields.map((f) => f.position)) + 1
          : 1;

      // Add new viewFields (skip if already present)
      const existingFieldMetadataIds = new Set(
        existingFields.map((f) => f.fieldMetadataId),
      );

      for (const fieldName of newFieldNames) {
        const field = fieldByName.get(fieldName);

        if (!field) {
          this.logger.warn(
            `Field '${fieldName}' not found for workspace ${workspaceId}`,
          );
          continue;
        }

        if (existingFieldMetadataIds.has(field.id)) {
          continue;
        }

        await this.viewFieldRepository.save({
          viewId: view.id,
          fieldMetadataId: field.id,
          isVisible: true,
          size: DEFAULT_FIELD_SIZE,
          position: nextPosition++,
          workspaceId,
        });
      }

      // Update kanban view: set mainGroupByFieldMetadataId and replace groups
      if (newName === 'By Status') {
        const listStatusField = fieldByName.get('listStatus');

        if (listStatusField) {
          await this.viewRepository.update(view.id, {
            mainGroupByFieldMetadataId: listStatusField.id,
          });

          // Remove old groups
          await this.viewGroupRepository.delete({ viewId: view.id });

          // Add new status groups
          for (let i = 0; i < STATUS_GROUPS.length; i++) {
            await this.viewGroupRepository.save({
              viewId: view.id,
              fieldValue: STATUS_GROUPS[i],
              position: i,
              isVisible: true,
              workspaceId,
            });
          }

          this.logger.log(
            `Updated kanban groups to status values for view ${view.id}`,
          );
        }
      }
    }

    this.logger.log(
      `Updated List views for workspace ${workspaceId}`,
    );
  }
}
