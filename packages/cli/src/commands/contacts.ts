import * as fs from 'node:fs';
import type { Command } from 'commander';
import { apiGet, apiPost, apiPut, apiDelete, handleApiError } from '../api-client.js';
import { log, error, json, isJson } from '../output.js';
import { captureError } from '../sentry.js';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export const registerContacts = (program: Command): void => {
  const contacts = program
    .command('contacts')
    .description('manage contacts');

  contacts
    .command('list')
    .description('list all contacts')
    .option('--limit <n>', 'max results', '50')
    .option('--filter <expr>', 'filter expression (e.g. "status=active")')
    .action(contactsList);

  contacts
    .command('get <id>')
    .description('get contact by ID')
    .action(contactsGet);

  contacts
    .command('create')
    .description('create a new contact')
    .requiredOption('--name <name>', 'contact name')
    .requiredOption('--phone <phone>', 'phone number (E.164)')
    .option('--email <email>', 'email address')
    .option('--company <company>', 'company name')
    .option('--tags <tags>', 'comma-separated tags')
    .action(contactsCreate);

  contacts
    .command('update <id>')
    .description('update a contact')
    .option('--name <name>')
    .option('--phone <phone>')
    .option('--email <email>')
    .option('--company <company>')
    .option('--tags <tags>')
    .action(contactsUpdate);

  contacts
    .command('delete <id>')
    .description('delete a contact')
    .action(contactsDelete);

  contacts
    .command('import <file>')
    .description('import contacts from CSV')
    .option('--dry-run', 'preview without importing')
    .option('--map <mapping>', 'column mapping (e.g. "Full Name=name,Phone=phone")')
    .action(contactsImport);

  contacts
    .command('search <query>')
    .description('search contacts')
    .option('--limit <n>', 'max results', '20')
    .action(contactsSearch);
};

const contactsList = async (opts: { limit: string; filter?: string }): Promise<void> => {
  try {
    const query: Record<string, string> = { limit: opts.limit };
    if (opts.filter) query.filter = opts.filter;

    const res = await apiGet<{ contacts: Contact[] }>('/v1/contacts', query);
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const { contacts } = res.data;
    if (!contacts.length) {
      log('no contacts yet — use `consuelo contacts create` or `consuelo contacts import`');
      return;
    }

    log('name                 | phone            | email                | tags');
    log('---------------------|------------------|----------------------|-----');
    for (const c of contacts) {
      const name = (c.name ?? '').padEnd(20).slice(0, 20);
      const phone = (c.phone ?? '').padEnd(16).slice(0, 16);
      const email = (c.email ?? '').padEnd(20).slice(0, 20);
      const tags = (c.tags ?? []).join(', ');
      log(`${name} | ${phone} | ${email} | ${tags}`);
    }
    log(`\n${contacts.length} contact${contacts.length === 1 ? '' : 's'}`);
  } catch (err: unknown) {
    captureError(err, { command: 'contacts list' });
    error(err instanceof Error ? err.message : 'failed to list contacts');
    process.exit(1);
  }
};

const contactsGet = async (id: string): Promise<void> => {
  try {
    const res = await apiGet<{ contact: Contact }>(`/v1/contacts/${id}`);
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const c = res.data.contact;
    log(`id:       ${c.id}`);
    log(`name:     ${c.name}`);
    log(`phone:    ${c.phone}`);
    if (c.email) log(`email:    ${c.email}`);
    if (c.company) log(`company:  ${c.company}`);
    if (c.tags?.length) log(`tags:     ${c.tags.join(', ')}`);
    log(`created:  ${c.createdAt}`);
  } catch (err: unknown) {
    captureError(err, { command: 'contacts get' });
    error(err instanceof Error ? err.message : 'failed to get contact');
    process.exit(1);
  }
};

const contactsCreate = async (opts: { name: string; phone: string; email?: string; company?: string; tags?: string }): Promise<void> => {
  try {
    const body: Record<string, unknown> = { name: opts.name, phone: opts.phone };
    if (opts.email) body.email = opts.email;
    if (opts.company) body.company = opts.company;
    if (opts.tags) body.tags = opts.tags.split(',').map((t: string) => t.trim());

    const res = await apiPost<{ contact: Contact }>('/v1/contacts', body);
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const c = res.data.contact;
    log(`created: ${c.name} — ${c.phone}${c.email ? ` — ${c.email}` : ''}`);
  } catch (err: unknown) {
    captureError(err, { command: 'contacts create' });
    error(err instanceof Error ? err.message : 'failed to create contact');
    process.exit(1);
  }
};

const contactsUpdate = async (id: string, opts: { name?: string; phone?: string; email?: string; company?: string; tags?: string }): Promise<void> => {
  try {
    const body: Record<string, unknown> = {};
    if (opts.name) body.name = opts.name;
    if (opts.phone) body.phone = opts.phone;
    if (opts.email) body.email = opts.email;
    if (opts.company) body.company = opts.company;
    if (opts.tags) body.tags = opts.tags.split(',').map((t: string) => t.trim());

    if (!Object.keys(body).length) {
      error('nothing to update — provide at least one field');
      process.exit(1);
    }

    const res = await apiPut<{ contact: Contact }>(`/v1/contacts/${id}`, body);
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    log(`updated: ${res.data.contact.name}`);
  } catch (err: unknown) {
    captureError(err, { command: 'contacts update' });
    error(err instanceof Error ? err.message : 'failed to update contact');
    process.exit(1);
  }
};

const contactsDelete = async (id: string): Promise<void> => {
  try {
    const res = await apiDelete<{ deleted: boolean }>(`/v1/contacts/${id}`);
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    log('contact deleted');
  } catch (err: unknown) {
    captureError(err, { command: 'contacts delete' });
    error(err instanceof Error ? err.message : 'failed to delete contact');
    process.exit(1);
  }
};

const contactsImport = async (file: string, opts: { dryRun?: boolean; map?: string }): Promise<void> => {
  try {
    if (!fs.existsSync(file)) {
      error(`file not found: ${file}`);
      process.exit(1);
    }

    let content = fs.readFileSync(file, 'utf-8');
    if (!content.trim()) {
      error('file is empty');
      process.exit(1);
    }

    if (opts.map) {
      const mappings = parseMappings(opts.map);
      content = remapCsvHeaders(content, mappings);
    }

    if (opts.dryRun) {
      const lines = content.trim().split('\n');
      const header = lines[0];
      const rows = lines.slice(1);
      log(`dry run — ${rows.length} row${rows.length === 1 ? '' : 's'} found`);
      log(`columns: ${header}`);
      for (const row of rows.slice(0, 5)) {
        log(`  ${row}`);
      }
      if (rows.length > 5) log(`  ... and ${rows.length - 5} more`);
      return;
    }

    log(`importing from ${file}...`);

    const res = await apiPost<{ imported: number; contacts: Contact[] }>('/v1/contacts/import', { content });
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    log(`imported ${res.data.imported} contact${res.data.imported === 1 ? '' : 's'}`);
    for (const c of res.data.contacts) {
      log(`  + ${c.name}${c.phone ? ` — ${c.phone}` : ''}${c.email ? ` — ${c.email}` : ''}`);
    }
  } catch (err: unknown) {
    captureError(err, { command: 'contacts import' });
    error(err instanceof Error ? err.message : 'import failed');
    process.exit(1);
  }
};

const contactsSearch = async (query: string, opts: { limit: string }): Promise<void> => {
  try {
    const res = await apiGet<{ contacts: Contact[] }>('/v1/contacts/search', { q: query, limit: opts.limit });
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const { contacts } = res.data;
    if (!contacts.length) {
      log('no results');
      return;
    }

    log('name                 | phone            | email                | tags');
    log('---------------------|------------------|----------------------|-----');
    for (const c of contacts) {
      const name = (c.name ?? '').padEnd(20).slice(0, 20);
      const phone = (c.phone ?? '').padEnd(16).slice(0, 16);
      const email = (c.email ?? '').padEnd(20).slice(0, 20);
      const tags = (c.tags ?? []).join(', ');
      log(`${name} | ${phone} | ${email} | ${tags}`);
    }
    log(`\n${contacts.length} result${contacts.length === 1 ? '' : 's'}`);
  } catch (err: unknown) {
    captureError(err, { command: 'contacts search' });
    error(err instanceof Error ? err.message : 'search failed');
    process.exit(1);
  }
};

// -- helpers --

const parseMappings = (map: string): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const pair of map.split(',')) {
    const [from, to] = pair.split('=').map((s: string) => s.trim());
    if (from && to) result[from] = to;
  }
  return result;
};

const remapCsvHeaders = (content: string, mappings: Record<string, string>): string => {
  const lines = content.split('\n');
  if (!lines.length) return content;
  const headers = lines[0].split(',').map((h: string) => {
    const trimmed = h.trim();
    return mappings[trimmed] ?? trimmed;
  });
  lines[0] = headers.join(',');
  return lines.join('\n');
};
