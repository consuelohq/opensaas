import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { PageLayoutTabLayoutMode } from 'twenty-shared/types';

import { PageLayoutType } from 'src/engine/metadata-modules/page-layout/enums/page-layout-type.enum';
import { WidgetType } from 'src/engine/metadata-modules/page-layout-widget/enums/widget-type.enum';
import {
  CONDITIONAL_DISPLAY_DEVICE_DESKTOP,
  CONDITIONAL_DISPLAY_DEVICE_MOBILE,
  TAB_PROPS,
  WIDGET_PROPS,
} from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-page-layout-tabs.template';
import {
  type StandardPageLayoutConfig,
  type StandardPageLayoutTabConfig,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/page-layout-config/standard-page-layout-config.type';

const ATTACHMENT_PAGE_TABS = {
  home: {
    universalIdentifier: '20202020-ab10-4010-8010-f11e5a11a401',
    ...TAB_PROPS.home,
    widgets: {
      fields: {
        universalIdentifier: '20202020-ac10-4010-8010-f11e5a11a411',
        ...WIDGET_PROPS.fields,
      },
      filePreviewMobile: {
        universalIdentifier: '20202020-ac10-4010-8010-f11e5a11a412',
        title: 'File Preview',
        type: WidgetType.FILE_PREVIEW,
        gridPosition: WIDGET_PROPS.noteRichText.gridPosition,
        position: { layoutMode: TAB_PROPS.home.layoutMode, index: 1 },
        conditionalDisplay: CONDITIONAL_DISPLAY_DEVICE_MOBILE,
      },
    },
  },
  filePreview: {
    universalIdentifier: '20202020-ab10-4010-8010-f11e5a11a402',
    title: 'File Preview',
    position: 15,
    icon: 'IconFileDescription',
    layoutMode: PageLayoutTabLayoutMode.CANVAS,
    widgets: {
      filePreview: {
        universalIdentifier: '20202020-ac10-4010-8010-f11e5a11a421',
        title: 'File Preview',
        type: WidgetType.FILE_PREVIEW,
        gridPosition: WIDGET_PROPS.timeline.gridPosition,
        position: WIDGET_PROPS.timeline.position,
        conditionalDisplay: CONDITIONAL_DISPLAY_DEVICE_DESKTOP,
      },
    },
  },
  timeline: {
    universalIdentifier: '20202020-ab10-4010-8010-f11e5a11a403',
    ...TAB_PROPS.timeline,
    widgets: {
      timeline: {
        universalIdentifier: '20202020-ac10-4010-8010-f11e5a11a431',
        ...WIDGET_PROPS.timeline,
      },
    },
  },
} as const satisfies Record<string, StandardPageLayoutTabConfig>;

export const STANDARD_ATTACHMENT_PAGE_LAYOUT_CONFIG = {
  name: 'Default Attachment Layout',
  type: PageLayoutType.RECORD_PAGE,
  objectUniversalIdentifier: STANDARD_OBJECTS.attachment.universalIdentifier,
  universalIdentifier: '20202020-a110-4010-8010-f11e5a11a010',
  defaultTabUniversalIdentifier: null,
  tabs: ATTACHMENT_PAGE_TABS,
} as const satisfies StandardPageLayoutConfig;
