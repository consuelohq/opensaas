import { FieldActorSource } from 'twenty-shared/types';
import { type EntityManager } from 'typeorm';

export const OPPORTUNITY_STRIPE_PLATFORM_MIGRATION_ID =
  '822639e5-9bf7-40f1-8882-a11140362339';
export const OPPORTUNITY_ANTHROPIC_AI_MODEL_ID =
  'fc747edc-cb00-4078-8d6b-1fab2611dae4';
export const OPPORTUNITY_NOTION_WORKSPACE_ID =
  '75de302f-1044-4957-8da4-1f67ebefd52b';
export const OPPORTUNITY_STRIPE_API_INTEGRATION_ID =
  '2beb07b0-340c-41d7-be33-5aa91757f329';
export const OPPORTUNITY_AIRBNB_ENTERPRISE_ID =
  '9543adcf-ec03-44e2-9233-3c2d3ebae98a';
export const OPPORTUNITY_FIGMA_DESIGN_ID =
  '9457f8e9-16ae-43b9-92ee-cbd21f3dded5';

export const prefillOpportunities = async (
  entityManager: EntityManager,
  schemaName: string,
) => {
  const workspaceMember = await entityManager
    .createQueryBuilder()
    .select('id')
    .from(`${schemaName}.workspaceMember`, 'workspaceMember')
    .limit(1)
    .getRawOne();

  const ownerId = workspaceMember?.id ?? null;

  await entityManager
    .createQueryBuilder()
    .insert()
    .into(`${schemaName}.opportunity`, [
      'id',
      'name',
      'listStatus',
      'ordering',
      'contactCount',
      'position',
      'companyId',
      'pointOfContactId',
      'ownerId',
      'createdBySource',
      'createdByWorkspaceMemberId',
      'createdByName',
      'updatedBySource',
      'updatedByWorkspaceMemberId',
      'updatedByName',
    ])
    .orIgnore()
    .values([
      {
        id: OPPORTUNITY_STRIPE_PLATFORM_MIGRATION_ID,
        name: 'New Leads Q1',
        listStatus: 'ACTIVE',
        ordering: 'SEQUENTIAL',
        contactCount: 150,
        position: 1,
        companyId: null,
        pointOfContactId: null,
        ownerId,
        createdBySource: FieldActorSource.SYSTEM,
        createdByWorkspaceMemberId: null,
        createdByName: 'System',
        updatedBySource: FieldActorSource.SYSTEM,
        updatedByWorkspaceMemberId: null,
        updatedByName: 'System',
      },
      {
        id: OPPORTUNITY_ANTHROPIC_AI_MODEL_ID,
        name: 'Follow-up Callbacks',
        listStatus: 'ACTIVE',
        ordering: 'ROUND_ROBIN',
        contactCount: 45,
        position: 2,
        companyId: null,
        pointOfContactId: null,
        ownerId,
        createdBySource: FieldActorSource.SYSTEM,
        createdByWorkspaceMemberId: null,
        createdByName: 'System',
        updatedBySource: FieldActorSource.SYSTEM,
        updatedByWorkspaceMemberId: null,
        updatedByName: 'System',
      },
      {
        id: OPPORTUNITY_NOTION_WORKSPACE_ID,
        name: 'Enterprise Prospects',
        listStatus: 'IDLE',
        ordering: 'SEQUENTIAL',
        contactCount: 200,
        position: 3,
        companyId: null,
        pointOfContactId: null,
        ownerId,
        createdBySource: FieldActorSource.SYSTEM,
        createdByWorkspaceMemberId: null,
        createdByName: 'System',
        updatedBySource: FieldActorSource.SYSTEM,
        updatedByWorkspaceMemberId: null,
        updatedByName: 'System',
      },
      {
        id: OPPORTUNITY_STRIPE_API_INTEGRATION_ID,
        name: 'West Coast Territory',
        listStatus: 'ACTIVE',
        ordering: 'SEQUENTIAL',
        contactCount: 89,
        position: 4,
        companyId: null,
        pointOfContactId: null,
        ownerId,
        createdBySource: FieldActorSource.SYSTEM,
        createdByWorkspaceMemberId: null,
        createdByName: 'System',
        updatedBySource: FieldActorSource.SYSTEM,
        updatedByWorkspaceMemberId: null,
        updatedByName: 'System',
      },
      {
        id: OPPORTUNITY_AIRBNB_ENTERPRISE_ID,
        name: 'Renewal Outreach',
        listStatus: 'PAUSED',
        ordering: 'ROUND_ROBIN',
        contactCount: 67,
        position: 5,
        companyId: null,
        pointOfContactId: null,
        ownerId,
        createdBySource: FieldActorSource.SYSTEM,
        createdByWorkspaceMemberId: null,
        createdByName: 'System',
        updatedBySource: FieldActorSource.SYSTEM,
        updatedByWorkspaceMemberId: null,
        updatedByName: 'System',
      },
      {
        id: OPPORTUNITY_FIGMA_DESIGN_ID,
        name: 'Event Follow-ups',
        listStatus: 'COMPLETED',
        ordering: 'SEQUENTIAL',
        contactCount: 32,
        position: 6,
        companyId: null,
        pointOfContactId: null,
        ownerId,
        createdBySource: FieldActorSource.SYSTEM,
        createdByWorkspaceMemberId: null,
        createdByName: 'System',
        updatedBySource: FieldActorSource.SYSTEM,
        updatedByWorkspaceMemberId: null,
        updatedByName: 'System',
      },
    ])
    .returning('*')
    .execute();
};
