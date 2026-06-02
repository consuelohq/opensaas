#!/usr/bin/env bun

// linear.js — linear graphql API wrapper for workspace agents
// usage: bun run linear -- <command> [options]
// token: reads .agent/.chatgpt-token.json (actor=app oauth token)

const fs = require('fs');
const path = require('path');

const API = 'https://api.linear.app/graphql';

function loadToken() {
  const paths = [
    path.join(__dirname, '..', '..', '.agent', '.chatgpt-token.json'),
    path.join(process.env.HOME || '/tmp', 'Dev/opensaas/.agent/.chatgpt-token.json'),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (data.access_token) return data.access_token;
    }
  }
  throw new Error('no linear token found — run: bash .agent/linear-refresh.sh --chatgpt');
}

function writeStdout(s = '') { process.stdout.write(s + '\n'); }
function writeStderr(s = '') { process.stderr.write(s + '\n'); }

function printHelp() {
  const lines = [
    'usage: bun run linear -- <command> [options]',
    '',
    'linear graphql API wrapper. posts as the workspace app, not as ko.',
    '',
    'commands:',
    '  query <graphql>              run raw graphql (query or mutation)',
    '  issue <identifier>           get issue by identifier (DEV-123)',
    '  issues|search [--search <text>] list/search issues',
    '  create|createIssue <title>   create issue (DEV/open, opensaas label by default)',
    '  comment <issue-id> <body>    add comment to issue',
    '  update|updateIssue <issue-id> update issue fields',
    '  labels                       list issue labels',
    '  teams                        list teams and workflow states',
    '  projects                     list projects',
    '  states [--team <id|dev>]     list workflow states for a team',
    '',
    'options:',
    '  --team <id>           team id (default: DEV)',
    '  --state <id>          workflow state id',
    '  --labels <name-or-id>  label names or ids (comma-separated or repeated after flag)',
    '  --priority <0-4>      priority (1=urgent, 4=low)',
    '  --assignee <id>       assignee id',
    '  --description <text>  issue description (markdown)',
    '  --title <text>        update issue title',
    '  --project <id|name>   project id or name',
    '  --cycle <id>          cycle id',
    '  --parent <issue-id>   parent issue id for sub-issues',
    '  --search <text>       search query for issues command',
    '  --first <n>           pagination limit (default: 20)',
    '  --after <cursor>      pagination cursor',
    '  --filter <json>       raw filter object for issues',
    '  --json                json output (default)',
    '  --help                show this help',
    '',
    'examples:',
    '  bun run linear -- issue DEV-123',
    '  bun run linear -- issues --search "dialer queue"',
    '  bun run linear -- issues --filter \'{"priority":{"lte":2,"neq":0}}\'',
    '  bun run linear -- create "add health check" --description "markdown body"',
    '  bun run linear -- comment ISSUE-UUID "looks good, merging"',
    '  bun run linear -- update ISSUE-UUID --state d8f29981-a8ce-451d-8910-ca8c04af01b2',
    '  bun run linear -- query "{ viewer { id name } }"',
  ];
  lines.forEach((l) => writeStdout(l));
}

// --- IDs ---
const DEV_TEAM = '29f5c661-da6c-4bfb-bd48-815a006ccaac';
const STATE_OPEN = '1160621c-7a00-4945-9093-47ba33862b7e';
const GROWTH_TEAM = 'd923f357-397d-4416-832f-2ec2e822acdf';
const TEAM_IDS = { dev: DEV_TEAM, development: DEV_TEAM, DEV: DEV_TEAM, grow: GROWTH_TEAM, growth: GROWTH_TEAM, GROW: GROWTH_TEAM };

function parseArgs(argv) {
  const args = { positional: [], first: 20 };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--team': args.team = argv[++i]; break;
      case '--state': args.state = argv[++i]; break;
      case '--labels': {
        const labels = [];
        while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) labels.push(argv[++i]);
        args.labels = labels.flatMap((value) => String(value).split(',')).map((value) => value.trim()).filter(Boolean);
        break;
      }
      case '--priority': args.priority = parseInt(argv[++i], 10); break;
      case '--assignee': args.assignee = argv[++i]; break;
      case '--description': args.description = argv[++i]; break;
      case '--title': args.title = argv[++i]; break;
      case '--project': args.project = argv[++i]; break;
      case '--cycle': args.cycle = argv[++i]; break;
      case '--parent': args.parent = argv[++i]; break;
      case '--search': args.search = argv[++i]; break;
      case '--first': args.first = parseInt(argv[++i], 10); break;
      case '--after': args.after = argv[++i]; break;
      case '--filter': args.filter = argv[++i]; break;
      case '--json': args.json = true; break;
      case '--help': args.help = true; break;
      default:
        if (argv[i].startsWith('--')) throw new Error(`unknown flag: ${argv[i]}`);
        args.positional.push(argv[i]);
    }
  }
  return args;
}

async function gql(token, query, variables) {
  const body = { query };
  if (variables && Object.keys(variables).length > 0) body.variables = variables;

  const resp = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await resp.json();

  if (!resp.ok || json.errors) {
    const msg = json.errors
      ? json.errors.map((e) => e.message).join('; ')
      : `HTTP ${resp.status}`;
    throw new Error(msg);
  }

  return json.data;
}

// --- commands ---

async function cmdQuery(token, args) {
  const query = args.positional[1];
  if (!query) throw new Error('usage: linear query "<graphql>"');
  const data = await gql(token, query);
  writeStdout(JSON.stringify(data, null, 2));
}

async function cmdIssue(token, args) {
  const id = args.positional[1];
  if (!id) throw new Error('usage: linear issue <identifier>');

  const data = await gql(token, `
    query($id: String!) {
      issue(id: $id) {
        id identifier url title description priority
        state { id name type }
        team { id key name }
        assignee { id name }
        labels { nodes { id name } }
        project { id name url state }
        cycle { id name number }
        parent { id identifier title }
        children { nodes { id identifier title } }
        comments(first: 10) {
          nodes { id body user { name } createdAt }
        }
        attachments { nodes { id title url } }
        createdAt updatedAt
      }
    }
  `, { id });

  writeStdout(JSON.stringify(data.issue, null, 2));
}

async function cmdIssues(token, args) {
  if (args.search) {
    const data = await gql(token, `
      query($term: String!, $first: Int, $after: String) {
        searchIssues(term: $term, first: $first, after: $after) {
          nodes {
            id identifier title priority
            state { name }
            assignee { name }
            labels { nodes { name } }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `, { term: args.search, first: args.first, after: args.after || null });

    const result = data.searchIssues;
    writeStdout(JSON.stringify({
      issues: result.nodes,
      pageInfo: result.pageInfo,
    }, null, 2));
    return;
  }

  // list with optional filter
  let filter = args.filter ? JSON.parse(args.filter) : {};
  const teamId = resolveTeamId(args.team);
  filter = { ...filter, team: { id: { eq: teamId } } };

  const data = await gql(token, `
    query($filter: IssueFilter, $first: Int, $after: String) {
      issues(filter: $filter, first: $first, after: $after, orderBy: updatedAt) {
        nodes {
          id identifier title priority
          state { name }
          assignee { name }
          labels { nodes { name } }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `, { filter, first: args.first, after: args.after || null });

  const result = data.issues;
  writeStdout(JSON.stringify({
    issues: result.nodes,
    pageInfo: result.pageInfo,
  }, null, 2));
}

function resolveTeamId(value) { return TEAM_IDS[value] || value || DEV_TEAM; }
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '')); }
function defaultLabels() {
  return ['opensaas'];
}
async function resolveLabelIds(token, labels) {
  try {
    const requested = labels && labels.length > 0 ? labels : defaultLabels();
    const data = await gql(token, `
      query($first: Int) {
        issueLabels(first: $first) { nodes { id name } }
      }
    `, { first: 250 });
    const byName = new Map(data.issueLabels.nodes.map((label) => [label.name.toLowerCase(), label.id]));
    const resolved = [];
    for (const label of requested) {
      if (isUuid(label)) { resolved.push(label); continue; }
      const id = byName.get(String(label).toLowerCase());
      if (!id) throw new Error(`unknown Linear label: ${label}. run: bun run linear -- labels`);
      resolved.push(id);
    }
    return Array.from(new Set(resolved));
  } catch (error) {
    throw new Error(`failed to resolve Linear labels: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}

async function cmdCreate(token, args) {
  const title = args.positional[1] || args.title;
  if (!title) throw new Error('usage: linear create "<title>" [--description "..."]');

  const input = {
    teamId: resolveTeamId(args.team),
    title,
    stateId: args.state || STATE_OPEN,
    labelIds: await resolveLabelIds(token, args.labels),
  };
  if (args.description) input.description = args.description;
  if (args.priority !== undefined) input.priority = args.priority;
  if (args.assignee) input.assigneeId = args.assignee;
  if (args.project) input.projectId = args.project;
  if (args.cycle) input.cycleId = args.cycle;
  if (args.parent) input.parentId = args.parent;

  const data = await gql(token, `
    mutation($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier url title team { key name } state { name type } labels { nodes { id name } } project { id name url state } parent { id identifier title } }
      }
    }
  `, { input });

  writeStdout(JSON.stringify(data.issueCreate, null, 2));
}

async function cmdComment(token, args) {
  const issueId = args.positional[1];
  const body = args.positional[2];
  if (!issueId || !body) throw new Error('usage: linear comment <issue-id> "<body>"');

  const data = await gql(token, `
    mutation($input: CommentCreateInput!) {
      commentCreate(input: $input) {
        success
        comment { id body }
      }
    }
  `, { input: { issueId, body } });

  writeStdout(JSON.stringify(data.commentCreate, null, 2));
}

async function cmdUpdate(token, args) {
  const issueId = args.positional[1];
  if (!issueId) throw new Error('usage: linear update <issue-id> [--state <id>] [--labels <ids>] ...');

  const input = {};
  if (args.state) input.stateId = args.state;
  if (args.title) input.title = args.title;
  if (args.labels) input.labelIds = await resolveLabelIds(token, args.labels);
  if (args.priority !== undefined) input.priority = args.priority;
  if (args.assignee) input.assigneeId = args.assignee;
  if (args.description) input.description = args.description;
  if (args.project) input.projectId = args.project;
  if (args.cycle) input.cycleId = args.cycle;
  if (args.parent) input.parentId = args.parent;

  if (Object.keys(input).length === 0) throw new Error('no fields to update — pass --state, --labels, --priority, etc.');

  const data = await gql(token, `
    mutation($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue { id identifier url title state { name type } labels { nodes { id name } } project { id name url state } parent { id identifier title } }
      }
    }
  `, { id: issueId, input });

  writeStdout(JSON.stringify(data.issueUpdate, null, 2));
}


async function cmdLabels(token, args) {
  const data = await gql(token, `
    query($first: Int, $after: String) {
      issueLabels(first: $first, after: $after) {
        nodes { id name description color }
        pageInfo { hasNextPage endCursor }
      }
    }
  `, { first: args.first, after: args.after || null });
  writeStdout(JSON.stringify({ labels: data.issueLabels.nodes, pageInfo: data.issueLabels.pageInfo }, null, 2));
}

async function cmdTeams(token, args) {
  const data = await gql(token, `
    query($first: Int, $after: String) {
      teams(first: $first, after: $after) {
        nodes { id key name states { nodes { id name type position } } }
        pageInfo { hasNextPage endCursor }
      }
    }
  `, { first: args.first, after: args.after || null });
  writeStdout(JSON.stringify({ teams: data.teams.nodes, pageInfo: data.teams.pageInfo }, null, 2));
}

async function cmdProjects(token, args) {
  const data = await gql(token, `
    query($first: Int, $after: String) {
      projects(first: $first, after: $after) {
        nodes { id name url state teams { nodes { id key name } } }
        pageInfo { hasNextPage endCursor }
      }
    }
  `, { first: args.first, after: args.after || null });
  writeStdout(JSON.stringify({ projects: data.projects.nodes, pageInfo: data.projects.pageInfo }, null, 2));
}

async function cmdStates(token, args) {
  const teamId = resolveTeamId(args.team);
  const data = await gql(token, `
    query($id: String!) {
      team(id: $id) { id key name states { nodes { id name type position } } }
    }
  `, { id: teamId });
  writeStdout(JSON.stringify(data.team, null, 2));
}

// --- main ---

async function main() {
  const argv = process.argv.slice(2);
  const sepIdx = argv.indexOf('--');
  const scriptArgs = sepIdx >= 0 ? argv.slice(sepIdx + 1) : argv;

  if (scriptArgs.length === 0 || scriptArgs[0] === '--help') {
    printHelp();
    return;
  }

  const args = parseArgs(scriptArgs);
  if (args.help) { printHelp(); return; }

  const command = args.positional[0];
  if (!command) { printHelp(); return; }

  const token = loadToken();

  switch (command) {
    case 'query': await cmdQuery(token, args); break;
    case 'issue': await cmdIssue(token, args); break;
    case 'issues':
    case 'search': await cmdIssues(token, args); break;
    case 'create':
    case 'createIssue': await cmdCreate(token, args); break;
    case 'comment': await cmdComment(token, args); break;
    case 'update':
    case 'updateIssue': await cmdUpdate(token, args); break;
    case 'labels': await cmdLabels(token, args); break;
    case 'teams': await cmdTeams(token, args); break;
    case 'projects': await cmdProjects(token, args); break;
    case 'states': await cmdStates(token, args); break;
    default: throw new Error(`unknown command: ${command}. run --help for usage.`);
  }
}

main().catch((err) => {
  writeStderr(`error: ${err.message}`);
  process.exit(1);
});
