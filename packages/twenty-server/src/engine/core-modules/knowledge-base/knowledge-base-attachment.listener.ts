import { Injectable, Logger } from '@nestjs/common';

import { type ObjectRecordCreateEvent } from 'twenty-shared/database-events';

import { OnDatabaseBatchEvent } from 'src/engine/api/graphql/graphql-query-runner/decorators/on-database-batch-event.decorator';
import { DatabaseEventAction } from 'src/engine/api/graphql/graphql-query-runner/enums/database-event-action';
import { ExceptionHandlerService } from 'src/engine/core-modules/exception-handler/exception-handler.service';
import { FileStorageService } from 'src/engine/core-modules/file-storage/file-storage.service';
import { KnowledgeBaseService } from 'src/engine/core-modules/knowledge-base/knowledge-base.service';
import { WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';
import { type AttachmentWorkspaceEntity } from 'src/modules/attachment/standard-objects/attachment.workspace-entity';

// mime types we can extract text from
const INDEXABLE_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
]);

const DEFAULT_COLLECTION_NAME = 'default';

@Injectable()
export class KnowledgeBaseAttachmentListener {
  private readonly logger = new Logger(KnowledgeBaseAttachmentListener.name);

  constructor(
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly fileStorageService: FileStorageService,
    private readonly exceptionHandlerService: ExceptionHandlerService,
  ) {}

  @OnDatabaseBatchEvent('attachment', DatabaseEventAction.CREATED)
  async handleAttachmentCreated(
    payload: WorkspaceEventBatch<ObjectRecordCreateEvent<AttachmentWorkspaceEntity>>,
  ) {
    for (const event of payload.events) {
      try {
        await this.indexAttachment(payload.workspaceId, event.properties.after);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'unknown error';
        this.logger.error('Auto-index failed for attachment: ' + message);
        this.exceptionHandlerService.captureExceptions([err instanceof Error ? err : new Error(message)], {
          workspace: { id: payload.workspaceId },
        });
      }
    }
  }

  private async indexAttachment(workspaceId: string, attachment: AttachmentWorkspaceEntity) {
    const files = attachment.file;

    if (!files || files.length === 0) {
      return;
    }

    const fileInfo = files[0];

    if (!fileInfo) {
      return;
    }

    // check if the file type is indexable
    // fileInfo doesn't have mimeType directly, so we infer from extension
    const ext = (fileInfo.label ?? '').split('.').pop()?.toLowerCase() ?? '';
    const indexableExts = new Set(['pdf', 'doc', 'docx', 'txt', 'md', 'csv', 'html']);

    if (!indexableExts.has(ext)) {
      return;
    }

    // get or create default collection
    let collection: { id: string } | undefined;
    const collections = await this.knowledgeBaseService.listCollections(workspaceId);
    const defaultCol = collections.find(c => c.name === DEFAULT_COLLECTION_NAME);

    if (defaultCol) {
      collection = defaultCol;
    } else {
      try {
        collection = await this.knowledgeBaseService.createCollection(workspaceId, DEFAULT_COLLECTION_NAME, 'Auto-indexed files');
      } catch (err: unknown) {
        // race condition — another event may have created it
        const cols = await this.knowledgeBaseService.listCollections(workspaceId);
        collection = cols.find(c => c.name === DEFAULT_COLLECTION_NAME);

        if (!collection) {
          throw err;
        }
      }
    }

    // read file from storage
    const filePath = fileInfo.fileId
      ? 'workspace-' + workspaceId + '/attachment/' + fileInfo.fileId
      : attachment.fullPath;

    if (!filePath) {
      return;
    }

    const stream = await this.fileStorageService.readFileLegacy({ filePath });

    // collect stream into buffer
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const buffer = Buffer.concat(chunks);

    // determine mime type from extension
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
      md: 'text/plain',
      csv: 'text/plain',
      html: 'text/html',
    };

    const mimeType = mimeMap[ext] ?? 'text/plain';

    // extract text
    const text = await this.knowledgeBaseService.extractText(buffer, mimeType);

    if (!text || text.trim().length === 0) {
      return;
    }

    // index
    const fileId = fileInfo.fileId ?? attachment.id;
    const result = await this.knowledgeBaseService.indexFile(
      fileId,
      collection.id,
      text,
      fileInfo.label ?? attachment.name ?? 'unnamed',
      workspaceId,
    );

    this.logger.log(
      'Auto-indexed attachment ' + attachment.id + ' (' + String(result.chunkCount) + ' chunks) in workspace ' + workspaceId,
    );
  }
}
