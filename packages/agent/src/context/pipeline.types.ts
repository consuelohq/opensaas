// risk factor identifiers used in deal scoring
export type RiskFactorId =
  | 'stage_duration'
  | 'engagement'
  | 'deal_size'
  | 'champion_status'
  | 'competitor';

export type RiskFactor = {
  id: RiskFactorId;
  label: string;
  score: number;
  weight: number;
};

export type DealRiskScore = {
  dealId: string;
  dealName: string;
  stage: string;
  riskScore: number;
  factors: RiskFactor[];
  value: number;
};

export type DealVelocity = {
  dealId: string;
  daysInCurrentStage: number;
  averageDaysForStage: number;
  ratio: number;
};

export type HealthLabel = 'healthy' | 'warning' | 'critical';

export type PipelineHealth = {
  score: number;
  label: HealthLabel;
  totalDeals: number;
  forecastedRevenue: number;
  insights: string[];
};

export type DealChangeType = 'stage_change' | 'amount_change' | 'close_date_change' | 'new_deal';

export type DealChange = {
  dealId: string;
  dealName: string;
  changeType: DealChangeType;
  detail: string;
  changedAt: Date;
};

export type PipelineContext = {
  health: PipelineHealth;
  topRisks: DealRiskScore[];
  recentChanges: DealChange[];
};

// input types for pure functions
export type DealInput = {
  id: string;
  name: string;
  stage: string;
  value: number;
  closeDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  daysInCurrentStage: number;
  daysSinceLastInteraction: number;
  hasChampion: boolean;
  hasFriendlyContact: boolean;
  hasCompetitor: boolean;
  hasActiveCompetitor: boolean;
};

export type StageAverage = {
  stage: string;
  averageDays: number;
  probability: number;
};
