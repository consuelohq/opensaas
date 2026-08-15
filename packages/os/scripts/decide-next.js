#!/usr/bin/env bun

const fs = require('fs');
const path = require('path');

const { resolveGitRoot } = require('./lib/paths');
const { computeReadiness } = require('./confidence-score');
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
  chooseHypothesisTarget,
  getNextUnreadPath,
  rankHypotheses,
} = require('./lib/state/explore-hypothesis-model');

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
  const top = rankHypotheses(state?.hypotheses || [])[0] || null;
  if (!top) return null;
  return {
    id: top.id,
    root_path: top.root_path,
    support_state: top.support_state,
    retrieval_support: top.retrieval_support,
    calibration_status: top.calibration_status,
  };
}

function buildRecommendation(state, readiness, args) {
  const hypothesis = summarizeHypothesis(state);
  const nextUnreadPath = getNextUnreadPath(state);
  const exploitTarget = chooseHypothesisTarget(state?.hypotheses || []);

  if (readiness.readiness === 'blocked') {
    return {
      action: 'inspect contradictory or failed validation evidence',
      reason: readiness.recommendation,
      readiness: readiness.readiness,
      hypothesis_support: hypothesis,
      alternative: nextUnreadPath ? `read ${nextUnreadPath}` : 'rerun explore after resolving the failure',
      context: args.context || null,
      recommendation: 'investigate-failure',
    };
  }

  if (readiness.readiness === 'ready-to-edit' && exploitTarget) {
    return {
      action: `run exploit --target ${exploitTarget}`,
      reason: 'the strongest dependency hypothesis has sufficient read coverage to choose an edit target',
      readiness: readiness.readiness,
      hypothesis_support: hypothesis,
      alternative: 'run confirm --verify after editing',
      context: args.context || null,
      exploit_target: exploitTarget,
      recommendation: 'exploit',
    };
  }

  if (nextUnreadPath) {
    return {
      action: `read ${nextUnreadPath}`,
      reason: nextUnreadPath === hypothesis?.root_path
        ? 'observe the strongest hypothesis root before committing to it'
        : 'cover a connected dependency in the strongest hypothesis before editing',
      readiness: readiness.readiness,
      hypothesis_support: hypothesis,
      alternative: 'rerun explore if the dependency graph is incomplete',
      context: args.context || null,
      recommendation: 'read',
    };
  }

  return {
    action: `explore deeper into ${hypothesis?.root_path || state?.query || 'the current task'}`,
    reason: 'the current hypothesis graph does not contain another unread evidence target',
    readiness: readiness.readiness,
    hypothesis_support: hypothesis,
    alternative: 'rerun explore with a larger budget or a tighter scope',
    context: args.context || null,
    recommendation: 'explore',
  };
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
  const readiness = computeReadiness(repoRoot, state, events);
  const recommendation = buildRecommendation(state, readiness, args);

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
