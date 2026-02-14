import { useMemo } from 'react';

import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type Person } from '@/people/types/Person';
import { type DialerContact } from '@/dialer/types/dialer';
import {
  personToDialerContact,
  personsToDialerContacts,
} from '@/dialer/utils/contactAdapter';

// fetch a single twenty person and map to DialerContact
export const useDialerContact = (personId: string | undefined) => {
  const { record, loading, error } = useFindOneRecord<Person>({
    objectNameSingular: 'person',
    objectRecordId: personId,
    skip: !personId,
  });

  const contact = useMemo<DialerContact | null>(() => {
    if (!record) return null;
    return personToDialerContact(record);
  }, [record]);

  return { contact, loading, error };
};

// fetch multiple twenty persons by id and map to DialerContacts
export const useDialerContacts = (personIds: string[]) => {
  const { records, loading, error } = useFindManyRecords<Person>({
    objectNameSingular: 'person',
    filter: { id: { in: personIds } },
    skip: personIds.length === 0,
    limit: personIds.length || 1,
  });

  const contacts = useMemo<DialerContact[]>(() => {
    if (!records || records.length === 0) return [];
    return personsToDialerContacts(records);
  }, [records]);

  return { contacts, loading, error };
};
