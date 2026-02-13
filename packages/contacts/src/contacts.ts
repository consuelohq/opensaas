import type { Contact, StorageProvider } from './types.js';
import { normalizePhone } from './utils.js';
import { parseDocument } from './parser.js';
import { MemoryProvider } from './providers/memory.js';

/**
 * Contacts — CRUD, search, and document import for sales contacts.
 */
export class Contacts {
  readonly store: StorageProvider;

  constructor(store?: StorageProvider) {
    this.store = store ?? new MemoryProvider();
  }

  async create(data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact> {
    return this.store.createContact({ ...data, phone: normalizePhone(data.phone) });
  }

  async get(id: string): Promise<Contact | null> {
    return this.store.getContact(id);
  }

  async update(id: string, data: Partial<Contact>): Promise<Contact | null> {
    if (data.phone) data.phone = normalizePhone(data.phone);
    return this.store.updateContact(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return this.store.deleteContact(id);
  }

  async search(query: string, userId?: string): Promise<Contact[]> {
    return this.store.searchContacts(query, userId);
  }

  async list(userId: string): Promise<Contact[]> {
    return this.store.listContacts(userId);
  }

  /** Import contacts from any document format using Groq AI parser */
  async importDocument(content: string, groqApiKey: string, userId?: string): Promise<Contact[]> {
    const { contacts: parsed, errors } = await parseDocument(content, groqApiKey);
    if (errors.length > 0) throw new Error(errors.join(', '));

    const results: Contact[] = [];
    for (const row of parsed) {
      const contact = await this.create({
        name: row.name,
        phone: row.phone ?? '',
        email: row.email,
        company: row.company,
        userId,
      });
      results.push(contact);
    }
    return results;
  }
}
