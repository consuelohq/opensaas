#!/usr/bin/env node
// consuelo-linear-mcp — custom Linear MCP server with bot auth, batching, and standards enforcement
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as reads from './tools/reads.js';
import * as writes from './tools/writes.js';
import { batchLinear } from './tools/batch.js';
import { getIdentity } from './auth.js';

const server = new McpServer({
  name: 'consuelo-linear-mcp',
  version: '1.0.0',
});

// --- read tools ---

server.tool('get_issue', 'fetch a single linear issue by identifier (DEV-123) or UUID', {
  issueId: z.string().describe('issue identifier like DEV-123 or a UUID'),
}, async (params) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(await reads.getIssue(params), null, 2) }],
}));

server.tool('list_issues', 'search or filter linear issues', {
  query: z.string().optional().describe('search query text'),
  teamId: z.string().optional().describe('filter by team UUID'),
  projectId: z.string().optional().describe('filter by project UUID'),
  limit: z.number().optional().describe('max results (default 20)'),
}, async (params) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(await reads.listIssues(params), null, 2) }],
}));

server.tool('list_comments', 'get comments on an issue', {
  issueId: z.string().describe('issue identifier like DEV-123 or UUID'),
}, async (params) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(await reads.listComments(params), null, 2) }],
}));

server.tool('get_project', 'fetch a linear project with its issues', {
  projectId: z.string().describe('project UUID'),
}, async (params) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(await reads.getProject(params), null, 2) }],
}));

server.tool('list_teams', 'list all teams', {}, async () => ({
  content: [{ type: 'text' as const, text: JSON.stringify(await reads.listTeams(), null, 2) }],
}));

server.tool('list_labels', 'list available labels', {
  teamId: z.string().optional().describe('filter by team UUID'),
}, async (params) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(await reads.listLabels(params), null, 2) }],
}));

server.tool('list_cycles', 'get cycles for a team', {
  teamId: z.string().describe('team UUID'),
}, async (params) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(await reads.listCycles(params), null, 2) }],
}));

// --- write tools ---

server.tool('create_issue', `create a new linear issue (posts as ${getIdentity()})`, {
  teamId: z.string().describe('team UUID'),
  title: z.string().describe('issue title'),
  description: z.string().optional().describe('markdown description'),
  parentId: z.string().optional().describe('parent issue UUID'),
  projectId: z.string().optional().describe('project UUID'),
  stateId: z.string().optional().describe('workflow state UUID'),
  priority: z.number().optional().describe('0=none, 1=urgent, 2=high, 3=medium, 4=low'),
  labelIds: z.array(z.string()).optional().describe('label UUIDs'),
  labelNames: z.array(z.string()).optional().describe('label names (for validation only — use labelIds for assignment)'),
  assigneeId: z.string().optional().describe('assignee UUID'),
  skipValidation: z.boolean().optional().describe('skip label/spec validation warnings'),
}, async (params) => {
  const result = await writes.createIssue(params);
  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
});

server.tool('update_issue', `update an existing linear issue (posts as ${getIdentity()})`, {
  issueId: z.string().describe('issue UUID'),
  title: z.string().optional().describe('new title'),
  description: z.string().optional().describe('new markdown description'),
  stateId: z.string().optional().describe('workflow state UUID'),
  priority: z.number().optional().describe('0=none, 1=urgent, 2=high, 3=medium, 4=low'),
  labelIds: z.array(z.string()).optional().describe('label UUIDs'),
  labelNames: z.array(z.string()).optional().describe('label names (for validation only)'),
  assigneeId: z.string().optional().describe('assignee UUID'),
  parentId: z.string().optional().describe('parent issue UUID'),
  projectId: z.string().optional().describe('project UUID'),
  skipValidation: z.boolean().optional().describe('skip label/spec validation warnings'),
}, async (params) => {
  const result = await writes.updateIssue(params);
  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
});

server.tool('create_comment', `post a comment on an issue (posts as ${getIdentity()})`, {
  issueId: z.string().describe('issue UUID'),
  body: z.string().describe('comment body (markdown)'),
  addFooter: z.boolean().optional().describe('add identity footer (default true)'),
}, async (params) => {
  const result = await writes.createComment(params);
  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
});

server.tool('update_comment', `update an existing comment (posts as ${getIdentity()})`, {
  commentId: z.string().describe('comment UUID'),
  body: z.string().describe('new comment body'),
}, async (params) => {
  const result = await writes.updateComment(params);
  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
});

// --- batch tool ---

server.tool('batch_linear', 'execute multiple linear operations in one call — reads use API key, writes use bot token', {
  operations: z.array(z.object({
    op: z.enum([
      'get_issue', 'list_issues', 'list_comments', 'get_project',
      'list_teams', 'list_labels', 'list_cycles',
      'create_issue', 'update_issue', 'create_comment', 'update_comment',
    ]).describe('operation name'),
    params: z.record(z.string(), z.unknown()).describe('operation parameters'),
  })).describe('array of operations to execute sequentially'),
}, async (params) => {
  const results = await batchLinear(params);
  return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
});

// --- start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err}\n`);
  process.exit(1);
});
