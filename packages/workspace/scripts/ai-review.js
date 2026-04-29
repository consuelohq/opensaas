#!/usr/bin/env bun

// ai-review.js — send diff + evidence to gemma via pi-proxy, post findings to PR
// writes review to .task/reviews/ai-<pr>.md and optionally posts to github

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

const PI_PROXY_URL = 'http://127.0.0.1:11434/v1/chat/completions';
const REVIEW_MODEL = 'google/gemma-4-31b-it';
const MAX_DIFF_CHARS = 60000;
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

function writeStdout(s = '') { process.stdout.write(s + '\n'); }
function writeStderr(s = '') { process.stderr.write(s + '\n'); }

function printHelp() {
  writeStdout('usage: bun run ai-review -- [options] [pr-number]');
  writeStdout('');
  writeStdout('send diff + evidence to gemma via pi-proxy for ai code review.');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --no-post    skip posting to github (just write .task/ file)');
  writeStdout('  --json       json output');
  writeStdout('  --help       show this help');
}

function parseArgs(argv) {
  const args = { prNumber: null, noPost: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--no-post': args.noPost = true; break;
      case '--json': args.json = true; break;
      case '--help': args.help = true; break;
      default:
        if (/^\d+$/.test(argv[i])) args.prNumber = parseInt(argv[i], 10);
        else if (argv[i].includes('/pull/')) {
          const m = argv[i].match(/\/pull\/(\d+)/);
          if (m) args.prNumber = parseInt(m[1], 10);
        }
        else if (argv[i].startsWith('--')) throw new Error(`unknown flag: ${argv[i]}`);
    }
  }
  return args;
}

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, ...opts }).trim();
  } catch {
    return '';
  }
}

function gitRoot() {
  return run('git rev-parse --show-toplevel');
}

function detectPrNumber() {
  const taskFile = path.join(process.cwd(), '.task', 'current.json');
  if (!fs.existsSync(taskFile)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
    const m = (data.prUrl || '').match(/\/pull\/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  } catch { return null; }
}

function getDiff(prNumber) {
  const diff = run(`gh pr diff ${prNumber} --repo consuelohq/opensaas`);
  if (diff.length > MAX_DIFF_CHARS) {
    return diff.substring(0, MAX_DIFF_CHARS) + '\n\n... (truncated, diff too large)';
  }
  return diff;
}

function getPrMeta(prNumber) {
  const raw = run(`gh pr view ${prNumber} --repo consuelohq/opensaas --json title,headRefName,files --jq '{title: .title, branch: .headRefName, files: [.files[].path]}'`);
  try { return JSON.parse(raw); } catch { return { title: '', branch: '', files: [] }; }
}

function getConfidence(root) {
  try {
    const { readExploreState, updateBeliefsWithEvents } = require('./lib/state/explore-state');
    const { getEvidenceEvents } = require('./lib/state/evidence-log');
    const { computeConfidence } = require('./confidence-score');
    const state = readExploreState(root);
    if (!state) return null;
    const events = getEvidenceEvents(root);
    const updated = updateBeliefsWithEvents(state, events);
    return computeConfidence(root, updated, events);
  } catch { return null; }
}

function getStaticReview(root) {
  try {
    const output = execFileSync('node', [path.join(root, 'packages/workspace/scripts/review.js'), '--json', '--no-tests'], {
      encoding: 'utf8',
      cwd: root,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120000,
    });
    return JSON.parse(output);
  } catch { return null; }
}

function buildSystemPrompt(confidence, staticReview) {
  let prompt = `you are a senior code reviewer for consuelo, an open-source sales infrastructure platform (typescript monorepo, nestjs + react + typeorm + postgres).

review the diff and provide structured findings. be direct, specific, and actionable.

format your response as markdown with these sections:
## summary
one paragraph overview of the changes.

## issues
numbered list of problems found. for each:
- severity: 🔴 blocking, 🟡 warning, 🟢 nit
- file and line range
- what's wrong and how to fix it

## good
things done well (brief).

## verdict
APPROVE, REQUEST_CHANGES, or COMMENT with one-line reason.

coding standards to check:
- no console usage (use structured logger)
- parameterized SQL only
- typed catch blocks with type guards
- no explicit any without // HACK: comment
- error handling: all awaiting functions need try-catch
- phone comparisons use normalizePhone()
- peer deps use lazy dynamic imports
`;

  if (confidence) {
    prompt += `\n## decision engine context
the coding agent's confidence score is ${confidence.score.toFixed(2)}.
recommendation: ${confidence.recommendation}
evidence for: ${confidence.evidence_for.join(', ') || 'none'}
evidence against: ${confidence.evidence_against.join(', ') || 'none'}
uncertainties: ${confidence.uncertainties.join(', ') || 'none'}
files read: ${confidence.evidence_counts.read_top_files}/${confidence.evidence_counts.top_files} top, ${confidence.evidence_counts.read_graph_files}/${confidence.evidence_counts.graph_files} graph

use this to calibrate your review — low confidence means look harder for missed cases. high confidence means focus on subtle issues.
`;
  }

  if (staticReview) {
    const yourCount = (staticReview.yours || []).length;
    const preCount = (staticReview.preExisting || []).length;
    if (yourCount > 0 || preCount > 0) {
      prompt += `\n## static analysis already found
${yourCount} issue(s) in changed code, ${preCount} pre-existing.
${(staticReview.yours || []).slice(0, 5).map(f => `- ${f.rule}: ${f.file}:${f.line} — ${f.msg}`).join('\n')}
don't repeat these — focus on semantic issues the static checks can't catch.
`;
    }
  }

  return prompt;
}

async function callPiProxy(systemPrompt, diff, prMeta) {
  try {
  const userMessage = `review this PR: "${prMeta.title}" (branch: ${prMeta.branch})

files changed: ${prMeta.files.join(', ')}

\`\`\`diff
${diff}
\`\`\``;

  // get nvidia key from keychain
  let apiKey;
  try {
    apiKey = execSync('security find-generic-password -a "$USER" -s "pi-proxy-nvidia-api-key" -w', { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('nvidia API key not found in keychain. run: security add-generic-password -a "$USER" -s "pi-proxy-nvidia-api-key" -w "YOUR_KEY"');
  }

  const body = JSON.stringify({
    model: REVIEW_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });

  const response = await fetch(NVIDIA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body,
    signal: AbortSignal.timeout(180000),
  });

  if (!response.ok) {
    const text = await response.text();
    // retry once on rate limit
    if (response.status === 429) {
      writeStderr('  rate limited, waiting 30s and retrying...');
      await new Promise(r => setTimeout(r, 30000));
      const retry = await fetch(NVIDIA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body,
        signal: AbortSignal.timeout(180000),
      });
      if (!retry.ok) {
        const retryText = await retry.text();
        throw new Error(`nvidia returned ${retry.status} after retry: ${retryText}`);
      }
      const retryData = await retry.json();
      return retryData.choices?.[0]?.message?.content || '';
    }
    throw new Error(`nvidia returned ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
  } catch (err) { // HACK: rethrow wrapper
    throw err instanceof Error ? err : new Error(String(err));
  }
}

function writeReviewFile(root, prNumber, content) {
  // write to .task/reviews/ if in a task worktree, otherwise /tmp
  const taskDir = path.join(root, '.task', 'reviews');
  const tmpDir = '/tmp';
  let outDir;

  if (fs.existsSync(path.join(root, '.task'))) {
    outDir = taskDir;
  } else {
    outDir = tmpDir;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `ai-${prNumber}.md`);
  fs.writeFileSync(outPath, content + '\n', 'utf8');
  return outPath;
}

function postToGithub(prNumber, content) {
  const body = `## 🤖 ai code review (gemma-4-31b-it)\n\n${content}\n\n---\n_automated review via pi-proxy + decision engine_`;
  const tmpFile = `/tmp/ai-review-${prNumber}.md`;
  fs.writeFileSync(tmpFile, body, 'utf8');
  try {
    execSync(`gh pr comment ${prNumber} --repo consuelohq/opensaas --body-file ${tmpFile}`, { encoding: 'utf8' });
    return true;
  } catch (err /* unknown */) {
    const msg = err instanceof Error ? err.message : String(err);
    writeStderr(`failed to post to github: ${msg}`);
    return false;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return; }

  const prNumber = args.prNumber || detectPrNumber();
  if (!prNumber) {
    writeStderr('error: no PR number. usage: bun run ai-review -- <pr-number>');
    process.exit(1);
  }

  const root = gitRoot();
  writeStderr(`→ ai review for PR #${prNumber}`);

  // gather context
  writeStderr('  fetching diff...');
  const diff = getDiff(prNumber);
  if (!diff) { writeStderr('error: empty diff'); process.exit(1); }

  const prMeta = getPrMeta(prNumber);
  writeStderr(`  "${prMeta.title}" — ${prMeta.files.length} files`);

  writeStderr('  reading confidence...');
  const confidence = getConfidence(root);
  if (confidence) {
    writeStderr(`  confidence: ${confidence.score.toFixed(2)} — ${confidence.recommendation}`);
  } else {
    writeStderr('  confidence: no evidence available');
  }

  writeStderr('  running static review...');
  const staticReview = getStaticReview(root);

  // build prompt and call pi-proxy
  const systemPrompt = buildSystemPrompt(confidence, staticReview);
  writeStderr(`  calling pi-proxy (${REVIEW_MODEL})...`);

  const reviewContent = await callPiProxy(systemPrompt, diff, prMeta);
  writeStderr(`  got ${reviewContent.length} chars back`);

  // write to .task/reviews/
  const filePath = writeReviewFile(root, prNumber, reviewContent);
  writeStderr(`  wrote ${filePath}`);

  // post to github
  if (!args.noPost) {
    writeStderr('  posting to github...');
    const posted = postToGithub(prNumber, reviewContent);
    if (posted) writeStderr('  ✓ posted to PR');
  }

  if (args.json) {
    writeStdout(JSON.stringify({
      pr: prNumber,
      model: REVIEW_MODEL,
      confidence: confidence?.score ?? null,
      reviewFile: filePath,
      posted: !args.noPost,
      contentLength: reviewContent.length,
    }, null, 2));
  } else {
    writeStdout(filePath);
  }
}

main().catch((err) => {
  writeStderr(err.message || String(err));
  process.exit(1);
});
