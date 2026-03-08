import { type PhonesMetadata } from 'twenty-shared/types';

import { BaseWorkspaceEntity } from 'src/engine/twenty-orm/base.workspace-entity';
import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

export class ListMemberWorkspaceEntity extends BaseWorkspaceEntity {
  position: number | null;
  phoneNumber: PhonesMetadata | null;
  status: string;
  disposition: string | null;
  callSid: string | null;
  duration: number | null;
  attemptedAt: Date | null;
  list: EntityRelation<OpportunityWorkspaceEntity> | null;
  listId: string | null;
  person: EntityRelation<PersonWorkspaceEntity> | null;
  personId: string | null;
}
