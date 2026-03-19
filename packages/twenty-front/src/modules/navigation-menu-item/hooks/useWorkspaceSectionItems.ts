import { useRecoilValue } from 'recoil';
import { type NavigationMenuItem } from '~/generated-metadata/graphql';

import { getObjectMetadataForNavigationMenuItem } from '@/navigation-menu-item/utils/getObjectMetadataForNavigationMenuItem';
import { isNavigationMenuItemFolder } from '@/navigation-menu-item/utils/isNavigationMenuItemFolder';
import { NavigationMenuItemType } from '@/navigation-menu-item/constants/NavigationMenuItemType';
import { type ProcessedNavigationMenuItem } from '@/navigation-menu-item/types/processed-navigation-menu-item';
import { type ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';
import { objectMetadataItemsState } from '@/object-metadata/states/objectMetadataItemsState';
import { coreViewsState } from '@/views/states/coreViewState';
import { type View } from '@/views/types/View';
import { convertCoreViewToView } from '@/views/utils/convertCoreViewToView';
import { isDefined } from 'twenty-shared/utils';

import { useNavigationMenuItemsByFolder } from './useNavigationMenuItemsByFolder';
import { usePrefetchedNavigationMenuItemsData } from './usePrefetchedNavigationMenuItemsData';
import { useSortedNavigationMenuItems } from './useSortedNavigationMenuItems';

export type FlatWorkspaceItem =
  | ProcessedNavigationMenuItem
  | (NavigationMenuItem & {
      itemType: NavigationMenuItemType.FOLDER;
    });

export type NavigationMenuItemClickParams = {
  item: FlatWorkspaceItem;
  objectMetadataItem?: ObjectMetadataItem | null;
};

const getWorkspaceItemPriority = (
  item: FlatWorkspaceItem,
  objectMetadataItems: ObjectMetadataItem[],
  views: View[],
) => {
  if (item.itemType === NavigationMenuItemType.FOLDER) {
    return 1;
  }

  if ('objectNameSingular' in item && item.objectNameSingular === 'listMember') {
    return 0;
  }

  const objectMetadataItem = getObjectMetadataForNavigationMenuItem(
    item,
    objectMetadataItems,
    views,
  );

  if (objectMetadataItem?.nameSingular === 'listMember') {
    return 0;
  }

  return 1;
};

export const useWorkspaceSectionItems = (): FlatWorkspaceItem[] => {
  const { workspaceNavigationMenuItems } =
    usePrefetchedNavigationMenuItemsData();
  const { workspaceNavigationMenuItemsSorted } = useSortedNavigationMenuItems();
  const { workspaceNavigationMenuItemsByFolder } =
    useNavigationMenuItemsByFolder();
  const coreViews = useRecoilValue(coreViewsState);
  const objectMetadataItems = useRecoilValue(objectMetadataItemsState);

  const views = coreViews.map(convertCoreViewToView);

  const flatWorkspaceItems = workspaceNavigationMenuItems
    .filter((item) => !isDefined(item.folderId))
    .sort((a, b) => a.position - b.position);

  const processedObjectViewsById = new Map(
    workspaceNavigationMenuItemsSorted.map((item) => [item.id, item]),
  );

  const folderChildrenById = new Map(
    workspaceNavigationMenuItemsByFolder.map((folder) => [
      folder.id,
      folder.navigationMenuItems,
    ]),
  );

  const flatItems: FlatWorkspaceItem[] = flatWorkspaceItems.reduce<
    FlatWorkspaceItem[]
  >((acc, item) => {
    if (isNavigationMenuItemFolder(item)) {
      acc.push({ ...item, itemType: NavigationMenuItemType.FOLDER });
    } else {
      const processedItem = processedObjectViewsById.get(item.id);
      if (!isDefined(processedItem)) {
        return acc;
      }
      if (processedItem.itemType === NavigationMenuItemType.LINK) {
        acc.push(processedItem);
      } else {
        const objectMetadataItem = getObjectMetadataForNavigationMenuItem(
          processedItem,
          objectMetadataItems,
          views,
        );
        if (isDefined(objectMetadataItem)) {
          acc.push(processedItem);
        }
      }
    }
    return acc;
  }, []);

  const prioritizedFlatItems = [...flatItems].sort((a, b) => {
    const priorityA = getWorkspaceItemPriority(a, objectMetadataItems, views);
    const priorityB = getWorkspaceItemPriority(b, objectMetadataItems, views);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return a.position - b.position;
  });

  return prioritizedFlatItems.flatMap((item) =>
    item.itemType === NavigationMenuItemType.FOLDER
      ? [item, ...(folderChildrenById.get(item.id) ?? [])]
      : [item],
  );
};
