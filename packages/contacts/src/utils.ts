import { parsePhoneNumberFromString } from 'libphonenumber-js';

const DEFAULT_COUNTRY = 'US';

const parsePhoneNumber = (phone: string) => {
  const trimmedPhone = phone.trim();

  if (trimmedPhone.length === 0) {
    return undefined;
  }

  if (trimmedPhone.startsWith('+')) {
    return parsePhoneNumberFromString(trimmedPhone);
  }

  const digits = trimmedPhone.replace(/\D/g, '');

  if (
    digits.length !== 10 &&
    !(digits.length === 11 && digits.startsWith('1'))
  ) {
    return undefined;
  }

  return parsePhoneNumberFromString(trimmedPhone, DEFAULT_COUNTRY);
};

export const normalizePhone = (phone: string): string => {
  const parsedPhoneNumber = parsePhoneNumber(phone);

  return parsedPhoneNumber?.number ?? '';
};

export const isValidPhone = (phone: string): boolean => {
  const parsedPhoneNumber = parsePhoneNumber(phone);

  return parsedPhoneNumber?.isValid() === true;
};
