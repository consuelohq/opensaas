#!/usr/bin/env bun

const fs = require('fs');
const path = require('path');

const { resolveGitRoot } = require('./lib/paths');
const {
  appendEvidenceEvent,
  getEvidenceEvents,
  getReadFilesFromEvidence,
} = require('./lib/state/evidence-log');
const { readExploreState } = require('./lib/state/explore-state');

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

function topResultsShareGraphEdges(results) {
  const top = results.slice(0, 3);
  if (top.length < 3) return true;

  const allConnections = top.map((result) => new Set(result.graph_connections || []));
  for (let left = 0; left < allConnections.length; left += 1) {
    for (let right = left + 1; right < allConnections.length; right += 1) {
      if (Array.from(allConnections[left]).some((filePath) => allConnections[right].has(filePath))) {
        return true;
      }
    }
  }

  return false;
}

function getErrorRelatedResult(results) {
  return results.some((result) => /error|exception|fail|test|spec|log/i.test(`${result.path} ${result.reason} ${result.preview}`));
}

function hasEvent(events, types) {
  return events.some((event) => types.includes(event.type));
}

function computeConfidence(repoRoot, state) {
  const events = getEvidenceEvents(repoRoot);
  const results = state.results || [];
  const topResults = results.slice(0, 5);
  const readFiles = getReadFilesFromEvidence(repoRoot);
  const filesRead = topResults.filter((result) => readFiles.has(result.path)).length;
  const graphConnections = Array.from(new Set(topResults.flatMap((result) => result.graph_connections || [])));
  const graphVisited = graphConnections.filter((filePath) => readFiles.has(filePath)).length;
  const testFiles = graphConnections.filter(isTestPath);
  const readTests = testFiles.filter((filePath) => readFiles.has(filePath));
  const hasTestCoverage = testFiles.length > 0;
  const verifyPassed = hasEvent(events, ['verify.pass']);
  const testPassed = hasEvent(events, ['test.pass']);
  const runtimeClean = hasEvent(events, ['runtime.clean']);
  const failingSignals = events.filter((event) => ['verify.fail', 'test.fail', 'runtime.error', 'contradiction.detected'].includes(event.type));
  const unrelatedTopResults = !topResultsShareGraphEdges(results);
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

  if (unrelatedTopResults) evidenceAgainst.push('top-3 explore results share no graph edges');
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
  const contradictionPenalty = Math.min(0.30, evidenceAgainst.length * 0.15);
  const score = Math.max(0, Math.min(1, 0.30 + readCoverage * 0.30 + graphCoverage * 0.10 + validationBonus - contradictionPenalty));

  const recommendation = score >= 0.75
    ? 'safe to exploit or confirm if edits already happened'
    : score >= 0.55
      ? 'read one more connected file before exploiting'
      : 'continue gathering evidence';

  return {
    score: Number(score.toFixed(2)),
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

  const result = computeConfidence(repoRoot, state);
  appendEvidenceEvent(repoRoot, {
    type: 'hypothesis.updated',
    source: 'confidence-score',
    question: state.query || null,
    action: 'score confidence',
    status: result.score >= 0.55 ? 'strengthened' : 'uncertain',
    confidence_delta: 0,
    details: result,
  }, { requireMirror: true });

  if (args.json) {
    writeStdout(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }
}

try {
  main();
} catch {
  writeStderr('unknown error');
  process.exit(1);
}
