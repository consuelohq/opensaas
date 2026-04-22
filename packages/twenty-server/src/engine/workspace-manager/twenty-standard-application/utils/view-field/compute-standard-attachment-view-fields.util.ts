import { type FlatViewField } from 'src/engine/metadata-modules/flat-view-field/types/flat-view-field.type';
import {
  createStandardViewFieldFlatMetadata,
  type CreateStandardViewFieldArgs,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/view-field/create-standard-view-field-flat-metadata.util';

export const computeStandardAttachmentViewFields = (
  args: Omit<CreateStandardViewFieldArgs<'attachment'>, 'context'>,
): Record<string, FlatViewField> => {
  return {
    // allAttachments view fields
    allAttachmentsName: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'allAttachments',
        viewFieldName: 'name',
        fieldName: 'name',
        position: 0,
        isVisible: true,
        size: 210,
      },
    }),
    allAttachmentsFile: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'allAttachments',
        viewFieldName: 'file',
        fieldName: 'file',
        position: 1,
        isVisible: true,
        size: 150,
      },
    }),
    allAttachmentsFileCategory: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'allAttachments',
        viewFieldName: 'fileCategory',
        fieldName: 'fileCategory',
        position: 2,
        isVisible: true,
        size: 120,
      },
    }),
    allAttachmentsCreatedBy: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'allAttachments',
        viewFieldName: 'createdBy',
        fieldName: 'createdBy',
        position: 3,
        isVisible: true,
        size: 150,
      },
    }),
    allAttachmentsCreatedAt: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'allAttachments',
        viewFieldName: 'createdAt',
        fieldName: 'createdAt',
        position: 4,
        isVisible: true,
        size: 120,
      },
    }),

    // recordings view fields
    recordingsName: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'recordings',
        viewFieldName: 'name',
        fieldName: 'name',
        position: 0,
        isVisible: true,
        size: 210,
      },
    }),
    recordingsFile: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'recordings',
        viewFieldName: 'file',
        fieldName: 'file',
        position: 1,
        isVisible: true,
        size: 150,
      },
    }),
    recordingsFileCategory: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'recordings',
        viewFieldName: 'fileCategory',
        fieldName: 'fileCategory',
        position: 2,
        isVisible: true,
        size: 120,
      },
    }),
    recordingsCreatedBy: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'recordings',
        viewFieldName: 'createdBy',
        fieldName: 'createdBy',
        position: 3,
        isVisible: true,
        size: 150,
      },
    }),
    recordingsCreatedAt: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'recordings',
        viewFieldName: 'createdAt',
        fieldName: 'createdAt',
        position: 4,
        isVisible: true,
        size: 120,
      },
    }),

    // agentFiles view fields
    agentFilesName: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'agentFiles',
        viewFieldName: 'name',
        fieldName: 'name',
        position: 0,
        isVisible: true,
        size: 210,
      },
    }),
    agentFilesFile: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'agentFiles',
        viewFieldName: 'file',
        fieldName: 'file',
        position: 1,
        isVisible: true,
        size: 150,
      },
    }),
    agentFilesFileCategory: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'agentFiles',
        viewFieldName: 'fileCategory',
        fieldName: 'fileCategory',
        position: 2,
        isVisible: true,
        size: 120,
      },
    }),
    agentFilesCreatedBy: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'agentFiles',
        viewFieldName: 'createdBy',
        fieldName: 'createdBy',
        position: 3,
        isVisible: true,
        size: 150,
      },
    }),
    agentFilesCreatedAt: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'agentFiles',
        viewFieldName: 'createdAt',
        fieldName: 'createdAt',
        position: 4,
        isVisible: true,
        size: 120,
      },
    }),

    // scripts view fields
    scriptsName: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'scripts',
        viewFieldName: 'name',
        fieldName: 'name',
        position: 0,
        isVisible: true,
        size: 210,
      },
    }),
    scriptsFile: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'scripts',
        viewFieldName: 'file',
        fieldName: 'file',
        position: 1,
        isVisible: true,
        size: 150,
      },
    }),
    scriptsFileCategory: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'scripts',
        viewFieldName: 'fileCategory',
        fieldName: 'fileCategory',
        position: 2,
        isVisible: true,
        size: 120,
      },
    }),
    scriptsCreatedBy: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'scripts',
        viewFieldName: 'createdBy',
        fieldName: 'createdBy',
        position: 3,
        isVisible: true,
        size: 150,
      },
    }),
    scriptsCreatedAt: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'scripts',
        viewFieldName: 'createdAt',
        fieldName: 'createdAt',
        position: 4,
        isVisible: true,
        size: 120,
      },
    }),

    // temporary view fields
    temporaryName: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'temporary',
        viewFieldName: 'name',
        fieldName: 'name',
        position: 0,
        isVisible: true,
        size: 210,
      },
    }),
    temporaryFile: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'temporary',
        viewFieldName: 'file',
        fieldName: 'file',
        position: 1,
        isVisible: true,
        size: 150,
      },
    }),
    temporaryExpiresAt: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'temporary',
        viewFieldName: 'expiresAt',
        fieldName: 'expiresAt',
        position: 2,
        isVisible: true,
        size: 120,
      },
    }),
    temporaryCreatedBy: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'temporary',
        viewFieldName: 'createdBy',
        fieldName: 'createdBy',
        position: 3,
        isVisible: true,
        size: 150,
      },
    }),
    temporaryCreatedAt: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'temporary',
        viewFieldName: 'createdAt',
        fieldName: 'createdAt',
        position: 4,
        isVisible: true,
        size: 120,
      },
    }),

    // attachmentRecordPageFields view fields
    attachmentRecordPageFieldsName: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'attachmentRecordPageFields',
        viewFieldName: 'name',
        fieldName: 'name',
        position: 0,
        isVisible: true,
        size: 150,
        viewFieldGroupName: 'general',
      },
    }),
    attachmentRecordPageFieldsFile: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'attachmentRecordPageFields',
        viewFieldName: 'file',
        fieldName: 'file',
        position: 1,
        isVisible: true,
        size: 150,
        viewFieldGroupName: 'general',
      },
    }),
    attachmentRecordPageFieldsFileCategory: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'attachmentRecordPageFields',
        viewFieldName: 'fileCategory',
        fieldName: 'fileCategory',
        position: 2,
        isVisible: true,
        size: 150,
        viewFieldGroupName: 'general',
      },
    }),
    attachmentRecordPageFieldsCreatedAt: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'attachmentRecordPageFields',
        viewFieldName: 'createdAt',
        fieldName: 'createdAt',
        position: 0,
        isVisible: true,
        size: 150,
        viewFieldGroupName: 'other',
      },
    }),
    attachmentRecordPageFieldsCreatedBy: createStandardViewFieldFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'attachmentRecordPageFields',
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
