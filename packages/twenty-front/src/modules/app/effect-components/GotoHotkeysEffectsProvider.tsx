import { GoToHotkeyItemEffect } from '@/app/effect-components/GoToHotkeyItemEffect';
import { useFilteredObjectMetadataItems } from '@/object-metadata/hooks/useFilteredObjectMetadataItems';
import { isNavigationDrawerExpandedState } from '@/ui/navigation/states/isNavigationDrawerExpanded';
import { navigationDrawerExpandedMemorizedState } from '@/ui/navigation/states/navigationDrawerExpandedMemorizedState';
import { useGlobalHotkeys } from '@/ui/utilities/hotkey/hooks/useGlobalHotkeys';
import { useGoToHotkeys } from '@/ui/utilities/hotkey/hooks/useGoToHotkeys';
import { useRecoilCallback } from 'recoil';
import { useNavigate } from 'react-router-dom';
import { AppPath, SettingsPath } from 'twenty-shared/types';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { FeatureFlagKey } from '~/generated-metadata/graphql';
import { getAppPath, getSettingsPath } from 'twenty-shared/utils';

export const GotoHotkeysEffectsProvider = () => {
  const { activeNonSystemObjectMetadataItems } =
    useFilteredObjectMetadataItems();

  const navigate = useNavigate();

  const expandDrawerAndNavigateToSettings = useRecoilCallback(
    ({ set }) =>
      () => {
        set(isNavigationDrawerExpandedState, true);
        set(navigationDrawerExpandedMemorizedState, true);
        navigate(getSettingsPath(SettingsPath.ProfilePage));
      },
    [navigate],
  );

  useGoToHotkeys({
    key: 'h',
    location: AppPath.Home,
  });

  useGoToHotkeys({
    key: 's',
    location: getSettingsPath(SettingsPath.ProfilePage),
    preNavigateFunction: useRecoilCallback(
      ({ set }) =>
        () => {
          set(isNavigationDrawerExpandedState, true);
          set(navigationDrawerExpandedMemorizedState, true);
        },
      [],
    ),
  });

  useGlobalHotkeys({
    keys: ['meta+,'],
    callback: expandDrawerAndNavigateToSettings,
    containsModifier: true,
    dependencies: [expandDrawerAndNavigateToSettings],
  });

  // g+a → go to computer (agent) — gated behind feature flag
  const isComputerSidebarEnabled = useIsFeatureEnabled(
    FeatureFlagKey.IS_COMPUTER_SIDEBAR_ENABLED,
  );

  useGoToHotkeys({
    key: 'a',
    location: AppPath.Agent,
    enabled: isComputerSidebarEnabled,
  });

  return activeNonSystemObjectMetadataItems.map((objectMetadataItem) => {
    if (!objectMetadataItem.shortcut) {
      return null;
    }

    return (
      <GoToHotkeyItemEffect
        key={`go-to-hokey-item-${objectMetadataItem.id}`}
        hotkey={objectMetadataItem.shortcut}
        pathToNavigateTo={getAppPath(AppPath.RecordIndexPage, {
          objectNamePlural: objectMetadataItem.namePlural,
        })}
      />
    );
  });
};
