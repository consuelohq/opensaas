import { availableCallerIdsState } from '@/dialer/states/availableCallerIdsState';
import { selectedCallerIdState } from '@/dialer/states/selectedCallerIdState';
import { selectedContactState } from '@/dialer/states/selectedContactState';
import { useUserPreferences } from '@/settings/hooks/useUserPreferences';
import { useRecoilState, useRecoilValue } from 'recoil';

export const useCallerIdSelection = () => {
  const availableCallerIds = useRecoilValue(availableCallerIdsState);
  const selectedContact = useRecoilValue(selectedContactState);
  const [selectedCallerId, setSelectedCallerId] = useRecoilState(
    selectedCallerIdState,
  );
  const { preferences } = useUserPreferences();

  const contactPhone = selectedContact?.phone ?? null;
  const contactAreaCode =
    contactPhone && contactPhone.length >= 5 ? contactPhone.slice(2, 5) : null;

  const selectedNumber = selectedCallerId
    ? availableCallerIds.find((number) => number.phoneNumber === selectedCallerId)
    : null;

  const localPresenceEnabled = preferences.dialer.localPresenceEnabled;
  const isLocalMatch =
    localPresenceEnabled &&
    contactAreaCode !== null &&
    selectedNumber?.areaCode === contactAreaCode;

  return {
    selectedCallerId,
    setSelectedCallerId,
    availableCallerIds,
    isLocalMatch,
    localPresenceEnabled,
  };
};
