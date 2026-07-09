#!/usr/bin/env bun

const fs = require('fs');
const path = require('path');

const { resolveGitRoot } = require('./lib/paths');
const {
  appendEvidenceEvent,
  getEvidenceEvents,
  getReadFilesFromEvidence,
} = require('./lib/state/evidence-log');
const {
  readExploreState,
  updateBeliefsWithEvents,
  writeExploreState,
} = require('./lib/state/explore-state');

const CONFIDENCE_EXPLOIT_THRESHOLD = 0.75;
const CONFIDENCE_GATHER_MORE_THRESHOLD = 0.55;

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run confidence-score -- [options]');
  writeStdout('');
  writeStdout('summarize belief strength, evidence, contradictions, and uncertainty.');
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

function isTestPath(filePath) {
  return /\.(spec|test)\.(ts|tsx|js|jsx)$/.test(filePath) || filePath.includes('/__tests__/');
}

function getEventTime(event) {
  const parsed = Date.parse(event.occurred_at || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function getLatestValidationEvents(events) {
  const latestByGroup = new Map();
  const validationGroups = new Set(['runtime', 'test', 'verify']);

  for (const event of events) {
    const group = String(event.type || '').split('.')[0];
    if (!validationGroups.has(group)) continue;

    const current = latestByGroup.get(group);
    if (!current || getEventTime(event) >= getEventTime(current)) {
      latestByGroup.set(group, event);
    }
  }

  return latestByGroup;
}

function getErrorRelatedResult(results) {
  return results.some((result) => /error|exception|fail|fatal|panic|stack|trace/i.test(`${result.path} ${result.reason} ${result.preview}`));
}

function calculateConfidence({
  beliefBonus = 0,
  confirmationFailed = false,
  contradictionPenalty = null,
  graphCoverage = 0,
  readCoverage = 0,
  runtimeChecked = false,
  runtimeClean = false,
  testPassed = false,
  validationBonus = null,
  verificationPassed = false,
}) {
  const effectiveValidationBonus = validationBonus ?? (
    (verificationPassed ? 0.15 : 0)
    + (testPassed ? 0.10 : 0)
    + ((runtimeClean || (runtimeChecked && !confirmationFailed)) ? 0.05 : 0)
  );
  const effectivePenalty = contradictionPenalty ?? (confirmationFailed ? 0.20 : 0);

  return Math.max(0, Math.min(
    1,
    0.30
      + readCoverage * 0.30
      + graphCoverage * 0.10
      + effectiveValidationBonus
      + beliefBonus
      - effectivePenalty,
  ));
}

function computeConfidence(repoRoot, state, events) {
  const latestValidationEvents = getLatestValidationEvents(events);
  const results = state.results || [];
  const topResults = results.slice(0, 5);
  const beliefs = state.beliefs || {};
  const beliefValues = topResults
    .map((result) => beliefs[result.path]?.posterior ?? result.score ?? 0)
    .sort((left, right) => right - left);
  const topPosterior = beliefValues[0] || 0;
  const beliefObservationCount = Object.values(beliefs)
    .reduce((sum, belief) => sum + (belief.observations?.length || 0), 0);
  const readFiles = getReadFilesFromEvidence(repoRoot);
  const filesRead = topResults.filter((result) => readFiles.has(result.path)).length;
  const graphConnections = Array.from(new Set(topResults.flatMap((result) => result.graph_connections || [])));
  const graphVisited = graphConnections.filter((filePath) => readFiles.has(filePath)).length;
  const testFiles = graphConnections.filter(isTestPath);
  const readTests = testFiles.filter((filePath) => readFiles.has(filePath));
  const hasTestCoverage = testFiles.length > 0;
  const verifyEvent = latestValidationEvents.get('verify');
  const testEvent = latestValidationEvents.get('test');
  const runtimeEvent = latestValidationEvents.get('runtime');
  const verifyPassed = verifyEvent?.type === 'verify.pass';
  const testPassed = testEvent?.type === 'test.pass';
  const runtimeClean = runtimeEvent?.type === 'runtime.clean';
  const failingSignals = [
    verifyEvent,
    testEvent,
    runtimeEvent,
    ...events.filter((event) => event.type === 'contradiction.detected'),
  ].filter((event) => event && ['verify.fail', 'test.fail', 'runtime.error', 'contradiction.detected'].includes(event.type));
  const deletedResult = results.some((result) => !fs.existsSync(path.join(repoRoot, result.path)));
  const questionMentionsError = /error|exception|failed|failing|stack|trace|crash/i.test(state.query || '');
  const missingErrorFiles = questionMentionsError && !getErrorRelatedResult(results);

  const evidenceFor = [];
  const evidenceAgainst = [];
  const startingState = [];
  const uncertainties = [];

  if (results.length > 0) {
    startingState.push(`Qwen prior found ${results.length} candidate files`);
  }

  if (filesRead > 0 && topResults.length > 0) {
    evidenceFor.push(`read ${filesRead}/${topResults.length} top files`);
  }

  if (graphConnections.length > 0) {
    startingState.push(`graph expansion found ${graphConnections.length} connected files`);
  }

  if (beliefValues.length > 0) {
    startingState.push(`top posterior belief ${topPosterior.toFixed(2)}`);
  }

  if (graphVisited > 0 && graphConnections.length > 0) {
    evidenceFor.push(`visited ${graphVisited}/${graphConnections.length} graph-connected files`);
  }

  if (hasTestCoverage) {
    startingState.push(`connected tests found (${testFiles.length})`);
  } else {
    uncertainties.push('no connected test file found yet');
  }

  if (readTests.length > 0) evidenceFor.push(`read ${readTests.length} connected test file(s)`);
  if (verifyPassed) evidenceFor.push('verify passed');
  if (testPassed) evidenceFor.push('targeted test passed');
  if (runtimeClean) evidenceFor.push('runtime logs were clean');

  for (const signal of failingSignals) {
    evidenceAgainst.push(`${signal.type}: ${signal.details?.summary || signal.status || 'failure recorded'}`);
  }

  if (deletedResult) evidenceAgainst.push('a result was deleted or moved since last index');
  if (missingErrorFiles) evidenceAgainst.push('question mentions error but no error-related files appeared');

  if (filesRead < Math.min(3, topResults.length)) {
    uncertainties.push('read more top-ranked files before exploiting');
  }

  if (graphConnections.length > 0 && graphVisited === 0) {
    uncertainties.push('graph-connected callers/tests/imports are not yet visited');
  }

  if (!verifyPassed && !testPassed && !runtimeClean) {
    uncertainties.push('no validation or runtime confirmation recorded');
  }

  const readCoverage = topResults.length === 0 ? 0 : filesRead / topResults.length;
  const graphCoverage = graphConnections.length === 0 ? 0 : graphVisited / graphConnections.length;
  const validationBonus = (verifyPassed ? 0.15 : 0) + (testPassed ? 0.10 : 0) + (runtimeClean ? 0.05 : 0);
  const beliefBonus = beliefObservationCount > 0 ? Math.max(0, topPosterior - 0.5) * 0.15 : 0;
  const contradictionPenalty = Math.min(0.30, evidenceAgainst.length * 0.15);
  const rawScore = calculateConfidence({
    beliefBonus,
    contradictionPenalty,
    graphCoverage,
    readCoverage,
    validationBonus,
  });

  const recommendation = rawScore >= CONFIDENCE_EXPLOIT_THRESHOLD
    ? 'safe to exploit or confirm if edits already happened'
    : rawScore >= CONFIDENCE_GATHER_MORE_THRESHOLD
      ? 'read one more connected file before exploiting'
      : 'continue gathering evidence';

  return {
    score: Number(rawScore.toFixed(2)),
    starting_state: startingState,
    evidence_for: evidenceFor,
    evidence_against: evidenceAgainst,
    uncertainties,
    evidence_counts: {
      events: events.length,
      top_files: topResults.length,
      read_top_files: filesRead,
      graph_files: graphConnections.length,
      read_graph_files: graphVisited,
      belief_observations: beliefObservationCount,
      top_posterior: Number(topPosterior.toFixed(4)),
    },
    recommendation,
  };
}

function printHuman(result) {
  writeStdout(`confidence-score: ${result.score}`);
  writeStdout('');
  writeStdout('  starting state:');
  if (result.starting_state.length === 0) {
    writeStdout('    - none recorded');
  } else {
    for (const item of result.starting_state) {
      writeStdout(`    - ${item}`);
    }
  }
  writeStdout('');
  writeStdout('  evidence for:');
  if (result.evidence_for.length === 0) {
    writeStdout('    - none recorded');
  } else {
    for (const item of result.evidence_for) {
      writeStdout(`    - ${item}`);
    }
  }
  writeStdout('');
  writeStdout('  evidence against:');
  if (result.evidence_against.length === 0) {
    writeStdout('    - none recorded');
  } else {
    for (const item of result.evidence_against) {
      writeStdout(`    - ${item}`);
    }
  }
  writeStdout('');
  writeStdout('  uncertainties:');
  for (const item of result.uncertainties) {
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
  const updatedState = updateBeliefsWithEvents(state, events);
  writeExploreState(repoRoot, updatedState);
  const result = computeConfidence(repoRoot, updatedState, events);
  appendEvidenceEvent(repoRoot, {
    type: 'hypothesis.updated',
    source: 'confidence-score',
    question: state.query || null,
    action: 'score confidence',
    status: result.score >= 0.55 ? 'strengthened' : 'uncertain',
    confidence_delta: 0,
    details: result,
  }, { requireMirror: false });

  if (args.json) {
    writeStdout(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }
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
  CONFIDENCE_EXPLOIT_THRESHOLD,
  CONFIDENCE_GATHER_MORE_THRESHOLD,
  calculateConfidence,
  computeConfidence,
};
