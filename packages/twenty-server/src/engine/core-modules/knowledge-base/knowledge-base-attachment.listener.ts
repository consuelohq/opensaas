import { Injectable, Logger } from '@nestjs/common';

import { type ObjectRecordCreateEvent } from 'twenty-shared/database-events';

import { OnDatabaseBatchEvent } from 'src/engine/api/graphql/graphql-query-runner/decorators/on-database-batch-event.decorator';
import { DatabaseEventAction } from 'src/engine/api/graphql/graphql-query-runner/enums/database-event-action';
import { WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';
import { type AttachmentWorkspaceEntity } from 'src/modules/attachment/standard-objects/attachment.workspace-entity';
import { KnowledgeBaseService } from 'src/engine/core-modules/knowledge-base/knowledge-base.service';

@Injectable()
export class KnowledgeBaseAttachmentListener {
  private readonly logger = new Logger(KnowledgeBaseAttachmentListener.name);

  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @OnDatabaseBatchEvent('attachment', DatabaseEventAction.CREATED)
  async handleAttachmentCreated(
    payload: WorkspaceEventBatch<ObjectRecordCreateEvent<AttachmentWorkspaceEntity>>,
  ) {
    // auto-indexing will be wired when groq/file processing pipeline is ready
    // for now, log the event so we know the listener fires
    this.logger.log(
      'Attachment created in workspace ' + payload.workspaceId +
      ', ' + String(payload.events.length) + ' file(s) — auto-index pending pipeline setup',
    );
  }
}
