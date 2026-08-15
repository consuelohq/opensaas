import {
  type AuthProviders,
  type FeatureFlagKey,
} from '~/generated-metadata/graphql';

export type ApiConfig = {
  mutationMaximumAffectedRecords: number;
};

export type BillingTrialPeriod = {
  duration: number;
  isCreditCardRequired: boolean;
};

export type Billing = {
  billingUrl?: string | null;
  isBillingEnabled: boolean;
  trialPeriods: BillingTrialPeriod[];
};

export enum CaptchaDriverType {
  GOOGLE_RECAPTCHA = 'GOOGLE_RECAPTCHA',
  TURNSTILE = 'TURNSTILE',
}

export type Captcha = {
  provider?: CaptchaDriverType | null;
  siteKey?: string | null;
};

export type NativeModelCapabilities = {
  twitterSearch?: boolean | null;
  webSearch?: boolean | null;
};

export type ClientAiModelProvider =
  | 'none'
  | 'openai'
  | 'anthropic'
  | 'open_ai_compatible'
  | 'xai'
  | 'groq';

export type ClientAiModelConfig = {
  deprecated?: boolean | null;
  inputCostPer1kTokensInCredits: number;
  label: string;
  modelId: string;
  nativeCapabilities?: NativeModelCapabilities | null;
  outputCostPer1kTokensInCredits: number;
  provider: ClientAiModelProvider;
};

export type PublicFeatureFlagMetadata = {
  description: string;
  imagePath?: string | null;
  label: string;
};

export type PublicFeatureFlag = {
  key: FeatureFlagKey;
  metadata: PublicFeatureFlagMetadata;
};

export type Sentry = {
  dsn?: string | null;
  environment?: string | null;
  release?: string | null;
};

export enum SupportDriver {
  FRONT = 'FRONT',
  NONE = 'NONE',
}

export type Support = {
  supportDriver: SupportDriver;
  supportFrontChatId?: string | null;
};

export type ClientConfig = {
  appVersion?: string;
  aiModels: Array<ClientAiModelConfig>;
  analyticsEnabled: boolean;
  api: ApiConfig;
  authProviders: AuthProviders;
  billing: Billing;
  calendarBookingPageId?: string;
  canManageFeatureFlags: boolean;
  captcha: Captcha;
  chromeExtensionId?: string;
  defaultSubdomain?: string;
  frontDomain: string;
  isAttachmentPreviewEnabled: boolean;
  isConfigVariablesInDbEnabled: boolean;
  isEmailVerificationRequired: boolean;
  isGoogleCalendarEnabled: boolean;
  isGoogleMessagingEnabled: boolean;
  isMicrosoftCalendarEnabled: boolean;
  isMicrosoftMessagingEnabled: boolean;
  isMultiWorkspaceEnabled: boolean;
  isImapSmtpCaldavEnabled: boolean;
  isEmailingDomainsEnabled: boolean;
  isCloudflareIntegrationEnabled: boolean;
  isClickHouseConfigured: boolean;
  publicFeatureFlags: Array<PublicFeatureFlag>;
  sentry: Sentry;
  signInPrefilled: boolean;
  support: Support;
  isTwoFactorAuthenticationEnabled: boolean;
  allowRequestsToTwentyIcons: boolean;
};
