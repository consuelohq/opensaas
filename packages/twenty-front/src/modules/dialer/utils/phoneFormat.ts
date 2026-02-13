/** Strip non-digit characters from a phone string */
export const stripNonDigits = (value: string): string =>
  value.replace(/\D/g, '');

/** Format a phone number: (555) 123-4567 or +1 (555) 123-4567 for 11+ digits */
export const formatPhone = (raw: string): string => {
  const digits = stripNonDigits(raw);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;

  // 11+ digits: +X (XXX) XXX-XXXX
  const countryCode = digits.slice(0, digits.length - 10);
  const national = digits.slice(-10);

  return `+${countryCode} (${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
};

/** Format as E.164: +15551234567 */
export const toE164 = (raw: string): string => {
  const digits = stripNonDigits(raw);
  const national = digits.length === 11 && digits[0] === '1' ? digits : `1${digits}`;

  return `+${national}`;
};

/** Extract 3-digit area code from a phone string */
export const extractAreaCode = (raw: string): string | null => {
  const digits = stripNonDigits(raw);
  const national =
    digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;

  return national.length >= 3 ? national.slice(0, 3) : null;
};
