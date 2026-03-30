import { Field, InputType, ObjectType } from '@nestjs/graphql';

import { IsOptional, IsString } from 'class-validator';

@ObjectType('DiscordBotConfig')
export class DiscordBotConfigDto {
  @Field(() => String)
  id: string;

  @Field(() => String, { nullable: true })
  botToken?: string;

  @Field(() => String)
  publicKey: string;

  @Field(() => String)
  applicationId: string;

  @Field(() => String, { nullable: true })
  clientSecret?: string;

  @Field(() => String, { nullable: true })
  interactionsEndpointUrl?: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@InputType('UpdateDiscordBotConfigInput')
export class UpdateDiscordBotConfigInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  botToken?: string;

  @Field(() => String)
  @IsString()
  publicKey: string;

  @Field(() => String)
  @IsString()
  applicationId: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  clientSecret?: string;
}

@ObjectType('DiscordInviteUrl')
export class DiscordInviteUrlDto {
  @Field(() => String)
  inviteUrl: string;

  @Field(() => [String])
  requiredPermissions: string[];
}

@ObjectType('DiscordConnectionStatus')
export class DiscordConnectionStatusDto {
  @Field(() => Boolean)
  linked: boolean;

  @Field(() => String, { nullable: true })
  discordUserId?: string;

  @Field(() => String, { nullable: true })
  discordUsername?: string;

  @Field(() => String, { nullable: true })
  discordAvatar?: string;

  @Field(() => Date, { nullable: true })
  linkedAt?: Date;
}
