// GitHub's commit statusCheckRollup contains historical check runs, including
// canceled workflow executions superseded at the same commit SHA. The merge
// gate must retain independent workflow/matrix contexts while dropping only
// demonstrably superseded executions.
const { githubRequest } = require('./github.js');

const PASSING_CONCLUSIONS = new Set(['success', 'neutral', 'skipped']);
const GITHUB_ACTIONS_APP_ID = 15368;
const PAGE_SIZE = 100;
const MAX_PAGES = 200;

const CHECK_CONTEXTS_QUERY = `
  query MergeReadinessContexts($owner: String!, $name: String!, $headSha: GitObjectID!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      object(oid: $headSha) {
        ... on Commit {
          oid
          statusCheckRollup {
            contexts(first: 100, after: $cursor) {
              totalCount
              pageInfo { hasNextPage endCursor }
              nodes {
                __typename
                ... on CheckRun {
                  id
                  name
                  status
                  conclusion
                  startedAt
                  completedAt
                  checkSuite {
                    app { databaseId }
                    workflowRun {
                      databaseId
                      event
                      createdAt
                      updatedAt
                      workflow { id name }
                    }
                  }
                }
                ... on StatusContext {
                  id
                  context
                  state
                  createdAt
                }
              }
            }
          }
        }
      }
    }
  }
`;

function normalizeCheckRun(check) {
  if (check?.__typename === 'StatusContext') {
    const state = String(check.state || '').toLowerCase();
    return {
      name: String(check.context || 'unnamed legacy status'),
      status: state === 'pending' || state === 'expected' ? 'in_progress' : 'completed',
      conclusion: state === 'success' ? 'success' : state === 'failure' || state === 'error' ? 'failure' : null,
    };
  }
  if (check?.__typename && check.__typename !== 'CheckRun') {
    return { name: 'unrecognized GitHub check context', status: 'unknown', conclusion: null };
  }
  return {
    name: String(check?.name || 'unnamed check'),
    status: String(check?.status || '').toLowerCase(),
    conclusion: check?.conclusion == null ? null : String(check.conclusion).toLowerCase(),
  };
}

function checkCountByName(checks) {
  const counts = new Map();
  for (const check of checks) {
    const name = String(check?.name || 'unnamed check');
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return counts;
}

function timeValue(iso) {
  if (typeof iso !== 'string' || !iso) return null;
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : null;
}

function currentCheckContexts(allChecks) {
  const selected = [];
  const extraPending = [];
  const workflows = new Map();
  const legacy = new Map();

  for (const check of allChecks) {
    if (check?.__typename === 'StatusContext') {
      const key = String(check.context || '');
      const previous = legacy.get(key);
      if (!previous) {
        legacy.set(key, check);
      } else {
        // GraphQL normally returns the effective legacy status; if duplicates
        // appear, only a strictly newer timestamp can supersede an older one.
        const now = timeValue(check.createdAt);
        const then = timeValue(previous.createdAt);
        if (now == null || then == null || now === then) {
          extraPending.push(`ambiguous legacy status: ${key || 'unnamed'}`);
        } else if (now > then) {
          legacy.set(key, check);
        }
      }
      continue;
    }

    const suite = check?.checkSuite;
    const run = suite?.workflowRun;
    const workflow = run?.workflow;
    const appId = suite?.app?.databaseId;
    if (run && workflow?.id && Number.isSafeInteger(run.databaseId)) {
      const workflowKey = `${appId || 'app'}:${workflow.id}:${run.event || 'unknown-event'}`;
      let executions = workflows.get(workflowKey);
      if (!executions) {
        executions = new Map();
        workflows.set(workflowKey, executions);
      }
      let execution = executions.get(run.databaseId);
      if (!execution) {
        execution = { checks: [], updatedAt: timeValue(run.updatedAt), startedAt: null, label: workflow.name || workflow.id };
        executions.set(run.databaseId, execution);
      }
      execution.checks.push(check);
      const startedAt = timeValue(check.startedAt);
      if (startedAt != null) execution.startedAt = Math.max(execution.startedAt ?? -Infinity, startedAt);
    } else {
      // A GitHub Actions job without a reliably identified run must never be
      // silently paired with a successful job of the same name.
      if (appId === GITHUB_ACTIONS_APP_ID) {
        extraPending.push(`unidentified GitHub Actions workflow: ${check?.name || 'unnamed check'}`);
      }
      selected.push(check);
    }
  }

  for (const executions of workflows.values()) {
    const runs = [...executions.values()];
    if (runs.length === 1) {
      selected.push(...runs[0].checks);
      continue;
    }

    // Select the most recently updated execution *of the same workflow*.
    // Do not use check names: separate workflows share names, and a matrix
    // may legitimately contain multiple jobs with an identical display name.
    if (runs.some((run) => run.updatedAt == null)) {
      extraPending.push(`workflow run cannot be ordered: ${runs[0].label}`);
      selected.push(...runs.flatMap((run) => run.checks));
      continue;
    }
    runs.sort((a, b) => b.updatedAt - a.updatedAt);
    if (runs[0].updatedAt === runs[1].updatedAt) {
      extraPending.push(`ambiguous current workflow run: ${runs[0].label}`);
      selected.push(...runs.flatMap((run) => run.checks));
      continue;
    }
    if (runs.slice(1).some((run) => run.startedAt != null &&
      (runs[0].startedAt == null || run.startedAt > runs[0].startedAt))) {
      // A later-started run that finished earlier may contain a real failure.
      // Conflicting ordering evidence is not proof that it was superseded.
      extraPending.push(`conflicting workflow run order: ${runs[0].label}`);
      selected.push(...runs.flatMap((run) => run.checks));
      continue;
    }

    const current = runs[0];
    const currentCounts = checkCountByName(current.checks);
    for (const previous of runs.slice(1)) {
      if (previous.checks.some((check) => String(check.status || '').toLowerCase() !== 'completed')) {
        extraPending.push(`unresolved previous workflow execution: ${previous.label}`);
      }
      for (const [name, count] of checkCountByName(previous.checks)) {
        if ((currentCounts.get(name) || 0) < count) {
          extraPending.push(`missing current workflow check: ${previous.label} / ${name}`);
        }
      }
    }
    selected.push(...current.checks);
  }

  selected.push(...legacy.values());
  return { selected, extraPending };
}

function summarizeCheckRuns(checkRuns) {
  const allChecks = Array.isArray(checkRuns) ? checkRuns : [];
  const { selected, extraPending } = currentCheckContexts(allChecks);
  const checks = selected.map(normalizeCheckRun);
  const failed = [];
  const pending = [...extraPending];
  const passed = [];

  for (const check of checks) {
    if (check.status !== 'completed') {
      pending.push(check.name);
    } else if (check.conclusion && PASSING_CONCLUSIONS.has(check.conclusion)) {
      passed.push(check.name);
    } else if (check.conclusion == null) {
      // Terminal check with an unknown conclusion is not an approval.
      failed.push(check.name);
    } else {
      failed.push(check.name);
    }
  }

  return {
    state: failed.length > 0 ? 'failed' : pending.length > 0 || checks.length === 0 ? 'pending' : 'passed',
    total: checks.length,
    pending,
    failed,
    passed,
  };
}

async function getPullRequestCheckSummary(token, repository, pr, request = githubRequest) {
  const headSha = pr?.head?.sha;
  if (!headSha) {
    return {
      state: 'pending', total: 0, pending: ['GitHub has not exposed the PR head SHA yet'],
      failed: [], passed: [], headSha: null,
    };
  }

  try {
    const [owner, name, ...extra] = String(repository).split('/');
    if (!owner || !name || extra.length) throw new Error('invalid repository for merge readiness');
    const checks = [];
    const seenCheckIds = new Set();
    const seenCursors = new Set();
    let cursor = null;
    let expectedCount = null;
    let complete = false;

    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await request({
        token,
        method: 'POST',
        endpoint: '/graphql',
        body: { query: CHECK_CONTEXTS_QUERY, variables: { owner, name, headSha, cursor } },
      });
      if (response?.errors?.length) {
        throw new Error(`GitHub GraphQL check query failed: ${response.errors.map((error) => error.message || 'unknown error').join('; ')}`);
      }
      const commit = response?.data?.repository?.object;
      if (!commit || commit.oid !== headSha) throw new Error('GitHub returned a different or missing commit SHA');
      const connection = commit.statusCheckRollup?.contexts;
      if (!connection || !Array.isArray(connection.nodes)) {
        throw new Error('GitHub returned no readable status-check contexts');
      }
      const count = connection.totalCount;
      if (!Number.isSafeInteger(count) || count < 0 || count > MAX_PAGES * PAGE_SIZE) {
        throw new Error('GitHub returned an invalid or unbounded check context count');
      }
      if (expectedCount == null) expectedCount = count;
      if (expectedCount !== count || checks.length + connection.nodes.length > count) {
        throw new Error('GitHub check context count changed during pagination');
      }
      for (const context of connection.nodes) {
        if (typeof context?.id !== 'string' || !context.id || seenCheckIds.has(context.id)) {
          throw new Error('GitHub check contexts are missing identities or contain duplicates');
        }
        seenCheckIds.add(context.id);
      }
      checks.push(...connection.nodes);
      const info = connection.pageInfo;
      if (!info || typeof info.hasNextPage !== 'boolean') {
        throw new Error('GitHub omitted check pagination metadata');
      }
      if (!info.hasNextPage) {
        if (checks.length !== count) throw new Error('GitHub returned a truncated check context set');
        complete = true;
        break;
      }
      const next = info.endCursor;
      if (!next || next === cursor || seenCursors.has(next) || connection.nodes.length === 0) {
        throw new Error('GitHub returned invalid check pagination cursor');
      }
      seenCursors.add(next);
      cursor = next;
    }
    if (!complete) throw new Error('GitHub check context pagination exceeded safety limit');
    return { ...summarizeCheckRuns(checks), headSha };
  } catch (error) {
    return {
      state: 'pending',
      total: 0,
      pending: ['GitHub check-run and legacy status readiness could not be completely read'],
      failed: [],
      passed: [],
      headSha,
      error: error instanceof Error ? error.message : 'unknown GitHub readiness error',
    };
  }
}

module.exports = {
  getPullRequestCheckSummary,
  summarizeCheckRuns,
};
