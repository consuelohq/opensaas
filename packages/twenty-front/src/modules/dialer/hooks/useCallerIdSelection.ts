import { availableCallerIdsState } from '@/dialer/states/availableCallerIdsState';
import { selectedCallerIdState } from '@/dialer/states/selectedCallerIdState';
import { selectedContactState } from '@/dialer/states/selectedContactState';
import { useUserPreferences } from '@/settings/hooks/useUserPreferences';
import { useRecoilState, useRecoilValue } from 'recoil';

const normalizePhone = (phoneNumber: string) => {
  const digits = phoneNumber.replace(/\D/g, '');

  if (digits.length == 10) {
    return `+1${digits}`;
  }

  if (digits.length == 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  if (phoneNumber.startsWith('+')) {
    return `+${digits}`;
  }

  return digits.length > 0 ? `+${digits}` : '';
};

export const useCallerIdSelection = () => {
  const availableCallerIds = useRecoilValue(availableCallerIdsState);
  const selectedContact = useRecoilValue(selectedContactState);
  const [selectedCallerId, setSelectedCallerId] = useRecoilState(
    selectedCallerIdState,
  );
  const { preferences, updatePreferences } = useUserPreferences();

  const contactPhone = selectedContact?.phone ?? null;
  const normalizedContactPhone = contactPhone
    ? normalizePhone(contactPhone)
    : null;
  const contactAreaCode =
    normalizedContactPhone && normalizedContactPhone.length >= 5
      ? normalizedContactPhone.slice(2, 5)
      : null;

  const normalizedSelectedCallerId = selectedCallerId
    ? normalizePhone(selectedCallerId)
    : null;
  const selectedNumber = normalizedSelectedCallerId
    ? availableCallerIds.find(
        (number) =>
          normalizePhone(number.phoneNumber) === normalizedSelectedCallerId,
      )
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
    preferences,
    updatePreferences,
  };
};
