import type {
  DealInput,
  DealRiskScore,
  HealthLabel,
  PipelineContext,
  PipelineHealth,
  RiskFactor,
  StageAverage,
} from './pipeline.types.js';

// --- risk factor weights (must sum to 1.0) ---

const WEIGHTS: Record<string, number> = {
  stage_duration: 0.30,
  engagement: 0.25,
  deal_size: 0.15,
  champion_status: 0.15,
  competitor: 0.15,
};

// --- individual factor scoring ---

const scoreStageDuration = (daysInStage: number, avgDays: number): number => {
  if (avgDays <= 0) return 0;
  const ratio = daysInStage / avgDays;

  return Math.min(100, Math.max(0, (ratio - 1) * 50));
};

const scoreEngagement = (daysSinceLastInteraction: number): number =>
  Math.min(100, (daysSinceLastInteraction / 30) * 100);

const scoreDealSize = (dealValue: number, pipelineAvgValue: number): number => {
  if (pipelineAvgValue <= 0) return 0;
  const ratio = dealValue / pipelineAvgValue;

  return Math.min(100, ratio * 33);
};

const scoreChampion = (hasChampion: boolean, hasFriendlyContact: boolean): number => {
  if (hasChampion) return 0;
  if (hasFriendlyContact) return 50;

  return 100;
};

const scoreCompetitor = (hasCompetitor: boolean, hasActiveCompetitor: boolean): number => {
  if (!hasCompetitor) return 0;
  if (hasActiveCompetitor) return 100;

  return 50;
};

// --- main scoring functions ---

export const scoreDeal = (
  deal: DealInput,
  stageAverages: StageAverage[],
  pipelineAvgValue: number,
): DealRiskScore => {
  const stageAvg = stageAverages.find((s) => s.stage === deal.stage);
  const avgDays = stageAvg?.averageDays ?? 30;

  const factors: RiskFactor[] = [
    {
      id: 'stage_duration',
      label: 'Stage duration',
      score: scoreStageDuration(deal.daysInCurrentStage, avgDays),
      weight: WEIGHTS.stage_duration,
    },
    {
      id: 'engagement',
      label: 'Engagement recency',
      score: scoreEngagement(deal.daysSinceLastInteraction),
      weight: WEIGHTS.engagement,
    },
    {
      id: 'deal_size',
      label: 'Deal size risk',
      score: scoreDealSize(deal.value, pipelineAvgValue),
      weight: WEIGHTS.deal_size,
    },
    {
      id: 'champion_status',
      label: 'Champion status',
      score: scoreChampion(deal.hasChampion, deal.hasFriendlyContact),
      weight: WEIGHTS.champion_status,
    },
    {
      id: 'competitor',
      label: 'Competitive pressure',
      score: scoreCompetitor(deal.hasCompetitor, deal.hasActiveCompetitor),
      weight: WEIGHTS.competitor,
    },
  ];

  const riskScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);

  return {
    dealId: deal.id,
    dealName: deal.name,
    stage: deal.stage,
    riskScore: Math.round(riskScore),
    factors,
    value: deal.value,
  };
};

export const scorePipeline = (
  deals: DealInput[],
  stageAverages: StageAverage[],
): DealRiskScore[] => {
  if (deals.length === 0) return [];

  const pipelineAvgValue =
    deals.reduce((sum, d) => sum + d.value, 0) / deals.length;

  return deals.map((deal) => scoreDeal(deal, stageAverages, pipelineAvgValue));
};

const getHealthLabel = (score: number): HealthLabel => {
  if (score >= 80) return 'healthy';
  if (score >= 50) return 'warning';

  return 'critical';
};

export const computeHealth = (
  riskScores: DealRiskScore[],
  stageAverages: StageAverage[],
): PipelineHealth => {
  if (riskScores.length === 0) {
    return {
      score: 100,
      label: 'healthy',
      totalDeals: 0,
      forecastedRevenue: 0,
      insights: ['No open deals in pipeline'],
    };
  }

  const avgRisk =
    riskScores.reduce((sum, d) => sum + d.riskScore, 0) / riskScores.length;
  const score = Math.round(100 - avgRisk);

  const stageProb = new Map(stageAverages.map((s) => [s.stage, s.probability]));
  const forecastedRevenue = riskScores.reduce((sum, d) => {
    const prob = stageProb.get(d.stage) ?? 0.5;

    return sum + d.value * prob;
  }, 0);

  const insights = generateInsights(riskScores, score);

  return {
    score,
    label: getHealthLabel(score),
    totalDeals: riskScores.length,
    forecastedRevenue: Math.round(forecastedRevenue),
    insights,
  };
};

export const generateInsights = (
  riskScores: DealRiskScore[],
  healthScore: number,
): string[] => {
  const insights: string[] = [];

  const highRisk = riskScores.filter((d) => d.riskScore >= 70);

  if (highRisk.length > 0) {
    insights.push(
      `${highRisk.length} deal${highRisk.length > 1 ? 's' : ''} at high risk (score >= 70)`,
    );
  }

  // find most common top risk factor across all deals
  const factorCounts = new Map<string, number>();

  for (const deal of riskScores) {
    const topFactor = deal.factors.reduce((max, f) =>
      f.score * f.weight > max.score * max.weight ? f : max,
    );

    factorCounts.set(
      topFactor.label,
      (factorCounts.get(topFactor.label) ?? 0) + 1,
    );
  }

  let topFactorLabel = '';
  let topFactorCount = 0;

  for (const [label, count] of factorCounts) {
    if (count > topFactorCount) {
      topFactorLabel = label;
      topFactorCount = count;
    }
  }

  if (topFactorLabel && topFactorCount > 1) {
    insights.push(
      `${topFactorLabel} is the top risk factor across ${topFactorCount} deals`,
    );
  }

  if (healthScore < 50) {
    insights.push('Pipeline health is critical — review stalled deals');
  } else if (healthScore < 80) {
    insights.push('Pipeline health needs attention — some deals showing risk');
  }

  return insights.slice(0, 3);
};

export const buildPipelineContext = (
  deals: DealInput[],
  stageAverages: StageAverage[],
  recentChanges: PipelineContext['recentChanges'],
): PipelineContext => {
  const riskScores = scorePipeline(deals, stageAverages);
  const health = computeHealth(riskScores, stageAverages);

  // top risks sorted by score descending
  const topRisks = [...riskScores]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);

  return { health, topRisks, recentChanges };
};
