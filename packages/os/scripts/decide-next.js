#!/usr/bin/env bun

const fs = require('fs');
const path = require('path');

const { resolveGitRoot } = require('./lib/paths');
const {
  CONFIDENCE_EXPLOIT_THRESHOLD,
  calculateConfidence,
} = require('./confidence-score');
const {
  appendEvidenceEvent,
  getEvidenceEvents,
  getReadFilesFromEvidence,
  markFileRead,
} = require('./lib/state/evidence-log');
const {
  readExploreState,
  updateBeliefsWithEvents,
  writeExploreState,
} = require('./lib/state/explore-state');

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
  writeStdout('  --mark-relevant <path>     manually boost a file belief');
  writeStdout('  --mark-irrelevant <path>   manually reduce a file belief');
  writeStdout('  --json               output structured json');
  writeStdout('  --help               show this help');
}

function parseArgs(argv) {
  const args = {
    json: false,
    markIrrelevant: [],
    markRead: [],
    markRelevant: [],
  };

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
      case '--mark-relevant': {
        const value = argv[index + 1];
        if (!value || value.startsWith('-')) {
          printHelp();
          process.exit(1);
        }
        args.markRelevant.push(value);
        index += 1;
        break;
      }
      case '--mark-irrelevant': {
        const value = argv[index + 1];
        if (!value || value.startsWith('-')) {
          printHelp();
          process.exit(1);
        }
        args.markIrrelevant.push(value);
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

function getEvidenceSummary(repoRoot, state, events) {
  const latestValidationEvents = getLatestValidationEvents(events);
  const readFiles = getReadFilesFromEvidence(repoRoot);
  const topResults = (state?.results || []).slice(0, 5);
  const graphConnections = unique(topResults.flatMap((result) => result.graph_connections || []));
  const readTopCount = topResults.filter((result) => readFiles.has(result.path)).length;
  const readGraphCount = graphConnections.filter((filePath) => readFiles.has(filePath)).length;
  const verifyEvent = latestValidationEvents.get('verify');
  const testEvent = latestValidationEvents.get('test');
  const runtimeEvent = latestValidationEvents.get('runtime');
  const confirmationVerdict = state?.confirmation?.verdict || null;
  const contradictionFound = events.some((event) => event.type === 'contradiction.detected');
  const verificationPassed = verifyEvent?.type === 'verify.pass';
  const verificationFailed = verifyEvent?.type === 'verify.fail' || testEvent?.type === 'test.fail' || runtimeEvent?.type === 'runtime.error' || contradictionFound;
  const runtimeChecked = runtimeEvent?.type === 'runtime.clean' || runtimeEvent?.type === 'runtime.error';
  const confirmationPassed = confirmationVerdict === 'CONFIRMED';
  const confirmationFailed = confirmationVerdict === 'NOT_CONFIRMED';

  const readCoverage = topResults.length === 0 ? 0 : readTopCount / topResults.length;
  const graphCoverage = graphConnections.length === 0 ? 0 : readGraphCount / graphConnections.length;
  const confidence = calculateConfidence({
    confirmationFailed,
    graphCoverage,
    readCoverage,
    runtimeChecked,
    verificationPassed,
  });

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

function getPosterior(candidate, beliefs) {
  return Math.max(0, Math.min(1, beliefs[candidate.path]?.posterior ?? candidate.belief_prior ?? candidate.score ?? 0.45));
}

function informationValue(candidate, beliefs) {
  const posterior = getPosterior(candidate, beliefs);
  const uncertainty = 1 - Math.abs((2 * posterior) - 1);
  const propagationReach = candidate.graphConnectionCount || candidate.graph_connection_count || candidate.graph_connections?.length || 0;
  const reachNorm = Math.min(1, propagationReach / 10);
  const testBonus = isTestPath(candidate.path) ? 1.5 : 1;

  return uncertainty * (1 + reachNorm) * testBonus;
}

function buildCandidateActions(state, readFiles) {
  const beliefs = state.beliefs || {};
  const resultCandidates = (state.results || []).map((result) => ({
    ...result,
    graphConnectionCount: result.graph_connection_count || result.graph_connections?.length || 0,
    source: 'explore-result',
  }));
  const connectedTests = [];

  for (const result of state.results || []) {
    for (const connection of result.graph_connections || []) {
      if (!isTestPath(connection) || readFiles.has(connection)) continue;
      connectedTests.push({
        graphConnectionCount: 1,
        graph_connections: [result.path],
        lines: { start: 1, end: 50 },
        path: connection,
        reason: `connected test for ${result.path}`,
        score: 0.45,
        source: 'connected-test',
      });
    }
  }

  return unique([...resultCandidates, ...connectedTests].map((candidate) => candidate.path))
    .map((filePath) => [...resultCandidates, ...connectedTests].find((candidate) => candidate.path === filePath))
    .filter((candidate) => candidate && !readFiles.has(candidate.path))
    .map((candidate) => {
      const posterior = getPosterior(candidate, beliefs);
      const info = informationValue(candidate, beliefs);
      return {
        ...candidate,
        decisionScore: (posterior * 0.6) + (info * 0.4),
        informationValue: info,
        posterior,
      };
    })
    .sort((left, right) => right.decisionScore - left.decisionScore);
}

function getAlternative(candidates, primaryPath = null) {
  const alternative = candidates.find((candidate) => candidate.path !== primaryPath);
  if (!alternative) return 'run confidence-score';

  return `read ${alternative.path} (posterior: ${alternative.posterior.toFixed(2)}, information value: ${alternative.informationValue.toFixed(2)})`;
}

function getExploitRecommendation(state) {
  const rankedBeliefs = Object.entries(state.beliefs || {})
    .map(([filePath, belief]) => ({ filePath, posterior: belief.posterior || 0 }))
    .sort((left, right) => right.posterior - left.posterior);
  const top = rankedBeliefs[0] || null;
  const second = rankedBeliefs[1] || null;
  if (!top) return null;

  const gap = top.posterior - (second?.posterior || 0);
  if (top.posterior >= 0.85 || (top.posterior >= 0.75 && gap >= 0.15)) {
    return {
      gap,
      target: top.filePath,
      topPosterior: top.posterior,
    };
  }

  return null;
}

function buildRecommendation(state, evidence, args) {
  const candidates = buildCandidateActions(state, evidence.readFiles);
  const bestCandidate = candidates[0] || null;
  const exploitRecommendation = getExploitRecommendation(state);

  if (evidence.verificationFailed) {
    return {
      action: 'inspect failed validation evidence',
      reason: 'a verification, test, runtime, or contradiction event is already recorded',
      confidence: evidence.confidence,
      alternative: bestCandidate ? `read ${bestCandidate.path}` : 'rerun confirm --verify',
      context: args.context || null,
      recommendation: 'investigate-failure',
    };
  }

  if (exploitRecommendation) {
    return {
      action: `run exploit --target ${exploitRecommendation.target}`,
      reason: `confidence ${exploitRecommendation.topPosterior.toFixed(2)} - belief concentrated on ${exploitRecommendation.target}. recommend: run exploit to begin editing.`,
      confidence: evidence.confidence,
      alternative: bestCandidate ? getAlternative(candidates, exploitRecommendation.target) : 'run confirm --verify if edits were already made',
      context: args.context || null,
      exploit_target: exploitRecommendation.target,
      next_best_action: bestCandidate ? {
        path: bestCandidate.path,
        information_value: Number(bestCandidate.informationValue.toFixed(2)),
        posterior: Number(bestCandidate.posterior.toFixed(2)),
      } : null,
      recommendation: 'exploit',
    };
  }

  if (bestCandidate) {
    const testPrefix = isTestPath(bestCandidate.path)
      ? 'test file - would confirm or deny the current hypothesis'
      : 'balances posterior relevance with information gain';
    return {
      action: `read ${bestCandidate.path} (lines ${bestCandidate.lines?.start || 1}-${bestCandidate.lines?.end || 1})`,
      reason: `${testPrefix} (posterior: ${bestCandidate.posterior.toFixed(2)}, information value: ${bestCandidate.informationValue.toFixed(2)})`,
      confidence: evidence.confidence,
      alternative: getAlternative(candidates, bestCandidate.path),
      context: args.context || null,
      decision_score: Number(bestCandidate.decisionScore.toFixed(2)),
      information_value: Number(bestCandidate.informationValue.toFixed(2)),
      posterior: Number(bestCandidate.posterior.toFixed(2)),
      recommendation: 'read',
    };
  }

  if ((state?.mode || 'exploring') === 'exploiting' && !evidence.confirmationPassed) {
    return {
      action: 'run confirm --verify',
      reason: 'the state is exploiting but validation truth has not been recorded yet',
      confidence: evidence.confidence,
      alternative: 'run targeted tests if a narrower test file is known',
      context: args.context || null,
      recommendation: 'confirm',
    };
  }

  if (evidence.confidence >= CONFIDENCE_EXPLOIT_THRESHOLD) {
    return {
      action: 'run exploit',
      reason: 'recommended files are read and evidence is strong enough to commit to an edit path',
      confidence: evidence.confidence,
      alternative: 'run confirm --verify if edits were already made',
      context: args.context || null,
      recommendation: 'exploit',
    };
  }

  return {
    action: `explore deeper into ${state.results?.[0]?.path || state?.query || 'the current task'}`,
    reason: 'evidence is still thin; embeddings are only the prior, not proof',
    confidence: evidence.confidence,
    alternative: 'rerun explore with a larger --budget or inspect connected callers/tests',
    context: args.context || null,
    recommendation: 'explore',
  };
}

function printHuman(recommendation) {
  writeStdout('decide-next:');
  writeStdout(`  action: ${recommendation.action}`);
  writeStdout(`  reason: ${recommendation.reason}`);
  writeStdout(`  confidence: ${recommendation.confidence}`);
  writeStdout(`  alternative: ${recommendation.alternative}`);
  writeStdout(`  recommendation: ${recommendation.recommendation}`);
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

  for (const filePath of args.markRelevant) {
    appendEvidenceEvent(repoRoot, {
      type: 'file.relevant',
      source: 'decide-next --mark-relevant',
      action: 'mark relevant',
      file_path: filePath,
      status: 'relevant',
      confidence_delta: 0.05,
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
      confidence_delta: -0.05,
      details: { manual: true },
    }, { requireMirror: true });
  }

  const rawState = readExploreState(repoRoot);
  if (!rawState && (args.markRead.length > 0 || args.markRelevant.length > 0 || args.markIrrelevant.length > 0)) {
    const result = {
      action: 'marked read',
      marked_irrelevant: args.markIrrelevant,
      marked_files: args.markRead,
      marked_relevant: args.markRelevant,
      confidence: 0.1,
    };
    writeStdout(args.json ? JSON.stringify(result, null, 2) : 'decide-next: marked evidence');
    return;
  }

  if (!rawState) {
    throw new Error('no explore state found; run explore first');
  }

  if (args.context) {
    const resolvedContext = path.isAbsolute(args.context)
      ? args.context
      : path.join(repoRoot, args.context);
    if (!fs.existsSync(resolvedContext)) {
      throw new Error(`context file not found: ${args.context}`);
    }
    args.context = resolvedContext;
  }

  const events = getEvidenceEvents(repoRoot);
  const state = updateBeliefsWithEvents(rawState, events);
  writeExploreState(repoRoot, state);
  const evidence = getEvidenceSummary(repoRoot, state, events);
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
} catch (error /* unknown */) {
  writeStderr(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
}
