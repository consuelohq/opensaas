#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function readChangedFiles(baseRef) {
  if (process.env.CHANGED_FILES && process.env.CHANGED_FILES.trim()) {
    return process.env.CHANGED_FILES.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  return git(['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function permissionLines(text) {
  const lines = text.split('\n');
  const result = [];
  let inside = false;

  for (const line of lines) {
    if (/^permissions:\s*$/.test(line)) {
      inside = true;
      continue;
    }

    if (inside && /^\S/.test(line)) {
      break;
    }

    if (inside) {
      result.push(line.trim());
    }
  }

  return result;
}

const baseRef = process.argv[2] || process.env.BASE_REF || 'origin/main';
const changedFiles = readChangedFiles(baseRef);
const changedWorkflowFiles = changedFiles.filter((file) =>
  /^\.github\/workflows\/[^/]+\.ya?ml$/.test(file),
);

const pullRequestTargetAllowlist = new Set([
  '.github/workflows/ci-utils.yaml',
  '.github/workflows/preview-env-dispatch.yaml',
]);

const writePermissionAllowlist = new Set([
  '.github/workflows/cd-deploy-main.yaml',
  '.github/workflows/cd-deploy-tag.yaml',
  '.github/workflows/ci-release-create.yaml',
  '.github/workflows/ci-release-merge.yaml',
  '.github/workflows/claude.yml',
  '.github/workflows/docs-i18n-pull.yaml',
  '.github/workflows/docs-i18n-push.yaml',
  '.github/workflows/i18n-pull.yaml',
  '.github/workflows/i18n-push.yaml',
  '.github/workflows/i18n-qa-report.yaml',
  '.github/workflows/preview-env-dispatch.yaml',
  '.github/workflows/preview-env-keepalive.yaml',
  '.github/workflows/upstream-sync.yml',
]);

const findings = [];

for (const file of changedWorkflowFiles) {
  if (!fs.existsSync(file)) {
    continue;
  }

  const text = fs.readFileSync(file, 'utf8');
  const usesPullRequestTarget = /(^|\n)\s*pull_request_target\s*:/.test(text);
  const hasPrivilegedPermission = permissionLines(text).some((line) =>
    /^(actions|checks|contents|deployments|id-token|issues|packages|pull-requests|statuses):\s*write\b/.test(line),
  );

  if (usesPullRequestTarget && !pullRequestTargetAllowlist.has(file)) {
    findings.push(`${file}: pull_request_target is restricted to approved legacy workflows`);
  }

  if (usesPullRequestTarget && /\buses:\s*actions\/checkout@/.test(text) && /(^|\n)\s*run:\s*/.test(text) && !pullRequestTargetAllowlist.has(file)) {
    findings.push(`${file}: pull_request_target must not combine checkout and run steps without explicit review`);
  }

  if (hasPrivilegedPermission && !writePermissionAllowlist.has(file)) {
    findings.push(`${file}: write permissions require an approved workflow allowlist entry`);
  }
}

const payload = {
  ok: findings.length === 0,
  baseRef,
  changedWorkflowFiles,
  findings,
};

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);

if (findings.length > 0) {
  process.exit(1);
}
