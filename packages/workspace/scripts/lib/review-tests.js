const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SELECTION_SCRIPT = 'packages/workspace/scripts/test-selection.js';
const OUTPUT_LIMIT = 64 * 1024 * 1024;

function formatSelectorFailure({ commandResult, readError }) {
  const bits = [];
  if (commandResult?.error) bits.push(commandResult.error.message || String(commandResult.error));
  if (commandResult?.signal) bits.push(`terminated by ${commandResult.signal}`);
  if (commandResult?.status !== 0) bits.push(`selector exit: ${commandResult?.status ?? 'unknown'}`);
  if (readError) bits.push(`selection report: ${readError}`);
  if (commandResult?.stderr) bits.push(String(commandResult.stderr).trim().slice(-2000));
  return bits.filter(Boolean).join('; ') || 'test selection failed without a usable report';
}

function failingSelectionResult(message) {
  return {
    pkg: 'test-selection',
    passed: false,
    elapsed: '0.0',
    suites: 'selection failure',
    tests: 'not executed',
    failures: [message],
  };
}

function runSelectedReviewTests({ repoRoot, base, all = false, spawn = spawnSync }) {
  const reportPath = path.join(
    os.tmpdir(),
    `opensaas-review-tests-${process.pid}-${crypto.randomUUID()}.json`,
  );
  const args = [SELECTION_SCRIPT, 'check', '--base', base, '--run', '--out', reportPath];
  if (all) args.push('--all');

  let commandResult;
  let report = null;
  let readError = null;
  try {
    commandResult = spawn('bun', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: OUTPUT_LIMIT,
    });
    try {
      report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch (error) {
      readError = error.message;
    }
  } catch (error) {
    commandResult = { status: null, error, signal: null };
  } finally {
    fs.rmSync(reportPath, { force: true });
  }

  const validReport = report && typeof report === 'object'
    && typeof report.passed === 'boolean'
    && Array.isArray(report.selectedSuites)
    && Array.isArray(report.runResults)
    && Array.isArray(report.matchedRules);

  if (!validReport) {
    const failure = formatSelectorFailure({ commandResult, readError: readError || 'invalid result shape' });
    return {
      passed: false,
      level: 'fail',
      zeroSuiteReason: failure,
      selectedSuiteCount: 0,
      matchedRuleIds: [],
      testResults: [failingSelectionResult(failure)],
    };
  }

  const testResults = report.runResults.map((result) => ({
    pkg: String(result.name || result.ruleId || 'unnamed suite'),
    passed: result.status === 'passed',
    elapsed: (Math.max(0, result.durationMs || 0) / 1000).toFixed(1),
    suites: result.ruleId || 'selected',
    tests: result.status || 'unknown',
    failures: result.status === 'passed'
      ? []
      : [String(result.outputTail || result.error?.message || 'test suite failed').slice(-4000)],
  }));
  const selectedSuiteCount = report.selectedSuites.length;
  const incompleteExecution = report.runResults.length !== selectedSuiteCount;
  const passed = commandResult?.status === 0
    && !commandResult?.error && !commandResult?.signal
    && report.passed === true && report.level !== 'fail'
    && !incompleteExecution
    && testResults.every((result) => result.passed);
  if (incompleteExecution || (!passed && testResults.every((result) => result.passed))) {
    testResults.push(failingSelectionResult(
      incompleteExecution
        ? `incomplete test execution: selected ${selectedSuiteCount} suites, reported ${report.runResults.length} results`
        : report.zeroSuiteReason || formatSelectorFailure({ commandResult }),
    ));
  }

  return {
    passed,
    level: report.level || 'unknown',
    zeroSuiteReason: report.zeroSuiteReason || null,
    selectedSuiteCount,
    matchedRuleIds: report.matchedRules.map((rule) => rule.id),
    testResults,
  };
}

module.exports = { runSelectedReviewTests };
