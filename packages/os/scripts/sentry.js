#!/usr/bin/env bun

const { execFileSync } = require('node:child_process');

const KEYCHAIN_SERVICES = {
  token: 'opensaas-sentry-auth-token',
  orgSlug: 'opensaas-sentry-org-slug',
  baseUrl: 'opensaas-sentry-base-url',
  projectSlug: 'opensaas-sentry-project-slug',
};

const DEFAULT_BASE_URL = 'https://sentry.io';
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const ARRAY_VALUE_FLAGS = new Set(['environment', 'expand', 'collapse', 'field']);
const SENSITIVE_KEY_PATTERN = /authorization|cookie|set-cookie|token|password|secret|api[-_]?key|twilioauthtoken/i;

function writeJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function fail(code, message, details = {}) {
  writeJson({ ok: false, code, message, ...details });
  process.exit(1);
}

function printHelp() {
  writeJson({
    usage: 'bun run sentry -- <command> [options]',
    commands: ['config', 'projects', 'issues', 'issue', 'issue-event', 'event', 'trace'],
    keychain: KEYCHAIN_SERVICES,
  });
}

function parseArgs(argv) {
  const parsed = { positional: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) {
      parsed.positional.push(item);
      continue;
    }

    const rawName = item.slice(2);
    const equalIndex = rawName.indexOf('=');
    const flagName = equalIndex === -1 ? rawName : rawName.slice(0, equalIndex);
    const inlineValue = equalIndex === -1 ? undefined : rawName.slice(equalIndex + 1);
    const key = toCamelCase(flagName);

    if (inlineValue !== undefined) {
      setArg(parsed, key, inlineValue);
      continue;
    }

    const values = [];
    while (argv[index + 1] && !argv[index + 1].startsWith('--')) {
      values.push(argv[index + 1]);
      index += 1;
      if (!ARRAY_VALUE_FLAGS.has(key)) break;
    }

    if (values.length === 0) {
      setArg(parsed, key, true);
      continue;
    }

    for (const value of values) {
      setArg(parsed, key, value);
    }
  }

  return parsed;
}

function setArg(target, key, value) {
  if (target[key] === undefined) {
    target[key] = value;
    return;
  }
  if (Array.isArray(target[key])) {
    target[key].push(value);
    return;
  }
  target[key] = [target[key], value];
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function parsePositiveInteger(value, fallback) {
  if (value === undefined || value === true) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_LIMIT);
}

function normalizeArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

function readKeychain(service) {
  try {
    return execFileSync(
      'security',
      ['find-generic-password', '-a', process.env.USER || '', '-s', service, '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
  } catch {
    return null;
  }
}

function loadConfig({ requireToken = true, requireOrg = true } = {}) {
  const token = process.env.SENTRY_AUTH_TOKEN || readKeychain(KEYCHAIN_SERVICES.token);
  const orgSlug = process.env.SENTRY_ORG || readKeychain(KEYCHAIN_SERVICES.orgSlug);
  const baseUrl = (process.env.SENTRY_BASE_URL || readKeychain(KEYCHAIN_SERVICES.baseUrl) || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const projectSlug = process.env.SENTRY_PROJECT || readKeychain(KEYCHAIN_SERVICES.projectSlug);

  if (requireToken && !token) {
    fail('CONFIG_ERROR', 'missing Sentry auth token in Keychain or SENTRY_AUTH_TOKEN', { missing: KEYCHAIN_SERVICES.token });
  }
  if (requireOrg && !orgSlug) {
    fail('CONFIG_ERROR', 'missing Sentry org slug in Keychain or SENTRY_ORG', { missing: KEYCHAIN_SERVICES.orgSlug });
  }

  return { token, orgSlug, baseUrl, projectSlug };
}

function appendSearchParam(params, key, value) {
  if (value === undefined || value === null || value === false) return;
  if (Array.isArray(value)) {
    for (const item of value) appendSearchParam(params, key, item);
    return;
  }
  params.append(key, String(value));
}

async function sentryFetch(pathname, query = {}, options = {}) {
  try {
    const config = options.config || loadConfig();
    const url = new URL(`/api/0/${pathname.replace(/^\/+/, '')}`, `${config.baseUrl}/`);

  for (const [key, value] of Object.entries(query)) {
    appendSearchParam(url.searchParams, key, value);
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${config.token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(options.timeoutMs || 30000),
  });

  const text = await response.text();
  const body = parseJsonBody(text);
  const meta = {
    statusCode: response.status,
    link: response.headers.get('link'),
    rateLimit: {
      limit: response.headers.get('x-sentry-rate-limit-limit'),
      remaining: response.headers.get('x-sentry-rate-limit-remaining'),
      reset: response.headers.get('x-sentry-rate-limit-reset'),
    },
  };

  if (!response.ok) {
    const error = new Error(`Sentry API request failed with HTTP ${response.status}`);
    error.details = {
      endpoint: url.pathname,
      query,
      response: redact(body || text),
      meta,
    };
    throw error;
  }

    return { data: redact(body), meta };
  } catch {
    throw new Error('Sentry API request failed');
  }
}

function parseJsonBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function redact(value) {
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (!value || typeof value !== 'object') return value;

  const output = {};
  for (const [key, child] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : redact(child);
  }
  return output;
}

function isShortIssueId(value) {
  return /^[A-Z0-9][A-Z0-9_-]*-\d+$/i.test(String(value));
}

function isNumericId(value) {
  return /^\d+$/.test(String(value));
}

async function resolveProjectId(projectSlug, config) {
  try {
    if (!projectSlug) return null;
  if (isNumericId(projectSlug)) return Number(projectSlug);

  const { data } = await sentryFetch(`/organizations/${config.orgSlug}/projects/`, { per_page: MAX_LIMIT }, { config });
  const project = Array.isArray(data) ? data.find((item) => item.slug === projectSlug || item.name === projectSlug) : null;
  if (!project) fail('NOT_FOUND', `Sentry project not found: ${projectSlug}`, { project: projectSlug });
    return Number(project.id);
  } catch {
    fail('SENTRY_PROJECT_ERROR', 'failed to resolve Sentry project');
  }
}

async function resolveProjectSlug(projectSlug, config) {
  if (projectSlug && !isNumericId(projectSlug)) return projectSlug;
  if (config.projectSlug) return config.projectSlug;
  return null;
}

async function resolveIssueId(identifier, config) {
  try {
    if (!identifier) fail('VALIDATION_ERROR', 'issue identifier is required');
  if (isNumericId(identifier)) return { issueId: String(identifier), shortId: null, projectSlug: null };

  if (!isShortIssueId(identifier)) {
    fail('VALIDATION_ERROR', 'issue identifier must be a numeric issue id or short id like PROJECT-123', { identifier });
  }

  const { data } = await sentryFetch(`/organizations/${config.orgSlug}/shortids/${encodeURIComponent(identifier)}/`, {}, { config });
  const issueId = data.groupId || data.group?.id || data.id;
  if (!issueId) fail('NOT_FOUND', `could not resolve Sentry short id: ${identifier}`, { shortId: identifier, data });

    return {
      issueId: String(issueId),
      shortId: identifier,
      projectSlug: data.projectSlug || data.project?.slug || null,
      resolution: data,
    };
  } catch {
    fail('SENTRY_ISSUE_RESOLUTION_ERROR', 'failed to resolve Sentry issue identifier');
  }
}

function eventIdentifierFromArgs(args) {
  return args.eventId || args.event || args.id || args.identifier || args.positional[1];
}

function issueIdentifierFromArgs(args) {
  return args.issueId || args.issue || args.id || args.identifier || args.positional[1];
}

function baseIssueQuery(args) {
  return {
    per_page: parsePositiveInteger(args.limit || args.perPage, DEFAULT_LIMIT),
    cursor: args.cursor,
    query: args.query,
    sort: args.sort,
    statsPeriod: args.statsPeriod || args.stats,
    start: args.start,
    end: args.end,
    expand: normalizeArray(args.expand),
    collapse: normalizeArray(args.collapse),
  };
}

async function cmdConfig(args) {
  try {
  const config = loadConfig({ requireToken: false, requireOrg: false });
  const payload = {
    ok: true,
    command: 'config',
    config: {
      tokenPresent: Boolean(config.token),
      orgSlug: config.orgSlug || null,
      baseUrl: config.baseUrl,
      projectSlug: config.projectSlug || null,
      keychainServices: KEYCHAIN_SERVICES,
    },
  };

  if (args.verify && config.token && config.orgSlug) {
    const { data, meta } = await sentryFetch(`/organizations/${config.orgSlug}/projects/`, { per_page: 1 }, { config });
    payload.verify = { ok: true, projectCountReturned: Array.isArray(data) ? data.length : null, meta };
  }

    writeJson(payload);
  } catch {
    fail('SENTRY_CONFIG_ERROR', 'failed to read Sentry config');
  }
}

async function cmdProjects(args) {
  try {
  const config = loadConfig();
  const { data, meta } = await sentryFetch(
    `/organizations/${config.orgSlug}/projects/`,
    { per_page: parsePositiveInteger(args.limit || args.perPage, DEFAULT_LIMIT), cursor: args.cursor },
    { config },
  );
    writeJson({ ok: true, command: 'projects', orgSlug: config.orgSlug, projects: data, meta });
  } catch {
    fail('SENTRY_PROJECTS_ERROR', 'failed to list Sentry projects');
  }
}

async function cmdIssues(args) {
  try {
  const config = loadConfig();
  const query = baseIssueQuery(args);
  const project = args.project || args.projectSlug;
  const resolvedProjectId = await resolveProjectId(project, config);
  if (resolvedProjectId) query.project = resolvedProjectId;

  const environments = normalizeArray(args.environment);
  if (environments.length > 0) query.environment = environments;

  const { data, meta } = await sentryFetch(`/organizations/${config.orgSlug}/issues/`, query, { config });
  const limit = parsePositiveInteger(args.limit || args.perPage, DEFAULT_LIMIT);
  const issues = Array.isArray(data) ? data.slice(0, limit) : data;
    writeJson({ ok: true, command: 'issues', orgSlug: config.orgSlug, project: project || null, issues, meta });
  } catch {
    fail('SENTRY_ISSUES_ERROR', 'failed to list Sentry issues');
  }
}

async function cmdIssue(args) {
  try {
  const config = loadConfig();
  const identifier = issueIdentifierFromArgs(args);
  const resolution = await resolveIssueId(identifier, config);
  const { data, meta } = await sentryFetch(
    `/organizations/${config.orgSlug}/issues/${encodeURIComponent(resolution.issueId)}/`,
    { expand: normalizeArray(args.expand) },
    { config },
  );
    writeJson({ ok: true, command: 'issue', orgSlug: config.orgSlug, input: identifier, resolution, issue: data, meta });
  } catch {
    fail('SENTRY_ISSUE_ERROR', 'failed to retrieve Sentry issue');
  }
}

async function cmdIssueEvent(args) {
  try {
  const config = loadConfig();
  const issueIdentifier = args.issueId || args.issue || args.positional[1];
  const eventId = args.eventId || args.event || args.positional[2] || 'recommended';
  const resolution = await resolveIssueId(issueIdentifier, config);
  const { data, meta } = await sentryFetch(
    `/organizations/${config.orgSlug}/issues/${encodeURIComponent(resolution.issueId)}/events/${encodeURIComponent(eventId)}/`,
    { full: args.full === true || args.full === 'true' ? true : undefined },
    { config },
  );
    writeJson({ ok: true, command: 'issueEvent', orgSlug: config.orgSlug, issueInput: issueIdentifier, eventInput: eventId, resolution, event: data, trace: extractTrace(data), meta });
  } catch {
    fail('SENTRY_ISSUE_EVENT_ERROR', 'failed to retrieve Sentry issue event');
  }
}

async function cmdEvent(args) {
  try {
  const config = loadConfig();
  const eventId = eventIdentifierFromArgs(args);
  if (!eventId) fail('VALIDATION_ERROR', 'event id is required');

  const projectSlug = await resolveProjectSlug(args.project || args.projectSlug || config.projectSlug, config);
  if (projectSlug) {
    const { data, meta } = await sentryFetch(`/projects/${config.orgSlug}/${projectSlug}/events/${encodeURIComponent(eventId)}/`, {}, { config });
    writeJson({ ok: true, command: 'event', orgSlug: config.orgSlug, projectSlug, eventId, event: data, trace: extractTrace(data), meta });
    return;
  }

  const { data, meta } = await sentryFetch(`/organizations/${config.orgSlug}/eventids/${encodeURIComponent(eventId)}/`, {}, { config });
    writeJson({ ok: true, command: 'event', orgSlug: config.orgSlug, eventId, resolver: data, trace: extractTrace(data), meta, note: 'resolved event metadata; pass project slug for full project event detail when needed' });
  } catch {
    fail('SENTRY_EVENT_ERROR', 'failed to retrieve Sentry event');
  }
}

async function cmdTrace(args) {
  const config = loadConfig();
  const traceId = args.traceId || args.trace || args.positional[1];
  if (!traceId) fail('VALIDATION_ERROR', 'trace id is required');

  const limit = parsePositiveInteger(args.limit || args.perPage, DEFAULT_LIMIT);
  const resolvedProjectId = await resolveProjectId(args.project || args.projectSlug, config);
  const attempts = [];
  const eventQuery = {
    dataset: args.dataset || 'errors',
    project: resolvedProjectId || -1,
    query: args.query || `trace:${traceId}`,
    field: normalizeArray(args.field).length > 0 ? normalizeArray(args.field) : ['id', 'title', 'project', 'timestamp', 'transaction', 'trace', 'issue.id'],
    statsPeriod: args.statsPeriod || '14d',
    per_page: limit,
    cursor: args.cursor,
  };

  try {
    const eventResult = await sentryFetch(`/organizations/${config.orgSlug}/events/`, eventQuery, { config });
    attempts.push({ source: 'events', ok: true, query: eventQuery, result: eventResult.data, meta: eventResult.meta });
  } catch {
    attempts.push({ source: 'events', ok: false, message: 'events trace lookup failed', query: eventQuery });
  }

  const issueQuery = { query: `trace:${traceId}`, project: resolvedProjectId || undefined, per_page: limit, statsPeriod: args.statsPeriod || '14d' };
  try {
    const issueResult = await sentryFetch(`/organizations/${config.orgSlug}/issues/`, issueQuery, { config });
    attempts.push({ source: 'issues', ok: true, query: issueQuery, result: issueResult.data, meta: issueResult.meta });
  } catch {
    attempts.push({ source: 'issues', ok: false, message: 'issues trace lookup failed', query: issueQuery });
  }

  writeJson({ ok: true, command: 'trace', orgSlug: config.orgSlug, traceId, bestEffort: true, attempts });
}

function extractTrace(event) {
  if (!event || typeof event !== 'object') return null;
  const contexts = event.contexts || {};
  const trace = contexts.trace || event.context?.trace || event.trace || null;
  return trace ? redact(trace) : null;
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
  const command = args.positional[0];
  if (!command || args.help) {
    printHelp();
    return;
  }

  switch (command) {
    case 'config':
      await cmdConfig(args);
      return;
    case 'projects':
      await cmdProjects(args);
      return;
    case 'issues':
      await cmdIssues(args);
      return;
    case 'issue':
      await cmdIssue(args);
      return;
    case 'issue-event':
    case 'issueEvent':
      await cmdIssueEvent(args);
      return;
    case 'event':
      await cmdEvent(args);
      return;
    case 'trace':
      await cmdTrace(args);
      return;
    default:
      fail('VALIDATION_ERROR', `unknown Sentry command: ${command}`, { command });
  }
  } catch {
    fail('COMMAND_FAILED', 'Sentry command failed');
  }
}

main().catch(() => {
  fail('COMMAND_FAILED', 'Sentry command failed');
});
