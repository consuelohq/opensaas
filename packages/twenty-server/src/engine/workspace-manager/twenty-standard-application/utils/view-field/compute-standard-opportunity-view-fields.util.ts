import { type FlatViewField } from 'src/engine/metadata-modules/flat-view-field/types/flat-view-field.type';
import {
  createStandardViewFieldFlatMetadata,
  type CreateStandardViewFieldArgs,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/view-field/create-standard-view-field-flat-metadata.util';

export const computeStandardOpportunityViewFields = (
  args: Omit<CreateStandardViewFieldArgs<'opportunity'>, 'context'>,
): Record<string, FlatViewField> => {
  return {
    // allOpportunities view fields
    allOpportunitiesName: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'allOpportunities',
        viewFieldName: 'name',
        fieldName: 'name',
        position: 0,
        isVisible: true,
        size: 150,
      },
    }),
    allOpportunitiesListStatus: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'allOpportunities',
        viewFieldName: 'listStatus',
        fieldName: 'listStatus',
        position: 1,
        isVisible: true,
        size: 120,
      },
    }),
    allOpportunitiesContactCount: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'allOpportunities',
        viewFieldName: 'contactCount',
        fieldName: 'contactCount',
        position: 2,
        isVisible: true,
        size: 100,
      },
    }),
    allOpportunitiesOrdering: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'allOpportunities',
        viewFieldName: 'ordering',
        fieldName: 'ordering',
        position: 3,
        isVisible: true,
        size: 120,
      },
    }),
    allOpportunitiesOwner: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'allOpportunities',
        viewFieldName: 'owner',
        fieldName: 'owner',
        position: 4,
        isVisible: true,
        size: 150,
      },
    }),
    allOpportunitiesSessionStartedAt: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'allOpportunities',
        viewFieldName: 'sessionStartedAt',
        fieldName: 'sessionStartedAt',
        position: 5,
        isVisible: true,
        size: 150,
      },
    }),
    allOpportunitiesElapsedSeconds: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'allOpportunities',
        viewFieldName: 'elapsedSeconds',
        fieldName: 'elapsedSeconds',
        position: 6,
        isVisible: true,
        size: 100,
      },
    }),

    // byStage view fields
    byStageName: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'byStage',
        viewFieldName: 'name',
        fieldName: 'name',
        position: 0,
        isVisible: true,
        size: 150,
      },
    }),
    byStageContactCount: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'byStage',
        viewFieldName: 'contactCount',
        fieldName: 'contactCount',
        position: 1,
        isVisible: true,
        size: 100,
      },
    }),
    byStageOrdering: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'byStage',
        viewFieldName: 'ordering',
        fieldName: 'ordering',
        position: 2,
        isVisible: true,
        size: 120,
      },
    }),
    byStageOwner: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'byStage',
        viewFieldName: 'owner',
        fieldName: 'owner',
        position: 3,
        isVisible: true,
        size: 150,
      },
    }),

    // opportunityRecordPageFields view fields
    opportunityRecordPageFieldsListStatus: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'opportunityRecordPageFields',
        viewFieldName: 'listStatus',
        fieldName: 'listStatus',
        position: 0,
        isVisible: true,
        size: 150,
        viewFieldGroupName: 'general',
      },
    }),
    opportunityRecordPageFieldsOrdering: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'opportunityRecordPageFields',
        viewFieldName: 'ordering',
        fieldName: 'ordering',
        position: 1,
        isVisible: true,
        size: 150,
        viewFieldGroupName: 'general',
      },
    }),
    opportunityRecordPageFieldsContactCount:
      createStandardViewFieldFlatMetadata({
        ...args,
        objectName: 'opportunity',
        context: {
          viewName: 'opportunityRecordPageFields',
          viewFieldName: 'contactCount',
          fieldName: 'contactCount',
          position: 2,
          isVisible: true,
          size: 150,
          viewFieldGroupName: 'general',
        },
      }),
    opportunityRecordPageFieldsOwner: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'opportunityRecordPageFields',
        viewFieldName: 'owner',
        fieldName: 'owner',
        position: 3,
        isVisible: true,
        size: 150,
        viewFieldGroupName: 'general',
      },
    }),
    opportunityRecordPageFieldsSessionStartedAt:
      createStandardViewFieldFlatMetadata({
        ...args,
        objectName: 'opportunity',
        context: {
          viewName: 'opportunityRecordPageFields',
          viewFieldName: 'sessionStartedAt',
          fieldName: 'sessionStartedAt',
          position: 0,
          isVisible: true,
          size: 150,
          viewFieldGroupName: 'session',
        },
      }),
    opportunityRecordPageFieldsSessionEndedAt:
      createStandardViewFieldFlatMetadata({
        ...args,
        objectName: 'opportunity',
        context: {
          viewName: 'opportunityRecordPageFields',
          viewFieldName: 'sessionEndedAt',
          fieldName: 'sessionEndedAt',
          position: 1,
          isVisible: true,
          size: 150,
          viewFieldGroupName: 'session',
        },
      }),
    opportunityRecordPageFieldsElapsedSeconds:
      createStandardViewFieldFlatMetadata({
        ...args,
        objectName: 'opportunity',
        context: {
          viewName: 'opportunityRecordPageFields',
          viewFieldName: 'elapsedSeconds',
          fieldName: 'elapsedSeconds',
          position: 2,
          isVisible: true,
          size: 150,
          viewFieldGroupName: 'session',
        },
      }),
    opportunityRecordPageFieldsCurrentIndex:
      createStandardViewFieldFlatMetadata({
        ...args,
        objectName: 'opportunity',
        context: {
          viewName: 'opportunityRecordPageFields',
          viewFieldName: 'currentIndex',
          fieldName: 'currentIndex',
          position: 3,
          isVisible: true,
          size: 150,
          viewFieldGroupName: 'session',
        },
      }),
    opportunityRecordPageFieldsCreatedAt: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'opportunityRecordPageFields',
        viewFieldName: 'createdAt',
        fieldName: 'createdAt',
        position: 0,
        isVisible: true,
        size: 150,
        viewFieldGroupName: 'other',
      },
    }),
    opportunityRecordPageFieldsCreatedBy: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'opportunityRecordPageFields',
        viewFieldName: 'createdBy',
        fieldName: 'createdBy',
        position: 1,
        isVisible: true,
        size: 150,
        viewFieldGroupName: 'other',
      },
    }),
  };
};
