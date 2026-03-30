import { isNonEmptyString } from '@sniptt/guards';
import posthog from 'posthog-js';

type PostHogInitInput = {
  apiKey: string;
  host: string;
};

type PostHogIdentifyInput = {
  distinctId: string;
  email?: string | null;
  workspaceId?: string | null;
  workspaceMemberId?: string | null;
};

let isPostHogInitialized = false;

export const initPostHog = ({ apiKey, host }: PostHogInitInput) => {
  if (isPostHogInitialized || !isNonEmptyString(apiKey)) {
    return;
  }

  posthog.init(apiKey, {
    api_host: host,
    autocapture: true,
    capture_pageleave: true,
    capture_pageview: true,
    person_profiles: 'identified_only',
    defaults: '2026-01-30',
  });

  isPostHogInitialized = true;
};

export const identifyPostHogUser = ({
  distinctId,
  email,
  workspaceId,
  workspaceMemberId,
}: PostHogIdentifyInput) => {
  if (!isPostHogInitialized) {
    return;
  }

  posthog.identify(distinctId, {
    email: email ?? undefined,
    workspaceId: workspaceId ?? undefined,
    workspaceMemberId: workspaceMemberId ?? undefined,
  });

  if (isNonEmptyString(workspaceId)) {
    posthog.group('workspace', workspaceId);
  }
};

export const capturePostHogEvent = (
  eventName: string,
  properties: Record<string, unknown> = {},
) => {
  if (!isPostHogInitialized) {
    return;
  }

  posthog.capture(eventName, properties);
};

export const resetPostHog = () => {
  if (!isPostHogInitialized) {
    return;
  }

  posthog.reset();
};
