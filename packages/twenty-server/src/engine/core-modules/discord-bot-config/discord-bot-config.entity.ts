import { Field, ObjectType } from '@nestjs/graphql';

import { IDField } from '@ptc-org/nestjs-query-graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { WorkspaceRelatedEntity } from 'src/engine/workspace-manager/types/workspace-related-entity';

@Entity({ name: 'discordBotConfig', schema: 'core' })
@ObjectType('DiscordBotConfig')
@Index('IDX_DISCORD_BOT_CONFIG_WORKSPACE_ID', ['workspaceId'])
export class DiscordBotConfigEntity extends WorkspaceRelatedEntity {
  @IDField(() => UUIDScalarType)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(() => String)
  @Column({ type: 'text' })
  botToken: string;

  @Field(() => String)
  @Column({ type: 'text' })
  publicKey: string;

  @Field(() => String)
  @Column({ type: 'text' })
  applicationId: string;

  @Field(() => String)
  @Column({ type: 'text' })
  clientSecret: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  interactionsEndpointUrl?: string;

  @Field(() => Date)
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Field(() => Date)
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
