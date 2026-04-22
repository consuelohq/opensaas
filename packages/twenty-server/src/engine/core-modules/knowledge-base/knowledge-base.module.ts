import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { FileStorageModule } from 'src/engine/core-modules/file-storage/file-storage.module';
import { KnowledgeBaseService } from 'src/engine/core-modules/knowledge-base/knowledge-base.service';
import { KnowledgeBaseResolver } from 'src/engine/core-modules/knowledge-base/knowledge-base.resolver';
import { KnowledgeBaseAttachmentListener } from 'src/engine/core-modules/knowledge-base/knowledge-base-attachment.listener';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

@Module({
  imports: [AuthModule, FileStorageModule.forRoot(), WorkspaceCacheStorageModule],
  providers: [
    KnowledgeBaseService,
    KnowledgeBaseResolver,
    KnowledgeBaseAttachmentListener,
  ],
  exports: [KnowledgeBaseService],
})
export class KnowledgeBaseModule {}
