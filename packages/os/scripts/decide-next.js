#!/usr/bin/env bun

const fs = require('fs');
const path = require('path');

const { resolveGitRoot } = require('./lib/paths');
const {
  appendEvidenceEvent,
  getEvidenceEvents,
  markFileRead,
} = require('./lib/state/evidence-log');
const {
  readExploreState,
  updateHypothesesWithEvents,
  writeExploreState,
} = require('./lib/state/explore-state');
const {
  evaluateExplorePolicy,
  projectDecisionRecommendation,
} = require('./lib/state/explore-policy');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run decide-next -- [options]');
  writeStdout('');
  writeStdout('recommend the next evidence action from hypothesis support and readiness.');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --context <file>            additional context file to mention');
  writeStdout('  --mark-read <path>          record an observation/coverage read');
  writeStdout('  --mark-relevant <path>      record explicit relevance evidence');
  writeStdout('  --mark-irrelevant <path>    record explicit irrelevance evidence');
  writeStdout('  --json                      output structured json');
  writeStdout('  --help                      show this help');
}

function parseArgs(argv) {
  const args = { json: false, markIrrelevant: [], markRead: [], markRelevant: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case '--context':
        args.context = argv[++index];
        break;
      case '--mark-read':
        args.markRead.push(argv[++index]);
        break;
      case '--mark-relevant':
        args.markRelevant.push(argv[++index]);
        break;
      case '--mark-irrelevant':
        args.markIrrelevant.push(argv[++index]);
        break;
      case '--json':
        args.json = true;
        break;
      case '--help':
        args.help = true;
        break;
      default:
        throw new Error(`unknown argument: ${argument}`);
    }
  }
  for (const [name, values] of Object.entries({
    '--mark-read': args.markRead,
    '--mark-relevant': args.markRelevant,
    '--mark-irrelevant': args.markIrrelevant,
  })) {
    if (values.some((value) => !value || value.startsWith('-'))) throw new Error(`${name} requires a path`);
  }
  if (args.context && args.context.startsWith('-')) throw new Error('--context requires a file');
  return args;
}

function summarizeHypothesis(state) {
  return evaluateExplorePolicy(state, []).top_hypothesis;
}

function buildRecommendation(policyResult, args = {}) {
  return projectDecisionRecommendation(policyResult, args);
}

function printHuman(recommendation) {
  writeStdout('decide-next:');
  writeStdout(`  action: ${recommendation.action}`);
  writeStdout(`  reason: ${recommendation.reason}`);
  writeStdout(`  readiness: ${recommendation.readiness}`);
  writeStdout(`  alternative: ${recommendation.alternative}`);
  writeStdout(`  recommendation: ${recommendation.recommendation}`);
  if (recommendation.hypothesis_support) {
    writeStdout(`  hypothesis: ${recommendation.hypothesis_support.root_path} (${recommendation.hypothesis_support.support_state}, retrieval support ${Number(recommendation.hypothesis_support.retrieval_support || 0).toFixed(3)})`);
  }
  if (recommendation.context) writeStdout(`  context: ${recommendation.context}`);
}

function appendManualEvidence(repoRoot, args) {
  for (const filePath of args.markRead) {
    markFileRead(repoRoot, filePath, { source: 'decide-next --mark-read' });
  }
  for (const filePath of args.markRelevant) {
    appendEvidenceEvent(repoRoot, {
      type: 'file.relevant',
      source: 'decide-next --mark-relevant',
      action: 'mark relevant',
      file_path: filePath,
      status: 'relevant',
      confidence_delta: 0,
      details: { manual: true },
    }, { requireMirror: true });
  }
  for (const filePath of args.markIrrelevant) {
    appendEvidenceEvent(repoRoot, {
      type: 'file.irrelevant',
      source: 'decide-next --mark-irrelevant',
      action: 'mark irrelevant',
      file_path: filePath,
      status: 'irrelevant',
      confidence_delta: 0,
      details: { manual: true },
    }, { requireMirror: true });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const repoRoot = resolveGitRoot(process.cwd());
  appendManualEvidence(repoRoot, args);
  const rawState = readExploreState(repoRoot);
  if (!rawState) {
    if (args.markRead.length || args.markRelevant.length || args.markIrrelevant.length) {
      writeStdout(args.json
        ? JSON.stringify({ readiness: 'insufficient-evidence', recommendation: 'run explore' }, null, 2)
        : 'decide-next: evidence recorded; run explore');
      return;
    }
    throw new Error('no explore state found; run explore first');
  }

  if (args.context) {
    const resolvedContext = path.isAbsolute(args.context) ? args.context : path.join(repoRoot, args.context);
    if (!fs.existsSync(resolvedContext)) throw new Error(`context file not found: ${args.context}`);
    args.context = resolvedContext;
  }

  const events = getEvidenceEvents(repoRoot);
  const state = updateHypothesesWithEvents(rawState, events);
  writeExploreState(repoRoot, state);
  const policyResult = evaluateExplorePolicy(state, events);
  const recommendation = buildRecommendation(policyResult, args);

  appendEvidenceEvent(repoRoot, {
    type: 'decision.taken',
    source: 'decide-next',
    question: state.query || null,
    action: recommendation.action,
    status: 'recommended',
    confidence_delta: 0,
    details: {
      reason: recommendation.reason,
      alternative: recommendation.alternative,
      readiness: recommendation.readiness,
      hypothesis_support: recommendation.hypothesis_support,
    },
  }, { requireMirror: true });

  if (args.json) writeStdout(JSON.stringify(recommendation, null, 2));
  else printHuman(recommendation);
}

if (require.main === module) {
  try {
    main();
  } catch (error /* unknown */) {
    writeStderr(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  buildRecommendation,
  summarizeHypothesis,
};
