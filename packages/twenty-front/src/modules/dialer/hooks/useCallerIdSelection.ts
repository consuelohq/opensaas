import { availableCallerIdsState } from '@/dialer/states/availableCallerIdsState';
import { localPresenceEnabledState } from '@/dialer/states/localPresenceEnabledState';
import { selectedCallerIdState } from '@/dialer/states/selectedCallerIdState';
import { selectedContactState } from '@/dialer/states/selectedContactState';
import { useEffect } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

// whether the current selection was auto-matched by area code
export const useCallerIdSelection = () => {
  const availableNumbers = useRecoilValue(availableCallerIdsState);
  const localPresenceEnabled = useRecoilValue(localPresenceEnabledState);
  const contact = useRecoilValue(selectedContactState);
  const [selectedCallerId, setSelectedCallerId] =
    useRecoilState(selectedCallerIdState);

  const contactPhone = contact?.phone ?? null;

  // extract area code from E.164 (+1XXXXXXXXXX)
  const contactAreaCode =
    contactPhone && contactPhone.length >= 5
      ? contactPhone.slice(2, 5)
      : null;

  const matchedNumber = contactAreaCode
    ? availableNumbers.find((n) => n.areaCode === contactAreaCode)
    : null;

  const isLocalMatch =
    localPresenceEnabled &&
    matchedNumber !== null &&
    matchedNumber !== undefined &&
    selectedCallerId === matchedNumber.phoneNumber;

  // auto-select matching area code when local presence is on
  useEffect(() => {
    if (!localPresenceEnabled || availableNumbers.length === 0) return;

    if (matchedNumber) {
      setSelectedCallerId(matchedNumber.phoneNumber);
    } else if (!selectedCallerId && availableNumbers.length > 0) {
      // fallback to first available
      setSelectedCallerId(availableNumbers[0].phoneNumber);
    }
  }, [
    contactAreaCode,
    localPresenceEnabled,
    availableNumbers,
    matchedNumber,
    selectedCallerId,
    setSelectedCallerId,
  ]);

  return {
    selectedCallerId,
    setSelectedCallerId,
    availableNumbers,
    isLocalMatch,
  };
};
