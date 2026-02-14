/** Normalize a phone number to E.164 format */
export const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
};

/** Check if a normalized E.164 phone number is valid */
export const isValidPhone = (phone: string): boolean => {
  if (!phone) return false;
  // E.164: + followed by 7-15 digits
  return /^\+[1-9]\d{6,14}$/.test(phone);
};
