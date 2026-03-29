import { useEffect } from 'react';
import { useRecoilValue } from 'recoil';

import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import {
  identifyPostHogUser,
  initPostHog,
  resetPostHog,
} from '@/telemetry/lib/posthog';
import { isDefined } from 'twenty-shared/utils';
import { POSTHOG_API_KEY, POSTHOG_HOST } from '~/config';

export const PostHogInitEffect = () => {
  const currentUser = useRecoilValue(currentUserState);
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);

  useEffect(() => {
    initPostHog({
      apiKey: POSTHOG_API_KEY,
      host: POSTHOG_HOST,
    });
  }, []);

  useEffect(() => {
    if (!isDefined(currentUser)) {
      resetPostHog();
      return;
    }

    identifyPostHogUser({
      distinctId: currentUser.id,
      email: currentUser.email,
      workspaceId: currentWorkspace?.id,
      workspaceMemberId: currentWorkspaceMember?.id,
    });
  }, [currentUser, currentWorkspace, currentWorkspaceMember]);

  return null;
};
