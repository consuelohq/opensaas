#!/usr/bin/env bun

const fs = require('fs');
const path = require('path');

const { getToken, listPullRequests } = require('./lib/github');
const { fetchOrigin, listWorktrees, refExists, runGit } = require('./lib/git');
const { DEFAULT_REPO, resolveGitRoot } = require('./lib/paths');
const {
  assertStreamBranchName,
  getDefaultStreamBranch,
  normalizeArea,
  parseStreamBranchName,
  parseTaskBranchName,
} = require('./lib/validation');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run stream:context -- --area <area> [options]');
  writeStdout('');
  writeStdout('required:');
  writeStdout('  --area <value>         stream area, for example dialer');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --stream <branch>      stream branch (default: stream/<area>)');
  writeStdout(`  --repo <owner/name>    github repository (default: ${DEFAULT_REPO})`);
  writeStdout('  --json                 output json');
  writeStdout('  --help                 show this help');
}

function parseArgs(argv) {
  const args = {
    repo: DEFAULT_REPO,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const rawArgument = argv[index];

    if (!rawArgument.startsWith('--')) {
      throw new Error(`unexpected argument: ${rawArgument}`);
    }

    const [flag, inlineValue] = rawArgument.split('=', 2);
    const isBooleanFlag = flag === '--json' || flag === '--help';
    const value = inlineValue !== undefined ? inlineValue : isBooleanFlag ? undefined : argv[index + 1];

    if (!isBooleanFlag && (!value || value.startsWith('--'))) {
      throw new Error(`missing value for ${flag}`);
    }

    if (inlineValue === undefined && !isBooleanFlag) {
      index += 1;
    }

    switch (flag) {
      case '--area':
        args.area = value;
        break;
      case '--stream':
        args.stream = value;
        break;
      case '--repo':
        args.repo = value;
        break;
      case '--json':
        args.json = true;
        break;
      case '--help':
        args.help = true;
        break;
      default:
        throw new Error(`unknown flag: ${flag}`);
    }
  }

  return args;
}

function loadEnv() {
  const envPaths = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', '.env'),
  ];
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const url = (content.match(/SUPABASE_URL=(.+)/) || [])[1];
      const key = (content.match(/SUPABASE_KEY=(.+)/) || [])[1];
      if (url && key) return { url: url.trim(), key: key.trim() };
    }
  }
  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY,
  };
}

async function getRecentWorkpads(area, limit = 3) {
  const env = loadEnv();
  if (!env.url || !env.key) {
    return { skipped: true, reason: 'missing supabase credentials', workpads: [] };
  }

  // try workpad category first, fall back to any category matching the area
  const queries = [
    { category: 'eq.workpad', title: `ilike.*${area}*` },
    { category: 'not.eq.stream-decision', title: `ilike.*${area}*` },
  ];

  for (const filters of queries) {
    const url = new URL(`${env.url}/rest/v1/memories`);
    url.searchParams.set('select', 'title,content,category,created_at');
    for (const [k, v] of Object.entries(filters)) {
      url.searchParams.set(k, v);
    }
    url.searchParams.set('order', 'created_at.desc');
    url.searchParams.set('limit', String(limit));

    try {
      const resp = await fetch(url.toString(), {
        headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
      });
      if (!resp.ok) continue;
      const rows = await resp.json();
      if (rows.length > 0) {
        return {
          skipped: false,
          reason: null,
          workpads: rows.map((row) => ({
            title: row.title,
            category: row.category,
            date: row.created_at ? row.created_at.slice(0, 16).replace('T', ' ') : '',
            content: row.content || '',
          })),
        };
      }
    } catch {
      continue;
    }
  }

  return { skipped: false, reason: null, workpads: [] };
}

async function getStreamDecisions(area, limit = 10) {
  const env = loadEnv();
  if (!env.url || !env.key) {
    return [];
  }

  const url = new URL(`${env.url}/rest/v1/memories`);
  url.searchParams.set('select', 'title,created_at');
  url.searchParams.set('category', 'eq.stream-decision');
  url.searchParams.set('title', `ilike.*${area}*`);
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', String(limit));

  try {
    const resp = await fetch(url.toString(), {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    });
    if (!resp.ok) return [];
    return (await resp.json()).map((row) => ({
      title: row.title,
      date: row.created_at ? row.created_at.slice(0, 10) : '',
    }));
  } catch {
    return [];
  }
}

function listAreaDocs(repoRoot, area) {
  const areaDirectory = path.join(repoRoot, 'areas', area);

  if (!fs.existsSync(areaDirectory)) {
    return [];
  }

  return fs
    .readdirSync(areaDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
    .map((name) => `areas/${area}/${name}`);
}

function getRecentCommits(repoRoot, streamBranch) {
  const candidates = [`refs/remotes/origin/${streamBranch}`, `refs/heads/${streamBranch}`];
  const ref = candidates.find((candidate) => refExists(repoRoot, candidate));

  if (!ref) {
    return [];
  }

  const output = runGit(['log', '--format=%h %ai %s', '-25', ref], { cwd: repoRoot });
  return output ? output.split('\n').filter(Boolean) : [];
}

function getAheadBehind(repoRoot, streamBranch) {
  const localRef = `refs/heads/${streamBranch}`;
  const remoteRef = `refs/remotes/origin/${streamBranch}`;

  if (!refExists(repoRoot, localRef) || !refExists(repoRoot, remoteRef)) {
    return null;
  }

  const output = runGit(['rev-list', '--left-right', '--count', `${localRef}...${remoteRef}`], { cwd: repoRoot });
  const [ahead, behind] = output.split(/\s+/).map((value) => Number.parseInt(value, 10));

  return {
    ahead: Number.isFinite(ahead) ? ahead : 0,
    behind: Number.isFinite(behind) ? behind : 0,
  };
}

function getAreaWorktrees(repoRoot, area) {
  return listWorktrees(repoRoot)
    .filter((worktree) => {
      if (!worktree.branch) {
        return false;
      }

      const taskBranch = parseTaskBranchName(worktree.branch);
      if (taskBranch && taskBranch.area === area) {
        return true;
      }

      const streamBranch = parseStreamBranchName(worktree.branch);
      return Boolean(streamBranch && streamBranch.area === area);
    })
    .map((worktree) => ({
      branch: worktree.branch,
      path: worktree.path,
    }))
    .sort((left, right) => left.branch.localeCompare(right.branch));
}

async function getOpenTaskPullRequests(args, area, streamBranch) {
  const token = (() => {
    try {
      return getToken();
    } catch {
      return null;
    }
  })();

  if (!token) {
    return {
      skipped: true,
      reason: 'missing github token',
      pullRequests: [],
    };
  }

  const pullRequests = await listPullRequests({
    token,
    repository: args.repo,
    state: 'open',
    base: streamBranch,
  });

  return {
    skipped: false,
    reason: null,
    pullRequests: pullRequests
      .filter((pullRequest) => pullRequest.head && pullRequest.head.ref.startsWith(`task/${area}/`))
      .map((pullRequest) => ({
        number: pullRequest.number,
        title: pullRequest.title,
        url: pullRequest.html_url,
        branch: pullRequest.head.ref,
        author: pullRequest.user ? pullRequest.user.login : null,
      })),
  };
}

function printResult(result, useJson) {
  if (useJson) {
    writeStdout(JSON.stringify(result, null, 2));
    return;
  }

  writeStdout(`stream: ${result.stream}`);

  if (result.aheadBehind) {
    const { ahead, behind } = result.aheadBehind;
    writeStdout(`ahead/behind vs origin: ${ahead}/${behind}`);
    if (behind > 0) {
      writeStdout(`  ⚠ ${behind} commits behind origin. run: bun run stream:sync -- --area ${result.area}`);
    }
  } else {
    writeStdout('ahead/behind vs origin: unavailable');
  }

  writeStdout('');
  writeStdout('stream decisions:');
  if (result.decisions.length === 0) {
    writeStdout('  - none yet');
    writeStdout(`  tip: bun run context -- save "dialer: description" --text --category stream-decision`);
  } else {
    for (const d of result.decisions) {
      writeStdout(`  - ${d.title}  (${d.date})`);
    }
    writeStdout(`  tip: bun run context -- save "${result.area}: new decision" --text --category stream-decision`);
  }

  writeStdout('');
  writeStdout('local worktrees:');
  if (result.worktrees.length === 0) {
    writeStdout('  - none');
  } else {
    for (const worktree of result.worktrees) {
      writeStdout(`  - ${worktree.branch} -> ${worktree.path}`);
    }
  }

  writeStdout('');
  writeStdout('open task prs:');
  if (result.openTaskPullRequests.skipped) {
    writeStdout(`  - skipped (${result.openTaskPullRequests.reason})`);
  } else if (result.openTaskPullRequests.pullRequests.length === 0) {
    writeStdout('  - none');
  } else {
    for (const pullRequest of result.openTaskPullRequests.pullRequests) {
      writeStdout(`  - #${pullRequest.number} ${pullRequest.branch} :: ${pullRequest.title}`);
    }
  }

  writeStdout('');
  writeStdout(`recent workpads (${result.recentWorkpads.workpads.length}):`);
  if (result.recentWorkpads.skipped) {
    writeStdout(`  - skipped (${result.recentWorkpads.reason})`);
  } else if (result.recentWorkpads.workpads.length === 0) {
    writeStdout('  - none');
    writeStdout('  tip: workpads are saved automatically by task:push. complete a task to see them here.');
  } else {
    for (let i = 0; i < result.recentWorkpads.workpads.length; i++) {
      const workpad = result.recentWorkpads.workpads[i];
      const bar = '──────────────────────────────────────────────────────────────';
      writeStdout(`  ┌${bar}┐`);
      writeStdout(`  │ workpad ${i + 1}/${result.recentWorkpads.workpads.length}: [${workpad.category}] ${workpad.title}`);
      writeStdout(`  │ saved: ${workpad.date}`);
      writeStdout(`  ├${bar}┤`);
      const lines = workpad.content.split('\n');
      for (const line of lines) {
        writeStdout(`  │ ${line}`);
      }
      writeStdout(`  └${bar}┘`);
      writeStdout('');
    }
  }

  writeStdout(`recent commits (${result.recentCommits.length}):`);
  if (result.recentCommits.length === 0) {
    writeStdout('  - none');
  } else {
    for (const commit of result.recentCommits) {
      writeStdout(`  - ${commit}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.area) {
    throw new Error('missing required --area');
  }

  const area = normalizeArea(args.area);
  const streamBranch = args.stream || getDefaultStreamBranch(area);
  const repoRoot = resolveGitRoot(process.cwd());

  assertStreamBranchName(streamBranch, area);
  fetchOrigin(repoRoot);

  const result = {
    area,
    stream: streamBranch,
    decisions: await getStreamDecisions(area),
    openTaskPullRequests: await getOpenTaskPullRequests(args, area, streamBranch),
    recentCommits: getRecentCommits(repoRoot, streamBranch),
    recentWorkpads: await getRecentWorkpads(area),
    aheadBehind: getAheadBehind(repoRoot, streamBranch),
    worktrees: getAreaWorktrees(repoRoot, area),
  };

  printResult(result, args.json);
}

main().catch((error) => {
  writeStderr(error instanceof Error ? error.message : 'unknown error');
  process.exit(1);
});
