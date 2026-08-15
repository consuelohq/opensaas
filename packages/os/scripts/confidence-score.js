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
const { deriveReadiness, rankHypotheses } = require('./lib/state/explore-hypothesis-model');

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

function computeReadiness(repoRoot, state, events) {
  const readiness = deriveReadiness(state, events);
  const hypotheses = rankHypotheses(state?.hypotheses || []);
  const top = hypotheses[0] || null;
  const evidenceFor = [];
  const evidenceAgainst = [];
  const uncertainties = [...(readiness.reasons || [])];
  const startingState = [];

  if (top) {
    startingState.push(`${hypotheses.length} dependency hypothesis${hypotheses.length === 1 ? '' : 'es'} available`);
    startingState.push(`top hypothesis ${top.root_path}`);
    startingState.push(`retrieval support ${Number(top.retrieval_support || 0).toFixed(3)} (${top.calibration_status || 'provisional'})`);
    if ((top.explicit_relevant_paths || []).length > 0) {
      evidenceFor.push(`explicit relevance: ${(top.explicit_relevant_paths || []).join(', ')}`);
    }
    if ((top.explicit_irrelevant_paths || []).length > 0) {
      evidenceAgainst.push(`explicit irrelevance: ${(top.explicit_irrelevant_paths || []).join(', ')}`);
    }
  }

  if (readiness.coverage?.root_read) evidenceFor.push('top hypothesis root read');
  if ((readiness.coverage?.dependency_read_count || 0) > 0) {
    evidenceFor.push(`read ${readiness.coverage.dependency_read_count}/${readiness.coverage.dependency_count} connected dependencies`);
  }
  if (readiness.validation.test === 'pass') evidenceFor.push('targeted test passed');
  if (readiness.validation.verify === 'pass') evidenceFor.push('verify passed');
  if (readiness.validation.runtime === 'pass') evidenceFor.push('runtime evidence clean');
  if (readiness.validation.test === 'fail') evidenceAgainst.push('targeted test failed');
  if (readiness.validation.verify === 'fail') evidenceAgainst.push('verify failed');
  if (readiness.validation.runtime === 'fail') evidenceAgainst.push('runtime evidence failed');
  if (readiness.contradiction) evidenceAgainst.push('contradiction recorded');

  const recommendation = readiness.state === 'ready-to-edit'
    ? 'evidence coverage is sufficient to choose an edit target; validation is still required after editing'
    : readiness.state === 'blocked'
      ? 'resolve the contradiction or failed validation before editing further'
      : readiness.state === 'insufficient-evidence'
        ? 'run explore before choosing an edit path'
        : 'gather the missing evidence listed under uncertainties';

  return {
    readiness: readiness.state,
    top_hypothesis: readiness.top_hypothesis,
    starting_state: startingState,
    evidence_for: evidenceFor,
    evidence_against: evidenceAgainst,
    uncertainties,
    coverage: readiness.coverage,
    validation: readiness.validation,
    calibration_status: top?.calibration_status || null,
    evidence_counts: {
      events: events.length,
      hypotheses: hypotheses.length,
      read_top_root: readiness.coverage?.root_read ? 1 : 0,
      dependency_files: readiness.coverage?.dependency_count || 0,
      read_dependency_files: readiness.coverage?.dependency_read_count || 0,
      explicit_relevant_files: top?.explicit_relevant_paths?.length || 0,
      explicit_irrelevant_files: top?.explicit_irrelevant_paths?.length || 0,
    },
    recommendation,
  };
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
