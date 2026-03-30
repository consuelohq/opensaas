import { availableCallerIdsState } from '@/dialer/states/availableCallerIdsState';
import { localPresenceEnabledState } from '@/dialer/states/localPresenceEnabledState';
import { selectedCallerIdState } from '@/dialer/states/selectedCallerIdState';
import { selectedContactState } from '@/dialer/states/selectedContactState';
import { useEffect } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

// whether the current selection was auto-matched by area code
export const useCallerIdSelection = () => {
  const availableCallerIds = useRecoilValue(availableCallerIdsState);
  const localPresenceEnabled = useRecoilValue(localPresenceEnabledState);
  const selectedContact = useRecoilValue(selectedContactState);
  const [selectedCallerId, setSelectedCallerId] = useRecoilState(
    selectedCallerIdState,
  );

  const contactPhone = selectedContact?.phone ?? null;

  // extract area code from E.164 (+1XXXXXXXXXX)
  const contactAreaCode =
    contactPhone && contactPhone.length >= 5 ? contactPhone.slice(2, 5) : null;

  const matchedNumber = contactAreaCode
    ? availableCallerIds.find((n) => n.areaCode === contactAreaCode)
    : null;

  const isLocalMatch =
    localPresenceEnabled &&
    matchedNumber !== null &&
    matchedNumber !== undefined &&
    selectedCallerId === matchedNumber.phoneNumber;

  // auto-select matching area code when local presence is on
  useEffect(() => {
    if (!localPresenceEnabled || availableCallerIds.length === 0) return;

    if (matchedNumber) {
      setSelectedCallerId(matchedNumber.phoneNumber);
    } else if (!selectedCallerId && availableCallerIds.length > 0) {
      // fallback to first available
      setSelectedCallerId(availableCallerIds[0].phoneNumber);
    }
  }, [
    contactAreaCode,
    localPresenceEnabled,
    availableCallerIds,
    matchedNumber,
    selectedCallerId,
    setSelectedCallerId,
  ]);

  return {
    selectedCallerId,
    setSelectedCallerId,
    availableCallerIds,
    isLocalMatch,
  };
};
