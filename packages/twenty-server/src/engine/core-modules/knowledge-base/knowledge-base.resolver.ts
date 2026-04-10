import { Args, Mutation, Query, Resolver, ObjectType, Field, Float, InputType } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
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
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

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
    return this.knowledgeBaseService.indexFileFromStorage(
      input.fileId, input.collectionId, workspace.id, input.content,
    );
  }
}
