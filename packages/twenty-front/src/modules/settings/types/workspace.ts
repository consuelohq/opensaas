export type TeamRole = 'owner' | 'admin' | 'member';

export type MemberStatus = 'active' | 'pending' | 'suspended';

export type PlanTier = 'free' | 'pro' | 'team' | 'enterprise';

export type BillingStatus = 'active' | 'past_due' | 'canceled' | 'trialing';

export type WorkspaceBranding = {
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string;
  companyName: string;
  supportEmail: string;
  customDomain: string | null;
};

export type TeamMember = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: TeamRole;
  status: MemberStatus;
  invitedAt: string;
  lastActiveAt: string | null;
};

export type UsageMetric = {
  used: number;
  limit: number;
};

export type BillingInfo = {
  plan: PlanTier;
  status: BillingStatus;
  currentPeriodEnd: string;
  seats: UsageMetric;
  usage: {
    calls: UsageMetric;
    minutes: UsageMetric;
    storage: UsageMetric; // bytes
  };
  stripeCustomerId: string | null;
};

export type WorkspaceLimits = {
  maxSeats: number;
  maxCallsPerMonth: number;
  maxMinutesPerMonth: number;
  maxStorageBytes: number;
  features: string[];
};

export type WorkspaceConfig = {
  id: string;
  name: string;
  slug: string;
  branding: WorkspaceBranding;
  team: TeamMember[];
  billing: BillingInfo;
  limits: WorkspaceLimits;
};

export const ROLE_PERMISSIONS: Record<TeamRole, string[]> = {
  owner: ['*'],
  admin: ['manage_team', 'manage_settings', 'manage_billing', 'make_calls', 'view_analytics'],
  member: ['make_calls', 'view_contacts', 'view_own_analytics'],
};

export const ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  owner: 'Full access to everything, including deleting the workspace',
  admin: 'Can manage team, settings, and billing',
  member: 'Can make calls and manage their own contacts',
};

export const DEFAULT_BRANDING: WorkspaceBranding = {
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#000000',
  accentColor: '#0066FF',
  companyName: '',
  supportEmail: '',
  customDomain: null,
};

export const DEFAULT_BILLING: BillingInfo = {
  plan: 'free',
  status: 'active',
  currentPeriodEnd: '',
  seats: { used: 1, limit: 1 },
  usage: {
    calls: { used: 0, limit: 100 },
    minutes: { used: 0, limit: 60 },
    storage: { used: 0, limit: 104857600 }, // 100MB
  },
  stripeCustomerId: null,
};

export const DEFAULT_LIMITS: WorkspaceLimits = {
  maxSeats: 1,
  maxCallsPerMonth: 100,
  maxMinutesPerMonth: 60,
  maxStorageBytes: 104857600,
  features: ['Basic calling', 'Contact management'],
};

export const DEFAULT_WORKSPACE: WorkspaceConfig = {
  id: '',
  name: '',
  slug: '',
  branding: DEFAULT_BRANDING,
  team: [],
  billing: DEFAULT_BILLING,
  limits: DEFAULT_LIMITS,
};

export const WORKSPACE_STORAGE_KEY = 'consuelo_workspace';
