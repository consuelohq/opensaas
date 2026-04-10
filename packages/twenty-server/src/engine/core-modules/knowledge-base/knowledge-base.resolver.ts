import { Args, Mutation, Query, Resolver, ObjectType, Field, Float, InputType } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { FileStorageDriverFactory } from 'src/engine/core-modules/file-storage/file-storage-driver.factory';
import { KnowledgeBaseService } from 'src/engine/core-modules/knowledge-base/knowledge-base.service';

@ObjectType()
export class KnowledgeSearchResultDto {
  @Field() chunkId!: string;
  @Field() content!: string;
  @Field(() => Float) similarity!: number;
  @Field() collectionId!: string;
  @Field() collectionName!: string;
  @Field() fileId!: string;
}

@ObjectType()
export class KnowledgeCollectionDto {
  @Field() id!: string;
  @Field() name!: string;
  @Field() chunkCount!: number;
}

@ObjectType()
export class KnowledgeIndexResultDto {
  @Field() chunkCount!: number;
}

@InputType()
export class KnowledgeSearchInput {
  @Field() query!: string;
  @Field({ nullable: true }) collectionId?: string;
  @Field({ nullable: true }) limit?: number;
  @Field(() => Float, { nullable: true }) minSimilarity?: number;
}

@InputType()
export class KnowledgeCreateCollectionInput {
  @Field() name!: string;
  @Field({ nullable: true }) description?: string;
}

@InputType()
export class KnowledgeIndexFileInput {
  @Field() fileId!: string;
  @Field() collectionId!: string;
  @Field({ nullable: true }) content?: string;
}

@Resolver()
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
export class KnowledgeBaseResolver {
  constructor(
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly fileStorageDriverFactory: FileStorageDriverFactory,
  ) {}

  @Query(() => [KnowledgeSearchResultDto])
  async knowledgeSearch(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('input') input: KnowledgeSearchInput,
  ): Promise<KnowledgeSearchResultDto[]> {
    return this.knowledgeBaseService.search(input.query, workspace.id, {
      collectionId: input.collectionId,
      limit: input.limit,
      minSimilarity: input.minSimilarity,
    });
  }

  @Query(() => [KnowledgeCollectionDto])
  async knowledgeCollections(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<KnowledgeCollectionDto[]> {
    return this.knowledgeBaseService.listCollections(workspace.id);
  }

  @Mutation(() => KnowledgeCollectionDto)
  async createKnowledgeCollection(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('input') input: KnowledgeCreateCollectionInput,
  ): Promise<KnowledgeCollectionDto> {
    const result = await this.knowledgeBaseService.createCollection(workspace.id, input.name, input.description);
    return { id: result.id, name: result.name, chunkCount: result.chunkCount };
  }

  @Mutation(() => Boolean)
  async deleteKnowledgeCollection(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('collectionId') collectionId: string,
  ): Promise<boolean> {
    await this.knowledgeBaseService.deleteCollection(collectionId, workspace.id);
    return true;
  }

  @Mutation(() => KnowledgeIndexResultDto)
  async indexFileInKnowledgeBase(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('input') input: KnowledgeIndexFileInput,
  ): Promise<KnowledgeIndexResultDto> {
    if (input.content) {
      return this.knowledgeBaseService.indexFile(input.fileId, input.collectionId, input.content, undefined, workspace.id);
    }
    // read file from storage when no content provided
    const filePath = 'workspace-' + workspace.id + '/attachment/' + input.fileId;
    const driver = this.fileStorageDriverFactory.getCurrentDriver();
    const stream = await driver.readFile({ filePath });
    const buffers: Buffer[] = [];
    for await (const chunk of stream) {
      buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(buffers);
    const ext = input.fileId.split('.').pop()?.toLowerCase() ?? '';
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf', doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain', md: 'text/plain', csv: 'text/plain', html: 'text/html',
    };
    const text = await this.knowledgeBaseService.extractText(buffer, mimeMap[ext] ?? 'text/plain');
    return this.knowledgeBaseService.indexFile(input.fileId, input.collectionId, text, undefined, workspace.id);
  }
}
