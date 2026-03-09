import { type FlatViewField } from 'src/engine/metadata-modules/flat-view-field/types/flat-view-field.type';
import {
  createStandardViewFieldFlatMetadata,
  type CreateStandardViewFieldArgs,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/view-field/create-standard-view-field-flat-metadata.util';

export const computeStandardListMemberViewFields = (
  args: Omit<CreateStandardViewFieldArgs<'listMember'>, 'context'>,
): Record<string, FlatViewField> => {
  return {
    allListMembersPosition: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'listMember',
      context: {
        viewName: 'allListMembers',
        viewFieldName: 'position',
        fieldName: 'position',
        position: 0,
        isVisible: true,
        size: 100,
      },
    }),
    allListMembersPhoneNumber: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'listMember',
      context: {
        viewName: 'allListMembers',
        viewFieldName: 'phoneNumber',
        fieldName: 'phoneNumber',
        position: 1,
        isVisible: true,
        size: 150,
      },
    }),
    allListMembersStatus: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'listMember',
      context: {
        viewName: 'allListMembers',
        viewFieldName: 'status',
        fieldName: 'status',
        position: 2,
        isVisible: true,
        size: 120,
      },
    }),
    allListMembersDisposition: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'listMember',
      context: {
        viewName: 'allListMembers',
        viewFieldName: 'disposition',
        fieldName: 'disposition',
        position: 3,
        isVisible: true,
        size: 120,
      },
    }),
    allListMembersDuration: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'listMember',
      context: {
        viewName: 'allListMembers',
        viewFieldName: 'duration',
        fieldName: 'duration',
        position: 4,
        isVisible: true,
        size: 100,
      },
    }),
    allListMembersList: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'listMember',
      context: {
        viewName: 'allListMembers',
        viewFieldName: 'list',
        fieldName: 'list',
        position: 5,
        isVisible: true,
        size: 150,
      },
    }),
    allListMembersPerson: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'listMember',
      context: {
        viewName: 'allListMembers',
        viewFieldName: 'person',
        fieldName: 'person',
        position: 6,
        isVisible: true,
        size: 150,
      },
    }),
  };
};
