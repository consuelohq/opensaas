import { type FlatViewFieldGroup } from 'src/engine/metadata-modules/flat-view-field-group/types/flat-view-field-group.type';
import {
  createStandardViewFieldGroupFlatMetadata,
  type CreateStandardViewFieldGroupArgs,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/view-field-group/create-standard-view-field-group-flat-metadata.util';

export const computeStandardAttachmentViewFieldGroups = (
  args: Omit<CreateStandardViewFieldGroupArgs<'attachment'>, 'context'>,
): Record<string, FlatViewFieldGroup> => {
  return {
    attachmentRecordPageFieldsGeneral: createStandardViewFieldGroupFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'attachmentRecordPageFields',
        viewFieldGroupName: 'general',
        name: 'General',
        position: 0,
        isVisible: true,
      },
    }),
    attachmentRecordPageFieldsAdditional: createStandardViewFieldGroupFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'attachmentRecordPageFields',
        viewFieldGroupName: 'additional',
        name: 'Additional',
        position: 1,
        isVisible: true,
      },
    }),
    attachmentRecordPageFieldsOther: createStandardViewFieldGroupFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'attachmentRecordPageFields',
        viewFieldGroupName: 'other',
        name: 'Other',
        position: 2,
        isVisible: true,
      },
    }),
  };
};
