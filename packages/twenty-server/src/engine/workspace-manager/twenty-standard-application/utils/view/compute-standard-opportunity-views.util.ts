import { type FlatView } from 'src/engine/metadata-modules/flat-view/types/flat-view.type';
import { ViewKey } from 'src/engine/metadata-modules/view/enums/view-key.enum';
import { ViewType } from 'src/engine/metadata-modules/view/enums/view-type.enum';
import {
  createStandardViewFlatMetadata,
  type CreateStandardViewArgs,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/view/create-standard-view-flat-metadata.util';

export const computeStandardOpportunityViews = (
  args: Omit<CreateStandardViewArgs<'opportunity'>, 'context'>,
): Record<string, FlatView> => {
  return {
    allOpportunities: createStandardViewFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'allOpportunities',
        name: 'All Lists',
        type: ViewType.TABLE,
        key: ViewKey.INDEX,
        position: 0,
        icon: 'IconList',
      },
    }),
    byStage: createStandardViewFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'byStage',
        name: 'By Status',
        type: ViewType.KANBAN,
        key: null,
        position: 2,
        icon: 'IconLayoutKanban',
        mainGroupByFieldName: 'listStatus',
      },
    }),
    opportunityRecordPageFields: createStandardViewFlatMetadata({
      ...args,
      objectName: 'opportunity',
      context: {
        viewName: 'opportunityRecordPageFields',
        name: 'List Record Page Fields',
        type: ViewType.FIELDS_WIDGET,
        key: null,
        position: 0,
        icon: 'IconList',
      },
    }),
  };
};
