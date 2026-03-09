// test: pi CRM tools + context injection
// run: node --experimental-strip-types packages/agent/src/pi-extensions/__tests__/crm-tools.test.ts

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createPiCrmTools } from '../crm-tools.ts';
import { createContextInjection } from '../context-injection.ts';
import { CrmClient } from '../../crm/client.ts';

// mock CRM client that returns predictable data
const mockCrmClient = {
  searchContacts: async (query: string, _filters?: unknown, opts?: { limit?: number }) => [
    { id: 'c-1', name: 'John Smith', email: 'john@example.com', phone: '+15551234567', company: 'Acme' },
    { id: 'c-2', name: 'Jane Smith', email: 'jane@example.com', phone: '+15559876543', company: 'Globex' },
  ].slice(0, opts?.limit ?? 50),

  getContact: async (id: string) => ({
    id,
    name: 'John Smith',
    email: 'john@example.com',
    phone: '+15551234567',
    company: 'Acme',
  }),

  logCall: async (contactId: string, outcome: string, notes: string, nextStep?: string) => ({
    id: 'call-1',
    contactId,
    outcome,
    notes,
    nextStep: nextStep ?? null,
    timestamp: new Date().toISOString(),
  }),
} as unknown as CrmClient;

describe('createPiCrmTools', () => {
  const tools = createPiCrmTools(mockCrmClient);

  it('creates CRM tools with expected core tools', () => {
    assert.ok(tools.length >= 3, 'should have at least 3 tools');
    const names = tools.map((t) => t.name);
    assert.ok(names.includes('search_contacts'), 'should have search_contacts');
    assert.ok(names.includes('get_contact'), 'should have get_contact');
    assert.ok(names.includes('log_call'), 'should have log_call');
  });

  it('each tool has label, description, parameters, and execute', () => {
    for (const tool of tools) {
      assert.ok(tool.label, `${tool.name} missing label`);
      assert.ok(tool.description, `${tool.name} missing description`);
      assert.ok(tool.parameters, `${tool.name} missing parameters`);
      assert.ok(typeof tool.execute === 'function', `${tool.name} missing execute`);
    }
  });

  it('search_contacts executes and returns results', async () => {
    const searchTool = tools.find((t) => t.name === 'search_contacts');
    assert.ok(searchTool);

    const result = await searchTool.execute('tc-1', { query: 'Smith' });
    assert.ok(result.content.length > 0);
    assert.equal(result.content[0].type, 'text');

    const parsed = JSON.parse((result.content[0] as { type: 'text'; text: string }).text);
    assert.ok(Array.isArray(parsed));
    assert.equal(parsed[0].name, 'John Smith');
  });

  it('get_contact executes and returns contact', async () => {
    const getTool = tools.find((t) => t.name === 'get_contact');
    assert.ok(getTool);

    const result = await getTool.execute('tc-2', { contactId: 'c-1' });
    const parsed = JSON.parse((result.content[0] as { type: 'text'; text: string }).text);
    assert.equal(parsed.id, 'c-1');
    assert.equal(parsed.name, 'John Smith');
  });

  it('log_call executes and returns call record', async () => {
    const logTool = tools.find((t) => t.name === 'log_call');
    assert.ok(logTool);

    const result = await logTool.execute('tc-3', {
      contactId: 'c-1',
      outcome: 'answered',
      notes: 'Discussed pricing',
      nextStep: 'Send proposal',
    });
    const parsed = JSON.parse((result.content[0] as { type: 'text'; text: string }).text);
    assert.equal(parsed.contactId, 'c-1');
    assert.equal(parsed.outcome, 'answered');
    assert.equal(parsed.nextStep, 'Send proposal');
  });

  it('tool handles CrmClient errors gracefully', async () => {
    const errorClient = {
      searchContacts: async () => { throw new Error('connection refused'); },
    } as unknown as CrmClient;

    const errorTools = createPiCrmTools(errorClient);
    const searchTool = errorTools.find((t) => t.name === 'search_contacts');
    assert.ok(searchTool);

    const result = await searchTool.execute('tc-4', { query: 'test' });
    const parsed = JSON.parse((result.content[0] as { type: 'text'; text: string }).text);
    assert.equal(parsed.error, 'connection refused');
  });
});

describe('createContextInjection', () => {
  it('buildSystemPromptSuffix includes <crm_context>', () => {
    const injection = createContextInjection();
    const suffix = injection.buildSystemPromptSuffix();
    assert.ok(suffix.includes('<crm_context>'));
    assert.ok(suffix.includes('</crm_context>'));
  });

  it('system prompt with suffix contains <crm_context>', () => {
    const injection = createContextInjection();
    const basePrompt = 'You are a sales assistant for Consuelo.';
    const fullPrompt = basePrompt + injection.buildSystemPromptSuffix();
    assert.ok(fullPrompt.includes('<crm_context>'));
    assert.ok(fullPrompt.startsWith(basePrompt));
  });

  it('transformContext passes messages through', async () => {
    const injection = createContextInjection();
    const messages = [
      { role: 'user' as const, content: 'hello', timestamp: Date.now() },
    ];
    const result = await injection.transformContext(messages);
    assert.deepEqual(result, messages);
  });
});
