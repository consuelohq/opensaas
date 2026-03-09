import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BackfillFileSizeAndMimeTypeCommand } from 'src/database/commands/upgrade-version-command/1-18/1-18-backfill-file-size-and-mime-type.command';
import { BackfillMessageChannelThrottleRetryAfterCommand } from 'src/database/commands/upgrade-version-command/1-18/1-18-backfill-message-channel-throttle-retry-after.command';
import { MigrateActivityRichTextAttachmentFileIdsCommand } from 'src/database/commands/upgrade-version-command/1-18/1-18-migrate-activity-rich-text-attachment-file-ids.command';
import { MigrateAttachmentFilesCommand } from 'src/database/commands/upgrade-version-command/1-18/1-18-migrate-attachment-files.command';
import { MigratePersonAvatarFilesCommand } from 'src/database/commands/upgrade-version-command/1-18/1-18-migrate-person-avatar-files.command';
import { UpdateListViewsCommand } from 'src/database/commands/upgrade-version-command/1-18/1-18-update-list-views.command';
import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { FeatureFlagEntity } from 'src/engine/core-modules/feature-flag/feature-flag.entity';
import { FeatureFlagModule } from 'src/engine/core-modules/feature-flag/feature-flag.module';
import { FileStorageModule } from 'src/engine/core-modules/file-storage/file-storage.module';
import { FileEntity } from 'src/engine/core-modules/file/entities/file.entity';
import { FilesFieldModule } from 'src/engine/core-modules/file/files-field/files-field.module';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { FieldMetadataModule } from 'src/engine/metadata-modules/field-metadata/field-metadata.module';
import { ObjectMetadataEntity } from 'src/engine/metadata-modules/object-metadata/object-metadata.entity';
import { ViewFieldEntity } from 'src/engine/metadata-modules/view-field/entities/view-field.entity';
import { ViewGroupEntity } from 'src/engine/metadata-modules/view-group/entities/view-group.entity';
import { ViewEntity } from 'src/engine/metadata-modules/view/entities/view.entity';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { AttachmentWorkspaceEntity } from 'src/modules/attachment/standard-objects/attachment.workspace-entity';
import { PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceEntity,
      FeatureFlagEntity,
      PersonWorkspaceEntity,
      FileEntity,
      AttachmentWorkspaceEntity,
      ObjectMetadataEntity,
      FieldMetadataEntity,
      ViewEntity,
      ViewFieldEntity,
      ViewGroupEntity,
    ]),
    DataSourceModule,
    FeatureFlagModule,
    FileStorageModule.forRoot(),
    WorkspaceCacheModule,
    FieldMetadataModule,
    ApplicationModule,
    FilesFieldModule,
  ],
  providers: [
    MigratePersonAvatarFilesCommand,
    MigrateAttachmentFilesCommand,
    BackfillFileSizeAndMimeTypeCommand,
    MigrateActivityRichTextAttachmentFileIdsCommand,
    BackfillMessageChannelThrottleRetryAfterCommand,
    UpdateListViewsCommand,
  ],
  exports: [
    MigratePersonAvatarFilesCommand,
    MigrateAttachmentFilesCommand,
    BackfillFileSizeAndMimeTypeCommand,
    MigrateActivityRichTextAttachmentFileIdsCommand,
    BackfillMessageChannelThrottleRetryAfterCommand,
    UpdateListViewsCommand,
  ],
})
export class V1_18_UpgradeVersionCommandModule {}
