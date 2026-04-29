#!/usr/bin/env bun

const fs = require('fs');

const { resolveGitRoot } = require('./lib/paths');
const {
  appendEvidenceEvent,
  getEvidenceEvents,
  getReadFilesFromEvidence,
  markFileRead,
} = require('./lib/state/evidence-log');
const { readExploreState } = require('./lib/state/explore-state');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run decide-next -- [options]');
  writeStdout('');
  writeStdout('recommend the single best next action from current evidence.');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --context <file>     additional context file to mention in the recommendation');
  writeStdout('  --mark-read <path>   manually record a file.read evidence event');
  writeStdout('  --json               output structured json');
  writeStdout('  --help               show this help');
}

function parseArgs(argv) {
  const args = { json: false, markRead: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case '--context': {
        const value = argv[index + 1];
        if (!value || value.startsWith('-')) {
          printHelp();
          process.exit(1);
        }
        args.context = value;
        index += 1;
        break;
      }
      case '--mark-read': {
        const value = argv[index + 1];
        if (!value || value.startsWith('-')) {
          printHelp();
          process.exit(1);
        }
        args.markRead.push(value);
        index += 1;
        break;
      }
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

  return args;
}

function isTestPath(filePath) {
  return /\.(spec|test)\.(ts|tsx|js|jsx)$/.test(filePath) || filePath.includes('/__tests__/');
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function hasEvent(events, types) {
  return events.some((event) => types.includes(event.type));
}

function getEvidenceSummary(repoRoot, state) {
  const events = getEvidenceEvents(repoRoot);
  const readFiles = getReadFilesFromEvidence(repoRoot);
  const topResults = (state?.results || []).slice(0, 5);
  const graphConnections = unique(topResults.flatMap((result) => result.graph_connections || []));
  const readTopCount = topResults.filter((result) => readFiles.has(result.path)).length;
  const readGraphCount = graphConnections.filter((filePath) => readFiles.has(filePath)).length;
  const verificationPassed = hasEvent(events, ['verify.pass']);
  const verificationFailed = hasEvent(events, ['verify.fail', 'test.fail', 'runtime.error', 'contradiction.detected']);
  const runtimeChecked = hasEvent(events, ['runtime.clean', 'runtime.error']);
  const confirmationPassed = hasEvent(events, ['verify.pass', 'test.pass', 'runtime.clean']);
  const confirmationFailed = hasEvent(events, ['verify.fail', 'test.fail', 'runtime.error']);

  const readCoverage = topResults.length === 0 ? 0 : readTopCount / topResults.length;
  const graphCoverage = graphConnections.length === 0 ? 0 : readGraphCount / graphConnections.length;
  const positiveConfirmation = (verificationPassed ? 0.15 : 0) + (runtimeChecked && !confirmationFailed ? 0.05 : 0);
  const penalty = confirmationFailed ? 0.2 : 0;
  const confidence = Math.max(0, Math.min(1, 0.3 + readCoverage * 0.3 + graphCoverage * 0.1 + positiveConfirmation - penalty));

  return {
    events,
    readFiles,
    topResults,
    graphConnections,
    readTopCount,
    readGraphCount,
    verificationPassed,
    verificationFailed,
    runtimeChecked,
    confirmationPassed,
    confirmationFailed,
    confidence: Number(confidence.toFixed(2)),
  };
}

function getAlternative(results, readFiles, primaryPath = null) {
  const testConnection = results
    .flatMap((result) => result.graph_connections || [])
    .find((filePath) => filePath !== primaryPath && isTestPath(filePath) && !readFiles.has(filePath));

  if (testConnection) return `read ${testConnection}`;

  const secondUnread = results.find((result) => result.path !== primaryPath && !readFiles.has(result.path));
  return secondUnread ? `read ${secondUnread.path}` : 'run confidence-score';
}

function buildRecommendation(state, evidence, args) {
  const results = state?.results || [];
  const unreadTopFile = results.find((result) => !evidence.readFiles.has(result.path));
  const unreadTest = results
    .flatMap((result) => result.graph_connections || [])
    .find((filePath) => isTestPath(filePath) && !evidence.readFiles.has(filePath));

  if (evidence.verificationFailed) {
    return {
      action: 'inspect failed validation evidence',
      reason: 'a verification, test, runtime, or contradiction event is already recorded',
      confidence: evidence.confidence,
      alternative: unreadTopFile ? `read ${unreadTopFile.path}` : 'rerun confirm --verify',
      context: args.context || null,
    };
  }

  if (unreadTopFile) {
    return {
      action: `read ${unreadTopFile.path} (lines ${unreadTopFile.lines?.start || 1}-${unreadTopFile.lines?.end || 1})`,
      reason: `highest unread relevance (${unreadTopFile.score}) - ${unreadTopFile.reason}`,
      confidence: evidence.confidence,
      alternative: getAlternative(results, evidence.readFiles, unreadTopFile.path),
      context: args.context || null,
    };
  }

  if (unreadTest) {
    return {
      action: `read ${unreadTest}`,
      reason: 'top files were read and this connected test can confirm expected behavior',
      confidence: evidence.confidence,
      alternative: 'run confidence-score',
      context: args.context || null,
    };
  }

  if ((state?.mode || 'exploring') === 'exploiting' && !evidence.confirmationPassed) {
    return {
      action: 'run confirm --verify',
      reason: 'the state is exploiting but validation truth has not been recorded yet',
      confidence: evidence.confidence,
      alternative: 'run targeted tests if a narrower test file is known',
      context: args.context || null,
    };
  }

  if (evidence.confidence >= 0.65) {
    return {
      action: 'run exploit',
      reason: 'recommended files are read and evidence is strong enough to commit to an edit path',
      confidence: evidence.confidence,
      alternative: 'run confirm --verify if edits were already made',
      context: args.context || null,
    };
  }

  return {
    action: `explore deeper into ${results[0]?.path || state?.query || 'the current task'}`,
    reason: 'evidence is still thin; embeddings are only the prior, not proof',
    confidence: evidence.confidence,
    alternative: 'rerun explore with a larger --budget or inspect connected callers/tests',
    context: args.context || null,
  };
}

function printHuman(recommendation) {
  writeStdout('decide-next:');
  writeStdout(`  action: ${recommendation.action}`);
  writeStdout(`  reason: ${recommendation.reason}`);
  writeStdout(`  confidence: ${recommendation.confidence}`);
  writeStdout(`  alternative: ${recommendation.alternative}`);
  if (recommendation.context) {
    writeStdout(`  context: ${recommendation.context}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const repoRoot = resolveGitRoot(process.cwd());

  for (const filePath of args.markRead) {
    markFileRead(repoRoot, filePath, { source: 'decide-next --mark-read' });
  }

  const state = readExploreState(repoRoot);
  if (!state && args.markRead.length > 0) {
    const result = {
      action: 'marked read',
      marked_files: args.markRead,
      confidence: 0.1,
    };
    writeStdout(args.json ? JSON.stringify(result, null, 2) : `decide-next: marked ${args.markRead.length} file(s) read`);
    return;
  }

  if (!state) {
    throw new Error('no explore state found; run explore first');
  }

  if (args.context && !fs.existsSync(args.context)) {
    throw new Error(`context file not found: ${args.context}`);
  }

  const evidence = getEvidenceSummary(repoRoot, state);
  const recommendation = buildRecommendation(state, evidence, args);
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
      confidence: recommendation.confidence,
      evidence_counts: {
        events: evidence.events.length,
        read_top_files: evidence.readTopCount,
        top_files: evidence.topResults.length,
        read_graph_files: evidence.readGraphCount,
        graph_files: evidence.graphConnections.length,
      },
    },
  }, { requireMirror: true });

  if (args.json) {
    writeStdout(JSON.stringify({
      ...recommendation,
      evidence_counts: {
        events: evidence.events.length,
        read_top_files: evidence.readTopCount,
        top_files: evidence.topResults.length,
        read_graph_files: evidence.readGraphCount,
        graph_files: evidence.graphConnections.length,
      },
    }, null, 2));
  } else {
    printHuman(recommendation);
  }
}

try {
  main();
} catch {
  writeStderr('unknown error');
  process.exit(1);
}
