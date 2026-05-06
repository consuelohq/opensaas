import { BadRequestException, UseGuards } from '@nestjs/common';
import {
  Args,
  Field,
  InputType,
  Int,
  Mutation,
  ObjectType,
} from '@nestjs/graphql';

import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { type UserEntity } from 'src/engine/core-modules/user/user.entity';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { DialerCallStartService } from 'src/engine/core-modules/consuelo-api/services/dialer-call-start.service';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@InputType()
export class StartDialerCallInput {
  @Field()
  source!: string;

  @Field()
  selectionStrategy!: string;

  @Field(() => Int)
  requestedFanout!: number;

  @Field({ nullable: true })
  targetPhone?: string;

  @Field(() => [String], { nullable: true })
  targetPhones?: string[];

  @Field({ nullable: true })
  contactId?: string;

  @Field(() => [String], { nullable: true })
  contactIds?: string[];

  @Field({ nullable: true })
  queueId?: string;

  @Field({ nullable: true })
  callerIdNumber?: string;

  @Field({ nullable: true })
  callMode?: string;
}

@ObjectType()
export class DialerCallStartCapacityDTO {
  @Field(() => Int)
  requestedFanout!: number;

  @Field(() => Int)
  callableTargetCount!: number;

  @Field(() => Int)
  availableCallerIdCount!: number;

  @Field(() => [String])
  reducedCapacityReasons!: string[];

  @Field(() => [String])
  blockedReasons!: string[];

  @Field(() => Int)
  actualFanout!: number;
}

@ObjectType()
export class DialerCallStartCallDTO {
  @Field()
  callSid!: string;

  @Field()
  contactId!: string;

  @Field()
  customerNumber!: string;

  @Field()
  callerId!: string;

  @Field()
  status!: string;

  @Field(() => Int)
  position!: number;
}

@ObjectType()
export class DialerCallStartResultDTO {
  @Field()
  sessionId!: string;

  @Field()
  queueId!: string;

  @Field()
  selectionStrategy!: string;

  @Field(() => Int)
  requestedFanout!: number;

  @Field(() => Int)
  actualFanout!: number;

  @Field()
  status!: string;

  @Field(() => DialerCallStartCapacityDTO)
  capacity!: DialerCallStartCapacityDTO;

  @Field(() => [DialerCallStartCallDTO])
  calls!: DialerCallStartCallDTO[];
}

@MetadataResolver()
@UseGuards(WorkspaceAuthGuard)
export class DialerCallStartResolver {
  constructor(
    private readonly dialerCallStartService: DialerCallStartService,
  ) {}

  @Mutation(() => DialerCallStartResultDTO)
  @UseGuards(NoPermissionGuard)
  async startDialerCall(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: UserEntity,
    @Args('input') input: StartDialerCallInput,
  ): Promise<DialerCallStartResultDTO> {
    return this.dialerCallStartService.startDialerCall({
      workspaceId: workspace.id,
      userId: user.id,
      input: {
        source: this.parseSource(input.source),
        selectionStrategy: this.parseSelectionStrategy(input.selectionStrategy),
        requestedFanout: input.requestedFanout,
        targetPhone: input.targetPhone,
        targetPhones: input.targetPhones,
        contactId: input.contactId,
        contactIds: input.contactIds,
        queueId: input.queueId,
        callerIdNumber: input.callerIdNumber,
        callMode: this.parseCallMode(input.callMode),
      },
    });
  }

  private parseSource(value: string): 'direct' | 'queue' {
    if (value === 'direct' || value === 'queue') {
      return value;
    }

    throw new BadRequestException(`Unsupported dialer call source: ${value}`);
  }

  private parseSelectionStrategy(value: string): 'single' | 'predictive' {
    if (value === 'single' || value === 'predictive') {
      return value;
    }

    throw new BadRequestException(
      `Unsupported dialer selection strategy: ${value}`,
    );
  }

  private parseCallMode(
    value: string | undefined,
  ): 'mock' | 'twilio-test' | 'live' | null {
    if (value === undefined) {
      return null;
    }

    if (value === 'mock' || value === 'twilio-test' || value === 'live') {
      return value;
    }

    throw new BadRequestException(`Unsupported dialer call mode: ${value}`);
  }
}
