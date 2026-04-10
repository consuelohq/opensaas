import { Module } from '@nestjs/common';

import { FileStorageModule } from 'src/engine/core-modules/file-storage/file-storage.module';
import { KnowledgeBaseService } from 'src/engine/core-modules/knowledge-base/knowledge-base.service';
import { KnowledgeBaseResolver } from 'src/engine/core-modules/knowledge-base/knowledge-base.resolver';
import { KnowledgeBaseAttachmentListener } from 'src/engine/core-modules/knowledge-base/knowledge-base-attachment.listener';

@Module({
  imports: [FileStorageModule.forRoot()],
  providers: [
    KnowledgeBaseService,
    KnowledgeBaseResolver,
    KnowledgeBaseAttachmentListener,
  ],
  exports: [KnowledgeBaseService],
})
export class KnowledgeBaseModule {}
