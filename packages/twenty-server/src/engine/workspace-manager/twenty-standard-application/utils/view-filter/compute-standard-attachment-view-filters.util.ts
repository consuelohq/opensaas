import { ViewFilterOperand } from 'twenty-shared/types';

import { type FlatViewFilter } from 'src/engine/metadata-modules/flat-view-filter/types/flat-view-filter.type';
import {
  createStandardViewFilterFlatMetadata,
  type CreateStandardViewFilterArgs,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/view-filter/create-standard-view-filter-flat-metadata.util';

export const computeStandardAttachmentViewFilters = (
  args: Omit<CreateStandardViewFilterArgs<'attachment'>, 'context'>,
): Record<string, FlatViewFilter> => {
  return {
    recordingsFileCategoryIsAudio: createStandardViewFilterFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'recordings',
        viewFilterName: 'fileCategoryIsAudio',
        fieldName: 'fileCategory',
        operand: ViewFilterOperand.IS,
        value: JSON.stringify(['RECORDING']),
      },
    }),
    agentFilesFileCategoryIsAgentFile: createStandardViewFilterFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'agentFiles',
        viewFilterName: 'fileCategoryIsAgentFile',
        fieldName: 'fileCategory',
        operand: ViewFilterOperand.IS,
        value: JSON.stringify(['AGENT_FILE']),
      },
    }),
    scriptsFileCategoryIsScript: createStandardViewFilterFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'scripts',
        viewFilterName: 'fileCategoryIsScript',
        fieldName: 'fileCategory',
        operand: ViewFilterOperand.IS,
        value: JSON.stringify(['SCRIPT']),
      },
    }),
    temporaryExpiresAtIsNotEmpty: createStandardViewFilterFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'temporary',
        viewFilterName: 'expiresAtIsNotEmpty',
        fieldName: 'expiresAt',
        operand: ViewFilterOperand.IS_NOT_EMPTY,
        value: '',
      },
    }),
  };
};
