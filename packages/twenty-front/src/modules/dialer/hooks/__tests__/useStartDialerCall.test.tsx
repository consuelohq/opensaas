import { MockedProvider } from '@apollo/client/testing';
import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';

import {
  START_DIALER_CALL,
  TERMINATE_DIALER_CALL,
} from '@/dialer/graphql/mutations/startDialerCall';
import {
  type StartDialerCallInput,
  useStartDialerCall,
} from '@/dialer/hooks/useStartDialerCall';

jest.mock('@/object-metadata/hooks/useApolloCoreClient', () => ({
  useApolloCoreClient: () => {
    throw new Error('useStartDialerCall must use the metadata Apollo client');
  },
}));

const startInput: StartDialerCallInput = {
  source: 'direct',
  selectionStrategy: 'single',
  requestedFanout: 1,
  targetPhone: 'target-redacted',
  callerIdNumber: 'caller-redacted',
};

const startResult = {
  sessionId: 'session-test',
  twilioGroupId: 'group-test',
  queueId: 'queue-test',
  selectionStrategy: 'single',
  requestedFanout: 1,
  actualFanout: 1,
  status: 'dialing',
  capacity: {
    requestedFanout: 1,
    callableTargetCount: 1,
    availableCallerIdCount: 1,
    reducedCapacityReasons: [],
    blockedReasons: [],
    actualFanout: 1,
  },
  calls: [
    {
      callSid: 'call-test',
      contactId: 'contact-test',
      customerNumber: 'target-redacted',
      callerId: 'caller-redacted',
      status: 'dialing',
      position: 1,
    },
  ],
};

const renderUseStartDialerCall = () =>
  renderHook(() => useStartDialerCall(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MockedProvider
        addTypename={false}
        mocks={[
          {
            request: {
              query: START_DIALER_CALL,
              variables: { input: startInput },
            },
            result: { data: { startDialerCall: startResult } },
          },
          {
            request: {
              query: TERMINATE_DIALER_CALL,
              variables: { input: { twilioGroupId: 'group-test' } },
            },
            result: {
              data: {
                terminateDialerCall: {
                  twilioGroupId: 'group-test',
                  status: 'terminated',
                },
              },
            },
          },
        ]}
      >
        {children}
      </MockedProvider>
    ),
  });

describe('useStartDialerCall', () => {
  it('runs start and terminate mutations through the active metadata Apollo provider', async () => {
    const { result } = renderUseStartDialerCall();

    let startResponse: Awaited<
      ReturnType<typeof result.current.startDialerCall>
    > | null = null;
    let terminateResponse: Awaited<
      ReturnType<typeof result.current.terminateDialerCall>
    > | null = null;

    await act(async () => {
      startResponse = await result.current.startDialerCall(startInput);
    });

    await act(async () => {
      terminateResponse =
        await result.current.terminateDialerCall('group-test');
    });

    expect(startResponse).toEqual(startResult);
    expect(terminateResponse).toEqual({
      twilioGroupId: 'group-test',
      status: 'terminated',
    });
  });
});
