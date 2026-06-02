import { gql } from '@apollo/client';

export const START_DIALER_CALL = gql`
  mutation StartDialerCall($input: StartDialerCallInput!) {
    startDialerCall(input: $input) {
      sessionId
      twilioGroupId
      queueId
      selectionStrategy
      requestedFanout
      actualFanout
      status
      capacity {
        requestedFanout
        callableTargetCount
        availableCallerIdCount
        reducedCapacityReasons
        blockedReasons
        actualFanout
      }
      calls {
        callSid
        contactId
        customerNumber
        callerId
        status
        position
      }
    }
  }
`;

export const TERMINATE_DIALER_CALL = gql`
  mutation TerminateDialerCall($input: TerminateDialerCallInput!) {
    terminateDialerCall(input: $input) {
      twilioGroupId
      status
    }
  }
`;
