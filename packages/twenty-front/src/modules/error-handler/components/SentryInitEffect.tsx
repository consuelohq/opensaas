import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { sentryConfigState } from '@/client-config/states/sentryConfigState';
import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

const SENTRY_EVENT_DEDUPLICATION_WINDOW_IN_MS = 15_000;

const SENTRY_IGNORED_ERRORS = [
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed with undelivered notifications.',
  'Non-Error promise rejection captured',
  'Network request failed',
];

type SentryEventForFiltering = {
  message?: string;
  exception?: {
    values?: Array<{
      type?: string;
      value?: string;
    }>;
  };
};

const recentSentryEvents = new Map<string, number>();

const getSentryEventKey = (event: SentryEventForFiltering) => {
  const exceptionValue = event.exception?.values?.[0];

  if (isNonEmptyString(exceptionValue?.value)) {
    return `${exceptionValue?.type ?? 'error'}:${exceptionValue.value}`;
  }

  if (isNonEmptyString(event.message)) {
    return `message:${event.message}`;
  }

  return null;
};

const isDuplicateSentryEvent = (event: SentryEventForFiltering) => {
  const eventKey = getSentryEventKey(event);

  if (!isNonEmptyString(eventKey)) {
    return false;
  }

  const now = Date.now();
  const previousTimestamp = recentSentryEvents.get(eventKey);

  for (const [storedKey, timestamp] of recentSentryEvents.entries()) {
    if (now - timestamp > SENTRY_EVENT_DEDUPLICATION_WINDOW_IN_MS) {
      recentSentryEvents.delete(storedKey);
    }
  }

  recentSentryEvents.set(eventKey, now);

  return (
    isDefined(previousTimestamp) &&
    now - previousTimestamp < SENTRY_EVENT_DEDUPLICATION_WINDOW_IN_MS
  );
};

export const SentryInitEffect = () => {
  const sentryConfig = useRecoilValue(sentryConfigState);

  const currentUser = useRecoilValue(currentUserState);
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);

  const [isSentryInitialized, setIsSentryInitialized] = useState(false);
  const [isSentryInitializing, setIsSentryInitializing] = useState(false);
  const [isSentryUserDefined, setIsSentryUserDefined] = useState(false);

  useEffect(() => {
    const initializeSentry = async () => {
      if (
        isNonEmptyString(sentryConfig?.dsn) &&
        !isSentryInitialized &&
        !isSentryInitializing
      ) {
        setIsSentryInitializing(true);

        try {
          const {
            feedbackIntegration,
            init,
            browserTracingIntegration,
            replayIntegration,
            globalHandlersIntegration,
          } = await import('@sentry/react');

          init({
            environment: sentryConfig?.environment ?? undefined,
            release: sentryConfig?.release ?? undefined,
            dsn: sentryConfig?.dsn,
            integrations: [
              browserTracingIntegration({}),
              replayIntegration(),
              feedbackIntegration({
                autoInject: false,
                colorScheme: 'system',
              }),
              globalHandlersIntegration({
                onunhandledrejection: false, // handled in PromiseRejectionEffect
              }),
            ],
            ignoreErrors: SENTRY_IGNORED_ERRORS,
            sampleRate: 0.35,
            tracePropagationTargets: [
              'localhost:3001',
              REACT_APP_SERVER_BASE_URL,
            ],
            tracesSampleRate: 0.1,
            replaysSessionSampleRate: 0,
            replaysOnErrorSampleRate: 0.15,
            beforeSend: (event) => {
              if (isDuplicateSentryEvent(event)) {
                return null;
              }

              return event;
            },
          });

          setIsSentryInitialized(true);
        } catch (_err: unknown) {
        } finally {
          setIsSentryInitializing(false);
        }
      }
    };

    const updateSentryUser = async () => {
      if (
        isSentryInitialized &&
        isDefined(currentUser) &&
        !isSentryUserDefined
      ) {
        try {
          const { setUser } = await import('@sentry/react');
          setUser({
            email: currentUser?.email,
            id: currentUser?.id,
            workspaceId: currentWorkspace?.id,
            workspaceMemberId: currentWorkspaceMember?.id,
          });
          setIsSentryUserDefined(true);
        } catch (_err: unknown) {}
      } else if (!isDefined(currentUser) && isSentryInitialized) {
        try {
          const { setUser } = await import('@sentry/react');
          setUser(null);
          setIsSentryUserDefined(false);
        } catch (_err: unknown) {}
      }
    };

    initializeSentry();
    updateSentryUser();
  }, [
    sentryConfig,
    isSentryInitialized,
    isSentryInitializing,
    currentUser,
    currentWorkspace,
    currentWorkspaceMember,
    isSentryUserDefined,
  ]);

  return <></>;
};
