import { type FlatView } from 'src/engine/metadata-modules/flat-view/types/flat-view.type';
import { ViewKey } from 'src/engine/metadata-modules/view/enums/view-key.enum';
import { ViewType } from 'src/engine/metadata-modules/view/enums/view-type.enum';
import {
  createStandardViewFlatMetadata,
  type CreateStandardViewArgs,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/view/create-standard-view-flat-metadata.util';

export const computeStandardAttachmentViews = (
  args: Omit<CreateStandardViewArgs<'attachment'>, 'context'>,
): Record<string, FlatView> => {
  return {
    allAttachments: createStandardViewFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'allAttachments',
        name: 'All Files',
        type: ViewType.TABLE,
        key: ViewKey.INDEX,
        position: 0,
        icon: 'IconFiles',
      },
    }),
    recordings: createStandardViewFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'recordings',
        name: 'Recordings',
        type: ViewType.TABLE,
        key: null,
        position: 1,
        icon: 'IconMicrophone',
      },
    }),
    agentFiles: createStandardViewFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'agentFiles',
        name: 'Agent Files',
        type: ViewType.TABLE,
        key: null,
        position: 2,
        icon: 'IconRobot',
      },
    }),
    scripts: createStandardViewFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'scripts',
        name: 'Scripts',
        type: ViewType.TABLE,
        key: null,
        position: 3,
        icon: 'IconCode',
      },
    }),
    temporary: createStandardViewFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'temporary',
        name: 'Temporary',
        type: ViewType.TABLE,
        key: null,
        position: 4,
        icon: 'IconClock',
      },
    }),
    attachmentRecordPageFields: createStandardViewFlatMetadata({
      ...args,
      objectName: 'attachment',
      context: {
        viewName: 'attachmentRecordPageFields',
        name: 'Attachment Record Page Fields',
        type: ViewType.FIELDS_WIDGET,
        key: null,
        position: 0,
        icon: 'IconList',
      },
    }),
  };
};
