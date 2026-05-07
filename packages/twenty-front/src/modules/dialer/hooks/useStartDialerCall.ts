import { useMutation } from '@apollo/client';

import {
  START_DIALER_CALL,
  TERMINATE_DIALER_CALL,
} from '@/dialer/graphql/mutations/startDialerCall';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';

export type StartDialerCallInput = {
  source: 'direct' | 'queue';
  selectionStrategy: 'single' | 'predictive';
  requestedFanout: number;
  targetPhone?: string;
  contactId?: string;
  queueId?: string;
  callerIdNumber?: string;
};

export type DialerCallStartCall = {
  callSid: string;
  contactId: string;
  customerNumber: string;
  callerId: string;
  status: string;
  position: number;
};

export type DialerCallStartResult = {
  sessionId: string;
  twilioGroupId: string | null;
  queueId: string;
  selectionStrategy: string;
  requestedFanout: number;
  actualFanout: number;
  status: string;
  capacity: {
    requestedFanout: number;
    callableTargetCount: number;
    availableCallerIdCount: number;
    reducedCapacityReasons: string[];
    blockedReasons: string[];
    actualFanout: number;
  };
  calls: DialerCallStartCall[];
};

type StartDialerCallMutation = {
  startDialerCall: DialerCallStartResult;
};

type StartDialerCallMutationVariables = {
  input: StartDialerCallInput;
};

type TerminateDialerCallMutation = {
  terminateDialerCall: {
    twilioGroupId: string;
    status: string;
  };
};

type TerminateDialerCallMutationVariables = {
  input: {
    twilioGroupId: string;
  };
};

export const useStartDialerCall = () => {
  const apolloCoreClient = useApolloCoreClient();
  const [mutate] = useMutation<
    StartDialerCallMutation,
    StartDialerCallMutationVariables
  >(START_DIALER_CALL, {
    client: apolloCoreClient,
  });
  const [terminateMutate] = useMutation<
    TerminateDialerCallMutation,
    TerminateDialerCallMutationVariables
  >(TERMINATE_DIALER_CALL, {
    client: apolloCoreClient,
  });

  const startDialerCall = async (
    input: StartDialerCallInput,
  ): Promise<DialerCallStartResult> => {
    const result = await mutate({
      variables: {
        input,
      },
    });

    if (!result.data?.startDialerCall) {
      throw new Error('startDialerCall returned no result');
    }

    return result.data.startDialerCall;
  };

  return {
    startDialerCall,
    terminateDialerCall: async (twilioGroupId: string) => {
      const result = await terminateMutate({
        variables: {
          input: {
            twilioGroupId,
          },
        },
      });

      if (!result.data?.terminateDialerCall) {
        throw new Error('terminateDialerCall returned no result');
      }

      return result.data.terminateDialerCall;
    },
  };
};
