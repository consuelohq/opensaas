#!/usr/bin/env bun

const { ensureIndex } = require('./lib/index/indexer');
const { retrieve } = require('./lib/search/retriever');
const { formatExploreOutput } = require('./lib/search/explore-output');
const {
  appendEvidenceEvent,
  getEvidenceEvents,
  getReadFilesFromEvidence,
  readEvidenceLog,
} = require('./lib/state/evidence-log');
const {
  buildInvestigationHypotheses,
  readExploreState,
  updateHypothesesWithEvents,
  writeExploreState,
} = require('./lib/state/explore-state');
const calibration = require('./lib/state/explore-calibration.v1.json');
const readCostModel = require('./lib/state/explore-read-cost-model.v1.json');
const promotionCriteria = require('./lib/state/explore-promotion-criteria.v1.json');
const promotionEvidence = require('./lib/state/explore-promotion-evidence.v1.json');
const { getRankSupport } = require('./lib/state/explore-hypothesis-model');
const { evaluateExplorePolicy } = require('./lib/state/explore-policy');
const { evaluateExploreVoiChallenger } = require('./lib/state/explore-voi-policy');
const { evaluateExplorePromotionGate } = require('./lib/state/explore-promotion-gate');

function writeStdout(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeStderr(value = '') {
  process.stderr.write(`${value}\n`);
}

function printHelp() {
  writeStdout('usage: bun run explore -- "<question>" [options]');
  writeStdout('');
  writeStdout('retrieve and rank the best next files using structure, embeddings, and graph expansion.');
  writeStdout('');
  writeStdout('options:');
  writeStdout('  --budget <n>      max files to return (default: 10)');
  writeStdout('  --depth <n>       graph expansion depth (default: 2)');
  writeStdout('  --changed-only    restrict results to files changed in the current branch');
  writeStdout('  --detail <mode>   structured output detail: compact (default) or full');
  writeStdout('  --reindex         force a full re-index before searching');
  writeStdout('  --json            output structured json');
  writeStdout('  --help            show this help');
}

function parseArgs(argv) {
  const args = {
    budget: 10,
    changedOnly: false,
    depth: 2,
    detail: 'compact',
    json: false,
    questionParts: [],
    reindex: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case '--budget':
        args.budget = Number.parseInt(argv[++index], 10);
        break;
      case '--depth':
        args.depth = Number.parseInt(argv[++index], 10);
        break;
      case '--changed-only':
        args.changedOnly = true;
        break;
      case '--detail':
        args.detail = argv[++index];
        break;
      case '--reindex':
        args.reindex = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '--help':
        args.help = true;
        break;
      default:
        if (argument.startsWith('--')) {
          throw new Error(`unknown flag: ${argument}`);
        }
        args.questionParts.push(argument);
    }
  }

  if (!Number.isFinite(args.budget) || args.budget <= 0) {
    throw new Error('--budget must be a positive number');
  }

  if (!Number.isFinite(args.depth) || args.depth < 0) {
    throw new Error('--depth must be zero or greater');
  }

  if (!['compact', 'full'].includes(args.detail)) {
    throw new Error('--detail must be compact or full');
  }

  args.question = args.questionParts.join(' ').trim();
  return args;
}

function getPackage(filePath) {
  const match = filePath.match(/^packages\/([^/]+)\//);
  return match ? match[1] : null;
}

function hasTestEdge(edges) {
  return (edges || []).some((edge) => edge.type === 'tests' || edge.type === 'tested_by');
}

function isTestPath(filePath) {
  return /\.(test|spec)\.[jt]sx?$/.test(filePath) || filePath.includes('__tests__');
}

function buildEvidenceStateMap(repoRoot) {
  const stateMap = new Map();
  try {
    const readFiles = getReadFilesFromEvidence(repoRoot);
    for (const filePath of readFiles) {
      stateMap.set(filePath, 'read');
    }
    const log = readEvidenceLog(repoRoot);
    for (const event of log.events) {
      if (event.type === 'file.relevant' && event.file_path) {
        stateMap.set(event.file_path, 'relevant');
      } else if (event.type === 'file.irrelevant' && event.file_path) {
        stateMap.set(event.file_path, 'irrelevant');
      }
    }
  } catch {
    // no evidence state yet
  }
  return stateMap;
}

function toJsonResult(args, results, indexResult) {
  const evidenceState = buildEvidenceStateMap(indexResult.repoRoot);

  const enrichedResults = results.map((result, index) => {

    const typedEdges = (result.edges || []).map((edge) => ({
      path: edge.sourcePath === result.path ? edge.targetPath : edge.sourcePath,
      type: edge.type,
      symbol: edge.symbol || null,
    }));

    const base = {
      path: result.path,
      score: Number(result.score.toFixed(4)),
      retrieval_support: Number(getRankSupport(index + 1, calibration).toFixed(4)),
      calibration_status: calibration.status,
      symbol: result.bestChunkName || null,
      chunk_type: result.bestChunkType || null,
      file_outline: result.implementationNames || null,
      typed_edges: typedEdges,
      is_implementation: Boolean(result.hasClassOrFunction),
      file_size: result.fileSize || null,
      chunk_count: result.totalChunks || null,
      last_modified: result.lastModified || null,
      has_test: hasTestEdge(result.edges),
      package: getPackage(result.path),
      changed_in_branch: Boolean(result.changedInBranch),
      evidence_state: evidenceState.get(result.path) || null,
      reason: result.reason,
      preview: result.preview,
      graph_connections: Array.from(new Set(result.graphConnections || [])),
      graph_connection_count: result.graphConnectionCount || result.graphConnections?.length || 0,
      lines: {
        start: result.startLine,
        end: result.endLine,
      },
      score_parts: result.scoreParts || {},
    };

    return base;
  });

  return {
    query: args.question,
    budget: args.budget,
    results: enrichedResults,
    index_stats: {
      total_files: indexResult.stats.totalFiles,
      total_chunks: indexResult.stats.totalChunks,
      last_indexed: indexResult.stats.lastIndexed,
      last_full_index: indexResult.stats.lastFullIndex,
      cache_root: indexResult.stats.cacheRoot,
      files_indexed: indexResult.filesIndexed,
      chunks_embedded: indexResult.chunksEmbedded,
    },
  };
}

function printHuman(args, results, indexResult) {
  writeStdout(`explore: "${args.question}"`);
  writeStdout('');

  if (results.length === 0) {
    writeStdout('  no results');
    return;
  }

  results.forEach((result, index) => {
    const line = String(index + 1).padStart(2, ' ');
    const score = result.score.toFixed(2);
    writeStdout(`${line}. ${result.path} (${score}) - ${result.reason}`);
    if (result.preview) {
      writeStdout(`    ${result.preview}`);
    }
    for (const connection of (result.graphConnections || []).slice(0, 3)) {
      writeStdout(`    - connected: ${connection}`);
    }
  });

  writeStdout('');
  writeStdout(`index: ${indexResult.stats.totalFiles} files, ${indexResult.stats.totalChunks} chunks, ${indexResult.filesIndexed} files refreshed`);
}

function printPolicyHuman(policy) {
  writeStdout('');
  writeStdout(`readiness: ${policy.readiness}`);
  writeStdout(`edit-ready: ${policy.edit_ready ? 'yes' : 'no'}`);
  if (policy.dependency_map?.primary) {
    writeStdout(`hypothesis: ${policy.dependency_map.primary.root_path} (${policy.dependency_map.primary.support_state})`);
  }
  if (policy.uncertainty?.reasons?.length) {
    writeStdout(`uncertainty: ${policy.uncertainty.reasons.join('; ')}`);
  }
  if (policy.next_action) {
    const target = policy.next_action.path || policy.next_action.query || '';
    writeStdout(`next: ${policy.next_action.type}${target ? ` ${target}` : ''}`);
  }
}

function printVoiHuman(challenger) {
  if (!challenger) return;
  const candidate = challenger.research_candidate;
  const target = candidate?.path ? ` ${candidate.path}` : '';
  writeStdout(`voi-shadow: ${challenger.status}${candidate ? `; candidate ${candidate.type}${target}` : ''}; promotion ${challenger.promotion_eligible ? 'eligible' : 'blocked'}`);
}

function printPromotionGateHuman(gate) {
  if (!gate) return;
  const listed = Array.isArray(gate.blockers) ? gate.blockers.slice(0, 4) : [];
  const suffix = listed.length > 0
    ? '; blockers ' + listed.join(', ') + (gate.blockers.length > 4 ? ', ...' : '')
    : '';
  writeStdout('promotion-gate: ' + gate.status + '; target ' + gate.target + '; production-cutover no' + suffix);
}
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.question) {
    throw new Error('missing question');
  }

  let indexResult;
  let results;
  try {
    indexResult = await ensureIndex({
      cwd: process.env.CONSUELO_TOOL_CALLER_CWD || process.cwd(),
      json: args.json,
      reindex: args.reindex,
    });
    results = await retrieve(indexResult.store, indexResult.repoRoot, args.question, {
      budget: args.budget,
      changedFiles: indexResult.changedFiles,
      changedOnly: args.changedOnly,
      depth: args.depth,
      worktreeId: indexResult.worktreeId,
    });
  } catch {
    throw new Error('explore failed');
  }
  const payload = toJsonResult(args, results, indexResult);
  const previousState = readExploreState(indexResult.repoRoot) || {};
  const shouldPreserveHypotheses = previousState.query === args.question && previousState.hypothesis_version === 1;
  const hypotheses = buildInvestigationHypotheses(payload.results, shouldPreserveHypotheses ? previousState.hypotheses : []);
  const nextState = {
    ...payload,
    hypothesis_version: 1,
    hypotheses,
    hypothesis_event_ids: shouldPreserveHypotheses ? previousState.hypothesis_event_ids || [] : [],
    branch: indexResult.branch,
    mode: 'exploring',
    worktree_id: indexResult.worktreeId,
    updated_at: new Date().toISOString(),
  };

  appendEvidenceEvent(indexResult.repoRoot, {
    type: 'explore.result',
    source: 'explore',
    question: args.question,
    action: 'explore',
    status: results.length > 0 ? 'found' : 'empty',
    confidence_delta: results.length > 0 ? 0.1 : -0.05,
    worktree_id: indexResult.worktreeId,
    details: {
      budget: args.budget,
      depth: args.depth,
      changed_only: args.changedOnly,
      result_count: results.length,
      results: payload.results.map((result) => ({
        path: result.path,
        score: result.score,
        reason: result.reason,
        lines: result.lines,
      })),
      index_stats: payload.index_stats,
    },
  }, { requireMirror: true });

  const events = getEvidenceEvents(indexResult.repoRoot);
  const state = updateHypothesesWithEvents(nextState, events);
  const policy = evaluateExplorePolicy(state, events);
  const challengerConfiguration = promotionEvidence.challengerConfiguration || {};
  const configuredUtilityRates = challengerConfiguration.status === 'frozen_challenger_configuration'
    && challengerConfiguration.frozen === true
    ? challengerConfiguration.utilityRates
    : undefined;
  let voiChallenger;
  try {
    voiChallenger = evaluateExploreVoiChallenger({
      state,
      controlPolicy: policy,
      calibration,
      costModel: readCostModel,
      utilityRates: configuredUtilityRates,
    });
  } catch (error /* unknown */) {
    const message = error instanceof Error ? error.message : String(error);
    voiChallenger = {
      voi_version: 1,
      method: 'myopic-empirical-voi-proxy',
      status: 'error',
      promotion_eligible: false,
      control_action: policy.next_action || null,
      research_candidate: null,
      recommended_replacement: null,
      agreement: null,
      net_voi: null,
      reason: `shadow evaluator failed: ${message}`,
    };
  }

  try {
    appendEvidenceEvent(indexResult.repoRoot, {
      type: 'explore.voi.shadow',
      source: 'explore',
      question: args.question,
      action: 'voi-shadow',
      status: voiChallenger.status,
      confidence_delta: 0,
      worktree_id: indexResult.worktreeId,
      details: {
        voi_version: voiChallenger.voi_version,
        method: voiChallenger.method,
        control_action: voiChallenger.control_action,
        research_candidate: voiChallenger.research_candidate ? {
          type: voiChallenger.research_candidate.type,
          path: voiChallenger.research_candidate.path,
          expected_proxy_gain: voiChallenger.research_candidate.expected_proxy_gain,
        } : null,
        promotion_eligible: voiChallenger.promotion_eligible,
        challenger_configuration_id: challengerConfiguration.configurationId || null,
        utility_profile_id: challengerConfiguration.utilityProfileId || null,
        agreement: voiChallenger.agreement,
        net_voi: voiChallenger.net_voi,
      },
    }, { requireMirror: true });
  } catch (error /* unknown */) {
    writeStderr(`explore: VOI shadow logging failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  let promotionGate;
  try {
    const promotionEvents = getEvidenceEvents(indexResult.repoRoot);
    promotionGate = evaluateExplorePromotionGate({
      challengerConfiguration,
      localChallenger: voiChallenger,
      costModel: readCostModel,
      calibration,
      benchmarkEvidence: promotionEvidence,
      shadowEvidence: promotionEvidence.shadowEvidence,
      localShadowEvents: promotionEvents,
      criteria: promotionCriteria,
    });
  } catch (error /* unknown */) {
    const message = error instanceof Error ? error.message : String(error);
    promotionGate = {
      gate_version: 1,
      method: 'prespecified-paired-sign-test-gate',
      status: 'blocked',
      target: 'controlled_trial',
      promotion_eligible: false,
      production_cutover: false,
      control_remains_authoritative: true,
      blockers: ['gate_evaluator_error'],
      reason: 'promotion gate failed closed: ' + message,
      challenger_configuration: null,
      local_challenger: null,
      benchmark: null,
      shadow: null,
      local_shadow: null,
    };
  }

  try {
    appendEvidenceEvent(indexResult.repoRoot, {
      type: 'explore.promotion.gate',
      source: 'explore',
      question: args.question,
      action: 'promotion-gate',
      status: promotionGate.status,
      confidence_delta: 0,
      worktree_id: indexResult.worktreeId,
      details: {
        gate_version: promotionGate.gate_version,
        method: promotionGate.method,
        target: promotionGate.target,
        promotion_eligible: promotionGate.promotion_eligible,
        production_cutover: false,
        blockers: promotionGate.blockers,
        challenger_configuration: promotionGate.challenger_configuration ? {
          status: promotionGate.challenger_configuration.status,
          frozen: promotionGate.challenger_configuration.frozen,
          configuration_id: promotionGate.challenger_configuration.configuration_id,
          utility_profile_id: promotionGate.challenger_configuration.utility_profile_id,
          utility_scale_present: promotionGate.challenger_configuration.utility_scale_present,
          utility_scale_valid: promotionGate.challenger_configuration.utility_scale_valid,
          utility_scale_non_degenerate: promotionGate.challenger_configuration.utility_scale_non_degenerate,
          read_cost_model_ready: promotionGate.challenger_configuration.read_cost_model_ready,
        } : null,
        local_challenger: promotionGate.local_challenger,
        benchmark: promotionGate.benchmark ? {
          independent_case_count: promotionGate.benchmark.independent_case_count,
          evaluated_case_count: promotionGate.benchmark.evaluated_case_count,
          relevance: promotionGate.benchmark.relevance,
          required_node: promotionGate.benchmark.required_node,
        } : null,
        shadow: promotionGate.shadow,
        local_shadow: promotionGate.local_shadow ? {
          observation_count: promotionGate.local_shadow.observation_count,
          distinct_question_count: promotionGate.local_shadow.distinct_question_count,
          error_count: promotionGate.local_shadow.error_count,
          authority_violation_count: promotionGate.local_shadow.authority_violation_count,
        } : null,
      },
    }, { requireMirror: true });
  } catch (error /* unknown */) {
    writeStderr('explore: promotion gate logging failed: ' + (error instanceof Error ? error.message : String(error)));
  }

  const statePath = writeExploreState(indexResult.repoRoot, {
    ...state,
    policy_snapshot: policy,
    voi_challenger_snapshot: voiChallenger,
    promotion_gate_snapshot: promotionGate,
    updated_at: new Date().toISOString(),
  });
  const outputPayload = { ...payload, policy, voi_challenger: voiChallenger, promotion_gate: promotionGate };

  if (args.json) {
    writeStdout(JSON.stringify(formatExploreOutput(outputPayload, args.detail), null, 2));
  } else {
    printHuman(args, results, indexResult);
    printPolicyHuman(policy);
    printVoiHuman(voiChallenger);
    printPromotionGateHuman(promotionGate);
    writeStdout(`state: ${statePath}`);
  }
}

main().catch((error) => {
  writeStderr(error instanceof Error ? error.message : 'unknown error');
  process.exit(1);
});
