import type { LeadConnectorContact } from '../contracts/index.js';

export const resolveLeadConnectorContactName = (
  contact: LeadConnectorContact,
): string | null => {
  const fullName = [contact.firstName, contact.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return contact.name?.trim() || fullName || contact.email?.trim() || null;
};
