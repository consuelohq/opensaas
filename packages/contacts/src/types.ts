// Contact record
export type Contact = {
  id: string;
  workspaceId?: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
};

// Queue record
export type Queue = {
  id: string;
  name: string;
  contactIds: string[];
  ordering: 'sequential' | 'round-robin' | 'priority';
  currentIndex: number;
  status: 'idle' | 'active' | 'paused' | 'completed';
  results: QueueResult[];
  createdAt: string;
};

export type QueueResult = {
  contactId: string;
  callSid?: string;
  outcome?: string;
  attemptedAt: string;
};

// Storage provider interface — users supply their own persistence
export type StorageProvider = {
  // Contacts
  createContact(contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact>;
  getContact(id: string): Promise<Contact | null>;
  updateContact(id: string, data: Partial<Contact>): Promise<Contact | null>;
  deleteContact(id: string): Promise<boolean>;
  searchContacts(query: string, workspaceId?: string): Promise<Contact[]>;
  listContacts(workspaceId: string): Promise<Contact[]>;

  // Queues
  createQueue(queue: Omit<Queue, 'id' | 'createdAt'>): Promise<Queue>;
  getQueue(id: string): Promise<Queue | null>;
  updateQueue(id: string, data: Partial<Queue>): Promise<Queue | null>;
};
