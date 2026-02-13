import * as fs from 'node:fs';
import { Contacts, normalizePhone } from '@consuelo/contacts';
import { loadConfig } from '../config.js';
import { log, error, json, isJson } from '../output.js';
import { captureError } from '../sentry.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let _contacts: Contacts | undefined;
function getContacts(): Contacts {
  _contacts ??= new Contacts();
  return _contacts;
}

export async function contactsCommand(action: string, args: string[]): Promise<void> {
  switch (action) {
    case 'list':
      return listContacts();
    case 'add':
      return addContact(args);
    case 'import':
      return importContacts(args);
    default:
      error('usage: consuelo contacts <list|add|import>');
      process.exit(1);
  }
}

async function listContacts(): Promise<void> {
  try {
    const all = await getContacts().list('cli');

    if (isJson()) {
      json({ contacts: all });
      return;
    }

    if (!all.length) {
      log('no contacts yet — use `consuelo contacts add` or `consuelo contacts import`');
      return;
    }

    // header
    log('name                 | phone            | email                | tags');
    log('---------------------|------------------|----------------------|-----');
    for (const c of all) {
      const name = (c.name ?? '').padEnd(20).slice(0, 20);
      const phone = (c.phone ?? '').padEnd(16).slice(0, 16);
      const email = (c.email ?? '').padEnd(20).slice(0, 20);
      const tags = (c.tags ?? []).join(', ');
      log(`${name} | ${phone} | ${email} | ${tags}`);
    }
    log(`\n${all.length} contact${all.length === 1 ? '' : 's'}`);
  } catch (err: unknown) {
    captureError(err, { command: 'contacts list' });
    error(err instanceof Error ? err.message : 'failed to list contacts');
    process.exit(1);
  }
}

async function addContact(args: string[]): Promise<void> {
  const [name, phone, email] = args;

  if (!name || !phone) {
    error('usage: consuelo contacts add <name> <phone> [email]');
    process.exit(1);
  }

  const normalized = normalizePhone(phone);
  if (!normalized || normalized === '+') {
    error(`invalid phone number: ${phone}`);
    process.exit(1);
  }

  if (email && !EMAIL_RE.test(email)) {
    error(`invalid email: ${email}`);
    process.exit(1);
  }

  // duplicate check by phone
  try {
    const existing = await getContacts().search(normalized, 'cli');
    if (existing.some((c: { phone: string }) => normalizePhone(c.phone) === normalized)) {
      error(`contact with phone ${normalized} already exists`);
      process.exit(1);
    }

    const created = await getContacts().create({ name, phone: normalized, email, userId: 'cli' });

    if (isJson()) {
      json(created);
    } else {
      log(`added: ${created.name} — ${created.phone}${created.email ? ` — ${created.email}` : ''}`);
    }
  } catch (err: unknown) {
    captureError(err, { command: 'contacts add' });
    error(err instanceof Error ? err.message : 'failed to add contact');
    process.exit(1);
  }
}

async function importContacts(args: string[]): Promise<void> {
  const file = args[0];

  if (!file) {
    error('usage: consuelo contacts import <file>');
    process.exit(1);
  }

  if (!fs.existsSync(file)) {
    error(`file not found: ${file}`);
    process.exit(1);
  }

  const config = loadConfig();
  if (!config.llmApiKey) {
    error('not configured — run `consuelo init` to set your LLM API key (needed for smart import)');
    process.exit(1);
  }

  const content = fs.readFileSync(file, 'utf-8');
  if (!content.trim()) {
    error('file is empty');
    process.exit(1);
  }

  log(`importing from ${file}...`);

  try {
    const imported = await getContacts().importDocument(content, config.llmApiKey, 'cli');

    if (isJson()) {
      json({ imported: imported.length, contacts: imported });
    } else {
      log(`imported ${imported.length} contact${imported.length === 1 ? '' : 's'}`);
      for (const c of imported) {
        log(`  + ${c.name}${c.phone ? ` — ${c.phone}` : ''}${c.email ? ` — ${c.email}` : ''}`);
      }
    }
  } catch (err: unknown) {
    captureError(err, { command: 'contacts import' });
    const status = err instanceof Object && 'status' in err ? (err as { status: number }).status : undefined;
    if (status === 401) {
      error('invalid API key — run `consuelo init` to update');
    } else if (status === 429) {
      error('rate limited — try again in a moment');
    } else {
      error(err instanceof Error ? err.message : 'import failed');
    }
    process.exit(1);
  }
}
