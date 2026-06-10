const { DEFAULT_REPO } = require('./paths');

const MAX_REASONABLE_PR_NUMBER = 1000000;

function normalizeRepository(value) {
  const repo = String(value || DEFAULT_REPO).trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error(`invalid repository: ${repo}`);
  }
  return repo;
}

function toPositivePrNumber(raw) {
  const text = String(raw || '').trim();
  if (!/^\d+$/.test(text)) return null;
  const number = Number.parseInt(text, 10);
  if (!Number.isInteger(number) || number <= 0 || number > MAX_REASONABLE_PR_NUMBER) return null;
  return number;
}

function maybeUrl(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const urlText = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  try {
    return new URL(urlText);
  } catch {
    return null;
  }
}

function assertRepositoryMatches(found, expected) {
  const foundRepo = normalizeRepository(found).toLowerCase();
  const expectedRepo = normalizeRepository(expected).toLowerCase();
  if (foundRepo !== expectedRepo) {
    throw new Error(`PR reference points at ${found}, expected ${expected}`);
  }
}

function parseRecognizedUrl(value, expectedRepository) {
  const url = maybeUrl(value);
  if (!url) return null;

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  if (host === 'github.com') {
    if (segments.length >= 4 && segments[2] === 'pull') {
      const repo = `${segments[0]}/${segments[1]}`;
      assertRepositoryMatches(repo, expectedRepository);
      const prNumber = toPositivePrNumber(segments[3]);
      if (!prNumber) throw new Error(`invalid PR number in ${value}`);
      return { prNumber, repo, source: 'github' };
    }
    if (segments.includes('issues') || segments.includes('commit') || segments.includes('compare') || segments.includes('actions')) {
      throw new Error(`unsupported GitHub URL: expected /pull/<number>, got ${url.pathname}`);
    }
    return null;
  }

  if (host === 'diffs.consuelohq.com') {
    if (segments.length >= 4 && segments[2] === 'pull') {
      const repo = `${segments[0]}/${segments[1]}`;
      assertRepositoryMatches(repo, expectedRepository);
      const prNumber = toPositivePrNumber(segments[3]);
      if (!prNumber) throw new Error(`invalid PR number in ${value}`);
      return { prNumber, repo, source: 'diffs' };
    }
    return null;
  }

  if (host === 'app.graphite.com') {
    if (segments.length >= 5 && segments[0] === 'github' && segments[1] === 'pr') {
      const repo = `${segments[2]}/${segments[3]}`;
      assertRepositoryMatches(repo, expectedRepository);
      const prNumber = toPositivePrNumber(segments[4]);
      if (!prNumber) throw new Error(`invalid PR number in ${value}`);
      return { prNumber, repo, source: 'graphite' };
    }
    return null;
  }

  return null;
}

function parseFreeText(value) {
  const text = String(value || '').trim();
  if (!text) throw new Error('missing PR reference');

  const direct = toPositivePrNumber(text.replace(/^#/, ''));
  if (/^#?\d+$/.test(text) && direct) {
    return { prNumber: direct, source: 'number' };
  }

  const pullMatch = text.match(/(?:^|\/)pull\/(\d+)(?:\b|\/|$)/i);
  if (pullMatch) {
    const prNumber = toPositivePrNumber(pullMatch[1]);
    if (!prNumber) throw new Error(`invalid PR number in ${value}`);
    return { prNumber, source: 'text' };
  }

  const prMatches = [...text.matchAll(/\bPR\s*#?\s*(\d+)\b/gi)].map((match) => match[1]);
  if (prMatches.length === 1) {
    const prNumber = toPositivePrNumber(prMatches[0]);
    if (!prNumber) throw new Error(`invalid PR number in ${value}`);
    return { prNumber, source: 'text' };
  }
  if (prMatches.length > 1) {
    throw new Error(`ambiguous PR reference: ${value}`);
  }

  const numbers = [...text.matchAll(/\b\d+\b/g)].map((match) => match[0]);
  if (numbers.length === 1 && /^(?:#|PR\b|pull\/)/i.test(text)) {
    const prNumber = toPositivePrNumber(numbers[0]);
    if (prNumber) return { prNumber, source: 'text' };
  }
  if (numbers.length > 1) {
    throw new Error(`ambiguous PR reference: ${value}`);
  }

  throw new Error(`could not find a PR number in: ${value}`);
}

function parsePrRef(value, options = {}) {
  const expectedRepository = normalizeRepository(options.repository || options.repo || DEFAULT_REPO);
  const urlResult = parseRecognizedUrl(value, expectedRepository);
  const parsed = urlResult || parseFreeText(value);
  const repo = parsed.repo || expectedRepository;
  return {
    prNumber: parsed.prNumber,
    repo,
    repository: repo,
    source: parsed.source,
    normalizedGithubUrl: `https://github.com/${repo}/pull/${parsed.prNumber}`,
  };
}

function resolvePrRefNumber(value, options = {}) {
  return parsePrRef(value, options).prNumber;
}

module.exports = {
  parsePrRef,
  resolvePrRefNumber,
};
