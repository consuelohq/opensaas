import { type Person } from '@/people/types/Person';
import { type DialerContact } from '@/dialer/types/dialer';
import { normalizePhone, isValidPhone } from '@consuelo/contacts';

// map a twenty Person to a DialerContact
export const personToDialerContact = (
  person: Person,
): DialerContact | null => {
  const phoneRaw = person.phone;
  if (!phoneRaw) return null;

  const phone = normalizePhone(phoneRaw);
  const phoneStatus = isValidPhone(phone) ? 'valid' : 'invalid';

  const firstName = person.name?.firstName ?? null;
  const lastName = person.name?.lastName ?? null;
  const name = [firstName, lastName].filter(Boolean).join(' ') || null;

  return {
    id: `dialer-${person.id}`,
    twentyPersonId: person.id,
    name,
    firstName,
    lastName,
    company: null, // resolved separately via companyId
    phone,
    phoneRaw,
    email: person.email || null,
    avatarUrl: person.avatarUrl ?? null,
    phoneStatus: phoneStatus as 'valid' | 'invalid',
    lastCalled: null,
    callCount: 0,
    timezone: null,
    lastNote: null,
    tags: [],
    dncStatus: false,
  };
};

// batch convert, filtering out contacts without valid phones
export const personsToDialerContacts = (persons: Person[]): DialerContact[] =>
  persons
    .map(personToDialerContact)
    .filter(
      (contact): contact is DialerContact =>
        contact !== null && contact.phoneStatus === 'valid',
    );

// check single phone against DNC list
export const checkDncStatus = async (phone: string): Promise<boolean> => {
  try {
    const normalized = normalizePhone(phone);
    const response = await fetch(
      `/api/dnc/check?phone=${encodeURIComponent(normalized)}`,
    );
    const { isDnc } = await response.json();
    return isDnc === true;
  } catch (err: unknown) {
    // DNC check failure defaults to not-on-list so calls aren't blocked
    return false;
  }
};

// batch filter contacts against DNC list
export const filterDncContacts = async (
  contacts: DialerContact[],
): Promise<{ filtered: DialerContact[]; dncCount: number }> => {
  try {
    const phones = contacts.map((contact) => contact.phone);
    const response = await fetch('/api/dnc/batch-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phones }),
    });
    const { dncPhones } = await response.json();
    const dncSet = new Set<string>(dncPhones);
    const filtered = contacts.filter((contact) => !dncSet.has(contact.phone));

    return { filtered, dncCount: contacts.length - filtered.length };
  } catch (err: unknown) {
    // DNC check failure returns all contacts unfiltered
    return { filtered: contacts, dncCount: 0 };
  }
};
