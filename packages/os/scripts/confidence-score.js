#!/usr/bin/env bun

const { resolveGitRoot } = require('./lib/paths');
const {
  appendEvidenceEvent,
  getEvidenceEvents,
} = require('./lib/state/evidence-log');
const {
  readExploreState,
  updateHypothesesWithEvents,
  writeExploreState,
} = require('./lib/state/explore-state');
const {
  evaluateExplorePolicy,
  projectReadiness,
} = require('./lib/state/explore-policy');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run confidence-score -- [options]');
  writeStdout('');
  writeStdout('report investigation readiness, evidence coverage, and validation state.');
  writeStdout('readiness is not a posterior probability.');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --json    output structured json');
  writeStdout('  --help    show this help');
}

function parseArgs(argv) {
  const args = { json: false };
  for (const argument of argv) {
    if (argument === '--json') args.json = true;
    else if (argument === '--help') args.help = true;
    else throw new Error(`unknown argument: ${argument}`);
  }
  return args;
}

function computeReadiness(_repoRoot, state, events) {
  return projectReadiness(evaluateExplorePolicy(state, events));
}

function printHuman(result) {
  writeStdout(`readiness: ${result.readiness}`);
  writeStdout('');
  writeStdout('  starting state:');
  for (const item of result.starting_state.length > 0 ? result.starting_state : ['none recorded']) {
    writeStdout(`    - ${item}`);
  }
  writeStdout('');
  writeStdout('  evidence for:');
  for (const item of result.evidence_for.length > 0 ? result.evidence_for : ['none recorded']) {
    writeStdout(`    - ${item}`);
  }
  writeStdout('');
  writeStdout('  evidence against:');
  for (const item of result.evidence_against.length > 0 ? result.evidence_against : ['none recorded']) {
    writeStdout(`    - ${item}`);
  }
  writeStdout('');
  writeStdout('  uncertainties:');
  for (const item of result.uncertainties.length > 0 ? result.uncertainties : ['none recorded']) {
    writeStdout(`    - ${item}`);
  }
  writeStdout('');
  writeStdout(`  recommendation: ${result.recommendation}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const repoRoot = resolveGitRoot(process.cwd());
  const state = readExploreState(repoRoot);
  if (!state) throw new Error('no explore state found; run explore first');

  const events = getEvidenceEvents(repoRoot);
  const updatedState = updateHypothesesWithEvents(state, events);
  writeExploreState(repoRoot, updatedState);
  const result = computeReadiness(repoRoot, updatedState, events);
  appendEvidenceEvent(repoRoot, {
    type: 'hypothesis.updated',
    source: 'confidence-score',
    question: state.query || null,
    action: 'assess readiness',
    status: result.readiness,
    confidence_delta: 0,
    details: result,
  }, { requireMirror: false });

  if (args.json) writeStdout(JSON.stringify(result, null, 2));
  else printHuman(result);
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
  computeReadiness,
};
